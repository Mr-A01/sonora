import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeEnv, fakeAi } from './harness.js';

const SECRET = 'secret-token-abcdefghijklmnop';

function webhookRequest(update, secret = SECRET) {
  return new Request('https://sonora.test/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(update),
  });
}

function audioUpdate({ updateId = 1, messageId = 10, duration = 200, fileSize = 1024 * 1024 } = {}) {
  return {
    update_id: updateId,
    channel_post: {
      message_id: messageId,
      chat: { id: -1001, title: 'Sonora Channel', type: 'channel' },
      audio: {
        file_id: `file-${messageId}`,
        file_unique_id: `uniq-${messageId}`,
        duration,
        file_size: fileSize,
        mime_type: 'audio/mpeg',
        title: 'Night Signal',
        performer: 'Aurora',
      },
    },
  };
}

/** Sources are allowlist-only: register the chat exactly as the admin route does. */
async function registerSource(env, chatId = '-1001') {
  await env.DB.prepare('INSERT INTO sources (id, chat_id, title, kind, enabled) VALUES (?, ?, ?, ?, 1)')
    .bind(crypto.randomUUID(), chatId, 'Sonora Channel', 'channel')
    .run();
}

test('webhook rejects a wrong secret', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(webhookRequest(audioUpdate(), 'wrong-secret'), env);
  assert.equal(res.status, 401);
});

test('webhook rejects a request with no secret header', async () => {
  const env = fakeEnv();
  const req = new Request('https://sonora.test/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(audioUpdate()),
  });
  const res = await worker.fetch(req, env);
  assert.equal(res.status, 401);
});

test('valid update enqueues exactly one job with no audio payload', async () => {
  const env = fakeEnv();
  await registerSource(env);
  const res = await worker.fetch(webhookRequest(audioUpdate()), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(body.jobId);
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
  const message = env.IMPORT_QUEUE.sent[0];
  assert.deepEqual(Object.keys(message).sort(), ['jobId', 'trackId']);
});

test('duplicate delivery does not create a second track', async () => {
  const env = fakeEnv();
  await registerSource(env);
  await worker.fetch(webhookRequest(audioUpdate()), env);
  const res = await worker.fetch(webhookRequest(audioUpdate()), env);
  const body = await res.json();
  assert.equal(body.duplicate, true);
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM tracks').first();
  assert.equal(row.n, 1);
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
});

test('30 second preview is rejected before any enqueue', async () => {
  const env = fakeEnv();
  await registerSource(env);
  const res = await worker.fetch(webhookRequest(audioUpdate({ duration: 30 })), env);
  const body = await res.json();
  assert.equal(body.rejected, 'preview_too_short');
  assert.equal(env.IMPORT_QUEUE.sent.length, 0);
  const track = await env.DB.prepare('SELECT status, error FROM tracks').first();
  assert.equal(track.status, 'failed');
  assert.match(track.error, /preview_too_short/);
});

test('oversized file is rejected without enqueue', async () => {
  const env = fakeEnv();
  await registerSource(env);
  const res = await worker.fetch(webhookRequest(audioUpdate({ fileSize: 25 * 1024 * 1024 })), env);
  const body = await res.json();
  assert.equal(body.rejected, 'file_too_large');
  assert.equal(env.IMPORT_QUEUE.sent.length, 0);
});

test('non-audio message is ignored', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(
    webhookRequest({ update_id: 5, message: { message_id: 1, chat: { id: 1, type: 'private' }, text: 'hi' } }),
    env
  );
  const body = await res.json();
  assert.equal(body.ignored, true);
});

test('source sequence increments durably per chat', async () => {
  const env = fakeEnv();
  await registerSource(env);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  const rows = await env.DB.prepare('SELECT source_sequence FROM tracks ORDER BY source_sequence').all();
  assert.deepEqual(rows.results.map((r) => r.source_sequence), [1, 2]);
});

test('manifest exposes only ready tracks and returns empty for a fresh DB', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(new Request('https://sonora.test/api/manifest.json'), env);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tracks, []);
});

test('media route serves range requests', async () => {
  const env = fakeEnv({ AI: fakeAi() });
  await env.MEDIA.put('audio/x.mp3', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  const res = await worker.fetch(
    new Request('https://sonora.test/media/audio/x.mp3', { headers: { range: 'bytes=2-5' } }),
    env
  );
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 2-5/8');
});

test('media route rejects path traversal', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(new Request('https://sonora.test/media/../secrets'), env);
  assert.equal(res.status, 404);
});
