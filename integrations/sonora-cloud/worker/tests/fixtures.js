/** Builds synthetic MPEG-1 Layer III frames so duration probing is exercised for real. */
export function makeMp3({ seconds = 60, id3 = null } = {}) {
  const frameLen = Math.floor((144 * 128000) / 44100); // 417
  const framesPerSecond = 44100 / 1152;
  const count = Math.round(seconds * framesPerSecond);
  const header = new Uint8Array([0xff, 0xfb, 0x94, 0x64]); // MPEG1 L3, 128kbps, 44.1kHz
  const chunks = [];
  if (id3) chunks.push(buildId3(id3));
  for (let i = 0; i < count; i++) {
    const frame = new Uint8Array(frameLen);
    frame.set(header, 0);
    chunks.push(frame);
  }
  return concat(chunks);
}

export function concat(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function syncsafe(n) {
  return [((n >> 21) & 0x7f), ((n >> 14) & 0x7f), ((n >> 7) & 0x7f), n & 0x7f];
}

function textFrame(id, text) {
  const encoded = new TextEncoder().encode(text);
  const body = new Uint8Array(1 + encoded.length);
  body[0] = 3; // UTF-8
  body.set(encoded, 1);
  const frame = new Uint8Array(10 + body.length);
  frame.set(new TextEncoder().encode(id), 0);
  frame.set(syncsafe(body.length), 4);
  frame.set(body, 10);
  return frame;
}

export function buildId3({ title, artist, album, year, cover, synced, plain, syncedMs = null }) {
  const frames = [];
  if (title) frames.push(textFrame('TIT2', title));
  if (artist) frames.push(textFrame('TPE1', artist));
  if (album) frames.push(textFrame('TALB', album));
  if (year) frames.push(textFrame('TYER', String(year)));
  if (plain) {
    const encoded = new TextEncoder().encode(plain);
    const body = new Uint8Array(5 + encoded.length);
    body[0] = 3;
    body.set([0x65, 0x6e, 0x67], 1); // 'eng'
    body[4] = 0; // empty descriptor terminator
    body.set(encoded, 5);
    const frame = new Uint8Array(10 + body.length);
    frame.set(new TextEncoder().encode('USLT'), 0);
    frame.set(syncsafe(body.length), 4);
    frame.set(body, 10);
    frames.push(frame);
  }
  if (cover) {
    const mime = new TextEncoder().encode('image/jpeg');
    const body = new Uint8Array(1 + mime.length + 1 + 1 + 1 + cover.length);
    let i = 0;
    body[i++] = 0; // latin1
    body.set(mime, i);
    i += mime.length;
    body[i++] = 0;
    body[i++] = 3;
    body[i++] = 0;
    body.set(cover, i);
    const frame = new Uint8Array(10 + body.length);
    frame.set(new TextEncoder().encode('APIC'), 0);
    frame.set(syncsafe(body.length), 4);
    frame.set(body, 10);
    frames.push(frame);
  }
  if (synced && syncedMs) {
    const enc = new TextEncoder();
    const parts = [];
    const head = new Uint8Array(6);
    head[0] = 3;
    head.set(enc.encode('eng'), 1);
    head[4] = 2; // milliseconds
    head[5] = 1; // lyric content type
    parts.push(head);
    parts.push(new Uint8Array([0])); // empty sync identifier, NUL terminated
    for (const [ms, text] of syncedMs) {
      parts.push(enc.encode(text));
      parts.push(new Uint8Array([0]));
      parts.push(new Uint8Array([(ms >> 24) & 0xff, (ms >> 16) & 0xff, (ms >> 8) & 0xff, ms & 0xff]));
    }
    const body = concat(parts);
    const frame = new Uint8Array(10 + body.length);
    frame.set(enc.encode('SYLT'), 0);
    frame.set(syncsafe(body.length), 4);
    frame.set(body, 10);
    frames.push(frame);
  }

  const body = concat(frames);
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 4, 0, 0], 0);
  header.set(syncsafe(body.length), 6);
  return concat([header, body]);
}
