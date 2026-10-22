# AGENTS.md

Entry point for coding agents working in this repository.

1. Read [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md) — canonical context,
   invariants, data contracts, known limitations.
2. Use [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
   [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md), and
   [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for details.
3. The actual source and configuration override all documentation. If they
   disagree, verify the code and update the docs in the same change.

Layout: static player at the root (`index.html`, `css/`, `js/`, `audio/`), the
Cloudflare backend in `cloud/worker/` (independently buildable), admin SPA in
`cloud/worker/public/admin/`, all technical docs in `docs/`.

Do not add a second documentation directory, a per-subsystem README, a framework
or bundler for the player, or a mandatory Groq dependency.

Quick checks:

```bash
cd cloud/worker && npm test && npm run build
```
