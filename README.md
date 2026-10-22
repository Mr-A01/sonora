# 🎧 SONORA — Listen deeper.

A dark, gold-accented music player with a Cloudflare-native backend that ingests
audio from Telegram and publishes a live catalog.

<p>
<a href="https://github.com/Mr-A01/sonora"><img alt="Upstream" src="https://img.shields.io/badge/upstream-Mr--A01%2Fsonora-D9A441?style=flat-square"></a>
<img alt="No build step" src="https://img.shields.io/badge/player-no%20build%20step-7FA98A?style=flat-square">
<img alt="Workers" src="https://img.shields.io/badge/backend-Cloudflare%20Workers-F38020?style=flat-square">
<img alt="License" src="https://img.shields.io/badge/license-MIT-9A8F7E?style=flat-square">
</p>

## ✨ Features

- **Player** — real audio playback, playlists, library, local stats, 10-band
  equalizer, ID3 tags and embedded artwork read in the browser.
- **Cloud catalog** — the player reads `GET /api/manifest.json` when
  `window.SONORA_API` is set; otherwise it uses the static, empty
  `audio/manifest.json`.
- **Telegram intake** — a webhook queues jobs; messages carry IDs only, never audio.
- **Pipeline** — download → duration probe → tags → R2 → Dropbox archive →
  lyrics → publish, with durable state at each stage.
- **Lyrics** — embedded SYLT/USLT honored; otherwise Workers AI Whisper plus a
  conservative Qwen cleanup that keeps original timings.
- **Admin SPA** — tracks, sources, Dropbox accounts, errors, health; served from
  the Worker origin so sessions stay first-party.

## 🧩 Main components

| | |
|---|---|
| `index.html`, `css/`, `js/` | Static player. No framework, no bundler. |
| `audio/manifest.json` | Offline fallback catalog (starts empty). |
| `cloud/worker/` | Cloudflare Worker: routes, services, jobs, D1 migrations, tests. |
| `cloud/worker/public/admin/` | Admin interface served by the Worker. |
| `docs/` | Agent-oriented technical documentation. |

## 🚀 Quick start

```bash
# player — no install needed
python3 -m http.server 8080          # http://localhost:8080

# backend
cd cloud/worker
npm install
cp .dev.vars.example .dev.vars       # fill placeholders; never commit
npm run migrate:local
npm run dev                          # admin at /admin/
```

## 🧪 Tests

```bash
cd cloud/worker
npm test        # node:test, no network, mocked providers
npm run build   # wrangler dry-run bundle check
```

## 📚 Documentation

- [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md) — start here: invariants, contracts, limitations.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — real data flows, schema, state machines.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — commands, fixtures, local workflow.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — resources, secrets, deploy, recovery.
- [`AGENTS.md`](AGENTS.md) — entry point for coding agents.

Persian version: [`README-fa.md`](README-fa.md)

## 🔐 Configuration note

Never commit `.dev.vars` or real tokens. Local tests and builds are offline by
design; provider connectivity is only proven by `GET /api/health` on the deployed
Worker. See [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## 📄 License

MIT — see [`LICENSE`](LICENSE).
