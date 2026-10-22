# Sonora — Agent Guide

Canonical working context for any coding agent. Read this first, then open the
specialized file you need: `ARCHITECTURE.md`, `DEVELOPMENT.md`, `OPERATIONS.md`.

**Rule zero:** source code and configuration override this document. If they
disagree, inspect the implementation, then fix the document in the same change.

## 1. What this repository is

One product with two halves in one Git repository:

| Half | What it is | Where |
|---|---|---|
| Public player | Static HTML/CSS/vanilla JS music player. No build step. | `index.html`, `css/`, `js/`, `audio/` |
| Cloud backend | Cloudflare Worker that ingests audio from Telegram, stores it, derives metadata/lyrics, and publishes a catalog. | `cloud/worker/` |
| Admin UI | Static SPA served by the same Worker from `cloud/worker/public/admin/`. | `cloud/worker/public/admin/` |
| Technical docs | The only project documentation directory. | `docs/` |

The player reads `GET /api/manifest.json` from the Worker when
`window.SONORA_API` is set; otherwise it reads the static `audio/manifest.json`,
which is an intentionally empty fallback.

### Product boundaries (do not silently expand)

- The player stays framework-free and build-free. Do not add a bundler.
- The Worker is the only place that talks to Telegram, Dropbox, Workers AI, or
  Groq. Nothing provider-related belongs in the browser or in a build script.
- The Worker is independently buildable and deployable from `cloud/worker/`.
- D1 is the source of truth for catalog state. No commit-per-track, no generated
  manifest file in Git.

### Explicit non-goals

- No monorepo toolchain, no workspace manager, no shared packages.
- No `ffmpeg`; Workers cannot run it. Duration/transcoding limits are documented,
  not worked around.
- No mandatory Groq dependency. Cloudflare Workers AI is the default and must
  remain sufficient.

## 2. Directory map

```text
.
├── index.html              player shell, sets window.SONORA_API
├── css/                    styles.css (base), fixes.css, eq.css (equalizer)
├── js/                     data.js (catalog data), app.js (UI/logic),
│                           eq.js (10-band EQ), id3.js (browser ID3 reader)
├── audio/manifest.json     static fallback catalog (starts empty)
├── cloud/worker/
│   ├── src/index.js        fetch / queue / scheduled entrypoints
│   ├── src/routes/         public.js, admin.js, telegram.js, media.js, health.js
│   ├── src/services/       telegram, dropbox, storage, audio, tags, transcribe,
│   │                       lyrics, metadata, ai
│   ├── src/jobs/           import.js (pipeline), cleanup.js (deletion)
│   ├── src/db/jobs.js      durable job store (claim/finish/fail)
│   ├── src/lib/            http.js, auth.js, crypto.js, ids.js
│   ├── migrations/         0001_init.sql (D1 schema)
│   ├── tests/              node:test suites + harness.js (D1 shim) + fixtures.js
│   ├── public/admin/       admin SPA (index.html, admin.js) — served by Worker
│   ├── .dev.vars.example   local secret/variable template (placeholders only)
│   ├── package.json        wrangler scripts
│   └── wrangler.jsonc      bindings, assets, cron, vars
├── docs/                   this file + ARCHITECTURE + DEVELOPMENT + OPERATIONS
├── .github/workflows/      GitHub Pages deployment
├── AGENTS.md               pointer to this file
├── README.md               English overview
├── README-fa.md            Persian overview
└── LICENSE                 MIT (© MHDLabs)
```

## 3. Where to look before changing a feature

