/**
 * Durable job store. D1 is the source of truth; the Queue message only carries an ID.
 * Every state transition is a single UPDATE guarded by the expected current state,
 * which makes at-least-once delivery idempotent.
 */
import { newId, nowIso } from '../lib/ids.js';

export async function enqueueJob(db, { type, trackId = null, payload = null, maxAttempts = 5 }) {
  const id = newId();
  await db.prepare(
    `INSERT INTO jobs (id, type, track_id, payload, max_attempts, status, next_attempt_at)
     VALUES (?, ?, ?, ?, ?, 'queued', ?)`
  ).bind(id, type, trackId, payload ? JSON.stringify(payload) : null, maxAttempts, nowIso()).run();
  return id;
}

/** Claims a job for a consumer. Returns null when already done, leased, or gone. */
export async function claimJob(db, jobId, leaseSeconds = 120) {
  const leaseUntil = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const row = await db.prepare(
    `UPDATE jobs SET status = 'running', attempts = attempts + 1, lease_until = ?, updated_at = ?
     WHERE id = ? AND status IN ('queued','failed')
       AND (lease_until IS NULL OR lease_until < ?)
     RETURNING *`
  ).bind(leaseUntil, nowIso(), jobId, nowIso()).first();
  return row || null;
}

export async function finishJob(db, jobId) {
  await db.prepare(
    `UPDATE jobs SET status = 'succeeded', lease_until = NULL, last_error = NULL, updated_at = ?
     WHERE id = ?`
  ).bind(nowIso(), jobId).run();
}

/** Records a recoverable failure; moves to dead letter once attempts are exhausted. */
export async function failJob(db, jobId, message, retryDelaySeconds = 30) {
  const row = await db.prepare('SELECT attempts, max_attempts FROM jobs WHERE id = ?').bind(jobId).first();
  if (!row) return { dead: true };
  const dead = row.attempts >= row.max_attempts;
  const next = new Date(Date.now() + retryDelaySeconds * 1000).toISOString();
  await db.prepare(
    `UPDATE jobs SET status = ?, lease_until = NULL, last_error = ?, next_attempt_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(dead ? 'dead' : 'failed', String(message).slice(0, 1000), dead ? null : next, nowIso(), jobId).run();
  return { dead };
}

export const JOB_STATES = ['queued', 'running', 'succeeded', 'failed', 'dead'];
