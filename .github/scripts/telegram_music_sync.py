#!/usr/bin/env python3
"""Import new audio/MP3 files from Telegram (private chat, group, or channel)
into the repository.

Pipeline per update:
  1. Parse message, pick audio/voice/video_note/audio-document.
  2. Deduplicate by file_unique_id and content sha256.
  3. Download raw file from Telegram.
  4. Send ALL textual signals + caption to Groq (gpt-oss-20b) for cleaning.
     - Single attempt, no retries.
     - On failure -> reply to the source message with an English error and
       DO NOT save the file.
  5. Convert non-MP3 to MP3 using a bundled ffmpeg binary (imageio-ffmpeg).
  6. Read duration from Telegram metadata first, else from mutagen.
  7. Append a track to audio/manifest.json (schema preserved exactly).
  8. Reply to the source message in English confirming the import.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import traceback
from pathlib import Path

import requests

# --------------------------------------------------------------------- config

ROOT = Path(__file__).resolve().parents[2]
AUDIO_DIR = ROOT / 'audio'
MANIFEST_PATH = AUDIO_DIR / 'manifest.json'
STATE_PATH = ROOT / '.telegram-sync-state.json'

BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()
CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '').strip()
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '').strip()

GROQ_BASE = 'https://api.groq.com/openai/v1'
GROQ_TEXT_MODEL = 'openai/gpt-oss-20b'

API = f'https://api.telegram.org/bot{BOT_TOKEN}' if BOT_TOKEN else ''

MAX_FILE_IDS = 5000
REQUEST_TIMEOUT = 90
GETUPDATES_TIMEOUT = 25
AUDIO_EXTENSIONS = {'.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wav', '.wma'}

AI_TIMEOUT = 60
RATE_LIMIT_DELAY = 2.5  # seconds between Groq calls; keeps us well under 30 RPM

MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024  # Telegram Bot API hard limit

FFMPEG_EXE = None  # lazily resolved via imageio-ffmpeg


# --------------------------------------------------------------------- utils

def log(message):
    print(message, flush=True)


def log_err(message):
    print(f'[ERROR] {message}', flush=True)


def ensure_audio_dir():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def cleanup_tmp_files():
    for p in AUDIO_DIR.glob('*.tmp'):
        try:
            p.unlink()
            log(f'Cleaned leftover tmp file: {p.name}')
        except OSError:
            pass


def slugify(text, fallback='untitled-track'):
    cleaned = re.sub(r'[^0-9A-Za-z]+', '-', (text or '').strip()).strip('-').lower()
    cleaned = re.sub(r'-{2,}', '-', cleaned)
    return (cleaned or fallback)[:70]


def sha256_of(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def format_duration(seconds):
    try:
        total = max(0, int(float(seconds)))
    except (TypeError, ValueError):
        return '00:00'
    return f'{total // 60:02d}:{total % 60:02d}'


def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def is_mp3_bytes(path):
    try:
        with Path(path).open('rb') as fh:
            head = fh.read(3)
            if head == b'ID3':
                return True
            fh.seek(0)
            first = fh.read(2)
        return len(first) == 2 and first[0] == 0xFF and (first[1] & 0xE0) == 0xE0
    except OSError:
        return False


def get_ffmpeg_exe():
    global FFMPEG_EXE
    if FFMPEG_EXE:
        return FFMPEG_EXE
    try:
        import imageio_ffmpeg  # type: ignore
        FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
        log(f'Using bundled ffmpeg: {FFMPEG_EXE}')
        return FFMPEG_EXE
    except Exception as exc:
        raise RuntimeError(f'Could not obtain ffmpeg binary: {exc}')


def mutagen_duration(path):
    try:
        from mutagen import File as MutagenFile  # type: ignore
        mf = MutagenFile(str(path))
        info = getattr(mf, 'info', None) if mf is not None else None
        length = getattr(info, 'length', None) if info is not None else None
        if length:
            return format_duration(length)
    except Exception as exc:
        log(f'mutagen failed on {path.name}: {exc}')
    return None


# --------------------------------------------------------------------- state

def load_state():
    if not STATE_PATH.exists():
        return {'offset': 0, 'file_ids': [], 'imported': 0}
    try:
        data = json.loads(STATE_PATH.read_text(encoding='utf-8'))
    except (ValueError, OSError):
        return {'offset': 0, 'file_ids': [], 'imported': 0}
    if not isinstance(data, dict):
        return {'offset': 0, 'file_ids': [], 'imported': 0}
    try:
        data['offset'] = int(data.get('offset', 0) or 0)
    except (TypeError, ValueError):
        data['offset'] = 0
    if not isinstance(data.get('file_ids'), list):
        data['file_ids'] = []
    try:
        data['imported'] = int(data.get('imported', 0) or 0)
    except (TypeError, ValueError):
        data['imported'] = 0
    return data


def save_state(state):
    STATE_PATH.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def remember_file_id(state, file_id):
    if not file_id:
        return
    ids = [f for f in state.get('file_ids', []) if f != file_id]
    ids.append(file_id)
    state['file_ids'] = ids[-MAX_FILE_IDS:]


# ----------------------------------------------------------------- manifest

def read_manifest():
    if not MANIFEST_PATH.exists():
        return {'tracks': []}
    try:
        with MANIFEST_PATH.open('r', encoding='utf-8') as fh:
            data = json.load(fh)
        if isinstance(data, dict) and isinstance(data.get('tracks'), list):
            return data
    except Exception:
        pass
    return {'tracks': []}


def write_manifest(data):
    with MANIFEST_PATH.open('w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write('\n')


def manifest_hashes(manifest):
    return {
        str(item.get('sha256', '')).lower()
        for item in manifest.get('tracks', [])
        if item.get('sha256')
    }


def manifest_ids(manifest):
    return {
        str(item.get('id', '')).lower()
        for item in manifest.get('tracks', [])
        if item.get('id')
    }


def unique_track_id(base, taken, digest):
    candidate = base or 'untitled-track'
    if candidate not in taken:
        return candidate
    return f'{candidate}-{digest[:6]}'


# ----------------------------------------------------------------- telegram

def api_request(method, params=None, timeout=REQUEST_TIMEOUT):
    resp = requests.get(f'{API}/{method}', params=params or {}, timeout=timeout)
    try:
        payload = resp.json()
    except ValueError:
        raise RuntimeError(
            f'Telegram API {method} returned non-JSON (HTTP {resp.status_code})'
        )
    if not payload.get('ok'):
        raise RuntimeError(
            f'Telegram API {method} failed (HTTP {resp.status_code}): '
            f'{payload.get("description")}'
        )
    return payload


def delete_webhook():
    try:
        api_request('deleteWebhook', {'drop_pending_updates': 'false'})
        log('Webhook cleared (getUpdates is now allowed).')
    except Exception as exc:
        log(f'Warning: could not clear webhook: {exc}')


def fetch_updates(offset):
    try:
        data = api_request(
            'getUpdates',
            {
                'offset': offset,
                'limit': 100,
                'timeout': GETUPDATES_TIMEOUT,
                'allowed_updates': json.dumps(
                    ['message', 'edited_message', 'channel_post', 'edited_channel_post']
                ),
            },
            timeout=REQUEST_TIMEOUT,
        )
    except Exception as exc:
        log_err(f'getUpdates failed: {exc}')
        return []
    return data.get('result', [])


def get_file_url(file_id):
    data = api_request('getFile', {'file_id': file_id})
    file_path = data.get('result', {}).get('file_path')
    if not file_path:
        raise RuntimeError('No file_path in Telegram response')
    return f'https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}'


def download_file(file_path, url):
    with requests.get(url, timeout=REQUEST_TIMEOUT, stream=True) as resp:
        resp.raise_for_status()
        with open(file_path, 'wb') as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 256):
                if chunk:
                    fh.write(chunk)


def send_reply(chat_id, message_id, text):
    """Best-effort reply to the source message. Never raises."""
    if not BOT_TOKEN or chat_id is None or message_id is None:
        return
    try:
        resp = requests.post(
            f'{API}/sendMessage',
            data={
                'chat_id': chat_id,
                'reply_to_message_id': message_id,
                'text': text[:4000],
                'disable_web_page_preview': 'true',
            },
            timeout=30,
        )
        if resp.status_code != 200:
            log(f'Reply failed (HTTP {resp.status_code}): {resp.text[:200]}')
    except Exception as exc:
        log(f'Reply failed: {exc}')


def reply_success(chat_id, message_id, track):
    text = (
        '✅ Added to library\n\n'
        f"🎵 {track['title']}\n"
        f"👤 {track['artist']}\n"
        f"💿 {track['album']} ({track['year']})\n"
        f"⏱ {track['duration']}"
    )
    send_reply(chat_id, message_id, text)


def reply_failure(chat_id, message_id, error):
    if isinstance(error, AIError):
        reason = AI_ERROR_LABELS.get(error.category, error.category)
        detail = error.detail
    else:
        reason = type(error).__name__
        detail = str(error)

    text = (
        '❌ Metadata extraction failed\n\n'
        'The song was not added to the library.\n\n'
        f'Reason: {reason}\n'
        f'Details: {str(detail)[:300]}\n\n'
        'You can resend the file later.'
    )
    send_reply(chat_id, message_id, text)


# ------------------------------------------------------------------- audio

def pick_audio(message):
    for key in ('audio', 'voice', 'video_note'):
        node = message.get(key)
        if isinstance(node, dict) and node.get('file_id'):
            return node, key

    doc = message.get('document')
    if isinstance(doc, dict) and doc.get('file_id'):
        mime = str(doc.get('mime_type', '')).lower()
        name = str(doc.get('file_name', '')).lower()
        ext = Path(name).suffix
        if mime.startswith('audio/') or ext in AUDIO_EXTENSIONS:
            return doc, 'document'
    return None, None


def chat_matches(message):
    if not CHAT_ID:
        return True
    chat = message.get('chat') or {}
    return str(chat.get('id')) == str(CHAT_ID)


def convert_to_mp3(source_path, dest_path):
    """Keep MP3 as-is; otherwise re-encode with the bundled ffmpeg (VBR -q:a 2)."""
    if is_mp3_bytes(source_path):
        if Path(source_path) != Path(dest_path):
            source_path.replace(dest_path)
        return
    ffmpeg = get_ffmpeg_exe()
    cmd = [
        ffmpeg, '-y', '-hide_banner', '-loglevel', 'error',
        '-i', str(source_path), '-vn',
        '-acodec', 'libmp3lame', '-q:a', '2', str(dest_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=600)
    source_path.unlink(missing_ok=True)


def telegram_duration(audio):
    seconds = audio.get('duration')
    if seconds is None:
        return None
    return format_duration(seconds)


# ---------------------------------------------------------------------- AI

class AIError(Exception):
    def __init__(self, category, detail):
        super().__init__(detail)
        self.category = category
        self.detail = str(detail)


AI_ERROR_LABELS = {
    'auth':       'Authentication with AI provider failed',
    'rate_limit': 'AI provider rate limit exceeded',
    'server':     'AI provider server error',
    'request':    'AI provider rejected the request',
    'timeout':    'AI request timed out',
    'network':    'Network error while contacting AI provider',
    'parse':      'AI returned an invalid response',
    'empty':      'AI returned an empty response',
    'unknown':    'Unexpected AI error',
}


AI_SYSTEM_PROMPT = """You are a music metadata extractor. You will receive raw signals extracted from a Telegram audio message (tags, file name, caption, chat context, etc.). Your job is to produce clean, accurate music metadata.

