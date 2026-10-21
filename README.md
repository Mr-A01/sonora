# SONORA

> **Listen deeper.** A static, dark-themed music player — gold accent, serif/mono/sans
> typography, real audio playback, playlists, library, local listening stats, and a
> 10-band equalizer.

Plain HTML + CSS + vanilla JavaScript on **GitHub Pages**. The catalog is served by
the **Sonora Cloud** worker (D1 → `/api/manifest.json`); the file `audio/manifest.json`
is the offline fallback and starts empty.

---

## Run locally

```bash
python -m http.server 8080   # → http://localhost:8080
# or
npx serve .
```

To point the player at the deployed API, define `window.SONORA_API` before
`js/app.js` loads:

```html
<script>window.SONORA_API = 'https://sonora-cloud.<subdomain>.workers.dev';</script>
```

Unset → the player reads the local `audio/manifest.json`.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch** → `main` / `/ (root)` → **Save**
4. Site appears at `https://<user>.github.io/<repo>/`.

`.nojekyll` is included. An Actions workflow also exists at
`.github/workflows/static.yml`.

## Music backend

See [`integrations/sonora-cloud/`](integrations/sonora-cloud/README.md): Cloudflare
Worker + D1 + Queues + R2 + Dropbox + Workers AI, with a static admin panel.
It is independently buildable and testable:

```bash
cd integrations/sonora-cloud/worker
npm install
npm test
```

## Notes

* The catalog starts empty. Tracks are published by the worker once they reach
  `status = 'ready'`.
* No build step, no framework, no bundler.
