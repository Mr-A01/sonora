# Sonora Cloud

Cloudflare-native backend for the Sonora music platform. The static player on
GitHub Pages stays static; everything privileged runs in a Worker.

```
integrations/sonora-cloud/
├── worker/
│   ├── src/
│   │   ├── index.js          # fetch, queue, scheduled entrypoints
│   │   ├── routes/           # public, admin, telegram, media, health
│   │   ├── services/         # telegram, dropbox, storage, audio, tags, transcribe, lyrics, metadata
│   │   ├── jobs/             # import pipeline, deletion/cleanup
│   │   ├── db/               # job store
│   │   └── lib/              # ids, http, crypto, auth
│   ├── migrations/           # D1 schema
│   ├── tests/                # node:test + node:sqlite harness
│   ├── package.json
│   └── wrangler.jsonc
├── web/admin/                # static admin SPA (GitHub Pages)
├── docs/                     # deployment and operations
├── .dev.vars.example
├── README.md
└── LICENSE
```

## Design constraints that shaped this

The project owner is in Iran and has no reliable direct access to
`api.telegram.org`, `api.groq.com`, or the Groq console from their machine.

* All outbound provider calls happen **in the deployed Worker**.
* Local tests use mocks and fixtures. No test, build, or migration needs Telegram
  or Groq connectivity.
* **Workers AI is the default** transcription and cleanup path. Groq is optional,
  off by default, and can never block an import.

## Default pipeline

| Stage | Provider |
|---|---|
| Speech-to-text | Workers AI `@cf/openai/whisper-large-v3-turbo` |
| Transcript cleanup | Workers AI `@cf/qwen/qwen3.8-27b` |
| Metadata completion | Workers AI `@cf/qwen/qwen3.8-27b` |
| Public audio | R2 (`MEDIA` binding) |
| Archive | Dropbox (multi-account OAuth) |
| Structured state | D1 |
| Async work | Queues |

Model IDs are configuration, not constants: `CF_WHISPER_MODEL`, `CLEANUP_MODEL`,
`METADATA_MODEL`. Verify current availability and pricing in the Workers AI
catalog before changing them — model IDs and prices change.

## Quick start (offline, no provider access needed)

```bash
cd integrations/sonora-cloud/worker
npm install            # wrangler only
npm test               # 54 tests, no network
```

With a local Cloudflare emulator (still no Telegram/Groq required):

```bash
cp ../.dev.vars.example .dev.vars
npm run migrate:local
npm run dev
```

## Docs

* [`docs/deployment.md`](docs/deployment.md) — resources, secrets, migrations, deploy
* [`docs/operations.md`](docs/operations.md) — webhook, admin bootstrap, retries, troubleshooting
* [`docs/architecture.md`](docs/architecture.md) — data model, ordering, consistency rules

## Status honesty

Tests in this repo are **local** (mocked providers, real SQLite-backed D1 shim).
Nothing here proves that Telegram, Dropbox, Workers AI, or Groq are reachable from
your Cloudflare account. Run `GET /api/health` on the deployed Worker and the
admin **Health** tab to verify real connectivity.
