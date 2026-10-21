/**
 * Public API. Only 'ready', non-deleted tracks leave this module.
 */
import { json, fail } from '../lib/http.js';
import { secondsToDisplay } from '../lib/ids.js';

export function toManifestTrack(track, env) {
  return {
    id: track.id,
    file: `${env.MEDIA_BASE_URL || '/media'}/${track.audio_key}`,
    title: track.title || track.id,
    artist: track.artist || 'Unknown Artist',
    album: track.album || 'Singles',
    year: track.year ?? null,
    genre: track.genre || null,
    duration: secondsToDisplay(track.duration_seconds),
    cover: track.cover_key ? `${env.MEDIA_BASE_URL || '/media'}/${track.cover_key}` : null,
  };
}

export async function getManifest(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, title, artist, album, year, genre, duration_seconds, cover_key, audio_key, ready_at
     FROM tracks
     WHERE status = 'ready' AND deleted_at IS NULL AND audio_key IS NOT NULL
     ORDER BY ready_at DESC, id DESC
     LIMIT 2000`
  ).all();
  return json({
    _readme: 'Generated from D1. Do not edit by hand.',
    generated_at: new Date().toISOString(),
    tracks: (results || []).map((t) => toManifestTrack(t, env)),
  });
}

export async function getLyrics(env, trackId) {
  const row = await env.DB.prepare(
    `SELECT l.track_id, l.source, l.format, l.status, l.text, l.segments
     FROM lyrics l JOIN tracks t ON t.id = l.track_id
     WHERE l.track_id = ? AND t.status = 'ready' AND t.deleted_at IS NULL`
  )
    .bind(trackId)
    .first();
  if (!row) return fail(404, 'not_found', 'no lyrics for this track');
  return json({
    track_id: row.track_id,
    source: row.source,
    format: row.format,
    status: row.status,
    text: row.text,
    segments: row.segments ? JSON.parse(row.segments) : null,
  });
}