| Change | Read first |
|---|---|
| Player UI, routing, playback | `js/app.js`, then `js/data.js` for catalog shape |
| Static catalog entries | `audio/manifest.json`, `js/data.js` header comment |
| Equalizer / Web Audio | `js/eq.js`, `css/eq.css` |
| Browser ID3 tags or cover art | `js/id3.js` (mirrors `cloud/worker/src/services/tags.js` semantics) |
| API surface | `cloud/worker/src/index.js` — every route is registered there |
| Public catalog payload | `src/routes/public.js` (`toManifestTrack`, `getManifest`) |
| Import pipeline | `src/jobs/import.js` (7 ordered stages) |
| Deletion/cleanup | `src/jobs/cleanup.js` + `markDeleted` |
| Telegram intake | `src/routes/telegram.js`, `src/services/telegram.js` |
| Lyrics/transcription | `src/services/transcribe.js`, `lyrics.js`, `src/jobs/import.js` |
| Metadata rules | `src/services/metadata.js`, `src/services/tags.js` |
| Auth / sessions / CSRF | `src/lib/auth.js`, `src/lib/crypto.js`, `src/lib/http.js` |
| Admin API | `src/routes/admin.js` |
| Admin UI | `cloud/worker/public/admin/admin.js` |
| Storage consistency | `src/services/storage.js`, table `track_storage` |
| Dropbox accounts | `src/services/dropbox.js`, table `dropbox_accounts` |
| Diagnostics | `src/routes/health.js` |
| Schema | `cloud/worker/migrations/0001_init.sql` |
| Deploy/config | `cloud/worker/wrangler.jsonc`, `OPERATIONS.md` |

## 4. Invariants that must not be broken

1. **Catalog visibility is one SQL predicate.** A track leaves
   `/api/manifest.json` the moment its status is not `ready` or `deleted_at` is
   set. Deletion flips status to `deleting` *before* storage cleanup.
2. **Queue messages carry identifiers only** (`{ jobId, trackId }`). Audio never
   travels through Queues.
3. **Ordering lives in D1**, not in Queue order: `sources.last_sequence` is
   incremented atomically per chat; `tracks(source_id, source_sequence)` is unique.
4. **Idempotency keys are durable.** `telegram_updates.update_id` (PK),
   `tracks(telegram_chat_id, telegram_message_id)` (UNIQUE),
   `track_storage(track_id, provider, object_key)` (PK) and job leases make
   at-least-once delivery safe. Do not weaken these constraints.
5. **Publish only when required storage is `stored`** (`allStored(db, id, ['r2'])`)
   and title, artist, and a non-null duration exist.
6. **Unknown duration is `NULL`, never `0`.** Such tracks stay `needs_review`.
7. **A disabled source imports nothing.** `sources.enabled` is checked from D1 in
   the webhook, before any track row, and again in the sequencing UPDATE. The
   webhook still answers `200` (`ignored: 'source_disabled'`) so Telegram does not
   retry. First contact auto-registers a chat as enabled.
8. **Lyrics timing is immutable.** Cleanup models return text per segment id;
   timings are merged back from the original transcription. Plain lyrics are
   never presented as synchronized.
9. **`manual_override = 1` blocks automated lyric writes** (enforced by the
   `ON CONFLICT ... WHERE lyrics.manual_override = 0` clause).
10. **Model IDs are configuration** (`CF_WHISPER_MODEL`, `CLEANUP_MODEL`,
    `METADATA_MODEL`), not code constants. Defaults live in `src/services/ai.js`.
11. **Audio content types come from one place**: `detectAudioExtension()` +
    `audioContentType()` in `src/services/audio.js`. Never hard-code a content
    type at an upload site.
12. **Secrets never enter responses, logs, or the repo.** Health output is
    secret-free by design and asserted by a test.
13. **Admin auth is server-side**: HttpOnly session cookie, hashed tokens in D1,
    CSRF double-submit bound to the session row, origin allowlist.
14. **Object keys are derived from track IDs**, never from editable titles.

## 5. Key data contracts

`GET /api/manifest.json` (CORS, public, generated — not stored in Git):

