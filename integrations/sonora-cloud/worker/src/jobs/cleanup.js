/** Deletion: remove from the public catalog immediately, clean up in the background. */
import { nowIso } from '../lib/ids.js';
import { deleteR2, deleteR2IfUnreferenced } from '../services/storage.js';
import { deleteFile } from '../services/dropbox.js';

async function logError(db, { category, trackId, message }) {
  await db
    .prepare('INSERT INTO error_log (id, category, stage, track_id, message) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), category, 'delete', trackId, String(message).slice(0, 500))
    .run();
}

/** Idempotent: flips status to 'deleting' first so the manifest drops it immediately. */
export async function markDeleted(env, trackId) {
  const db = env.DB;
  const row = await db
    .prepare(`UPDATE tracks SET status='deleting', deleted_at=?, updated_at=? WHERE id=? AND status != 'deleted' RETURNING id`)
    .bind(nowIso(), nowIso(), trackId)
    .first();
  return Boolean(row);
}

export async function cleanupTrack(env, trackId) {
  const db = env.DB;
  const track = await db.prepare('SELECT * FROM tracks WHERE id = ?').bind(trackId).first();
  if (!track) return { ok: true, skipped: 'missing' };

  const failures = [];

  if (track.audio_key) {
    try {
      await deleteR2(env, track.audio_key);
      await db
        .prepare(`UPDATE track_storage SET state='deleted', updated_at=? WHERE track_id=? AND provider='r2' AND object_key=?`)
        .bind(nowIso(), trackId, track.audio_key)
        .run();
    } catch (err) {
      failures.push(`r2 audio: ${err.message}`);
      await logError(db, { category: 'r2_delete', trackId, message: err.message });
    }
  }

  if (track.cover_key) {
    try {
      const result = await deleteR2IfUnreferenced(db, env, track.cover_key, trackId);
      if (result.deleted) {
        await db
          .prepare(`UPDATE track_storage SET state='deleted', updated_at=? WHERE track_id=? AND provider='r2' AND object_key=?`)
          .bind(nowIso(), trackId, track.cover_key)
          .run();
      }
    } catch (err) {
      failures.push(`r2 cover: ${err.message}`);
      await logError(db, { category: 'r2_delete', trackId, message: err.message });
    }
  }

  if (track.dropbox_path && track.dropbox_account_id) {
    const account = await db
      .prepare('SELECT * FROM dropbox_accounts WHERE id = ?')
      .bind(track.dropbox_account_id)
      .first();
    if (account) {
      try {
        await deleteFile(db, env, account, track.dropbox_path);
        await db
          .prepare(`UPDATE track_storage SET state='deleted', updated_at=? WHERE track_id=? AND provider='dropbox' AND object_key=?`)
          .bind(nowIso(), trackId, track.dropbox_path)
          .run();
      } catch (err) {
        failures.push(`dropbox: ${err.message}`);
        await logError(db, { category: 'dropbox_delete', trackId, message: err.message });
      }
    }
  }

  if (failures.length) {
    await db
      .prepare(`UPDATE tracks SET status='deleting', error=?, updated_at=? WHERE id=?`)
      .bind(`cleanup_failed: ${failures.join('; ')}`.slice(0, 500), nowIso(), trackId)
      .run();
    return { ok: false, failures };
  }

  await db
    .prepare(`UPDATE tracks SET status='deleted', error=NULL, updated_at=? WHERE id=?`)
    .bind(nowIso(), trackId)
    .run();
  return { ok: true };
}

export async function retryCleanup(env) {
  const { results } = await env.DB.prepare(`SELECT id FROM tracks WHERE status='deleting' LIMIT 50`).all();
  const outcomes = [];
  for (const row of results || []) {
    outcomes.push({ trackId: row.id, ...(await cleanupTrack(env, row.id)) });
  }
  return outcomes;
}
