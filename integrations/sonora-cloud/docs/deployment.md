# Deployment

All steps run against Cloudflare. None require Telegram or Groq access from your
local machine.

## 0. Prerequisites

* A Cloudflare account with Workers, D1, R2, Queues, and Workers AI enabled.
* `npx wrangler login` (or `CLOUDFLARE_API_TOKEN` in CI).

Workers AI, Queues, and R2 have plan limits and per-request pricing. Verify your
current entitlement in the Cloudflare dashboard; nothing here assumes a free tier.

## 1. Create resources

```bash
cd integrations/sonora-cloud/worker
npx wrangler d1 create sonora-cloud
npx wrangler r2 bucket create sonora-media
npx wrangler queues create sonora-import
npx wrangler queues create sonora-import-dlq
```

Copy the D1 `database_id` from the output into `wrangler.jsonc`
(`d1_databases[0].database_id`). Queue and R2 names must match `wrangler.jsonc`.

## 2. Apply migrations

```bash
npm run migrate:remote
```

The catalog starts empty by design. `GET /api/manifest.json` returns
`{"tracks": []}` until a track reaches `status = 'ready'`.

## 3. Configure vars

Edit the `vars` block in `wrangler.jsonc`:

| Var | Meaning |
|---|---|
| `PUBLIC_WORKER_URL` | Deployed Worker origin (no trailing slash) |
| `ALLOWED_ORIGINS` | Comma-separated exact origins allowed to call the admin API |
| `MEDIA_BASE_URL` | Public prefix for audio/covers, normally `<worker>/media` |
| `TRANSCRIPTION_PROVIDER` | `cloudflare` (default) or `groq` |
| `CF_WHISPER_MODEL` | `@cf/openai/whisper-large-v3-turbo` |
| `CLEANUP_MODEL` | `@cf/qwen/qwen3.8-27b` |
| `METADATA_MODEL` | `@cf/qwen/qwen3.8-27b` |
| `PREVIEW_MAX_SECONDS` | `30` |
| `TRANSCRIBE_ON_IMPORT` | `true` to transcribe missing lyrics |

## 4. Set secrets

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET          # 16+ random chars
npx wrangler secret put TOKEN_ENCRYPTION_KEY             # 32+ random chars
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN            # 24+ random chars, one-time
npx wrangler secret put DROPBOX_APP_KEY
npx wrangler secret put DROPBOX_APP_SECRET
# optional, only if you deliberately enable Groq:
npx wrangler secret put GROQ_API_KEY
```

Generate values with `openssl rand -base64 32`. Never commit them.

## 5. Deploy

```bash
npx wrangler deploy
```

Record the deployed URL and put it in `PUBLIC_WORKER_URL`, then redeploy.

## 6. Register the Telegram webhook

From the admin **Health** tab press **Register webhook**, or:

```bash
curl -X POST https://<worker>/api/admin/telegram/webhook \
  -H "Cookie: sonora_session=...; sonora_csrf=..." \
  -H "x-csrf-token: ..." -H "Origin: https://mhdlabs.github.io"
```

The Worker calls `setWebhook` with your secret token, which it also validates on
every inbound update. Nothing is called from your laptop.

## 7. Bootstrap the administrator

```bash
curl -X POST https://<worker>/api/admin/bootstrap \
  -H "content-type: application/json" \
  -H "x-bootstrap-token: $ADMIN_BOOTSTRAP_TOKEN" \
  -d '{"username":"admin","password":"a-long-unique-password"}'
```

Bootstrap refuses to run once an admin exists. Afterwards rotate or remove
`ADMIN_BOOTSTRAP_TOKEN` with `npx wrangler secret delete ADMIN_BOOTSTRAP_TOKEN`.

## 8. Dropbox OAuth app

1. Create an app at <https://www.dropbox.com/developers/apps> with
   **Scoped access** → **Full Dropbox** (or App folder).
2. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`,
   `account_info.read`.
3. Add the redirect URI:
   `https://<worker>/api/admin/dropbox/callback`
4. Put the app key/secret in Worker secrets.
5. In the admin **Dropbox** tab choose **Connect account** and complete consent.

`token_access_type=offline` is requested so a refresh token is issued. Refresh
tokens are encrypted with AES-GCM before they reach D1.

## 9. GitHub Pages

`web/admin/index.html` is static. Publish it (for example to
`https://mhdlabs.github.io/sonora-update/admin/`) and either:

* set `window.SONORA_API_BASE` before `admin.js` loads, or
* serve it from the same origin as the Worker to avoid cross-site cookies.

The player reads `window.SONORA_API` to fetch `/api/manifest.json`; if unset it
falls back to the static `audio/manifest.json`, which starts empty.

## 10. Verify

```bash
curl -s https://<worker>/api/health | jq
```

Each check reports `ok` plus a non-secret detail. `telegram` failing means the
deployed Worker cannot reach the Bot API — report the actual error, do not assume
success.

## Paid / plan-dependent

* Workers AI: billed per model (Whisper per audio minute, Qwen per token).
* Queues: billed per operation beyond the included allowance.
* R2: storage and Class A/B operations.
* Telegram: free, but Bot API downloads are capped at 20 MB.
* Groq: optional; free tier uploads are capped at 25 MB.
