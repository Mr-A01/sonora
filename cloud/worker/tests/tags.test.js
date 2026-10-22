import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readId3, normalizeText, parseFilename } from '../src/services/tags.js';
import { buildId3 } from './fixtures.js';

test('reads UTF-8 tags including Persian', () => {
  const bytes = buildId3({ title: 'آهنگ شب', artist: 'خواننده', album: 'آلبوم', year: 2021 });
  const { tags } = readId3(bytes);
  assert.equal(tags.title, 'آهنگ شب');
  assert.equal(tags.artist, 'خواننده');
  assert.equal(tags.year, 2021);
});

test('absent tags stay absent instead of being invented', () => {
  const { tags, cover } = readId3(buildId3({ title: 'Only Title' }));
  assert.equal(tags.artist, undefined);
  assert.equal(tags.year, undefined);
  assert.equal(cover, null);
});

test('extracts embedded APIC artwork', () => {
  const cover = new Uint8Array(200).fill(7);
  const { cover: found } = readId3(buildId3({ title: 't', cover }));
  assert.ok(found);
  assert.equal(found.mime, 'image/jpeg');
  assert.equal(found.data.length, cover.length);
});

test('SYLT yields line-level synchronization', () => {
  const bytes = buildId3({
    title: 't',
    synced: true,
    syncedMs: [
      [0, 'خط اول'],
      [4000, 'خط دوم'],
    ],
  });
  const { syncedLyrics } = readId3(bytes);
  assert.equal(syncedLyrics.length, 2);
  assert.equal(syncedLyrics[0].start, 0);
  assert.equal(syncedLyrics[1].start, 4);
  assert.equal(syncedLyrics[1].text, 'خط دوم');
});

test('USLT plain lyrics are reported as plain, never synchronized', () => {
  const { plainLyrics, syncedLyrics } = readId3(buildId3({ title: 't', plain: 'یک\nدو' }));
  assert.equal(plainLyrics, 'یک\nدو');
  assert.equal(syncedLyrics, null);
});

test('unicode normalization keeps Persian characters intact', () => {
  assert.equal(normalizeText('  سلام   دنیا  '), 'سلام دنیا');
  assert.equal(normalizeText('می\u200cروم'), 'می\u200cروم');
});

test('filename parsing only splits on an explicit separator', () => {
  assert.deepEqual(parseFilename('Artist - Title.mp3'), { artist: 'Artist', title: 'Title' });
  assert.deepEqual(parseFilename('Just A Title.mp3'), { artist: null, title: 'Just A Title' });
});
