export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

/** Stable object keys: never derived from editable display text. */
export function audioKey(trackId, ext = 'mp3') {
  return `audio/${trackId}.${ext}`;
}
export function coverKey(trackId, ext = 'jpg') {
  return `covers/${trackId}.${ext}`;
}

export function secondsToDisplay(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