```json
{
  "_readme": "Generated from D1. Do not edit by hand.",
  "generated_at": "ISO-8601",
  "tracks": [
    {
      "id": "uuid",
      "file": "<MEDIA_BASE_URL>/audio/<id>.mp3",
      "title": "…",
      "artist": "…",
      "album": "…",
      "year": 2026,
      "genre": "…",
      "duration": "3:20",
      "cover": "<MEDIA_BASE_URL>/covers/<id>.jpg | null"
    }
  ]
}
```

The player consumes exactly these keys in `mergeManifestTrack` (`js/app.js`).
Adding fields is safe; renaming or removing `id`/`file`/`title`/`artist` is not.

`GET /api/tracks/:id/lyrics` returns
`{ track_id, source, format, status, text, segments }` where `source` ∈
`embedded|generated|manual|none` and `format` ∈ `plain|line|word`. Only for
`ready`, non-deleted tracks; `404` otherwise.

Error shape for every failure: `{ "error": { "code": "...", "message": "..." } }`.

## 6. Build and test

```bash
cd cloud/worker
npm install
npm test                     # node:test, no network, D1 via node:sqlite
npm run build                # wrangler deploy --dry-run --outdir=.wrangler/dry-run
```

Requires Node with `node:sqlite` (22.5+; developed on 26.x). Tests are local and
mocked: passing them does **not** prove Telegram, Dropbox, Workers AI, or Groq
connectivity. See `DEVELOPMENT.md` for details and `OPERATIONS.md` for real
verification.

## 7. Security and data-integrity rules

- Never commit `.dev.vars`, real tokens, R2 objects, or D1 dumps.
- Never log tokens; `logError`/`console.error` payloads are category+message only.
- Dropping or reordering tracks in Git is fine; **do not** delete
  `audio/manifest.json` entries or R2/D1 data as part of a refactor.
- Deletion is idempotent and asynchronous; a row in `status='deleting'` is not
  deleted. Cleanup retries come from the cron and the admin Retry action.
- Any schema change needs a new numbered migration; never edit
  `0001_init.sql` in place on a deployed database.

## 8. Known limitations (verified in code)

- `sources.enabled` is enforced by the webhook; a disabled source acknowledges
  updates with `{ ok: true, ignored: "source_disabled" }` and stores no track.
- `settings` table exists and is unused.
- `retryCleanup`, `telegram.getChatMember`, and `telegram.deleteWebhook` are
  exported but not called by any route.
- Duration probing covers MP3 and FLAC only. M4A, OGG/Opus, and WAV are accepted
  and stored with the correct content type, but resolve to `duration: null` and
  therefore `needs_review` unless Telegram reported a duration.
- `TRANSCRIBE_ON_IMPORT` is opt-out (`false` disables automatic transcription).
  Embedded SYLT/USLT lyrics are still extracted when it is `false`. Unidentified
  containers (`bin`) are never sent to Whisper.
- Telegram Bot API downloads are capped at 20 MB; no chunking is implemented.
- Dropbox quota data is only refreshed when an account health check runs, so
  `pickAccount` can select an account whose stored quota is stale.
- Health `dropbox` check reads stored health rows; it does not call Dropbox.

## 9. Documentation duties

When you change architecture, routes, schema, env vars, or commands, update the
matching file in `docs/` in the same commit. Keep one source of truth:

- `AGENT_GUIDE.md` — orientation, invariants, contracts, limitations.
- `ARCHITECTURE.md` — real component/data flows, states, guarantees.
- `DEVELOPMENT.md` — commands and local workflow.
- `OPERATIONS.md` — deploy, bindings, secrets, recovery, troubleshooting.

Do not add another `docs/`, `documentation/`, or per-subsystem README. Do not
duplicate the architecture text into `README.md` or into agent instruction files.

## 10. Before you assume

Run these when a change looks surprising:

```bash
git status --short
grep -rn "pattern" cloud/worker/src
cd cloud/worker && npm test
```

If a documented behaviour cannot be reproduced in the current source, the
documentation is wrong — fix it, and say so in the change description.
