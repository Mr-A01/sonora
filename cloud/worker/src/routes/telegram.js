/**
 * Telegram webhook. Validates the secret token, durably records the update,
 * creates the job, enqueues an ID-only message, and returns 200 immediately.
 * No audio bytes ever enter the Queue payload.
 */
import { json, fail } from '../lib/http.js';
import { nowIso } from '../lib/ids.js';
import { extractAudio, verifyWebhookSecret, telegram, TelegramError } from '../services/telegram.js';
import { enqueueJob } from '../db/jobs.js';
import { detectAudioExtension, PREVIEW_MAX_SECONDS } from '../services/audio.js';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

function previewThreshold(env) {
  const configured = Number(env.PREVIEW_MAX_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? configured : PREVIEW_MAX_SECONDS;
}

export async function handleWebhook(request, env) {
  if (!verifyWebhookSecret(env, request.headers.get('x-telegram-bot-api-secret-token'))) {
    return fail(401, 'unauthorized', 'invalid webhook secret');
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return fail(400, 'bad_request', 'invalid JSON');
  }
  if (!update || typeof update.update_id !== 'number') return fail(400, 'bad_request', 'missing update_id');

  const db = env.DB;

  // Durable dedupe: the primary key on update_id makes replay harmless.
  const inserted = await db
    .prepare('INSERT OR IGNORE INTO telegram_updates (update_id, chat_id, message_id, status) VALUES (?, ?, ?, ?)')
    .bind(update.update_id, String(extractChatId(update)), extractMessageId(update), 'received')
    .run();
  if (inserted.meta.changes === 0) return json({ ok: true, duplicate: true });

  const audio = extractAudio(update);
  if (!audio) {
    await markUpdate(db, update.update_id, 'ignored');
    return json({ ok: true, ignored: true });
  }

  if (audio.fileSize && audio.fileSize > MAX_IMPORT_BYTES) {
    await recordRejection(db, audio, 'file_too_large', `file is ${audio.fileSize} bytes; Telegram Bot API caps downloads at 20 MB`);
    return json({ ok: true, rejected: 'file_too_large' });
  }
  if (audio.durationSeconds != null && audio.durationSeconds <= previewThreshold(env)) {
    await recordRejection(db, audio, 'preview_too_short', `duration ${audio.durationSeconds}s is at or below the ${previewThreshold(env)}s preview threshold`);
    return json({ ok: true, rejected: 'preview_too_short' });
  }

  const ext = detectAudioExtension(audio.mimeType, audio.filename);
  const source = await upsertSource(db, audio);

  // Ordering is enforced with a durable per-source sequence, not Queue order.
  const seqRow = await db
    .prepare('UPDATE sources SET last_sequence = last_sequence + 1, updated_at = ? WHERE id = ? RETURNING last_sequence')
    .bind(nowIso(), source.id)
    .first();

  const trackId = crypto.randomUUID();
  let track;
  try {
    track = await db
      .prepare(
        `INSERT INTO tracks (id, source_id, source_sequence, telegram_chat_id, telegram_message_id, status, source_metadata)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)
         RETURNING id`
      )
      .bind(
        trackId,
        source.id,
        seqRow.last_sequence,
        audio.chatId,
        audio.messageId,
        JSON.stringify({
          fileId: audio.fileId,
          fileUniqueId: audio.fileUniqueId,
          durationSeconds: audio.durationSeconds,
          filename: audio.filename,
          mimeType: audio.mimeType,
          title: audio.title,
          performer: audio.performer,
          caption: audio.caption,
        })
      )
      .first();
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      await markUpdate(db, update.update_id, 'duplicate_track');
      return json({ ok: true, duplicate: true });
    }
    throw err;
  }

  const jobId = await enqueueJob(db, {
    type: 'import',
    trackId: track.id,
    payload: { ext },
  });
  await markUpdate(db, update.update_id, 'queued');

  try {
    await env.IMPORT_QUEUE.send({ jobId, trackId: track.id });
  } catch (err) {
    // The job row survives; the repair job re-enqueues anything stuck in 'queued'.
    console.error(JSON.stringify({ category: 'queue_send_failed', jobId, message: String(err.message).slice(0, 200) }));
    return json({ ok: true, queued: false, jobId });
  }
  return json({ ok: true, jobId });
}

function extractChatId(update) {  const m = update.message || update.channel_post;
  return m?.chat?.id ?? null;
}
function extractMessageId(update) {
  const m = update.message || update.channel_post;
  return m?.message_id ?? null;
}

async function markUpdate(db, updateId, status) {
  await db.prepare('UPDATE telegram_updates SET status = ? WHERE update_id = ?').bind(status, updateId).run();
}

async function upsertSource(db, audio) {
  const existing = await db.prepare('SELECT * FROM sources WHERE chat_id = ?').bind(audio.chatId).first();
  if (existing) return existing;
  const id = crypto.randomUUID();
  await db
    .prepare(`INSERT INTO sources (id, chat_id, title, kind, enabled) VALUES (?, ?, ?, ?, 1)`)
    .bind(id, audio.chatId, audio.chatTitle, audio.chatType === 'channel' ? 'channel' : 'group')
    .run();
  return { id, chat_id: audio.chatId, last_sequence: 0 };
}

/** Idempotent rejection record: repeated updates never re-run work. */
async function recordRejection(db, audio, code, reason) {
  const existing = await db
    .prepare('SELECT id FROM tracks WHERE telegram_chat_id = ? AND telegram_message_id = ?')
    .bind(audio.chatId, audio.messageId)
    .first();
  if (existing) return;
  await db
    .prepare(
      `INSERT INTO tracks (id, telegram_chat_id, telegram_message_id, status, error, source_metadata)
       VALUES (?, ?, ?, 'failed', ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      audio.chatId,
      audio.messageId,
      `${code}: ${reason}`,
      JSON.stringify({ fileId: audio.fileId, filename: audio.filename, durationSeconds: audio.durationSeconds })
    )
    .run();
}

export async function registerWebhook(env, workerUrl) {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) {
    throw new TelegramError('TELEGRAM_WEBHOOK_SECRET must be at least 16 characters', { code: 'not_configured' });
  }
  if (!workerUrl || !/^https:\/\//.test(workerUrl)) {
    throw new TelegramError('PUBLIC_WORKER_URL must be an https URL', { code: 'not_configured' });
  }
  const url = `${workerUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  await telegram.setWebhook(env, url, secret);
  return url;
}
