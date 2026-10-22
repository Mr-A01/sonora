import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeEnv } from './harness.js';
import { hashPassword } from '../src/lib/crypto.js';

const SECRET = 'secret-token-abcdefghijklmnop';
const ORIGIN = 'https://mhdlabs.github.io';

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

/** Creates an admin and returns a session suitable for CSRF-guarded calls. */
async function adminSession(env) {
  const password = 'correct horse battery';
  const { hash, salt, iterations } = await hashPassword(password);
  await env.DB.prepare('INSERT INTO admins (id, username, password_hash, salt, iterations) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), 'admin', hash, salt, iterations)
    .run();

  const res = await worker.fetch(
    new Request('https://sonora.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ username: 'admin', password }),
    }),
    env
  );
  assert.equal(res.status, 200, 'admin login must succeed');
  const body = await res.json();
  const cookie = (res.headers.get('set-cookie') || '')
    .split(',')
    .map((c) => c.trim().split(';')[0])
    .filter((c) => c.startsWith('sonora_session=') || c.startsWith('sonora_csrf='))
    .join('; ');
  return { cookie, csrf: body.csrfToken };
}

function adminRequest(path, session, { method = 'GET', body } = {}) {
  const headers = { cookie: session.cookie, origin: ORIGIN };
  if (method !== 'GET') headers['x-csrf-token'] = session.csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`https://sonora.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function registerSource(env, session, chatId = '-1001') {
  return worker.fetch(
    adminRequest('/api/admin/sources', session, {
      method: 'POST',
      body: { chat_id: chatId, title: 'Sonora Channel' },
    }),
    env
  );
}

async function counts(env) {
  const sources = await env.DB.prepare('SELECT COUNT(*) AS n FROM sources').first();
  const tracks = await env.DB.prepare('SELECT COUNT(*) AS n FROM tracks').first();
  const jobs = await env.DB.prepare('SELECT COUNT(*) AS n FROM jobs').first();
  return { sources: sources.n, tracks: tracks.n, jobs: jobs.n };
}

test('unknown chat is ignored: no source, track, job, or queue message', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(webhookRequest(audioUpdate()), env);
  const body = await res.json();

  assert.equal(res.status, 200, 'Telegram must still receive 200 or it retries');
  assert.equal(body.ok, true);
  assert.equal(body.ignored, 'source_unknown');
  assert.equal(body.jobId, undefined);

  assert.deepEqual(await counts(env), { sources: 0, tracks: 0, jobs: 0 });
  assert.equal(env.IMPORT_QUEUE.sent.length, 0);

  const update = await env.DB.prepare('SELECT status FROM telegram_updates WHERE update_id = 1').first();
  assert.equal(update.status, 'source_unknown');
});

test('unknown chat rejection stays idempotent across replays', async () => {
  const env = fakeEnv();
  const update = audioUpdate();
  await worker.fetch(webhookRequest(update), env);
  const second = await (await worker.fetch(webhookRequest(update), env)).json();
  assert.equal(second.duplicate, true);

  const third = await (await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 11 })), env)).json();
  assert.equal(third.ignored, 'source_unknown');
  assert.deepEqual(await counts(env), { sources: 0, tracks: 0, jobs: 0 });
});

test('admin registration makes a subsequent import work', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);

  const reg = await registerSource(env, session);
  assert.equal(reg.status, 200);
  const regBody = await reg.json();
  assert.equal(regBody.ok, true);
  assert.equal(regBody.existing, false);

  const source = await env.DB.prepare('SELECT * FROM sources WHERE chat_id = ?').bind('-1001').first();
  assert.equal(source.enabled, 1);
  assert.equal(source.last_sequence, 0, 'registration must not consume a sequence');

  const body = await (await worker.fetch(webhookRequest(audioUpdate()), env)).json();
  assert.ok(body.jobId, 'registered + enabled source must queue an import');
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);

  const after = await counts(env);
  assert.equal(after.sources, 1);
  assert.equal(after.tracks, 1);
  assert.equal(after.jobs, 1);
});

test('registration is idempotent and re-enables without resetting the sequence', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);
  await registerSource(env, session);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);

  const body = await (await registerSource(env, session)).json();
  assert.equal(body.ok, true);
  assert.equal(body.existing, true);

  const sources = await env.DB.prepare('SELECT COUNT(*) AS n FROM sources').first();
  assert.equal(sources.n, 1);
  const source = await env.DB.prepare('SELECT * FROM sources WHERE chat_id = ?').bind('-1001').first();
  assert.equal(source.enabled, 1);
  assert.equal(source.last_sequence, 1, 're-registration must not reset ordering');

  await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  const sequences = await env.DB.prepare('SELECT source_sequence FROM tracks ORDER BY source_sequence').all();
  assert.deepEqual(sequences.results.map((r) => r.source_sequence), [1, 2]);
});

test('registration requires authentication and CSRF', async () => {
  const env = fakeEnv();
  const anonymous = await worker.fetch(
    new Request('https://sonora.test/api/admin/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ chat_id: '-1001' }),
    }),
    env
  );
  assert.equal(anonymous.status, 401);

  const session = await adminSession(env);
  const noCsrf = await worker.fetch(
    new Request('https://sonora.test/api/admin/sources', {
      method: 'POST',
      headers: { cookie: session.cookie, origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: '-1001' }),
    }),
    env
  );
  assert.equal(noCsrf.status, 403);
  assert.deepEqual(await counts(env), { sources: 0, tracks: 0, jobs: 0 });
});

test('registration rejects a non-numeric chat id', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);
  const res = await registerSource(env, session, 'not-a-chat');
  assert.equal(res.status, 400);
  assert.deepEqual(await counts(env), { sources: 0, tracks: 0, jobs: 0 });
});

test('disabled source accepts the webhook but queues nothing', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);
  await registerSource(env, session);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);

  const source = await env.DB.prepare('SELECT id FROM sources WHERE chat_id = ?').bind('-1001').first();
  await worker.fetch(
    adminRequest(`/api/admin/sources/${source.id}`, session, { method: 'PATCH', body: { enabled: false } }),
    env
  );

  const res = await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ignored, 'source_disabled');
  assert.equal(env.IMPORT_QUEUE.sent.length, 1, 'no new job for a disabled source');

  const after = await counts(env);
  assert.equal(after.tracks, 1, 'no track row for a disabled source');
  assert.equal(after.jobs, 1);

  const row = await env.DB.prepare('SELECT last_sequence FROM sources WHERE id = ?').bind(source.id).first();
  assert.equal(row.last_sequence, 1, 'the sequence must not advance');
  const update = await env.DB.prepare('SELECT status FROM telegram_updates WHERE update_id = 2').first();
  assert.equal(update.status, 'source_disabled');
});

test('re-enabling through PATCH restores imports and continues the sequence', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);
  await registerSource(env, session);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 1, messageId: 1 })), env);
  const { id } = await env.DB.prepare('SELECT id FROM sources WHERE chat_id = ?').bind('-1001').first();

  await worker.fetch(adminRequest(`/api/admin/sources/${id}`, session, { method: 'PATCH', body: { enabled: false } }), env);
  await worker.fetch(webhookRequest(audioUpdate({ updateId: 2, messageId: 2 })), env);
  await worker.fetch(adminRequest(`/api/admin/sources/${id}`, session, { method: 'PATCH', body: { enabled: true } }), env);

  const res = await worker.fetch(webhookRequest(audioUpdate({ updateId: 3, messageId: 3 })), env);
  assert.ok((await res.json()).jobId);
  assert.equal(env.IMPORT_QUEUE.sent.length, 2);
  const sequences = await env.DB.prepare('SELECT source_sequence FROM tracks ORDER BY source_sequence').all();
  assert.deepEqual(sequences.results.map((r) => r.source_sequence), [1, 2]);
});

test('a replayed update from a disabled source stays a no-op', async () => {
  const env = fakeEnv();
  const session = await adminSession(env);
  await registerSource(env, session);
  const update = audioUpdate();
  await worker.fetch(webhookRequest(update), env);

  const { id } = await env.DB.prepare('SELECT id FROM sources WHERE chat_id = ?').bind('-1001').first();
  await worker.fetch(adminRequest(`/api/admin/sources/${id}`, session, { method: 'PATCH', body: { enabled: false } }), env);

  const body = await (await worker.fetch(webhookRequest(update), env)).json();
  assert.equal(body.duplicate, true);
  assert.equal(env.IMPORT_QUEUE.sent.length, 1);
});

test('non-audio message is ignored and registers nothing', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(
    webhookRequest({ update_id: 7, message: { message_id: 1, chat: { id: 42, type: 'private' }, text: 'hi' } }),
    env
  );
  assert.equal((await res.json()).ignored, true);
  assert.deepEqual(await counts(env), { sources: 0, tracks: 0, jobs: 0 });
});
