/**
 * Import pipeline: download -> probe -> tag -> R2 -> Dropbox -> lyrics -> ready.
 * Each stage records durable state so a retry only redoes unfinished work.
 */
import { audioKey, coverKey, nowIso } from '../lib/ids.js';
import { probeDuration, isPreview, audioContentType, PREVIEW_MAX_SECONDS } from '../services/audio.js';
import { readId3, normalizeText, parseFilename } from '../services/tags.js';
import { resolveMetadata, completeMetadataWithAi } from '../services/metadata.js';
import { telegram } from '../services/telegram.js';
import { pickTranscriber } from '../services/transcribe.js';
import { cleanupSegments, lyricSegmentsToText } from '../services/lyrics.js';
import {
  beginOperation,
  completeOperation,
  failOperation,
  putR2,
  allStored,
} from '../services/storage.js';
import { pickAccount, uploadFile, checkAccount } from '../services/dropbox.js';

function previewThreshold(env) {
  const configured = Number(env.PREVIEW_MAX_SECONDS);
  return Number.isFinite(configured) && configured > 0 ? configured : PREVIEW_MAX_SECONDS;
}

export class ImportError extends Error {
  constructor(message, { retryable = true, code = 'import_failed' } = {}) {
    super(message);
    this.name = 'ImportError';
    this.retryable = retryable;
    this.code = code;
  }
}

