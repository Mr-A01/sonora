# SONORA

> **Listen deeper.** A fully static, dark-themed music web app — gold accent, serif/mono/sans
> typography, working audio playback, playlists, library, local listening stats, and a
> 10-band equalizer. Your library is real: it is generated from your own audio files' ID3 tags.

No build step, no framework, no server-side code. Plain HTML + CSS + ES5-ish JavaScript.
Runs exclusively on **GitHub Pages**.

---

## Run locally

Any static file server works (files are referenced with **relative paths** only):

```bash
# Python
python -m http.server 8080
# → open http://localhost:8080

# or Node
npx serve .
```

> Opening `index.html` directly via `file://` works for the UI, but `audio/manifest.json`
> and some audio files may be blocked by the browser — use a local server.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Build and deployment**
3. Source: **Deploy from a branch**
4. Branch: **`main` / `/ (root)`** → **Save**
5. The site appears at `https://<user>.github.io/<repo>/` within a minute.

Notes:
- An empty `.nojekyll` file is included so GitHub skips Jekyll processing
  (keeps files/directories starting with `_` and everything under `/audio` untouched).
- A ready-made workflow also exists at `.github/workflows/static.yml` — if you use it,
  switch Pages source to **GitHub Actions** instead of “Deploy from a branch”.
- Deep links are client-side (`#/page/param`) — unknown URLs boot to home.

---

## PWA

- `manifest.webmanifest` + theme-color for “Add to Home Screen”.
- Service Worker (`sw.js`) caches static assets and keeps the app usable offline
  for already-visited pages. Music files themselves are still network-fetched.

---

## How to add music

Everything is generated — **no hand-editing of JSON**:

1. **Drop an audio file into `/audio/`** (`.mp3`, `.m4a`, `.aac`, `.ogg`, `.oga`,
   `.opus`, `.flac`, `.wav`)
2. **Run the script:**

   ```bash
   python .github/scripts/add_music.py  # or: add the --check flag for a dry run
   ```

3. **Commit + push.**

The script (stdlib only — no pip installs) does everything:

- reads **ID3 tags** from the file itself: title, artist, album, year, genre
- **extracts the embedded cover art** into `audio/covers/<id>.jpg|.png`
- measures duration (ffprobe if available, otherwise MPEG-frame fallback)
- rebuilds `audio/manifest.json`, preserving fields it does not own
  (`sha256`, `telegram_file_unique_id`, `source`, `imported_at`, `added_at`)
- prunes orphaned cover images

The app merges the manifest at load and auto-creates artist/album entries, so playlists,
charts and stats all update automatically. If a file 404s at playback time,
the player shows the missing path instead of failing silently.

### Via GitHub Actions

`.github/workflows/add-music.yml` runs automatically whenever anything under `/audio/`
is pushed to `main` (or manually via **workflow_dispatch**): it executes
`python .github/scripts/add_music.py --check` and, if the manifest drifted, commits the regenerated
`audio/manifest.json` + covers back to the repo — so an upload made straight through
the GitHub web UI still ends up in the manifest. The website itself needs no server.

---

## Equalizer

Open the full player (click the track bar or press `F`) → **EQ** button (or press `E`).
10 bands (31 Hz – 16 kHz, ±15 dB), preamp, 13 presets, custom presets, live response curve,
ENABLE/BYPASS. Visual style is fully unified with the main dark + gold theme.
Changes persist in `sonora-state-v2`.

## Keyboard shortcuts

`Space` play/pause · `←/→` seek ±10s (Shift = ±30s) · `↑/↓` volume · `M` mute · `N/P` next/prev ·
`L` like · `S` shuffle · `R` repeat · `F` full player · **`E` EQ panel · `Shift+E` EQ bypass** ·
`0–9` jump to % · `⌘/Ctrl+K` search · `?` help · `Esc` close

## Persistence & reset

Everything lives under the single `localStorage` key **`sonora-state-v2`**.
Nothing ever leaves your browser. Use **Reset app** in the footer to clear it
(`window.clearState()`).

## Structure

```
index.html            single page shell + PWA meta
manifest.webmanifest  web app manifest
sw.js                 service worker (precache + runtime cache)
css/styles.css        theme, layout, components
css/fixes.css         fixes / hardening
css/eq.css            equalizer panel
css/share.css         share dialog
js/data.js            data layer (empty until the manifest loads) + safe fallbacks
js/app.js             app logic, state, routing, persistence, pages
js/deeplink.js        hash-route deep links (shareable URLs)
js/covers.js          shared fallback artwork
js/eq.js              Web Audio EQ engine + panel UI
js/id3.js             ID3v2 reader (cover art fallback at runtime)
js/share.js           now-playing / library share dialog + JSON export-import
js/foryou.js          personal picks (recently played, favourites, genres)
js/seo.js             per-page document titles + meta
js/polish.js          stats helpers + small UI polish
js/phase-b.js         discover/charts refinements
.github/scripts/add_music.py  scans /audio → regenerates manifest + covers
audio/manifest.json   generated by add_music.py — do not edit by hand
audio/covers/         cover art extracted from your files' ID3 tags
.github/workflows/    add-music.yml (manifest rebuild) + static.yml (Pages deploy)
.nojekyll             skip Jekyll on GitHub Pages
```

All artwork and metadata come from the audio files you add — SONORA ships with no
fictional artists, albums or editorial content.
