# Architecture

## Components

| Layer | Responsibility |
|---|---|
| Worker | HTTP API, Telegram webhook, admin auth, orchestration, media delivery |
| D1 | Tracks, sources, jobs, lyrics, storage rows, audit, errors, OAuth state |
| Queues | Asynchronous import/cleanup with bounded retries and a DLQ |
| R2 | Public playback copies and extracted cover art |
| Dropbox | Archived originals, multiple accounts |
| Workers AI | Whisper transcription, Qwen text cleanup, metadata completion |
| GitHub Pages | Static player and static admin shell |

D1 is authoritative. `GET /api/manifest.json` renders the public catalog from D1;
no Git commit is created per track.

## Data model

`tracks` holds one row per import. Key invariants:

* `UNIQUE (source_id, source_sequence)` — durable per-source ordering.
* `UNIQUE (telegram_chat_id, telegram_message_id)` — duplicate delivery is a no-op.
* `status` moves `pending → processing → ready | needs_review | failed`,
  and `ready → deleting → deleted` on removal.
* `duration_seconds` is `INTEGER` or `NULL`. Display strings are derived.

`track_storage` records one row per `(track_id, provider, object_key)` with an
idempotency key and a state machine `pending → uploading → stored | failed`,
plus `deleted`. Cross-provider atomicity does not exist, so a track is published
only when `allStored(db, id, ['r2'])` is true.

`jobs` is the durable job table. Queue messages carry `{ jobId, trackId }` only.

`lyrics` keeps source (`embedded|generated|manual|none`), format (`plain|line|word`),
status, raw transcript, model ids, and `manual_override`.

## Ordering and idempotency

Queues are at-least-once and unordered. Ordering therefore lives in D1:

1. The webhook increments `sources.last_sequence` atomically and stores it on the
   track row.
2. The consumer claims a job with a lease (`claimJob`), so concurrent duplicate
   deliveries cannot both run it.
3. Any stage that touches an external provider writes to `track_storage` before
   the call and updates it after. Re-running is safe.

Different sources are never globally serialized.

## Failure handling

* Every failure is written to `error_log` with a category and stage.
* `failJob` applies bounded backoff and moves exhausted jobs to `dead`.
* A cron every 15 minutes re-enqueues queued/failed jobs whose lease expired and
  retries deletions stuck in `deleting`.
* Telegram `retry_after` and non-retryable errors (invalid file, auth) are
  distinguished so permanent failures do not loop.

## Lyrics rules

* Embedded SYLT → stored as `format: line`, `source: embedded`. No Whisper call.
* Embedded USLT without timestamps → stored as `format: plain`. Never presented as
  synchronized.
* Neither present → Whisper segments, then Qwen cleanup that returns text per
  segment ID only. Timings are merged back from the immutable source segments.
* Word-level timings are dropped after text correction; the stored format is
  line-level.
* A manual override sets `manual_override = 1`; automated writes are then blocked
  by the `ON CONFLICT ... WHERE lyrics.manual_override = 0` clause.

## Security

* Passwords: PBKDF2-SHA256, 100k iterations (Workers' practical ceiling), unique salt.
* Sessions: random 256-bit token, SHA-256 hashed in D1, HttpOnly `SameSite=None`
  cookie, 12-hour expiry, revocable.
* CSRF: double-submit cookie plus a hash bound to the session row.
* Origin allowlist (`ALLOWED_ORIGINS`) on login and on every authenticated call.
* Dropbox refresh tokens: AES-GCM with `TOKEN_ENCRYPTION_KEY`.
* Diagnostics never include tokens; `/api/health` returns only health facts.

Because the admin UI is on GitHub Pages and the API is on `workers.dev`, cookies
are cross-site: `SameSite=None; Secure` is required, and `ALLOWED_ORIGINS` must
list the exact Pages origin. Serving the admin UI from the same Worker avoids
third-party-cookie restrictions entirely — recommended if your browser blocks them.

## Known limits

* Telegram Bot API `getFile` downloads are capped at 20 MB. Not raised by Cloudflare.
* No ffmpeg on Workers. Duration is parsed for MP3 and FLAC; M4A/OGG resolve to
  `null` and the track stays `needs_review` rather than being published with a
  guessed duration.
* Workers AI Whisper accepts bounded audio payloads; very long tracks may need a
  chunking strategy, which is not implemented.
* Dropbox accounts have independent quotas; no pooling is assumed.