function logErrorRow(db, { category, stage, trackId, message }) {
  return db
    .prepare('INSERT INTO error_log (id, category, stage, track_id, message) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), category, stage, trackId, String(message).slice(0, 800))
    .run();
}

export async function importTrack(env, trackId, meta = {}) {
  const db = env.DB;
  const track = await db.prepare('SELECT * FROM tracks WHERE id = ?').bind(trackId).first();
  if (!track) throw new ImportError('track not found', { retryable: false });
  if (track.status === 'ready') return { ok: true, skipped: 'already_ready' };
  if (track.status === 'deleted' || track.status === 'deleting') return { ok: true, skipped: 'deleted' };

  const source = JSON.parse(track.source_metadata || '{}');

  await db.prepare(`UPDATE tracks SET status='processing', updated_at=? WHERE id=?`).bind(nowIso(), trackId).run();

  // 1. Download (bounded by the Telegram adapter).
  let bytes;
  try {
    const file = await telegram.getFile(env, source.fileId);
    bytes = await telegram.downloadFile(env, file.file_path);
  } catch (err) {
    await logErrorRow(db, { category: 'telegram_download', stage: 'download', trackId, message: err.message });
    await failTrack(db, trackId, err.message, err.code === 'file_too_large' ? 'failed' : 'pending');
    throw new ImportError(err.message, { retryable: err.code !== 'file_too_large' });
  }

  // An unidentified container keeps the 'bin' marker: it is stored as opaque
  // bytes instead of pretending to be MP3.
  const ext = meta.ext && /^(mp3|m4a|ogg|opus|flac|wav)$/.test(meta.ext) ? meta.ext : 'bin';

  // 2. Duration: trusted metadata first, never assumed zero.
  const id3 = readId3(bytes);
  const probed = probeDuration(bytes, ext);
  const duration = Number.isInteger(source.durationSeconds)
    ? source.durationSeconds
    : Number.isInteger(probed)
      ? probed
      : null;

  if (duration != null && isPreview(duration, previewThreshold(env))) {
    await db
      .prepare(`UPDATE tracks SET status='failed', error=?, updated_at=? WHERE id=?`)
      .bind(`preview_too_short: ${duration}s is at or below ${previewThreshold(env)}s`, nowIso(), trackId)
      .run();
    return { ok: false, rejected: 'preview_too_short' };
  }

  // 3. Metadata: deterministic sources, then the model for gaps only.
  const resolved = resolveMetadata({
    tags: id3.tags,
    telegram: { title: source.title, artist: source.performer, album: null },
    filename: parseFilename(source.filename),
  });
  const completed = await completeMetadataWithAi(env, resolved.values, {
    filename: source.filename,
    caption: source.caption,
  });

  // 4. R2 uploads. Stable keys, independent of titles.
  const aKey = audioKey(trackId, ext);
  const contentType = audioContentType(ext);
  await beginOperation(db, { trackId, provider: 'r2', objectKey: aKey });
  try {
    await putR2(env, aKey, bytes, contentType);
    await completeOperation(db, { trackId, provider: 'r2', objectKey: aKey, sizeBytes: bytes.length });
  } catch (err) {
    await failOperation(db, { trackId, provider: 'r2', objectKey: aKey, error: err.message });
    await logErrorRow(db, { category: 'r2_upload', stage: 'r2', trackId, message: err.message });
    throw new ImportError(`R2 upload failed: ${err.message}`);
  }

  let cKey = null;
  if (id3.cover) {
    cKey = coverKey(trackId, imageExt(id3.cover.mime));
    await beginOperation(db, { trackId, provider: 'r2', objectKey: cKey });
    try {
      await putR2(env, cKey, id3.cover.data, id3.cover.mime);
      await completeOperation(db, { trackId, provider: 'r2', objectKey: cKey, sizeBytes: id3.cover.data.length });
    } catch (err) {
      await failOperation(db, { trackId, provider: 'r2', objectKey: cKey, error: err.message });
      // Artwork is optional; a failure must not block the audio.
      await logErrorRow(db, { category: 'r2_cover', stage: 'r2', trackId, message: err.message });
      cKey = null;
    }
  }

  // 5. Dropbox archive. Failure is recoverable and does not publish a broken track.
  const account = await pickAccount(db, env, bytes.length);
  let dropboxPath = null;
  let dropboxAccountId = null;
  if (account) {
    const path = `${account.folder}/originals/${trackId}.${ext}`;
    await beginOperation(db, { trackId, provider: 'dropbox', objectKey: path });
    try {
      const tokenAccount = account.access_token ? account : account;
      await uploadFile(db, env, tokenAccount, path, bytes);
      await completeOperation(db, { trackId, provider: 'dropbox', objectKey: path, sizeBytes: bytes.length });
      dropboxPath = path;
      dropboxAccountId = account.id;
    } catch (err) {
      await failOperation(db, { trackId, provider: 'dropbox', objectKey: path, error: err.message });
      await logErrorRow(db, { category: 'dropbox_upload', stage: 'dropbox', trackId, message: err.message });
      await checkAccount(db, env, account);
    }
  } else {
    await logErrorRow(db, {
      category: 'dropbox_unavailable',
      stage: 'dropbox',
      trackId,
      message: 'no enabled Dropbox account is configured or has capacity',
    });
  }

  // 6. Lyrics. Embedded synchronized lyrics win; plain text is not upgraded.
  const lyrics = await resolveLyrics(env, db, { trackId, bytes, id3, filename: source.filename, language: completed.values.language, ext });

  // 7. Publish only when every required object exists and metadata is usable.
  const stored = await allStored(db, trackId, ['r2']);
  const title = completed.values.title || source.title || null;
  const artist = completed.values.artist || source.performer || null;
  const canPublish = stored && Boolean(title) && Boolean(artist) && duration != null;

  const status = canPublish ? 'ready' : 'needs_review';
  await db
    .prepare(
      `UPDATE tracks SET title=?, artist=?, album=?, year=?, genre=?, language=?, duration_seconds=?,
        cover_key=?, audio_key=?, dropbox_account_id=?, dropbox_path=?, status=?, ready_at=?, error=?, updated_at=?
       WHERE id=?`
    )
    .bind(
      title,
      artist,
      completed.values.album ?? null,
      completed.values.year ?? null,
      completed.values.genre ?? null,
      completed.values.language ?? null,
      duration,
      cKey,
      aKey,
      dropboxAccountId,
      dropboxPath,
      status,
      status === 'ready' ? nowIso() : null,
      canPublish
        ? null
        : `incomplete: ${[
            !stored && 'storage',
            !title && 'title',
            !artist && 'artist',
            duration == null && 'duration_unknown',
          ]
            .filter(Boolean)
            .join(',')}`,
      nowIso(),
      trackId
    )
    .run();

  return { ok: true, status, lyrics: lyrics.kind };
}

async function resolveLyrics(env, db, { trackId, bytes, id3, filename, language, ext }) {
  if (id3.syncedLyrics && id3.syncedLyrics.length) {
    await saveLyrics(db, trackId, {
      source: 'embedded',
      format: 'line',
      status: 'ready',
      text: lyricSegmentsToText(id3.syncedLyrics),
      segments: id3.syncedLyrics,
      raw: null,
      model: null,
    });
    return { kind: 'embedded_synced' };
  }

  if (id3.plainLyrics) {
    // Preserved verbatim, explicitly not synchronized.
    await saveLyrics(db, trackId, {
      source: 'embedded',
      format: 'plain',
      status: 'ready',
      text: id3.plainLyrics,
      segments: null,
      raw: null,
      model: null,
    });
    return { kind: 'embedded_plain' };
  }

  // Transcription is the default path; only an explicit opt-out skips it.
  // Embedded SYLT/USLT above are unaffected by this setting.
  if (!transcriptionEnabled(env)) return { kind: 'skipped' };
  // An unidentifiable container is not sent to Whisper: that would burn an AI
  // call on bytes we could not classify. The track is already needs_review.
  if (ext === 'bin') return { kind: 'unsupported_format' };

  let transcription;
  try {
    transcription = await pickTranscriber(env).transcribe(bytes, {
      language: language || undefined,
      filename: `${trackId}.${ext}`,
    });
  } catch (err) {
    await db
      .prepare(
        `INSERT INTO lyrics (track_id, source, format, status, model) VALUES (?, 'generated', 'plain', 'failed', ?)
         ON CONFLICT (track_id) DO UPDATE SET status='failed', model=excluded.model, updated_at=datetime('now')`
      )
      .bind(trackId, `${transcriptionProvider(env)}`)
      .run();
    await db
      .prepare('INSERT INTO error_log (id, category, stage, track_id, message) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), 'transcription', 'lyrics', trackId, String(err.message).slice(0, 500))
      .run();
    return { kind: 'failed' };
  }

  const segments = transcription.segments.length
    ? transcription.segments
    : [{ id: 'seg-0', start: 0, end: 0, text: transcription.text }];

  let cleaned = segments;
  let status = 'ready';
  let format = transcription.segments.length ? 'line' : 'plain';
  let model = `${transcription.provider}:${transcription.model}`;

  if (segments.length && transcription.segments.length) {
    const result = await cleanupSegments(env, segments, { language: language || 'fa' });
    if (result.ok) {
      cleaned = result.segments;
      model += `+${env.CLEANUP_MODEL || '@cf/qwen/qwen3.8-27b'}`;
    } else {
      status = 'needs_review';
    }
  }

  await saveLyrics(db, trackId, {
    source: 'generated',
    format,
    status,
    text: lyricSegmentsToText(cleaned),
    segments: transcribedSegments(cleaned),
    raw: transcription.text,
    model,
  });
  return { kind: transcription.provider };
}

/** Word timings become unreliable after text correction: downgrade to line-level. */
function transcribedSegments(segments) {
  return segments.map((s) => ({
    id: s.id,
    start: s.start,
    end: s.end,
    text: s.text,
  }));
}

function transcriptionProvider(env) {
  return String(env.TRANSCRIPTION_PROVIDER || 'cloudflare') === 'groq' && env.GROQ_API_KEY
    ? 'groq'
    : 'cloudflare';
}

/**
 * `TRANSCRIBE_ON_IMPORT` is opt-out: unset/`true` transcribes, `false` disables
 * automatic transcription only. Embedded lyrics are always extracted first.
 */
export function transcriptionEnabled(env) {
  return String(env.TRANSCRIBE_ON_IMPORT ?? 'true').trim().toLowerCase() !== 'false';
}

async function saveLyrics(db, trackId, { source, format, status, text, segments, raw, model }) {
  await db
    .prepare(
      `INSERT INTO lyrics (track_id, source, format, status, text, segments, raw_transcript, model, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (track_id) DO UPDATE SET
         source=excluded.source, format=excluded.format, status=excluded.status, text=excluded.text,
         segments=excluded.segments, raw_transcript=excluded.raw_transcript, model=excluded.model,
         updated_at=excluded.updated_at
       WHERE lyrics.manual_override = 0`
    )
    .bind(
      trackId,
      source,
      format,
      status,
      text,
      segments ? JSON.stringify(segments) : null,
      raw,
      model,
      nowIso()
    )
    .run();
}

function imageExt(mime) {
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  return 'jpg';
}

async function failTrack(db, trackId, message, status = 'pending') {
  await db
    .prepare('UPDATE tracks SET status=?, error=?, updated_at=? WHERE id=?')
    .bind(status, String(message).slice(0, 500), nowIso(), trackId)
    .run();
}
