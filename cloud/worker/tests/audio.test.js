import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mp3DurationSeconds, probeDuration, isPreview, PREVIEW_MAX_SECONDS } from '../src/services/audio.js';
import { makeMp3 } from './fixtures.js';

test('exactly 30 seconds is a preview', () => {
  assert.equal(isPreview(30), true);
  assert.equal(PREVIEW_MAX_SECONDS, 30);
});

test('31 seconds is not a preview', () => {
  assert.equal(isPreview(31), false);
});

test('unknown duration is never zero', () => {
  assert.equal(isPreview(null), false);
  assert.equal(probeDuration(new Uint8Array([1, 2, 3]), 'm4a'), null);
});

test('mp3 duration is probed from real frames', () => {
  const bytes = makeMp3({ seconds: 30 });
  const seconds = mp3DurationSeconds(bytes);
  assert.ok(Math.abs(seconds - 30) <= 1, `expected ~30, got ${seconds}`);
});

test('mp3 probing tolerates ID3v2 prefix', () => {
  const bytes = makeMp3({ seconds: 45, id3: { title: 'x', artist: 'y' } });
  const seconds = probeDuration(bytes, 'mp3');
  assert.ok(Math.abs(seconds - 45) <= 1, `expected ~45, got ${seconds}`);
});

test('garbage input resolves to null, not a fake duration', () => {
  assert.equal(mp3DurationSeconds(new Uint8Array(500)), null);
});

test('only MP3 and FLAC report a duration; OGG/Opus/WAV/M4A stay unknown', () => {
  const ogg = new Uint8Array(200);
  ogg.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS" capture pattern
  const opus = new Uint8Array(200);
  opus.set([0x4f, 0x67, 0x67, 0x53], 0);
  const wav = new Uint8Array(200);
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"

  assert.equal(probeDuration(ogg, 'ogg'), null);
  assert.equal(probeDuration(opus, 'opus'), null);
  assert.equal(probeDuration(wav, 'wav'), null);
  assert.equal(probeDuration(new Uint8Array(200), 'm4a'), null);
});

test('a corrupt FLAC header returns null instead of a guessed duration', () => {
  const fake = new Uint8Array(64);
  fake.set([0x66, 0x4c, 0x61, 0x43], 0); // "fLaC" but zero sample rate
  assert.equal(probeDuration(fake, 'flac'), null);
});
