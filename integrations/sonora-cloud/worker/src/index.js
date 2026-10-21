import { corsHeaders, fail, isAllowedOrigin, json } from './lib/http.js';
import { handleWebhook } from './routes/telegram.js';
import { handleAdmin, handleDropboxCallback } from './routes/admin.js';
import { getManifest, getLyrics } from './routes/public.js';
import { serveMedia } from './routes/media.js';
import { healthz } from './routes/health.js';
import { claimJob, finishJob, failJob } from './db/jobs.js';
import { importTrack } from './jobs/import.js';
import { cleanupTrack } from './jobs/cleanup.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const withCors = (response) => {
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(corsHeaders(request, env))) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    };

    try {
      if (path === '/api/telegram/webhook' && method === 'POST') {
        return await handleWebhook(request, env);
      }

      if (path === '/api/manifest.json' && method === 'GET') {
        return withCors(await getManifest(env));
      }

      const lyricsMatch = path.match(/^\/api\/tracks\/([A-Za-z0-9-]+)\/lyrics$/);
      if (lyricsMatch && method === 'GET') {
        return withCors(await getLyrics(env, lyricsMatch[1]));
      }

      if (path.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
        return await serveMedia(request, env, path.slice('/media/'.length));
      }

      if (path === '/api/health' && method === 'GET') {
        return withCors(json(await healthz(env)));
      }

      if (path === '/api/admin/dropbox/callback' && method === 'GET') {
        return await handleDropboxCallback(request, env);
      }

      if (path.startsWith('/api/admin/')) {
        if (!isAllowedOrigin(request, env)) return fail(403, 'origin_not_allowed', 'origin is not in ALLOWED_ORIGINS');
        return withCors(await handleAdmin(request, env, path, method));
      }

      return fail(404, 'not_found', 'no such route');
    } catch (err) {
      console.error(JSON.stringify({ category: 'unhandled', path, message: String(err.message).slice(0, 300) }));
      return withCors(fail(500, 'internal_error', 'internal error'));
    }
  },

  /**
   * Queue consumer. Messages carry identifiers only. Every handler is
   * idempotent; failures are recorded in D1 and retried with backoff.
   */
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { jobId, trackId } = message.body || {};
      if (!jobId) {
        message.ack();
        continue;
      }
      const job = await claimJob(env.DB, jobId);
      if (!job) {
        // Already finished, leased, or dead — safe to acknowledge.
        message.ack();
        continue;
      }

      try {
        let result = { ok: true };
        if (job.type === 'import') {
          result = await importTrack(env, job.track_id, job.payload ? JSON.parse(job.payload) : {});
        } else if (job.type === 'cleanup' || job.type === 'repair') {
          result = await cleanupTrack(env, job.track_id);
        }

        if (result.ok === false && result.failures) {
          const { dead } = await failJob(env.DB, jobId, result.failures.join('; '), 60);
          message.retry({ delaySeconds: dead ? 0 : 60 });
          continue;
        }
        await finishJob(env.DB, jobId);
        message.ack();
      } catch (err) {
        const retryAfter = 30;
        const { dead } = await failJob(env.DB, jobId, err.message, retryAfter);
        if (dead) {
          message.ack();
        } else {
          message.retry({ delaySeconds: retryAfter });
        }
      }
    }
  },

  /** Cron: requeue stuck jobs and retry deletion cleanup. */
  async scheduled(_event, env, ctx) {
    if (!env.IMPORT_QUEUE) return;
    ctx.waitUntil(
      (async () => {
        const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { results } = await env.DB.prepare(
          `SELECT id, track_id FROM jobs
           WHERE status IN ('queued','failed') AND (lease_until IS NULL OR lease_until < ?)
           LIMIT 20`
        )
          .bind(stale)
          .all();
        for (const job of results || []) {
          await env.IMPORT_QUEUE.send({ jobId: job.id, trackId: job.track_id });
        }
        const pendingDeletes = await env.DB.prepare(`SELECT id FROM tracks WHERE status='deleting' LIMIT 10`).all();
        for (const row of pendingDeletes.results || []) {
          await cleanupTrack(env, row.id).catch(() => {});
        }
      })()
    );
  },
};
