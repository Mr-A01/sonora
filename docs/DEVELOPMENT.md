# Development

All commands are offline-safe. Nothing here requires Telegram, Groq, Dropbox, or
Cloudflare credentials. Live provider checks belong in `OPERATIONS.md`.

## Prerequisites

| Need | For | Notes |
|---|---|---|
| Node.js ≥ 22.5 | Worker tests (uses built-in `node:sqlite`) | developed on v26.11.1 |
| `npm` | Worker dependencies (only `wrangler`) | lockfile committed |
| Python 3 or `npx serve` | Serving the static player locally | any static server works |
| Cloudflare account | `wrangler dev` bindings beyond local D1/R2/Queues emulation | not needed for tests |

## Repository root vs Worker directory

| Task | Where |
|---|---|
| Static player preview | repository root |
| Anything `npm`/`wrangler` | `cloud/worker/` |
| Docs | repository root (`docs/`) |

There is intentionally no root `package.json`; the Worker dependency tree is the
only one.

## Static player

```bash
python3 -m http.server 8080     # http://localhost:8080
# or
npx serve .
```

Point it at a deployed backend by setting the global before `js/app.js` loads
(edit `index.html`, or inject it in devtools):

```html
<script>window.SONORA_API = 'https://<worker-host>';</script>
```

Unset (the committed state) → the player uses `audio/manifest.json`, which is
empty. Checks that matter for site changes:

- The page loads with an empty catalog and no console errors.
- Nav, search, and player render (catalog-independent UI).
- `css/*.css` and `js/*.js` paths resolve from `/`; `index.html` uses
  `<base href="./">` so GitHub Pages sub-paths work.
- If you change `js/data.js` or `audio/manifest.json`, keep the JSON strict and
  keep the `tracks` array shape (`id`, `file`, `title`, `artist`, `album`,
  optional `year`, `genre`, `duration`, `cover`).

## Worker: install, test, build

```bash
cd cloud/worker
npm install
npm test                 # node --test tests/  (offline, no network)
npm run build            # wrangler deploy --dry-run --outdir=.wrangler/dry-run
```

`npm test` uses:

- `tests/harness.js` — a D1 shim over `node:sqlite` that executes the real
  migration, plus fake `AI`, `MEDIA` (R2), and `IMPORT_QUEUE` bindings.
- `tests/fixtures.js` — synthesizes real MP3 frames and ID3v2 frames (TIT2, TPE1,
  TALB, TYER, USLT, APIC, SYLT) so audio parsing is exercised, not stubbed.
- `globalThis.fetch` stubs in `pipeline.test.js` for the Telegram download path.

Coverage by file:

| File | Focus |
|---|---|
| `webhook.test.js` | secret validation, dedupe, preview/size rejection, sequencing, manifest, media ranges + traversal |
| `pipeline.test.js` | full import, download failure, unknown duration, SYLT/USLT/generated lyrics, deletion, shared artwork, cleanup failure, Dropbox selection |
| `admin.test.js` | auth, CSRF, origin allowlist, delete confirmation, PATCH validation, manual lyrics, token encryption, secret-free health, bootstrap-once |
| `lyrics.test.js` | cleanup merge rules and rejection paths |
| `tags.test.js` | UTF-8/Persian ID3, absent tags, APIC, filename parsing |
| `audio.test.js` | MP3/FLAC duration probing |
| `sources.test.js` | allowlist: unknown chat ignored, admin registration, enable/disable, sequencing |
| `formats.test.js` | MIME detection, content-type mapping, R2 metadata, `TRANSCRIBE_ON_IMPORT` on/off |
| `config.test.js` | `wrangler.jsonc` still points at real entrypoint, migrations dir, admin assets, queue + DLQ |

`npm run build` proves the Worker bundles. It does not deploy and does not need
credentials; the dry run reads `public/` and reports bindings.

## Local Worker runtime (optional)

```bash
cd cloud/worker
cp .dev.vars.example .dev.vars      # fill placeholders; never commit
npm run migrate:local               # wrangler d1 migrations apply --local
npm run dev                         # wrangler dev
```

Local emulation covers D1, R2, and Queues. Admin UI is at `/admin/`. Telegram,
Dropbox, and Workers AI calls will fail locally unless the machine can reach
those hosts — that is expected here, and tests must not depend on it.

Other scripts: `npm run migrate:remote`, `npm run deploy`.

## Database migrations

```bash
cd cloud/worker
npm run migrate:local     # or migrate:remote
```

To add a migration, create `migrations/0002_<name>.sql` and never edit
`0001_init.sql` after it has been applied to a remote database. `tests/harness.js`
loads only `0001_init.sql`; extend it if a later migration is required for tests
to run.

## Inspecting failures

```bash
cd cloud/worker
npx wrangler tail --format pretty                    # live deployed logs
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT status, COUNT(*) FROM jobs GROUP BY status"
npx wrangler d1 execute sonora-cloud --remote \
  --command "SELECT category, stage, message, created_at FROM error_log ORDER BY created_at DESC LIMIT 20"
```

Structured logs are JSON with `category` and a truncated `message`; tokens are
never included. The admin UI exposes the same data (Dashboard, Errors, Health).

## Conventions

- ESM only (`"type": "module"`), no TypeScript, no build step for source.
- Audio content types live in `AUDIO_CONTENT_TYPES` (`src/services/audio.js`).
  Add a format there (and to `detectAudioExtension`) rather than at a call site.
- Keep the module split: `routes/` (HTTP shaping), `services/` (providers and
  parsing), `jobs/` (pipelines), `db/` (queries for jobs), `lib/` (primitives).
- Add tests next to the behaviour they cover; mocks live in `tests/harness.js`.
- Update `docs/` in the same change when routes, schema, env vars, or commands
  change.
