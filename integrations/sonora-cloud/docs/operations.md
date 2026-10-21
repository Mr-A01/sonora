# Operations

## Verification vocabulary

Be precise about what has actually been proven:

| Statement | Meaning |
|---|---|
| local tests passed | `npm test` in `worker/`, providers mocked |
| mock integration passed | job webhook + queue consumer exercised against fakes |
| provider connectivity verified | `/api/health` on the deployed Worker returned `ok` for that provider |
| production end-to-end verified | a real file went Telegram → R2 → published manifest |

Only the first two are covered by this repository's automated tests.

## Telegram

* Inbound updates are validated against `TELEGRAM_WEBHOOK_SECRET` in the
  `x-telegram-bot-api-secret-token` header.
* `update_id` is the primary key of `telegram_updates`, so replays are no-ops.
* `(chat_id, message_id)` is unique on `tracks`, so duplicate messages cannot
  create duplicate tracks.
* A chat added to the panel does **not** grant the bot access. Use
  **Sources → Check access** (`getChat`) to see the real error.
* Files above 20 MB are rejected with an explicit error before any download.
* Webhook responses are immediate; all heavy work happens in the Queue consumer.

### If Telegram import fails

1. Health tab → **Test Telegram**. If it fails, the Worker cannot reach Telegram
   (not your laptop).
2. Check the webhook URL matches `PUBLIC_WORKER_URL` and uses `https`.
3. For `getFile` errors, confirm the bot is a member/admin of the channel.

## Preview rejection

Tracks with a verified duration ≤ 30 s (`PREVIEW_MAX_SECONDS`) are rejected before
Whisper, R2, or Dropbox work. Rejection is idempotent and recorded as
`preview_too_short`.

If duration cannot be determined (M4A/OGG container, corrupt header), the track is
stored but marked `needs_review` with `duration_unknown` — never published with a
guessed value.

## Jobs and retries

* `jobs.status`: `queued → running → succeeded | failed → dead`.
* Leases prevent concurrent consumers from processing one job twice.
* Backoff is 30 s per attempt by default, `max_attempts` 5.
* The cron (`*/15 * * * *`) re-enqueues stale queues and retries deletions.

### Inspecting

```bash
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT status, COUNT(*) FROM jobs GROUP BY status"
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT id,type,attempts,last_error FROM jobs WHERE status='dead'"
```

Dead jobs appear in **Errors → Dead letters** with a Retry action on the track.

## Deletion

1. `DELETE /api/admin/tracks/:id` with `x-confirm-delete: <id>`.
2. The row flips to `deleting` first, so the track disappears from
   `/api/manifest.json` in the same transaction.
3. A cleanup job removes the R2 audio, R2 cover (only if no other track
   references it), and the Dropbox original.
4. Any failure keeps `status='deleting'` and records `cleanup_failed`; the cron
   and the admin Retry both re-attempt.

Never report a track as fully deleted while `status='deleting'`.

## Lyrics recovery

* `source='embedded'` with `format='line'` means real SYLT timestamps.
* `format='plain'` is never synchronized; the player must not present it as such.
* `source='generated'` stores the raw transcript in `raw_transcript` for
  regeneration.
* A Qwen response that drops most segments or empties the text is rejected; the
  transcription is kept and marked `needs_review`.
* Manual edits set `manual_override=1` and are protected from automated writes.

## Diagnostics

`GET /api/health` (public, no secrets) and **Health** in the admin panel run from
the Worker:

* D1 query
* Telegram `getMe` + `getWebhookInfo`
* Workers AI round-trip on `CLEANUP_MODEL`
* R2 write/read/delete probe
* Queue binding + job counts
* Dropbox account health rows

`telegram` and `dropbox` results reflect real outbound connectivity from
Cloudflare. A local `curl` is not evidence of either.

## Rotating secrets

1. `npx wrangler secret put <NAME>` with a new value.
2. Redeploy if the value is also in `vars`.
3. For `TOKEN_ENCRYPTION_KEY`, re-encrypt Dropbox refresh tokens: disconnect and
   reconnect each account (the stored ciphertext is not readable with a new key).

## Limits worth remembering

* Telegram Bot API download cap: 20 MB.
* Groq upload cap: 25 MB free / 100 MB developer tier (verify per account).
* Queue payloads: IDs only. Never audio.
* Workers has no persistent filesystem and no ffmpeg.
