import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { fakeEnv } from './harness.js';
import { hashPassword, encrypt, decrypt } from '../src/lib/crypto.js';

async function createAdmin(env, username = 'admin', password = 'correct horse battery') {
  const { hash, salt, iterations } = await hashPassword(password);
  await env.DB.prepare('INSERT INTO admins (id, username, password_hash, salt, iterations) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), username, hash, salt, iterations)
    .run();
  return { username, password };
}

function originHeaders(extra = {}) {
  return { origin: 'https://mhdlabs.github.io', ...extra };
}

async function login(env, creds) {
  const res = await worker.fetch(
    new Request('https://sonora.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...originHeaders() },
      body: JSON.stringify(creds),
    }),
    env
  );
  const body = await res.json();
  const header = res.headers.get('set-cookie') || '';
  const cookie = header
    .split(',')
    .map((c) => c.trim().split(';')[0])
    .filter((c) => c.startsWith('sonora_session=') || c.startsWith('sonora_csrf='))
    .join('; ');
  return { res, body, cookie };
}

test('unauthenticated admin request is rejected', async () => {
  const env = fakeEnv();
  const res = await worker.fetch(new Request('https://sonora.test/api/admin/dashboard'), env);
  assert.equal(res.status, 401);
});

test('login with wrong password fails and is recorded', async () => {
  const env = fakeEnv();
  await createAdmin(env);
  const { res } = await login(env, { username: 'admin', password: 'nope' });
  assert.equal(res.status, 401);
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action='login_failed'`).first();
  assert.equal(row.n, 1);
});

test('login, session check, then mutation requires CSRF', async () => {
  const env = fakeEnv();
  const creds = await createAdmin(env);
  const { body, cookie } = await login(env, creds);
  assert.ok(body.csrfToken);

  const me = await worker.fetch(
    new Request('https://sonora.test/api/admin/me', { headers: { cookie, ...originHeaders() } }),
    env
  );
  assert.equal(me.status, 200);

  const noCsrf = await worker.fetch(
    new Request('https://sonora.test/api/admin/logout', { method: 'POST', headers: { cookie, ...originHeaders() } }),
    env
  );
  assert.equal(noCsrf.status, 403);

  const withCsrf = await worker.fetch(
    new Request('https://sonora.test/api/admin/logout', {
      method: 'POST',
      headers: { cookie, ...originHeaders(), 'x-csrf-token': body.csrfToken },
    }),
    env
  );
  assert.equal(withCsrf.status, 200);
});

test('login from a non-allowlisted origin is refused', async () => {
  const env = fakeEnv();
  const creds = await createAdmin(env);
  const res = await worker.fetch(
    new Request('https://sonora.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify(creds),
    }),
    env
  );
  assert.equal(res.status, 403);
});

test('deletion requires the explicit confirmation header', async () => {
  const env = fakeEnv();
  const creds = await createAdmin(env);
  const { body, cookie } = await login(env, creds);
  const trackId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tracks (id, title, artist, status, duration_seconds, audio_key) VALUES (?, 'A', 'B', 'ready', 200, 'audio/a.mp3')`
  ).bind(trackId).run();

  const headers = { cookie, ...originHeaders(), 'x-csrf-token': body.csrfToken };
  const noConfirm = await worker.fetch(
    new Request(`https://sonora.test/api/admin/tracks/${trackId}`, { method: 'DELETE', headers }),
    env
  );
  assert.equal(noConfirm.status, 400);

  const ok = await worker.fetch(
    new Request(`https://sonora.test/api/admin/tracks/${trackId}`, {
      method: 'DELETE',
      headers: { ...headers, 'x-confirm-delete': trackId },
    }),
    env
  );
  assert.equal(ok.status, 200);

  const manifest = await (await worker.fetch(new Request('https://sonora.test/api/manifest.json'), env)).json();
  assert.equal(manifest.tracks.length, 0, 'deleted track must leave the public manifest immediately');
});

test('track edits are validated server-side', async () => {
  const env = fakeEnv();
  const creds = await createAdmin(env);
  const { body, cookie } = await login(env, creds);
  const trackId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO tracks (id, title, status) VALUES (?, ?, ?)').bind(trackId, 'x', 'ready').run();
  const headers = { cookie, ...originHeaders(), 'x-csrf-token': body.csrfToken, 'content-type': 'application/json' };
  const res = await worker.fetch(
    new Request(`https://sonora.test/api/admin/tracks/${trackId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ year: 1200 }),
    }),
    env
  );
  assert.equal(res.status, 400);
});

test('manual lyrics survive automated runs', async () => {
  const env = fakeEnv();
  const trackId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO tracks (id, title, status) VALUES (?, ?, ?)').bind(trackId, 'x', 'ready').run();
  await env.DB.prepare(
    `INSERT INTO lyrics (track_id, source, format, status, text, manual_override) VALUES (?, 'manual', 'plain', 'ready', 'my edit', 1)`
  ).bind(trackId).run()
  await env.DB.prepare(
    `INSERT INTO lyrics (track_id, source, format, status, text, updated_at) VALUES (?, 'generated', 'plain', 'ready', 'machine', ?)
     ON CONFLICT (track_id) DO UPDATE SET text=excluded.text WHERE lyrics.manual_override = 0`
  ).bind(trackId, new Date().toISOString()).run();
  const row = await env.DB.prepare('SELECT text, source FROM lyrics WHERE track_id = ?').bind(trackId).first();
  assert.equal(row.text, 'my edit');
  assert.equal(row.source, 'manual');
});

test('dropbox tokens are encrypted at rest', async () => {
  const secret = 'test-encryption-key-please-rotate';
  const { ciphertext, iv } = await encrypt('sl.refresh-token-value', secret);
  assert.notEqual(ciphertext, 'sl.refresh-token-value');
  assert.equal(await decrypt(ciphertext, iv, secret), 'sl.refresh-token-value');
});

test('health report never leaks secrets', async () => {
  const env = fakeEnv({ TELEGRAM_BOT_TOKEN: '123:super-secret-token', GROQ_API_KEY: 'gsk_secret' });
  const res = await worker.fetch(new Request('https://sonora.test/api/health'), env);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes('super-secret-token'), 'bot token leaked');
  assert.ok(!text.includes('gsk_secret'), 'groq key leaked');
  const body = JSON.parse(text);
  assert.ok(Array.isArray(body.checks));
  assert.equal(body.groq_enabled, false);
});

test('bootstrap refuses to run twice', async () => {
  const env = fakeEnv({ ADMIN_BOOTSTRAP_TOKEN: 'bootstrap-token-at-least-24-chars' });
  const make = () =>
    new Request('https://sonora.test/api/admin/bootstrap', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-bootstrap-token': env.ADMIN_BOOTSTRAP_TOKEN },
      body: JSON.stringify({ username: 'admin', password: 'a-serious-password' }),
    });
  const first = await worker.fetch(make(), env);
  assert.equal(first.status, 200);
  const second = await worker.fetch(make(), env);
  assert.equal(second.status, 400);
});
