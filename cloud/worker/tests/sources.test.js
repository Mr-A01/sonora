import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeEnv } from './harness.js';

const SECRET = 'secret-token-abcdefghijklmnop';

function webhookRequest(update) {
  return new Request('https://sonora.test/api/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': SECRET },
    body: JSON.stringify(update),
  });
}

function audioUpdate({ updateId = 1, messageId = 10, chatId = -1001 } = {}) {
  return {
    update_id: updateId,
    channel_post: {
      message_id: messageId,
      chat: { id: chatId, title: 'Sonora Channel', type: 'channel' },
      audio: {
        file_id: `file-${messageId}`,
        file_unique_id: `uniq-${messageId}`,
        duration: 200,
        file_size: 1024 * 1024,
        mime_type: 'audio/mpeg',
        title: 'Night Signal',
        performer: 'Aurora',
      },
    },
  };
}

async function disableSource(env, chatId) {
  await env.DB.prepare('UPDATE sources SET enabled = 0 WHERE chat_id = ?').bind(String(chatId)).run();
}

async function sourceRow(env, chatId) {
  return env.DB.prepare('SELECT * FROM sources WHERE chat_id = ?').bind(String(chatId)).first();
}

test('first audio message registers an enabled source and imports it', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(webhookRequest(audioUpdate()), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.jobId, 'enabled source must queue an import');

  const source = await sourceRow(env, -1001);
  assert.equal(source.enabled, 1);
  assert.equal(source.last_sequence, 1);
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
});

test('disabled source accepts the webhook but queues nothing', async () => {
  const env = fakeEnv();
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);
  await disableSource(env, -1001);

  const res = await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  const body = await res.json();
  assert.equal(res.status, 200, 'Telegram must still get a 200 or it retries forever');
  assert.equal(body.ok, true);
  assert.equal(body.ignored, 'source_disabled');
  assert.equal(env.IMPORT_QUEUE.sent.length, 1, 'no new job for a disabled source');

  const tracks = await env.DB.prepare('SELECT COUNT(*) AS n FROM tracks').first();
  assert.equal(tracks.n, 1, 'no track row is created for a disabled source');

  const source = await sourceRow(env, -1001);
  assert.equal(source.last_sequence, 1, 'the sequence must not advance');

  const update = await env.DB.prepare('SELECT status FROM telegram_updates WHERE update_id = 2').first();
  assert.equal(update.status, 'source_disabled');
});

test('re-enabling a disabled source restores imports and continues the sequence', async () => {
  const env = fakeEnv();
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);
  await disableSource(env, -1001);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);

  await env.DB.prepare('UPDATE sources SET enabled = 1 WHERE chat_id = ?').bind('-1001').run();
  const res = await worker.fetch(webhookRequest(audioUpdate({ updateId: 3, messageId: 3 })), env);
  const body = await res.json();
  assert.ok(body.jobId);
  assert.equal(env.IMPORT_QUEUE.sent.length, 2);

  const sequences = await env.DB.prepare('SELECT source_sequence FROM tracks ORDER BY source_sequence').all();
  assert.deepEqual(sequences.results.map((r) => r.source_sequence), [1, 2]);
  assert.equal((await sourceRow(env, -1001)).last_sequence, 2);
});

test('a replayed update from a disabled source stays a no-op', async () => {
  const env = fakeEnv();
  const update = audioUpdate();
  await worker.fetch(webhookRequest(update), env);
  await disableSource(env, -1001);

  const res = await worker.fetch(webhookRequest(update), env);
  const body = await res.json();
  assert.equal(body.duplicate, true);
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
  const tracks = await env.DB.prepare('SELECT COUNT(*) AS n FROM tracks').first();
  assert.equal(tracks.n, 1);
});

test('admin can toggle the source that the webhook then honours', async () => {
  const env = fakeEnv();
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);
  const { id } = await sourceRow(env, -1001);

  // Same UPDATE the PATCH /api/admin/sources/:id route performs.
  await env.DB.prepare('UPDATE sources SET enabled = 0 WHERE id = ?').bind(id).run();
  const res = await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  assert.equal((await res.json()).ignored, 'source_disabled');
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
});

test('unknown chat with a non-audio message is not registered as a source', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(
    webhookRequest({ update_id: 7, message: { message_id: 1, chat: { id: 42, type: 'private' }, text: 'hi' } }),
    env
  );
  assert.equal((await res.json()).ignored, true);
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sources').first();
  assert.equal(count.n, 0);
});
