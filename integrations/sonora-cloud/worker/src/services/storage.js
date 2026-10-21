/**
 * R2 + D1 storage coordination. No cross-provider transaction exists, so every
 * step is recorded with an idempotency key and re-runs are safe.
 */
import { audioKey, coverKey, nowIso } from '../lib/ids.js';

export const STORAGE_STATES = ['pending', 'uploading', 'stored', 'failed', 'deleted'];

export async function beginOperation(db, { trackId, provider, objectKey }) {
  const idempotencyKey = `${trackId}:${provider}:${objectKey}`;
  await db
    .prepare(
      `INSERT INTO track_storage (track_id, provider, object_key, state, idempotency_key, updated_at)
       VALUES (?, ?, ?, 'uploading', ?, ?)
       ON CONFLICT (track_id, provider, object_key) DO UPDATE SET
         state = CASE WHEN track_storage.state = 'stored' THEN 'stored' ELSE 'uploading' END,
         updated_at = excluded.updated_at`
    )
    .bind(trackId, provider, objectKey, idempotencyKey, nowIso())
    .run();
  return idempotencyKey;
}

export async function completeOperation(db, { trackId, provider, objectKey, sizeBytes, checksum }) {
  await db
    .prepare(
      `UPDATE track_storage SET state='stored', size_bytes=?, checksum=?, last_error=NULL, updated_at=?
       WHERE track_id=? AND provider=? AND object_key=?`
    )
    .bind(sizeBytes ?? null, checksum ?? null, nowIso(), trackId, provider, objectKey)
    .run();
}

export async function failOperation(db, { trackId, provider, objectKey, error }) {
  await db
    .prepare(
      `UPDATE track_storage SET state='failed', last_error=?, updated_at=?
       WHERE track_id=? AND provider=? AND object_key=?`
    )
    .bind(String(error).slice(0, 500), nowIso(), trackId, provider, objectKey)
    .run();
}

/** True only when every required provider operation reached 'stored'. */
export async function allStored(db, trackId, required) {
  const { results } = await db
    .prepare('SELECT provider, state FROM track_storage WHERE track_id = ?')
    .bind(trackId)
    .all();
  const states = new Map((results || []).map((r) => [r.provider, r.state]));
  return required.every((p) => states.get(p) === 'stored');
}

export async function putR2(env, key, bytes, contentType) {
  if (!env.MEDIA) throw new Error('R2 binding MEDIA is not configured');
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });
}

/** Range-aware read for seeking. Returns 416 for unsatisfiable ranges. */
export async function getR2Object(env, key, rangeHeader) {
  if (!env.MEDIA) throw new Error('R2 binding MEDIA is not configured');
  const meta = await env.MEDIA.head(key);
  if (!meta) return null;
  const size = meta.size;
  const etag = meta.httpEtag || `"${meta.etag}"`;
  const baseHeaders = {
    'content-type': meta.httpMetadata?.contentType || 'application/octet-stream',
    'accept-ranges': 'bytes',
    etag,
    'cache-control': meta.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable',
  };

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) return { status: 416, headers: { ...baseHeaders, 'content-range': `bytes */${size}` } };
    let start = match[1] === '' ? null : Number(match[1]);
    let end = match[2] === '' ? null : Number(match[2]);
    if (start === null && end === null) return { status: 416, headers: { ...baseHeaders, 'content-range': `bytes */${size}` } };
    if (start === null) {
      start = Math.max(0, size - end);
      end = size - 1;
    } else if (end === null || end >= size) {
      end = size - 1;
    }
    if (start > end || start >= size) {
      return { status: 416, headers: { ...baseHeaders, 'content-range': `bytes */${size}` } };
    }
    const object = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!object) return null;
    return {
      status: 206,
      headers: { ...baseHeaders, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
      body: object.body,
    };
  }

  const object = await env.MEDIA.get(key);
  if (!object) return null;
  return { status: 200, headers: { ...baseHeaders, 'content-length': String(size) }, body: object.body };
}

export async function deleteR2(env, key) {
  if (!env.MEDIA) throw new Error('R2 binding MEDIA is not configured');
  await env.MEDIA.delete(key);
}

export async function deleteR2IfUnreferenced(db, env, key, trackId) {
  const { results } = await db
    .prepare('SELECT id FROM tracks WHERE cover_key = ? AND id != ? AND status != ?')
    .bind(key, trackId, 'deleted')
    .all();
  if ((results || []).length) return { deleted: false, reason: 'shared' };
  await deleteR2(env, key);
  return { deleted: true };
}

export { audioKey, coverKey };
