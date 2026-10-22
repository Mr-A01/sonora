import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importTrack } from '../src/jobs/import.js';
import { cleanupTrack, markDeleted } from '../src/jobs/cleanup.js';
import { fakeEnv, fakeAi } from './harness.js';
import { makeMp3 } from './fixtures.js';

/** Redirects the Telegram download path to an in-memory fixture. */
function stubTelegram(bytes, { failDownload = false } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/getFile')) {
      return new Response(JSON.stringify({ ok: true, result: { file_path: 'voice/file.mp3', file_size: bytes.length } }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (u.includes('/file/bot')) {
      if (failDownload) return new Response('nope', { status: 500 });
      return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
    }
    return original(url);
  };
  return () => {
    globalThis.fetch = original;
  };
}

async function seedTrack(env, { duration = 180 } = {}) {
  const id = crypto.randomUUID();
  const sourceId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO sources (id, chat_id, title) VALUES (?, ?, ?)').bind(sourceId, '-100', 'Chan').run();
  await env.DB.prepare(
    `INSERT INTO tracks (id, source_id, source_sequence, telegram_chat_id, telegram_message_id, status, source_metadata, duration_seconds)
     VALUES (?, ?, 1, '-100', 1, 'pending', ?, ?)`
  )
    .bind(
      id,
      sourceId,
      JSON.stringify({ fileId: 'f1', filename: 'Aurora - Night Signal.mp3', durationSeconds: duration }),
      duration
    )
    .run();
  return id;
}

test('full import publishes a ready track with R2 audio', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'Night Signal', artist: 'Aurora' } }));
  try {
    const result = await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(result.status, 'ready');
    const row = await env.DB.prepare('SELECT * FROM tracks WHERE id = ?').bind(trackId).first();
    assert.equal(row.title, 'Night Signal');
    assert.equal(row.artist, 'Aurora');
    assert.equal(row.year, null, 'year must stay null rather than being invented');
    assert.ok(row.audio_key);
    assert.ok(env.MEDIA.store.has(row.audio_key));
    const manifest = await env.DB.prepare(`SELECT id FROM tracks WHERE status='ready'`).all();
    assert.equal(manifest.results.length, 1);
  } finally {
    restore();
  }
});

test('a download failure leaves the track unpublished and retryable', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200 }), { failDownload: true });
  try {
    await assert.rejects(() => importTrack(env, trackId, { ext: 'mp3' }));
    const row = await env.DB.prepare('SELECT status FROM tracks WHERE id = ?').bind(trackId).first();
    assert.equal(row.status, 'pending');
    const errors = await env.DB.prepare('SELECT COUNT(*) AS n FROM error_log').first();
    assert.ok(errors.n >= 1);
  } finally {
    restore();
  }
});

test('unknown duration is never published as zero', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env, { duration: null });
  const restore = stubTelegram(new Uint8Array(1000).fill(1)); // unparseable audio
  try {
    const result = await importTrack(env, trackId, { ext: 'bin' });
    assert.equal(result.status, 'needs_review');
    const row = await env.DB.prepare('SELECT duration_seconds, error FROM tracks WHERE id = ?').bind(trackId).first();
    assert.equal(row.duration_seconds, null);
    assert.match(row.error, /duration_unknown/);
  } finally {
    restore();
  }
});

