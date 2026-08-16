# SONORA — Listen deeper.

A dark, editorial music platform: discovery, artists, albums, radio, sessions, stories, library, and a full player with **real audio**.

## Structure

```
sonora/
├── index.html
├── css/
│   ├── styles.css
│   └── fixes.css
├── js/
│   └── app.js
└── README.md
```

## Run

```bash
cd sonora
python3 -m http.server 8080
```

Open **http://localhost:8080**.

> Audio files are bundled locally in `audio/` (short demo clips). Serve over **http://** (not `file://`) so the browser can load them.

## What works

- **Real playback** via `HTMLAudioElement` (16 demo tracks mapped to albums)
- **Scrubbable progress** on mini player + full player (click the bar)
- **Play / pause / next / prev** (prev restarts if >3s into track)
- **Likes, follows, saved playlists, history** → `localStorage` (`sonora-state`)
- Search (⌘/Ctrl+K), queue, ambient mode, sleep timer
- Radio stations start real playback
- Keyboard: Space = play/pause, ←/→ seek in full player, Esc closes overlays

## License

Design study — free for learning and portfolio use. Demo audio © SoundHelix.


## Track IDs & custom audio

Every track has a stable **id**. Playback looks for:

```
audio/{track-id}.mp3
```

Examples:

| Track | ID | File |
|-------|-----|------|
| Glass Horizon | `ms-01-glass-horizon` | `audio/ms-01-glass-horizon.mp3` |
| Honey & Smoke | `gs-01-honey-smoke` | `audio/gs-01-honey-smoke.mp3` |

Full list: `audio/TRACKS.txt`.

To use your own songs:

1. Open `js/app.js` → `ALBUMS` → each track looks like `{id:'ms-01-glass-horizon', t:'Glass Horizon', d:'4:12'}`
2. Change `id` / `t` / `d` if you want
3. Put the MP3 file at `audio/{id}.mp3` with the **exact same id**

Bundled `audio/track1.mp3` … `track8.mp3` are short demos used as fallback when a file is missing.


## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` or `K` | Play / Pause |
| `←` / `→` | Seek −10s / +10s |
| `Shift + ←` / `→` | Seek −30s / +30s |
| `↑` / `↓` | Volume up / down |
| `M` | Mute / Unmute |
| `N` | Next track |
| `P` | Previous track |
| `L` | Like current track |
| `S` | Shuffle on/off |
| `R` | Repeat off → all → one |
| `F` | Open / close full player |
| `0`–`9` | Jump to 0%…90% of track |
| `?` | Shortcuts guide |
| `⌘/Ctrl + K` | Search |
| `Esc` | Close overlays |

Also supports media keys (play/pause, next, previous) when the browser exposes them.
