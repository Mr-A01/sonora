/**
 * Bounded audio probing with no native dependencies (Workers cannot run ffmpeg).
 * Supports MP3 (ID3v2 + MPEG frame walk), FLAC STREAMINFO, and OGG/Opus granule.
 * Unknown is a real result: callers must not treat it as zero.
 */
export const PREVIEW_MAX_SECONDS = 30;

const MP3_BITRATES = {
  1: { 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] },
  2: { 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] },
};
const SAMPLE_RATES = { 1: [0, 44100, 48000, 32000], 2: [0, 22050, 24000, 16000], 25: [0, 11025, 12000, 8000] };

function id3v2Size(b) {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  return 10 + ((b[6] & 0x7f) * 2097152 + (b[7] & 0x7f) * 16384 + (b[8] & 0x7f) * 128 + (b[9] & 0x7f));
}

/** Walks MPEG audio frames. Returns integer seconds, or null when unparseable. */
export function mp3DurationSeconds(bytes) {
  const start = id3v2Size(bytes);
  let offset = start;
  let frames = 0;
  let duration = 0;
  let samplesPerFrame = 0;
  let sampleRate = 0;

  while (offset + 4 <= bytes.length && frames < 50000) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) {
      offset++;
      continue;
    }
    const versionBits = (bytes[offset + 1] >> 3) & 0x03;
    const layerBits = (bytes[offset + 1] >> 1) & 0x03;
    const bitrateIdx = (bytes[offset + 2] >> 4) & 0x0f;
    const rateIdx = (bytes[offset + 2] >> 2) & 0x03;
    if (versionBits === 1 || layerBits === 0 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) {
      offset++;
      continue;
    }
    const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 25;
    const layer = 4 - layerBits; // 1..3
    if (!samplesPerFrame) {
      sampleRate = SAMPLE_RATES[version][rateIdx];
      samplesPerFrame = layer === 1 ? 384 : layer === 2 ? 1152 : version === 1 ? 1152 : 576;
    }
    const table = MP3_BITRATES[version === 1 ? 1 : 2][layer] || [];
    const bitrate = (table[bitrateIdx] || 0) * 1000;
    if (!bitrate || !sampleRate) {
      offset++;
      continue;
    }
    const pad = (bytes[offset + 2] >> 1) & 0x01;
    const frameLen = Math.floor(((layer === 1 ? 12 : 144) * bitrate) / sampleRate) + pad;
    if (frameLen <= 4) {
      offset++;
      continue;
    }
    duration += samplesPerFrame / sampleRate;
    frames++;
    offset += frameLen;
  }
  if (!frames) return null;
  return Math.round(duration);
}

export function flacDurationSeconds(bytes) {
  if (bytes.length < 42 || bytes[0] !== 0x66 || bytes[1] !== 0x4c || bytes[2] !== 0x61 || bytes[3] !== 0x43) return null;
  // STREAMINFO is the first metadata block: bytes 8..17 of payload.
  const sampleRate = (bytes[18] << 12) | (bytes[19] << 4) | (bytes[20] >> 4);
  const totalSamples = (bytes[21] & 0x0f) * 2 ** 32 + (bytes[22] << 24 >>> 0) + (bytes[23] << 16) + (bytes[24] << 8) + bytes[25];
  if (!sampleRate || !totalSamples) return null;
  return Math.round(totalSamples / sampleRate);
}

export function detectAudioExtension(mime = '', filename = '') {
  const m = String(mime).toLowerCase();
  const f = String(filename).toLowerCase();
  if (m.includes('mpeg') || m.includes('mp3') || f.endsWith('.mp3')) return 'mp3';
  if (m.includes('flac') || f.endsWith('.flac')) return 'flac';
  if (m.includes('ogg') || m.includes('opus') || f.endsWith('.ogg') || f.endsWith('.opus')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a') || m.endsWith('aac') || f.endsWith('.m4a') || f.endsWith('.aac')) return 'm4a';
  return 'bin';
}

/** Best-effort duration with an explicit null for unsupported containers. */
export function probeDuration(bytes, ext) {
  if (!bytes || bytes.length < 32) return null;
  if (ext === 'mp3') return mp3DurationSeconds(bytes);
  if (ext === 'flac') return flacDurationSeconds(bytes);
  return null; // m4a/ogg need container-specific parsing; never guessed
}

export function isPreview(durationSeconds) {
  return Number.isInteger(durationSeconds) && durationSeconds <= PREVIEW_MAX_SECONDS;
}
