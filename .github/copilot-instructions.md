# Copilot instructions

Project context and invariants: [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).
Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md),
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).

- Static player at repo root (`index.html`, `css/`, `js/`, `audio/`). No bundler,
  no framework, no build step. Do not restructure it.
- Cloudflare Worker lives in `cloud/worker/` and must stay independently
  buildable: `cd cloud/worker && npm test && npm run build`.
- Admin SPA lives in `cloud/worker/public/admin/` and is served by the Worker
  (`assets.directory = "./public"`). Do not create a second copy.
- All technical documentation stays in the single root `docs/` directory.
- Source and `wrangler.jsonc` override documentation; verify before assuming.

Invariants that must not be weakened:

- Queue messages carry `{ jobId, trackId }` only — never audio.
- D1 is authoritative; publishing requires `status='ready'`, R2 `stored`, title,
  artist, and a non-null duration. Unknown duration is `NULL`, never `0`.
- Deletion sets `status='deleting'` before any provider cleanup.
- Lyrics timing is immutable; `manual_override = 1` blocks automated writes.
- Provider calls happen only inside the Worker. Tests and builds must stay
  offline (mocked providers, `node:sqlite` D1 shim).
- Never commit `.dev.vars`, real tokens, or generated artifacts
  (`node_modules/`, `.wrangler/`).
