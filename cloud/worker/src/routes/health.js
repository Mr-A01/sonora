/**
 * Deployed-worker diagnostics. Runs from the Worker, so results describe real
 * outbound connectivity — not the developer's machine. Never returns secrets.
 */
import { nowIso } from '../lib/ids.js';
import { telegram } from '../services/telegram.js';

async function check(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail, checked_at: nowIso() };
  } catch (err) {
    return { name, ok: false, error: String(err.message || err).slice(0, 300), checked_at: nowIso() };
  }
}

export async function healthReport(env) {
  const checks = [];
  const db = env.DB;

  checks.push(
    await check('d1', async () => {
      const row = await db.prepare('SELECT COUNT(*) AS n FROM tracks').first();
      return { tracks: row?.n ?? 0 };
    })
  );

  checks.push(
    await check('telegram', async () => {
      if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');
      const me = await telegram.getMe(env);
      const info = await telegram.getWebhookInfo(env);
      return {
        bot_username: me.username,
        webhook_url: info.url || null,
        webhook_pending: info.pending_update_count ?? null,
        webhook_last_error: info.last_error_message || null,
        verified_from_worker: true,
      };
    })
  );

  checks.push(
    await check('workers_ai', async () => {
      if (!env.AI) throw new Error('AI binding not configured');
      const out = await env.AI.run(env.CLEANUP_MODEL || '@cf/qwen/qwen3.8-27b', {
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 8,
      });
      const text = out?.choices?.[0]?.message?.content ?? out?.response ?? '';
      return { model: env.CLEANUP_MODEL || '@cf/qwen/qwen3.8-27b', responded: Boolean(String(text).trim()) };
    })
  );

  checks.push(
    await check('r2', async () => {
      if (!env.MEDIA) throw new Error('MEDIA binding not configured');
      const probe = `_health/${Date.now()}.txt`;
      await env.MEDIA.put(probe, 'ok', { httpMetadata: { contentType: 'text/plain' } });
      const read = await env.MEDIA.get(probe);
      await env.MEDIA.delete(probe);
      return { read_ok: Boolean(read) };
    })
  );

  checks.push(
    await check('queues', async () => {
      if (!env.IMPORT_QUEUE) throw new Error('IMPORT_QUEUE binding not configured');
      const { results } = await db.prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status').all();
      return { bound: true, jobs: Object.fromEntries((results || []).map((r) => [r.status, r.n])) };
    })
  );

  checks.push(
    await check('dropbox', async () => {
      const { results } = await db
        .prepare('SELECT id, label, enabled, health, health_error FROM dropbox_accounts ORDER BY created_at')
        .all();
      const rows = results || [];
      const healthy = rows.filter((r) => r.health === 'healthy' && r.enabled).length;
      return { accounts: rows.length, healthy, statuses: rows.map((r) => ({ label: r.label, health: r.health, error: r.health_error })) };
    })
  );

  return {
    environment: 'deployed-worker',
    checked_at: nowIso(),
    groq_enabled: Boolean(env.GROQ_API_KEY) && String(env.TRANSCRIPTION_PROVIDER || '') === 'groq',
    transcription_provider: String(env.TRANSCRIPTION_PROVIDER || 'cloudflare'),
    checks,
  };
}

export async function healthz(env) {
  return healthReport(env);
}
