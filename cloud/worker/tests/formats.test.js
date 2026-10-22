import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectAudioExtension,
  audioContentType,
  AUDIO_CONTENT_TYPES,
} from '../src/services/audio.js';
import { importTrack, transcriptionEnabled } from '../src/jobs/import.js';
import { fakeEnv, fakeAi } from './harness.js';
import { makeMp3 } from './fixtures.js';

function stubTelegram(bytes) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/getFile')) {
      return new Response(JSON.stringify({ ok: true, result: { file_path: 'voice/file', file_size: bytes.length } }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (u.includes('/file/bot')) {
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
      JSON.stringify({ fileId: 'f1', filename: 'x.mp3', durationSeconds: duration }),
      duration
    )
    .run();
  return id;
}

// --- format detection -------------------------------------------------------

test('declared MIME types map to the right container and content type', () => {
  const cases = [
    ['audio/mpeg', 'song.mp3', 'mp3', 'audio/mpeg'],
    ['audio/mp4', 'song.m4a', 'm4a', 'audio/mp4'],
    ['audio/x-m4a', 'song.m4a', 'm4a', 'audio/mp4'],
    ['audio/aac', 'song.aac', 'm4a', 'audio/mp4'],
    ['audio/ogg', 'song.ogg', 'ogg', 'audio/ogg'],
    ['audio/vorbis', 'song.oga', 'ogg', 'audio/ogg'],
    ['audio/opus', 'song.opus', 'opus', 'audio/ogg'],
    ['audio/flac', 'song.flac', 'flac', 'audio/flac'],
    ['audio/x-flac', 'song.flac', 'flac', 'audio/flac'],
    ['audio/wav', 'song.wav', 'wav', 'audio/wav'],
    ['audio/x-wav', 'song.wav', 'wav', 'audio/wav'],
  ];
  for (const [mime, filename, ext, contentType] of cases) {
    assert.equal(detectAudioExtension(mime, filename), ext, `${mime} should be ${ext}`);
    assert.equal(audioContentType(ext), contentType, `${ext} should be ${contentType}`);
  }
});

test('MIME type wins over a misleading filename', () => {
  assert.equal(detectAudioExtension('audio/mp4', 'track.mp3'), 'm4a', 'M4A bytes must not be labelled MP3');
  assert.equal(detectAudioExtension('audio/flac', 'track.mp3'), 'flac');
  assert.equal(detectAudioExtension('audio/mpeg', 'track.m4a'), 'mp3');
});

test('unknown formats resolve to bin and a non-audio content type', () => {
  assert.equal(detectAudioExtension('application/octet-stream', 'blob.dat'), 'bin');
  assert.equal(detectAudioExtension('', ''), 'bin');
  assert.equal(audioContentType('bin'), 'application/octet-stream');
  assert.equal(audioContentType('something-else'), 'application/octet-stream');
});

test('filename fallback is used only when no MIME type identifies the format', () => {
  assert.equal(detectAudioExtension('application/octet-stream', 'song.m4a'), 'm4a');
  assert.equal(detectAudioExtension('', 'song.flac'), 'flac');
  assert.equal(detectAudioExtension('application/octet-stream', 'song.OPUS'), 'opus');
});

test('every declared content type is a real media or binary type', () => {
  for (const [ext, type] of Object.entries(AUDIO_CONTENT_TYPES)) {
    assert.match(type, /^audio\/[a-z0-9.+-]+$|^application\/octet-stream$/, `${ext} -> ${type}`);
  }
  assert.equal(AUDIO_CONTENT_TYPES.m4a, 'audio/mp4', 'm4a must never be audio/ogg');
});

// --- stored R2 metadata -----------------------------------------------------

test('m4a import stores audio/mp4 in R2 metadata and keys', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env);
  const restore = stubTelegram(new Uint8Array(512).fill(7));
  try {
    const result = await importTrack(env, trackId, { ext: 'm4a' });
    // Duration is unknown for M4A, so it must not be published as ready.
    assert.equal(result.status, 'needs_review');
    const row = await env.DB.prepare('SELECT audio_key FROM tracks WHERE id = ?').bind(trackId).first();
    assert.match(row.audio_key, /\.m4a$/);
    assert.equal(env.MEDIA.store.get(row.audio_key).httpMetadata.contentType, 'audio/mp4');
  } finally {
    restore();
  }
});

test('unidentified audio is stored as opaque bytes, never as MP3', async () => {
  const env = fakeEnv();
  const trackId = await seedTrack(env, { duration: null });
  const restore = stubTelegram(new Uint8Array(400).fill(3));
  try {
    const result = await importTrack(env, trackId, { ext: 'bin' });
    assert.equal(result.status, 'needs_review');
    assert.equal(result.lyrics, 'unsupported_format', 'no Whisper call on unidentified bytes');
    const row = await env.DB.prepare('SELECT audio_key FROM tracks WHERE id = ?').bind(trackId).first();
    assert.ok(!/\.mp3$/.test(row.audio_key), `unexpected MP3 key: ${row.audio_key}`);
    assert.equal(
      env.MEDIA.store.get(row.audio_key).httpMetadata.contentType,
      'application/octet-stream'
    );
  } finally {
    restore();
  }
});