Return ONLY a single valid JSON object. No markdown fences, no prose, no explanations.

Required JSON schema (all keys must be present):
{
  "title":  string,   // Clean song title. No emojis, no hashtags, no URLs, no "Official Video", "HD", "320", "Download", "دانلود", etc.
  "artist": string,   // Main artist. If unknown, use "Unknown".
  "album":  string,   // Album name. If unknown, use "Imported".
  "year":   integer   // 4-digit release year, or null if unknown.
}

Rules:
- Prefer the Telegram audio tags (title/performer) when they look clean.
- Use the caption if tags are junk (e.g. generic download-site names or emojis).
- If the title contains "Artist - Title", split it into artist and title.
- Preserve Persian/Arabic/Hebrew/CJK script as-is.
- Never invent an artist. If none can be inferred, use "Unknown".
- Never invent an album. If none can be inferred, use "Imported".
- Never invent a year. If none can be inferred, use null.
"""


def build_ai_signals(message, audio, source_hint):
    chat = message.get('chat') or {}
    from_user = message.get('from') or {}
    sender_name = ' '.join(filter(None, [
        from_user.get('first_name'),
        from_user.get('last_name'),
    ])).strip() or from_user.get('username') or ''

    signals = {
        'telegram_caption': (message.get('caption') or '').strip(),
        'telegram_audio_title': (audio.get('title') or '').strip(),
        'telegram_performer': (audio.get('performer') or '').strip(),
        'telegram_file_name': (audio.get('file_name') or '').strip(),
        'telegram_mime_type': str(audio.get('mime_type') or '').strip(),
        'telegram_duration_seconds': audio.get('duration'),
        'source_type': source_hint,
        'chat_title': (chat.get('title') or chat.get('username') or '').strip(),
        'sender_name': sender_name,
        'message_date_utc': time.strftime(
            '%Y-%m-%dT%H:%M:%SZ',
            time.gmtime(message.get('date') or time.time()),
        ),
    }
    return {k: v for k, v in signals.items() if v not in (None, '')}


def parse_ai_response(raw):
    text = (raw or '').strip()
    if not text:
        raise AIError('empty', 'AI returned empty content')

    if text.startswith('```'):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text).strip()

    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass

    raise AIError('parse', f'Could not parse JSON from response: {text[:200]!r}')


def sanitize_year(value):
    current_year = int(time.strftime('%Y'))
    try:
        year = int(value)
        if 1900 <= year <= current_year + 1:
            return year
    except (TypeError, ValueError):
        pass
    return current_year


def call_ai(signals):
    """Single-shot call to Groq. Raises AIError on any failure."""
    if not GROQ_API_KEY:
        raise AIError('auth', 'GROQ_API_KEY is not set')

    headers = {
        'Authorization': f'Bearer {GROQ_API_KEY}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': GROQ_TEXT_MODEL,
        'messages': [
            {'role': 'system', 'content': AI_SYSTEM_PROMPT},
            {'role': 'user', 'content': json.dumps(signals, ensure_ascii=False)},
        ],
        'temperature': 0.2,
        'max_tokens': 500,
    }

    try:
        resp = requests.post(
            f'{GROQ_BASE}/chat/completions',
            headers=headers,
            json=payload,
            timeout=AI_TIMEOUT,
        )
    except requests.Timeout as exc:
        raise AIError('timeout', f'Request exceeded {AI_TIMEOUT}s: {exc}')
    except requests.ConnectionError as exc:
        raise AIError('network', f'Connection error: {exc}')
    except requests.RequestException as exc:
        raise AIError('network', f'Request error: {exc}')

    status = resp.status_code

    if status in (401, 403):
        raise AIError('auth', f'HTTP {status}: {resp.text[:200]}')
    if status == 429:
        raise AIError('rate_limit', f'HTTP 429: {resp.text[:200]}')
    if 500 <= status < 600:
        raise AIError('server', f'HTTP {status}: {resp.text[:200]}')
    if 400 <= status < 500:
        raise AIError('request', f'HTTP {status}: {resp.text[:200]}')
    if status != 200:
        raise AIError('unknown', f'Unexpected HTTP {status}: {resp.text[:200]}')

    try:
        body = resp.json()
    except ValueError:
        raise AIError('parse', f'Non-JSON HTTP body: {resp.text[:200]!r}')

    choices = body.get('choices') or []
    if not choices:
        raise AIError('empty', f'No choices in response: {str(body)[:200]}')

    content = (choices[0].get('message') or {}).get('content') or ''
    return parse_ai_response(content)


# ---------------------------------------------------------------- pipeline

def import_update(item, state, manifest):
    """Process one Telegram update. Returns True when a new track was added."""
    message = (
        item.get('message')
        or item.get('edited_message')
        or item.get('channel_post')
        or item.get('edited_channel_post')
    )
    if not isinstance(message, dict):
        return False

    if not chat_matches(message):
        return False

    chat_id = (message.get('chat') or {}).get('id')
    message_id = message.get('message_id')

    audio, source_hint = pick_audio(message)
    if not audio:
        return False

    file_id = str(audio.get('file_id', ''))
    file_unique_id = str(audio.get('file_unique_id', ''))
    if not file_id:
        return False

    if file_unique_id and file_unique_id in set(state.get('file_ids', [])):
        log(f'Skip duplicate file_unique_id={file_unique_id}')
        return False

    # Telegram Bot API download limit (20 MB)
    file_size = int(audio.get('file_size') or 0)
    if file_size and file_size > MAX_DOWNLOAD_BYTES:
        mb = file_size / (1024 * 1024)
        log(f'Skip oversized file ({mb:.2f} MB > 20 MB): file_id={file_id}')
        send_reply(
            chat_id, message_id,
            f'⚠️ File too large ({mb:.1f} MB)\n'
            'Telegram Bot API cannot download files above 20 MB.',
        )
        if file_unique_id:
            remember_file_id(state, file_unique_id)
        return False

    title_hint = (
        (message.get('caption') or '').strip().splitlines()[0:1]
        or [audio.get('title') or '']
        or [Path(audio.get('file_name') or '').stem]
    )
    slug_source = title_hint[0] if title_hint and title_hint[0] else 'untitled-track'
    slug = slugify(slug_source)
    stamp = int(time.time())
    raw_path = AUDIO_DIR / f'{slug}-{stamp}-{file_unique_id or file_id}.tmp'

    # -- download --------------------------------------------------------
    try:
        url = get_file_url(file_id)
        download_file(raw_path, url)
    except Exception as exc:
        log_err(f'Download failed for file_id={file_id}: {exc}')
        raw_path.unlink(missing_ok=True)
        send_reply(chat_id, message_id, f'❌ Download failed\n\nDetails: {str(exc)[:300]}')
        return False

    content_hash = sha256_of(raw_path)
    if content_hash in manifest_hashes(manifest):
        raw_path.unlink(missing_ok=True)
        log(f'Skip duplicate content sha256={content_hash[:12]}')
        if file_unique_id:
            remember_file_id(state, file_unique_id)
        return False

    # -- AI metadata extraction (single attempt) -------------------------
    time.sleep(RATE_LIMIT_DELAY)  # keep under 30 RPM
    try:
        signals = build_ai_signals(message, audio, source_hint)
        ai_data = call_ai(signals)
    except AIError as exc:
        raw_path.unlink(missing_ok=True)
        log_err(f'AI failed for file_id={file_id}: [{exc.category}] {exc.detail}')
        reply_failure(chat_id, message_id, exc)
        return False
    except Exception as exc:
        raw_path.unlink(missing_ok=True)
        log_err(f'Unexpected AI error for file_id={file_id}: {exc}')
        reply_failure(chat_id, message_id, exc)
        return False

    ai_title = str(ai_data.get('title') or '').strip()
    ai_artist = str(ai_data.get('artist') or '').strip()
    ai_album = str(ai_data.get('album') or '').strip()

    fallback_title = (
        (message.get('caption') or '').strip().splitlines()[0:1]
        or [audio.get('title') or '']
        or [Path(audio.get('file_name') or '').stem]
    )
    title = (ai_title or (fallback_title[0] if fallback_title else '') or 'Untitled track')[:120]
    artist = (ai_artist or 'Unknown')[:120]
    album = (ai_album or 'Imported')[:120]
    year = sanitize_year(ai_data.get('year'))

    slug = slugify(title)

    # -- convert to MP3 --------------------------------------------------
    final_path = AUDIO_DIR / f'{slug}-{stamp}-{content_hash[:8]}.mp3'
    if final_path.exists():
        final_path = AUDIO_DIR / f'{slug}-{stamp}-{content_hash[:8]}-{file_unique_id or file_id}.mp3'

    try:
        convert_to_mp3(raw_path, final_path)
    except subprocess.CalledProcessError as exc:
        log_err(f'ffmpeg failed for {raw_path.name}: {exc.stderr or exc}')
        raw_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        send_reply(chat_id, message_id, '❌ Audio conversion to MP3 failed.')
        return False
    except Exception as exc:
        log_err(f'Conversion error for {raw_path.name}: {exc}')
        raw_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        send_reply(chat_id, message_id, f'❌ Conversion error\n\nDetails: {str(exc)[:300]}')
        return False

    if raw_path.exists() and raw_path != final_path:
        raw_path.unlink(missing_ok=True)

    final_hash = sha256_of(final_path) if final_path.exists() else content_hash
    if final_hash in manifest_hashes(manifest):
        final_path.unlink(missing_ok=True)
        log(f'Skip duplicate converted content sha256={final_hash[:12]}')
        if file_unique_id:
            remember_file_id(state, file_unique_id)
        return False

    # -- duration --------------------------------------------------------
    duration = telegram_duration(audio) or mutagen_duration(final_path) or '00:00'

    # -- manifest --------------------------------------------------------
    track_id = unique_track_id(slug, manifest_ids(manifest), final_hash)
    track = {
        'id': track_id,
        'file': f'audio/{final_path.name}',
        'title': title,
        'artist': artist,
        'album': album,
        'year': year,
        'duration': duration,
        'cover': '',
        'sha256': final_hash,
        'telegram_file_unique_id': file_unique_id,
        'source': source_hint,
        'imported_at': now_iso(),
    }

    manifest.setdefault('tracks', []).append(track)
    write_manifest(manifest)
    if file_unique_id:
        remember_file_id(state, file_unique_id)
    state['imported'] = int(state.get('imported', 0)) + 1

    log(f'Imported {track_id} ({duration}) from {source_hint} -> {final_path.name}')
    reply_success(chat_id, message_id, track)
    return True


def handle_updates():
    ensure_audio_dir()
    cleanup_tmp_files()

    if not BOT_TOKEN:
        log_err('TELEGRAM_BOT_TOKEN is not set. Aborting.')
        return 0
    if not GROQ_API_KEY:
        log_err('GROQ_API_KEY is not set. Aborting.')
        return 0

    delete_webhook()

    state = load_state()
    manifest = read_manifest()
    log(f'Starting sync: offset={state.get("offset")} '
        f'chat_filter={CHAT_ID or "(any chat)"} '
        f'imported_total={state.get("imported", 0)} '
        f'ai_model={GROQ_TEXT_MODEL}')

    updates = fetch_updates(state.get('offset', 0))
    log(f'Received {len(updates)} update(s) from Telegram.')

    if not updates:
        save_state(state)
        return 0

    imported = 0
    max_update_id = state.get('offset', 0)

    for item in updates:
        update_id = int(item.get('update_id', 0))
        try:
            if import_update(item, state, manifest):
                imported += 1
            if update_id >= max_update_id:
                max_update_id = update_id + 1
        except Exception as exc:
            log_err(f'Unexpected error processing update_id={update_id}: {exc}')
            log(traceback.format_exc())
            if update_id >= max_update_id:
                max_update_id = update_id + 1

    state['offset'] = max_update_id
    log(f'Advanced offset to {state["offset"]}')
    save_state(state)
    return imported


# ------------------------------------------------------------------- git

def commit_changes(imported):
    subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'],
                   check=True, cwd=str(ROOT))
    subprocess.run(
        ['git', 'config', 'user.email',
         '41898282+github-actions[bot]@users.noreply.github.com'],
        check=True, cwd=str(ROOT),
    )

    subprocess.run(['git', 'add', 'audio', '.telegram-sync-state.json'],
                   check=True, cwd=str(ROOT))
    staged = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=str(ROOT))
    if staged.returncode == 0:
        log('Nothing staged to commit.')
        return

    msg = f'Add imported Telegram tracks ({imported})' if imported > 0 \
        else 'Update Telegram sync state'
    subprocess.run(['git', 'commit', '-m', msg], check=True, cwd=str(ROOT))

    pull = subprocess.run(
        ['git', 'pull', '--rebase', '--autostash', 'origin', 'HEAD'],
        cwd=str(ROOT),
    )
    if pull.returncode != 0:
        log('Warning: git pull --rebase failed; attempting push anyway.')

    subprocess.run(['git', 'push'], check=True, cwd=str(ROOT))
    log(f'Pushed changes to repository (imported={imported}).')


# ------------------------------------------------------------------- main

def main():
    try:
        imported = handle_updates()
        commit_changes(imported)
    except Exception as exc:
        log_err(f'FATAL: {exc}')
        log(traceback.format_exc())
        sys.exit(1)


if __name__ == '__main__':
    main()
