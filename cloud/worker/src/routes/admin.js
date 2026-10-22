/** Admin API. Every handler validates session + role; mutations also require CSRF. */
import { json, fail, readJson, isAllowedOrigin } from '../lib/http.js';
import { requireAdmin, verifyLogin, revokeSession, clearCookieHeaders, bootstrapAdmin, sessionResponse } from '../lib/auth.js';
import { nowIso, secondsToDisplay } from '../lib/ids.js';
import { enqueueJob } from '../db/jobs.js';
import { markDeleted, cleanupTrack } from '../jobs/cleanup.js';
import { importTrack } from '../jobs/import.js';
import { checkAccount, authorizeUrl, exchangeCode, storeAccount } from '../services/dropbox.js';
import { telegram } from '../services/telegram.js';
import { registerWebhook } from './telegram.js';
import { healthReport } from './health.js';

const EDITABLE = ['title', 'artist', 'album', 'year', 'genre', 'language', 'duration_seconds'];

function audit(db, adminId, action, target, detail = null) {
  return db
    .prepare('INSERT INTO audit_log (id, admin_id, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), adminId, action, target, detail ? JSON.stringify(detail) : null)
    .run();
}

export async function handleAdmin(request, env, path, method) {
  const db = env.DB;

  if (path === '/api/admin/bootstrap' && method === 'POST') {
    if (!env.ADMIN_BOOTSTRAP_TOKEN) return fail(503, 'disabled', 'bootstrap disabled: ADMIN_BOOTSTRAP_TOKEN not set');
    const body = await readJson(request);
    const header = request.headers.get('x-bootstrap-token');
    if (!header || header !== env.ADMIN_BOOTSTRAP_TOKEN) return fail(403, 'forbidden', 'invalid bootstrap token');
    const result = await bootstrapAdmin(db, env, { username: body.username, password: body.password });
    if (!result.ok) return fail(400, 'bootstrap_failed', result.error);
    return json({ ok: true });
  }

  if (path === '/api/admin/login' && method === 'POST') {
    if (!isAllowedOrigin(request, env)) return fail(403, 'origin_not_allowed', 'origin is not allowlisted');
    const body = await readJson(request);
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const result = await verifyLogin(db, env, { username: body.username, password: body.password, ip });
    if (!result.ok) return fail(result.status, result.error, 'login failed');
    return json(
      { ok: true, csrfToken: result.csrfToken },
      { headers: { 'set-cookie': result.headers } }
    );
  }

  if (path === '/api/admin/logout' && method === 'POST') {
    const guard = await requireAdmin(db, request, { mutating: true });
    if (guard.error) return guard.error;
    await revokeSession(db, request);
    return json({ ok: true }, { headers: { 'set-cookie': clearCookieHeaders() } });
  }

  if (path === '/api/admin/me' && method === 'GET') {
    const guard = await requireAdmin(db, request);
    if (guard.error) return guard.error;
    return sessionResponse(guard.session);
  }

  // --- everything below is authenticated ---
  const mutating = method !== 'GET';
  const guard = await requireAdmin(db, request, { mutating });
  if (guard.error) return guard.error;
  if (mutating && !isAllowedOrigin(request, env)) return fail(403, 'origin_not_allowed', 'origin is not allowlisted');
  const adminId = guard.session.admin_id;

  if (path === '/api/admin/dashboard' && method === 'GET') {
    const states = await db.prepare('SELECT status, COUNT(*) AS n FROM tracks GROUP BY status').all();
    const jobs = await db.prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status').all();
    const recent = await db
      .prepare('SELECT id, title, artist, status, created_at, error FROM tracks ORDER BY created_at DESC LIMIT 10')
      .all();
    const actions = await db
      .prepare('SELECT action, target, created_at FROM audit_log ORDER BY created_at DESC LIMIT 10')
      .all();
    return json({
      tracks: Object.fromEntries((states.results || []).map((r) => [r.status, r.n])),
      jobs: Object.fromEntries((jobs.results || []).map((r) => [r.status, r.n])),
      recent: recent.results || [],
      audit: actions.results || [],
    });
  }

  if (path === '/api/admin/tracks' && method === 'GET') {
    const url = new URL(request.url);
    const q = `%${(url.searchParams.get('q') || '').trim()}%`;
    const limit = Math.min(Number(url.searchParams.get('limit') || 25), 100);
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const status = url.searchParams.get('status');
    const { results } = await db
      .prepare(
        `SELECT id, title, artist, album, year, genre, language, duration_seconds, status, cover_key,
                dropbox_account_id, created_at, error
         FROM tracks
         WHERE (title LIKE ? OR artist LIKE ? OR album LIKE ? OR id LIKE ?)
           ${status ? 'AND status = ?' : ''}
         ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .bind(...(status ? [q, q, q, q, status, limit, offset] : [q, q, q, q, limit, offset]))
      .all();
    return json({ tracks: results || [], limit, offset });
  }

  const trackMatch = path.match(/^\/api\/admin\/tracks\/([A-Za-z0-9-]+)$/);
  if (trackMatch) {
    const trackId = trackMatch[1];
    if (method === 'GET') {
      const track = await db.prepare('SELECT * FROM tracks WHERE id = ?').bind(trackId).first();
      if (!track) return fail(404, 'not_found', 'track not found');
      const lyrics = await db.prepare('SELECT * FROM lyrics WHERE track_id = ?').bind(trackId).first();
      const storage = await db.prepare('SELECT * FROM track_storage WHERE track_id = ?').bind(trackId).all();
      return json({
        track: { ...track, duration_display: secondsToDisplay(track.duration_seconds) },
        lyrics: lyrics || null,
        storage: storage.results || [],
      });
    }
    if (method === 'PATCH') {
      const body = await readJson(request);
      const updates = [];
      const values = [];
      for (const field of EDITABLE) {
        if (!(field in body)) continue;
        if (field === 'year') {
          if (body.year !== null && (!Number.isInteger(body.year) || body.year < 1900)) {
            return fail(400, 'validation', 'year must be an integer >= 1900 or null');
          }
        }
        if (field === 'duration_seconds') {
          if (body.duration_seconds !== null && (!Number.isInteger(body.duration_seconds) || body.duration_seconds < 0)) {
            return fail(400, 'validation', 'duration_seconds must be a non-negative integer or null');
          }
        }
        if (field !== 'year' && field !== 'duration_seconds' && typeof body[field] !== 'string') {
          return fail(400, 'validation', `${field} must be a string`);
        }
        updates.push(`${field} = ?`);
        values.push(field === 'year' || field === 'duration_seconds' ? body[field] : body[field].normalize('NFC').trim().slice(0, 300));
      }
      if (!updates.length) return fail(400, 'validation', 'no editable fields supplied');
      updates.push('updated_at = ?');
      values.push(nowIso(), trackId);
      await db.prepare(`UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      await audit(db, adminId, 'track.update', trackId, Object.keys(body));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const confirmation = request.headers.get('x-confirm-delete');
      if (confirmation !== trackId) return fail(400, 'confirmation_required', 'x-confirm-delete must equal the track id');
      const marked = await markDeleted(env, trackId);
      await audit(db, adminId, 'track.delete', trackId);
      if (marked) {
        const jobId = await enqueueJob(db, { type: 'cleanup', trackId });
        try {
          await env.IMPORT_QUEUE.send({ jobId, trackId });
        } catch {
          await cleanupTrack(env, trackId).catch(() => {});
        }
      }
      return json({ ok: true, marked });
    }
  }

  const lyricsMatch = path.match(/^\/api\/admin\/tracks\/([A-Za-z0-9-]+)\/lyrics$/);
  if (lyricsMatch && method === 'PUT') {
    const trackId = lyricsMatch[1];
    const body = await readJson(request);
    if (typeof body.text !== 'string') return fail(400, 'validation', 'text is required');
    const segments = Array.isArray(body.segments) ? body.segments : null;
    if (segments) {
      for (const s of segments) {
        if (typeof s.start !== 'number' || typeof s.end !== 'number' || s.end < s.start || typeof s.text !== 'string') {
          return fail(400, 'validation', 'segments need numeric start/end (end >= start) and text');
        }
      }
    }
    await db
      .prepare(
        `INSERT INTO lyrics (track_id, source, format, status, text, segments, manual_override, updated_at)
         VALUES (?, 'manual', ?, 'ready', ?, ?, 1, ?)
         ON CONFLICT (track_id) DO UPDATE SET source='manual', format=excluded.format, status='ready',
           text=excluded.text, segments=excluded.segments, manual_override=1, updated_at=excluded.updated_at`
      )
      .bind(trackId, segments ? 'line' : 'plain', body.text, segments ? JSON.stringify(segments) : null, nowIso())
      .run();
    await audit(db, adminId, 'lyrics.edit', trackId);
    return json({ ok: true });
  }

  const retryMatch = path.match(/^\/api\/admin\/tracks\/([A-Za-z0-9-]+)\/retry$/);
  if (retryMatch && method === 'POST') {
    const trackId = retryMatch[1];
    await db
      .prepare(`UPDATE tracks SET status='pending', error=NULL, updated_at=? WHERE id=? AND status != 'deleted'`)
      .bind(nowIso(), trackId)
      .run();
    const jobId = await enqueueJob(db, { type: 'import', trackId });
    await env.IMPORT_QUEUE.send({ jobId, trackId });
    await audit(db, adminId, 'track.retry', trackId);
    return json({ ok: true, jobId });
  }

  if (path === '/api/admin/sources' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM sources ORDER BY created_at DESC').all();
    return json({ sources: results || [] });
  }

  // Explicit registration. The webhook never enrolls a chat on its own, so this
  // is the only way a Telegram chat becomes importable. Idempotent by chat_id.
  if (path === '/api/admin/sources' && method === 'POST') {
    const body = await readJson(request);
    const chatId = String(body.chat_id ?? '').trim();
    if (!/^-?\d+$/.test(chatId)) return fail(400, 'validation', 'chat_id must be a numeric Telegram chat id');
    const title = typeof body.title === 'string' ? body.title.normalize('NFC').trim().slice(0, 200) : null;
    const kind = body.kind === 'group' ? 'group' : 'channel';

    const existing = await db.prepare('SELECT * FROM sources WHERE chat_id = ?').bind(chatId).first();
    if (existing) {
      // Re-registering an existing chat re-enables it without touching its sequence.
      await db.prepare('UPDATE sources SET enabled=1, updated_at=? WHERE id=?').bind(nowIso(), existing.id).run();
      await audit(db, adminId, 'source.register', existing.id, { chat_id: chatId, existing: true });
      return json({ ok: true, id: existing.id, existing: true, enabled: true });
    }

    const id = crypto.randomUUID();
    await db
      .prepare(`INSERT INTO sources (id, chat_id, title, kind, enabled) VALUES (?, ?, ?, ?, 1)`)
      .bind(id, chatId, title, kind)
      .run();
    await audit(db, adminId, 'source.register', id, { chat_id: chatId });
    return json({ ok: true, id, existing: false, enabled: true });
  }

  const sourceMatch = path.match(/^\/api\/admin\/sources\/([A-Za-z0-9-]+)$/);
  if (sourceMatch && method === 'PATCH') {
    const body = await readJson(request);
    if (typeof body.enabled !== 'boolean') return fail(400, 'validation', 'enabled must be boolean');
    await db
      .prepare('UPDATE sources SET enabled=?, updated_at=? WHERE id=?')
      .bind(body.enabled ? 1 : 0, nowIso(), sourceMatch[1])
      .run();
    await audit(db, adminId, 'source.toggle', sourceMatch[1], { enabled: body.enabled });
    return json({ ok: true });
  }

  const sourceCheck = path.match(/^\/api\/admin\/sources\/([A-Za-z0-9-]+)\/check$/);
  if (sourceCheck && method === 'POST') {
    const source = await db.prepare('SELECT * FROM sources WHERE id = ?').bind(sourceCheck[1]).first();
    if (!source) return fail(404, 'not_found', 'source not found');
    try {
      const chat = await telegram.getChat(env, source.chat_id);
      await db
        .prepare(`UPDATE sources SET access_status='ok', access_error=NULL, title=?, updated_at=? WHERE id=?`)
        .bind(chat.title || chat.username || source.chat_id, nowIso(), source.id)
        .run();
      return json({ ok: true, title: chat.title, type: chat.type });
    } catch (err) {
      await db
        .prepare(`UPDATE sources SET access_status='error', access_error=?, updated_at=? WHERE id=?`)
        .bind(String(err.message).slice(0, 300), nowIso(), source.id)
        .run();
      return json({ ok: false, error: err.message });
    }
  }

  if (path === '/api/admin/dropbox/accounts' && method === 'GET') {
    const { results } = await db
      .prepare(
        `SELECT id, label, enabled, health, health_error, quota_used, quota_total, folder, updated_at
         FROM dropbox_accounts ORDER BY created_at`
      )
      .all();
    return json({ accounts: results || [] });
  }

  if (path === '/api/admin/dropbox/connect' && method === 'POST') {
    const redirectUri = `${env.PUBLIC_WORKER_URL.replace(/\/$/, '')}/api/admin/dropbox/callback`;
    const state = crypto.randomUUID();
    await db
      .prepare('INSERT INTO oauth_states (state, admin_id, expires_at) VALUES (?, ?, ?)')
      .bind(state, adminId, new Date(Date.now() + 10 * 60 * 1000).toISOString())
      .run();
    return json({ url: authorizeUrl(env, { state, redirectUri }) });
  }

  const dbxMatch = path.match(/^\/api\/admin\/dropbox\/accounts\/([A-Za-z0-9-]+)$/);
  if (dbxMatch && method === 'PATCH') {
    const body = await readJson(request);
    if (typeof body.enabled !== 'boolean') return fail(400, 'validation', 'enabled must be boolean');
    await db
      .prepare('UPDATE dropbox_accounts SET enabled=?, updated_at=? WHERE id=?')
      .bind(body.enabled ? 1 : 0, nowIso(), dbxMatch[1])
      .run();
    return json({ ok: true });
  }
  if (dbxMatch && method === 'DELETE') {
    await db
      .prepare('UPDATE dropbox_accounts SET enabled=0, refresh_token_enc=?, refresh_token_iv=?, access_token=NULL, health=?, updated_at=? WHERE id=?')
      .bind('revoked', 'revoked', 'revoked', nowIso(), dbxMatch[1])
      .run();
    await audit(db, adminId, 'dropbox.disconnect', dbxMatch[1]);
    return json({ ok: true });
  }

  const dbxCheck = path.match(/^\/api\/admin\/dropbox\/accounts\/([A-Za-z0-9-]+)\/check$/);
  if (dbxCheck && method === 'POST') {
    const account = await db.prepare('SELECT * FROM dropbox_accounts WHERE id = ?').bind(dbxCheck[1]).first();
    if (!account) return fail(404, 'not_found', 'account not found');
    return json(await checkAccount(db, env, account));
  }

  if (path === '/api/admin/errors' && method === 'GET') {
    const url = new URL(request.url);
    const q = `%${(url.searchParams.get('q') || '').trim()}%`;
    const { results } = await db
      .prepare(
        `SELECT id, category, stage, track_id, message, created_at FROM error_log
         WHERE message LIKE ? OR category LIKE ? ORDER BY created_at DESC LIMIT 100`
      )
      .bind(q, q)
      .all();
    const dead = await db
      .prepare(`SELECT id, type, track_id, attempts, last_error FROM jobs WHERE status='dead' LIMIT 50`)
      .all();
    return json({ errors: results || [], dead_letters: dead.results || [] });
  }

  if (path === '/api/admin/telegram/test' && method === 'POST') {
    try {
      const me = await telegram.getMe(env);
      const info = await telegram.getWebhookInfo(env);
      return json({
        ok: true,
        bot: { id: me.id, username: me.username },
        webhook: { url: info.url || null, pending: info.pending_update_count ?? null, last_error: info.last_error_message || null },
      });
    } catch (err) {
      return json({ ok: false, error: err.message, code: err.code || 'error' }, { status: 200 });
    }
  }

  if (path === '/api/admin/telegram/webhook' && method === 'POST') {
    try {
      const url = await registerWebhook(env, env.PUBLIC_WORKER_URL);
      await audit(db, adminId, 'telegram.webhook', url);
      return json({ ok: true, url });
    } catch (err) {
      return json({ ok: false, error: err.message }, { status: 502 });
    }
  }

  if (path === '/api/admin/health' && method === 'GET') {
    return json(await healthReport(env));
  }

  return fail(404, 'not_found', 'unknown admin route');
}

/** Dropbox OAuth callback. State is validated and single-use. */
export async function handleDropboxCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return fail(400, 'bad_request', 'missing code or state');

  const row = await env.DB.prepare('SELECT * FROM oauth_states WHERE state = ?').bind(state).first();
  if (!row) return fail(400, 'invalid_state', 'unknown OAuth state');
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  if (Date.parse(row.expires_at) <= Date.now()) return fail(400, 'expired_state', 'OAuth state expired');

  const redirectUri = `${env.PUBLIC_WORKER_URL.replace(/\/$/, '')}/api/admin/dropbox/callback`;
  const token = await exchangeCode(env, code, redirectUri);
  if (!token.refresh_token) return fail(400, 'no_refresh_token', 'Dropbox did not return a refresh token');
  await storeAccount(env.DB, env, { label: token.account_id || 'Dropbox account', refreshToken: token.refresh_token });
  return new Response('Dropbox account connected. You can close this window.', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export { importTrack };