test('embedded synchronized lyrics skip transcription', async () => {
  let transcribed = false;
  const env = fakeEnv({
    AI: {
      async run(model, payload) {
        if (String(model).includes('whisper')) {
          transcribed = true;
          return { text: 'should not run', segments: [] };
        }
        return { choices: [{ message: { content: '{}' } }] };
      },
    },
  });
  const trackId = await seedTrack(env);
  const bytes = makeMp3({
    seconds: 200,
    id3: { title: 'T', artist: 'A', synced: true, syncedMs: [[0, 'یک'], [5000, 'دو']] },
  });
  const restore = stubTelegram(bytes);
  try {
    await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(transcribed, false, 'Whisper must not run when SYLT exists');
    const lyrics = await env.DB.prepare('SELECT source, format, segments FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.source, 'embedded');
    assert.equal(lyrics.format, 'line');
    const segments = JSON.parse(lyrics.segments);
    assert.equal(segments[1].start, 5);
  } finally {
    restore();
  }
});

test('plain embedded lyrics are stored as plain, never as synchronized', async () => {
  const env = fakeEnv({ AI: { async run() { throw new Error('must not be called'); } } });
  const trackId = await seedTrack(env);
  const bytes = makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A', plain: 'یک\nدو' } });
  const restore = stubTelegram(bytes);
  try {
    await importTrack(env, trackId, { ext: 'mp3' });
    const lyrics = await env.DB.prepare('SELECT source, format, segments FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.format, 'plain');
    assert.equal(lyrics.segments, null);
  } finally {
    restore();
  }
});

test('missing lyrics trigger the transcription path', async () => {
  const env = fakeEnv({ AI: fakeAi() });
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A' } }));
  try {
    await importTrack(env, trackId, { ext: 'mp3' });
    const lyrics = await env.DB.prepare('SELECT source, model FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.source, 'generated');
    assert.match(lyrics.model, /cloudflare/);
  } finally {
    restore();
  }
});

test('deletion removes the manifest entry, then cleans storage', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A', cover: new Uint8Array(300).fill(9) } }));
  try {
    await importTrack(env, trackId, { ext: 'mp3' });
  } finally {
    restore();
  }
  const before = await env.DB.prepare('SELECT audio_key, cover_key FROM tracks WHERE id = ?').bind(trackId).first();
  assert.ok(env.MEDIA.store.has(before.audio_key));

  await markDeleted(env, trackId);
  const lyricsRow = await env.DB.prepare('SELECT status FROM tracks WHERE id = ?').bind(trackId).first();
  assert.equal(lyricsRow.status, 'deleting');

  const result = await cleanupTrack(env, trackId);
  assert.equal(result.ok, true);
  assert.equal(env.MEDIA.store.has(before.audio_key), false);
  assert.equal(env.MEDIA.store.has(before.cover_key), false);
  const after = await env.DB.prepare('SELECT status FROM tracks WHERE id = ?').bind(trackId).first();
  assert.equal(after.status, 'deleted');
});

test('shared artwork survives until no track references it', async () => {
  const env = fakeEnv();
  const shared = 'covers/shared.jpg';
  await env.MEDIA.put(shared, new Uint8Array([1, 2, 3]));
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO tracks (id, title, status, cover_key) VALUES (?, 'A', 'ready', ?)`).bind(a, shared).run();
  await env.DB.prepare(`INSERT INTO tracks (id, title, status, cover_key) VALUES (?, 'B', 'ready', ?)`).bind(b, shared).run();

  await markDeleted(env, a);
  await cleanupTrack(env, a);
  assert.equal(env.MEDIA.store.has(shared), true, 'artwork still referenced by track B');

  await markDeleted(env, b);
  await cleanupTrack(env, b);
  assert.equal(env.MEDIA.store.has(shared), false, 'last reference removed the object');
});

test('failed cleanup stays visible and retryable', async () => {
  const env = fakeEnv({ MEDIA: { async delete() { throw new Error('r2 down'); }, async put() {}, async get() {}, async head() { return null; } } });
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO tracks (id, title, status, audio_key) VALUES (?, 'X', 'ready', 'audio/x.mp3')`).bind(id).run();
  await markDeleted(env, id);
  const result = await cleanupTrack(env, id);
  assert.equal(result.ok, false);
  const row = await env.DB.prepare('SELECT status, error FROM tracks WHERE id = ?').bind(id).first();
  assert.equal(row.status, 'deleting');
  assert.match(row.error, /cleanup_failed/);
});

test('two accounts: fallback selection skips a full account', async () => {
  const { pickAccount } = await import('../src/services/dropbox.js');
  const env = fakeEnv();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO dropbox_accounts (id, label, refresh_token_enc, refresh_token_iv, enabled, health, quota_used, quota_total)
     VALUES ('a','full','x','y',1,'healthy',100,105)`
  ).run();
  await env.DB.prepare(
    `INSERT INTO dropbox_accounts (id, label, refresh_token_enc, refresh_token_iv, enabled, health, quota_used, quota_total, created_at)
     VALUES ('b','roomy','x','y',1,'healthy',10,900000000000,?)`
  ).bind(now).run();
  const chosen = await pickAccount(env.DB, env, 1024 * 1024);
  assert.equal(chosen.id, 'b');
});