test('an unsupported ext argument degrades to bin instead of guessing', async () => {
  const env = fakeEnv({ AI: { async run() { throw new Error('AI must not run'); } } });
  const trackId = await seedTrack(env, { duration: null });
  const restore = stubTelegram(new Uint8Array(400).fill(3));
  try {
    await importTrack(env, trackId, { ext: 'exe' });
    const row = await env.DB.prepare('SELECT audio_key FROM tracks WHERE id = ?').bind(trackId).first();
    assert.ok(!/\.exe$/.test(row.audio_key), 'unknown extension must not reach the object key');
    assert.equal(
      env.MEDIA.store.get(row.audio_key).httpMetadata.contentType,
      'application/octet-stream'
    );
  } finally {
    restore();
  }
});

test('mp3 and flac uploads keep their media types', async () => {
  for (const [ext, expected, bytes] of [
    ['mp3', 'audio/mpeg', makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A' } })],
    ['flac', 'audio/flac', new Uint8Array(64).fill(0)],
  ]) {
    const env = fakeEnv();
    const trackId = await seedTrack(env);
    const restore = stubTelegram(bytes);
    try {
      await importTrack(env, trackId, { ext });
      const row = await env.DB.prepare('SELECT audio_key FROM tracks WHERE id = ?').bind(trackId).first();
      assert.equal(env.MEDIA.store.get(row.audio_key).httpMetadata.contentType, expected);
    } finally {
      restore();
    }
  }
});

// --- transcription configuration -------------------------------------------

test('TRANSCRIBE_ON_IMPORT defaults to enabled', () => {
  assert.equal(transcriptionEnabled({}), true);
  assert.equal(transcriptionEnabled({ TRANSCRIBE_ON_IMPORT: 'true' }), true);
  assert.equal(transcriptionEnabled({ TRANSCRIBE_ON_IMPORT: 'TRUE' }), true);
  assert.equal(transcriptionEnabled({ TRANSCRIBE_ON_IMPORT: '' }), true, 'empty means default, not off');
  assert.equal(transcriptionEnabled({ TRANSCRIBE_ON_IMPORT: 'false' }), false);
  assert.equal(transcriptionEnabled({ TRANSCRIBE_ON_IMPORT: ' FALSE ' }), false);
});

test('disabled transcription skips Whisper and creates no lyrics row', async () => {
  let whisperCalls = 0;
  const env = fakeEnv({
    TRANSCRIBE_ON_IMPORT: 'false',
    AI: {
      async run(model, payload) {
        if (String(model).includes('whisper')) whisperCalls++;
        return fakeAi().run(model, payload);
      },
    },
  });
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A' } }));
  try {
    const result = await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(result.lyrics, 'skipped');
    assert.equal(whisperCalls, 0, 'no Whisper call when transcription is disabled');
    const lyrics = await env.DB.prepare('SELECT COUNT(*) AS n FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.n, 0);
  } finally {
    restore();
  }
});

test('disabled transcription still extracts embedded synchronized lyrics', async () => {
  let whisperCalls = 0;
  const env = fakeEnv({
    TRANSCRIBE_ON_IMPORT: 'false',
    AI: {
      async run(model, payload) {
        if (String(model).includes('whisper')) whisperCalls++;
        return fakeAi().run(model, payload);
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
    const result = await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(result.lyrics, 'embedded_synced');
    assert.equal(whisperCalls, 0);
    const lyrics = await env.DB.prepare('SELECT source, format FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.source, 'embedded');
    assert.equal(lyrics.format, 'line');
  } finally {
    restore();
  }
});

test('disabled transcription still extracts embedded plain lyrics', async () => {
  const env = fakeEnv({ TRANSCRIBE_ON_IMPORT: 'false', AI: { async run() { throw new Error('no AI'); } } });
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A', plain: 'یک\nدو' } }));
  try {
    const result = await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(result.lyrics, 'embedded_plain');
    const lyrics = await env.DB.prepare('SELECT format FROM lyrics WHERE track_id = ?').bind(trackId).first();
    assert.equal(lyrics.format, 'plain');
  } finally {
    restore();
  }
});

test('enabled transcription runs Whisper exactly once', async () => {
  let whisperCalls = 0;
  const env = fakeEnv({
    TRANSCRIBE_ON_IMPORT: 'true',
    AI: {
      async run(model, payload) {
        if (String(model).includes('whisper')) whisperCalls++;
        return fakeAi().run(model, payload);
      },
    },
  });
  const trackId = await seedTrack(env);
  const restore = stubTelegram(makeMp3({ seconds: 200, id3: { title: 'T', artist: 'A' } }));
  try {
    const result = await importTrack(env, trackId, { ext: 'mp3' });
    assert.equal(result.lyrics, 'cloudflare');
    assert.equal(whisperCalls, 1);
  } finally {
    restore();
  }
});
