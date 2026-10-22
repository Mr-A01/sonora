# Operations

Deployment and runtime reference for the cloud half. Every step runs against
Cloudflare or on the deployed Worker — never against a local machine that cannot
reach Telegram.

## 0. Verification vocabulary

Use these terms precisely; they are not interchangeable.

| Statement | What it actually means |
|---|---|
| local tests passed | `npm test` in `cloud/worker`, all providers mocked, D1 via `node:sqlite` |
| bundle builds | `npm run build` (`wrangler deploy --dry-run`) succeeded |
| provider connectivity verified | `GET /api/health` on the deployed Worker returned `ok` for that provider |
| production end-to-end verified | a real file went Telegram → R2 → `status='ready'` → present in `/api/manifest.json` |

Only the first two are covered by this repository's automated checks.

## 1. Required resources and bindings

Bindings declared in `cloud/worker/wrangler.jsonc`:

| Binding | Type | Name |
|---|---|---|
| `DB` | D1 | `sonora-cloud` (`migrations_dir: migrations`) |
| `MEDIA` | R2 | `sonora-media` |
| `IMPORT_QUEUE` | Queue producer | `sonora-import` |
| consumer | Queue | `sonora-import` → DLQ `sonora-import-dlq`, batch 5, timeout 30 s, `max_retries` 3 |
| `AI` | Workers AI | — |
| `assets` | Static assets | `./public` (admin SPA) |
| cron | Trigger | `*/15 * * * *` |

Create them once:

```bash
cd cloud/worker
npx wrangler d1 create sonora-cloud
npx wrangler r2 bucket create sonora-media
npx wrangler queues create sonora-import
npx wrangler queues create sonora-import-dlq
```

Put the returned D1 `database_id` into `wrangler.jsonc` (it ships as
`REPLACE_WITH_D1_DATABASE_ID`). Names must match the config.

## 2. Migrations

```bash
cd cloud/worker
npm run migrate:remote
```

One migration exists: `migrations/0001_init.sql`. It creates `admins`,
`sessions`, `sources`, `telegram_updates`, `tracks`, `track_storage`, `jobs`,
`lyrics`, `dropbox_accounts`, `oauth_states`, `audit_log`, `error_log`,
`settings`. The catalog starts empty; `GET /api/manifest.json` returns
`{"tracks": []}` until a track is `ready`.

Never edit an applied migration. Add `0002_*.sql`.

## 3. Non-secret variables (`vars`)

| Var | Default in repo | Meaning |
|---|---|---|
| `PUBLIC_WORKER_URL` | placeholder | Deployed Worker origin, no trailing slash. Used for webhook registration and the Dropbox redirect URI. |
| `ALLOWED_ORIGINS` | `https://mhdlabs.github.io` | Comma-separated exact origins allowed to call `/api/admin/*`. Also the CORS allowlist. |
| `MEDIA_BASE_URL` | placeholder `<worker>/media` | Prefix for `file`/`cover` URLs in the manifest. Empty → `/media`. |
| `TRANSCRIPTION_PROVIDER` | `cloudflare` | `cloudflare` or `groq`. Groq also requires `GROQ_API_KEY`. |
| `CF_WHISPER_MODEL` | `@cf/openai/whisper-large-v3-turbo` | Whisper model id. |
| `CLEANUP_MODEL` | `@cf/qwen/qwen3.8-27b` | Transcript-cleanup model id. Also probed by health. |
| `METADATA_MODEL` | `@cf/qwen/qwen3.8-27b` | Metadata completion model id. |
| `PREVIEW_MAX_SECONDS` | `30` | Reject tracks at or below this duration. Non-numeric/≤0 falls back to 30. |
| `TRANSCRIBE_ON_IMPORT` | `true` | `false` disables automatic transcription only. Embedded SYLT/USLT lyrics are still extracted; unidentified containers are never transcribed. |

Model IDs and prices change. Verify availability in the Workers AI catalog before
changing them, then check `workers_ai` in `/api/health`.

## 4. Secrets

```bash
cd cloud/worker
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET    # 16+ random chars, enforced
npx wrangler secret put TOKEN_ENCRYPTION_KEY       # any long random string (SHA-256 → AES-GCM key)
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN      # 24+ random chars, one-time
npx wrangler secret put DROPBOX_APP_KEY
npx wrangler secret put DROPBOX_APP_SECRET
npx wrangler secret put GROQ_API_KEY               # optional; only with TRANSCRIPTION_PROVIDER=groq
```

