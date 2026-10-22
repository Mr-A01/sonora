/**
 * Dependency-free ID3v2.3/2.4 reader for Workers (no Buffer, no node APIs).
 * Ported in spirit from the Sonora browser reader (js/id3.js) so the player and
 * the importer agree on tag semantics.
 *
 * Returns only facts found in the file. Absent fields are null — never invented.
 */
const TAGS = {
  TIT2: 'title',
  TPE1: 'artist',
  TALB: 'album',
  TDRC: 'year',
  TYER: 'year',
  TCON: 'genre',
  TLAN: 'language',
  USLT: 'plainLyrics',
};

function syncsafe(b, o) {
  return (b[o] & 0x7f) * 2097152 + (b[o + 1] & 0x7f) * 16384 + (b[o + 2] & 0x7f) * 128 + (b[o + 3] & 0x7f);
}
function u32(b, o) {
  return b[o] * 16777216 + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
}
function decodeUtf16(bytes, littleEndian) {
  let s = '';
  const start = bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) ? 2 : 0;
  if (bytes.length >= 2) littleEndian = bytes[0] === 0xff && bytes[1] === 0xfe ? true : bytes[0] === 0xfe && bytes[1] === 0xff ? false : littleEndian;
  for (let i = start; i + 1 < bytes.length; i += 2) {
    s += String.fromCharCode(littleEndian ? bytes[i] + (bytes[i + 1] << 8) : (bytes[i] << 8) + bytes[i + 1]);
  }
  return s;
}
function decodeText(bytes, encByte) {
  let s;
  if (encByte === 1 || encByte === 2) s = decodeUtf16(bytes, true);
  else if (encByte === 3) s = new TextDecoder('utf-8').decode(bytes);
  else s = new TextDecoder('iso-8859-1').decode(bytes);
  return s.replace(/\0+$/g, '').replace(/^\0+/g, '').trim();
}
function stripUnsync(b) {
  const out = [];
  for (let i = 0; i < b.length; i++) {
    out.push(b[i]);
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return new Uint8Array(out);
}
function findTerminator(b, from, wide) {
  if (wide) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
  } else {
    for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  }
  return b.length;
}

/** SYLT gives real word/line timestamps; we only emit line-level synchronization. */
function parseSylt(payload) {
  if (!payload || payload.length < 8) return null;
  const encByte = payload[0];
  const timeFormat = payload[4];
  if (timeFormat !== 2) return null; // only milliseconds are trusted
  let offset = 6;
  const end = findTerminator(payload, offset, encByte === 1 || encByte === 2);
  offset = end + (encByte === 1 || encByte === 2 ? 2 : 1);

  const segments = [];
  while (offset + 4 < payload.length) {
    const textEnd = findTerminator(payload, offset, encByte === 1 || encByte === 2);
    const text = decodeText(payload.slice(offset, textEnd), encByte);
    offset = textEnd + (encByte === 1 || encByte === 2 ? 2 : 1);
    if (offset + 4 > payload.length) break;
    const ms = u32(payload, offset);
    offset += 4;
    if (text) segments.push({ startMs: ms, text });
  }
  if (!segments.length) return null;
  return segments.map((s, i) => ({
    id: `sylt-${i}`,
    start: s.startMs / 1000,
    end: null,
    text: s.text,
  }));
}

/**
 * @param {Uint8Array} bytes full file bytes (bounded by caller)
 * @returns {{ tags: object, cover: {mime:string, data:Uint8Array}|null, syncedLyrics: Array|null, plainLyrics: string|null }}
 */
export function readId3(bytes) {
  const result = { tags: {}, cover: null, syncedLyrics: null, plainLyrics: null };
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return result;
  const major = bytes[3];
  if (major !== 3 && major !== 4) return result;
  const flags = bytes[5];
  const tagEnd = Math.min(bytes.length, 10 + syncsafe(bytes, 6));
  if (tagEnd <= 10) return result;

  let body = bytes.slice(10, tagEnd);
  if (flags & 0x80) body = stripUnsync(body);
  let offset = 0;
  if (flags & 0x40) {
    offset = major === 4 ? syncsafe(body, 0) : u32(body, 0) + 4;
  }

  while (offset + 10 <= body.length) {
    const id = String.fromCharCode(body[offset], body[offset + 1], body[offset + 2], body[offset + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = major === 4 ? syncsafe(body, offset + 4) : u32(body, offset + 4);
    if (size < 0 || offset + 10 + size > body.length) break;
    const frame = body.slice(offset + 10, offset + 10 + size);
    offset += 10 + size;

    if (id === 'APIC' && !result.cover) {
      const encByte = frame[0];
      let i = 1;
      let mime = '';
      while (i < frame.length && frame[i] !== 0) mime += String.fromCharCode(frame[i++]);
      i++;
      i++; // picture type
      const descEnd = findTerminator(frame, i, encByte === 1 || encByte === 2);
      i = descEnd + (encByte === 1 || encByte === 2 ? 2 : 1);
      const data = frame.slice(i);
      if (data.length > 64) result.cover = { mime: mime || 'image/jpeg', data };
      continue;
    }
    if (id === 'SYLT' && !result.syncedLyrics) {
      result.syncedLyrics = parseSylt(frame);
      continue;
    }
    const key = TAGS[id];
    if (!key) continue;
    if (id === 'USLT') {
      const encByte = frame[0];
      let i = 4; // encoding + 3-byte language
      const descEnd = findTerminator(frame, i, encByte === 1 || encByte === 2);
      i = descEnd + (encByte === 1 || encByte === 2 ? 2 : 1);
      const text = decodeText(frame.slice(i), encByte);
      if (text) result.plainLyrics = text;
      continue;
    }
    const text = decodeText(frame.slice(1), frame[0]);
    if (!text) continue;
    if (key === 'year') {
      const match = text.match(/\d{4}/);
      if (match) result.tags.year = Number(match[0]);
    } else {
      result.tags[key] = text;
    }
  }
  return result;
}

/** Normalizes Unicode (NFC) while preserving Persian/Arabic characters. */
export function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

/** Conservative filename heuristic: never guesses artist when evidence is weak. */
export function parseFilename(name) {
  const base = String(name || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim();
  if (!base) return { title: null, artist: null };
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: normalizeText(parts[0]), title: normalizeText(parts.slice(1).join(' - ')) };
  return { title: normalizeText(base), artist: null };
}