Generate with `openssl rand -base64 32`. `.dev.vars.example` holds placeholders
only; a real `.dev.vars` is git-ignored.

For `wrangler dev`, copy `.dev.vars.example` to `.dev.vars` and fill it. Never
commit it.

## 5. Deploy

```bash
cd cloud/worker
npm run build      # optional dry run
npx wrangler deploy
```

Then set `PUBLIC_WORKER_URL` and `MEDIA_BASE_URL` to the deployed origin and
redeploy, so webhook registration and manifest URLs are correct.

## 6. Telegram webhook

Register from the admin **Health** tab ("Register webhook"), which requires a
live session, or call the API with a session cookie + CSRF header. The Worker
calls `setWebhook` with `secret_token = TELEGRAM_WEBHOOK_SECRET` and
`allowed_updates = ["message","channel_post"]`. It refuses when the secret is
shorter than 16 characters or `PUBLIC_WORKER_URL` is not `https://`.

Verification after registering:

1. `GET /api/health` → `telegram.ok === true` and `webhook_url` equals
   `<PUBLIC_WORKER_URL>/api/telegram/webhook`.
2. Post a real audio file to the channel. Expected: `tracks.status` moves
   `pending → processing → ready|needs_review`, and a `jobs` row reaches
   `succeeded`.
3. `GET /api/manifest.json` contains the track only when it is `ready`.

If Telegram is unreachable from the Worker, `/api/health` reports
`telegram.ok === false` with the real error — do not assume success.

## 7. Administrator bootstrap

```bash
curl -X POST https://<worker>/api/admin/bootstrap \
  -H 'content-type: application/json' \
  -H "x-bootstrap-token: $ADMIN_BOOTSTRAP_TOKEN" \
  -d '{"username":"admin","password":"a-long-unique-password"}'
```

Constraints enforced in code: bootstrap is disabled when `ADMIN_BOOTSTRAP_TOKEN`
is unset; the token must be ≥ 24 chars; it refuses if any admin row exists;
password must be ≥ 12 chars. Remove the secret afterwards:

```bash
npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN
```

Admin UI: `https://<worker>/admin/` (served by the Worker from
`cloud/worker/public/admin/`, same origin, so cookies are first-party). If you
also host it elsewhere, set `window.SONORA_API_BASE` before `admin.js` loads and
add that exact origin to `ALLOWED_ORIGINS`. Third-party-cookie blocking breaks
that setup; same-origin is the supported path.

## 8. Dropbox OAuth app

1. Create an app at <https://www.dropbox.com/developers/apps> — **Scoped access**,
   Full Dropbox or App folder.
2. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`,
   `account_info.read`.
3. Redirect URI: `https://<PUBLIC_WORKER_URL>/api/admin/dropbox/callback`.
4. Set `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` as Worker secrets.
5. Admin → Dropbox → **Connect account**. `token_access_type=offline` is
   requested; the refresh token is AES-GCM encrypted before it reaches D1.
6. Run **Check** on the account to populate health and quota. Quota is cached —
   archival selection uses the last known values.

Additional accounts can be connected; `pickAccount` chooses the smallest-usage
account with room. There is no pooling of quotas across accounts.

## 9. Models

| Stage | Default | Config |
|---|---|---|
| Speech-to-text | Workers AI Whisper `@cf/openai/whisper-large-v3-turbo` | `CF_WHISPER_MODEL` |
| Transcript cleanup | Workers AI Qwen | `CLEANUP_MODEL` |
| Metadata completion | Workers AI Qwen | `METADATA_MODEL` |
| Optional STT | Groq `whisper-large-v3` | `GROQ_API_KEY`, `GROQ_WHISPER_MODEL`, `TRANSCRIPTION_PROVIDER=groq` |

Cleanup is best-effort: a rejected model response keeps the raw transcript and
marks lyrics `needs_review`. Metadata AI only fills gaps and cannot invent a year.

## 10. Iranian network constraint (design-driving)

The maintainer cannot reliably reach `api.telegram.org` or `api.groq.com` from
their local connection, and the Groq console is inaccessible.

Consequences, which must be preserved:

- All provider calls happen inside the deployed Worker.
- Default development and testing require **no** access to Telegram, Groq, or
  Dropbox: tests use mocks and fixtures, and `npm run build` is offline.
- Workers AI is the default transcription and cleanup path. Groq is opt-in and
  must never be required for an import to succeed.
- Connectivity is verified from the deployed Worker (`/api/health`), never
  inferred from a local `curl`.

## 11. Retries, recovery, deletion

- Job states: `queued → running → succeeded | failed → dead`. `claimJob` takes a
  120 s lease via a guarded UPDATE; concurrent consumers cannot double-process.
- `failJob` backs off 30 s (60 s for partial pipeline failures) and moves the job
  to `dead` at `max_attempts` (default 5).
- Cron every 15 minutes re-enqueues up to 20 stale `queued|failed` jobs (lease
  expired > 10 min) and retries up to 10 tracks stuck in `deleting`.
- Manual retry: `POST /api/admin/tracks/:id/retry` resets the track to `pending`
  and enqueues a fresh import.
- Deletion: `DELETE /api/admin/tracks/:id` with `x-confirm-delete: <id>`. Status
  becomes `deleting` first (manifest drops it immediately), then cleanup removes
  R2 audio, unreferenced R2 cover, and the Dropbox original.

```bash
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT id,type,attempts,last_error FROM jobs WHERE status='dead'"
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT id,status,error FROM tracks WHERE status IN ('deleting','needs_review','failed')"
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT category,stage,message,created_at FROM error_log ORDER BY created_at DESC LIMIT 20"
```

## 12. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Webhook returns 401 | secret mismatch | re-register; compare `TELEGRAM_WEBHOOK_SECRET` |
| Update accepted, no track | non-audio message, replay, or queue send failed | check `telegram_updates.status`, `jobs` rows |
| Track stuck `pending` | queue undelivered | wait for cron, or Retry from admin |
| `preview_too_short` | duration ≤ `PREVIEW_MAX_SECONDS` | expected rejection, recorded on the track |
| `file_too_large` | > 20 MB Bot API cap | expected; not raised by Cloudflare |
| `needs_review` + `duration_unknown` | M4A/OGG/corrupt header | set duration manually via PATCH, then Retry |
| Lyrics `needs_review` | cleanup rejected output | inspect `raw_transcript`; regenerate manually |
| Admin 403 `csrf_failed` | missing/mismatched `x-csrf-token` | reload the SPA so cookies refresh |
| Admin 403 `origin_not_allowed` | origin not in `ALLOWED_ORIGINS` | add the exact origin, redeploy |
| `dropbox_unavailable` in `error_log` | no enabled account / quota | reconnect or check quota |
| Track stuck `deleting` | provider delete failed | admin Retry or wait for cron |
| `workers_ai.ok === false` | model id invalid or unavailable | verify the model id in the catalog |
| Import ignored as `source_disabled` | source is disabled in D1 | re-enable it in admin → Sources |

## 13. Limits and plan dependencies

- Telegram Bot API download cap: 20 MB (hard provider limit).
- Groq upload cap enforced in code: 25 MB.
- No `ffmpeg`, no persistent filesystem: duration parsing is limited to
  MP3/FLAC. M4A, OGG/Opus, and WAV uploads keep the correct content type but
  resolve to `duration: null`, so they stay `needs_review` unless Telegram
  reported a duration.
- Workers AI Whisper accepts bounded payloads; long tracks have no chunking
  strategy implemented.
- Queues: at-least-once, unordered; ordering is only durable per source.
- Workers AI, Queues, R2, and D1 bill per usage with plan limits. Verify current
  entitlement in the dashboard; nothing here assumes a free tier.
- Disabling a source in admin stops new imports from that chat; it does not
  remove tracks already imported from it.

## 14. Credential rotation

1. `npx wrangler secret put <NAME>` with the new value.
2. Redeploy if the value is duplicated in `vars`.
3. `TOKEN_ENCRYPTION_KEY`: existing Dropbox ciphertext becomes unreadable.
   Disconnect and reconnect each Dropbox account to re-encrypt, then run Check.
4. `TELEGRAM_WEBHOOK_SECRET`: re-register the webhook after rotating, or all
   inbound updates return 401.
5. `ADMIN_BOOTSTRAP_TOKEN`: delete it once an admin exists. There is no password
   reset endpoint; a forgotten password requires a manual D1 update of
   `admins.password_hash`/`salt`/`iterations`.
6. Revoke any leaked token at the provider, then rotate here. Never commit
   `.dev.vars` or paste secrets into issues.
