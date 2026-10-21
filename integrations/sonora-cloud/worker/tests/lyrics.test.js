import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMetadata, validateAiMetadata, completeMetadataWithAi } from '../src/services/metadata.js';
import { mergeCleanup, cleanupSegments, lyricSegmentsToText } from '../src/services/lyrics.js';
import { fakeAi, fakeEnv } from './harness.js';

test('tags outrank telegram which outranks filename', () => {
  const { values, origin } = resolveMetadata({
    tags: { title: 'Tag Title' },
    telegram: { title: 'Telegram Title', artist: 'Telegram Artist' },
    filename: { title: 'File Title', artist: 'File Artist' },
  });
  assert.equal(values.title, 'Tag Title');
  assert.equal(origin.title, 'tag');
  assert.equal(values.artist, 'Telegram Artist');
});

test('unknown year stays null instead of using the current year', () => {
  const { values } = resolveMetadata({ tags: { title: 'x' } });
  assert.equal(values.year, undefined);
});

test('AI output cannot overwrite known fields', async () => {
  const env = fakeEnv({
    AI: {
      async run() {
        return { choices: [{ message: { content: '{"title":"Invented","artist":"Invented Artist","year":2035}' } }] };
      },
    },
  });
  const result = await completeMetadataWithAi(env, { title: 'Real', artist: null }, {});
  assert.equal(result.values.title, 'Real');
  assert.equal(result.values.artist, 'Invented Artist');
  assert.equal(result.values.year, undefined, 'future year must be rejected');
});

test('invalid AI metadata is dropped, not persisted', () => {
  assert.deepEqual(validateAiMetadata('not json at all', { allowedFields: ['artist'] }), {});
  assert.deepEqual(validateAiMetadata({ artist: '   ' }, { allowedFields: ['artist'] }), {});
});

test('cleanup preserves immutable timestamps', () => {
  const segments = [
    { id: 'seg-0', start: 0, end: 2.5, text: 'سلام دنیا' },
    { id: 'seg-1', start: 2.5, end: 5, text: 'دو باره' },
  ];
  const result = mergeCleanup(segments, '{"segments":[{"id":"seg-0","text":"سلام، دنیا"},{"id":"seg-1","text":"دوباره"}]}');
  assert.equal(result.ok, true);
  assert.equal(result.segments[0].start, 0);
  assert.equal(result.segments[1].end, 5);
  assert.equal(result.segments[1].text, 'دوباره');
});

test('cleanup can never erase valid lyrics', () => {
  const segments = [{ id: 'seg-0', start: 0, end: 1, text: 'متن اصلی' }];
  const result = mergeCleanup(segments, '{"segments":[{"id":"seg-0","text":"   "}]}');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty_output');
});

test('cleanup rejects output that loses half the segments', () => {
  const segments = [
    { id: 'seg-0', start: 0, end: 1, text: 'a' },
    { id: 'seg-1', start: 1, end: 2, text: 'b' },
    { id: 'seg-2', start: 2, end: 3, text: 'c' },
    { id: 'seg-3', start: 3, end: 4, text: 'd' },
  ];
  const result = mergeCleanup(segments, '{"segments":[{"id":"seg-0","text":"A"}]}');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_many_segments_lost');
});

test('malformed model output is rejected', () => {
  const result = mergeCleanup([{ id: 'seg-0', start: 0, end: 1, text: 'x' }], 'no json here');
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_output');
});

test('cleanupSegments survives a provider failure', async () => {
  const env = fakeEnv({ AI: fakeAi({ fail: true }) });
  const result = await cleanupSegments(env, [{ id: 'seg-0', start: 0, end: 1, text: 'x' }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'provider_error');
});

test('persian text survives cleanup', async () => {
  const env = fakeEnv();
  const result = await cleanupSegments(env, [
    { id: 'seg-0', start: 0, end: 2, text: 'سلام دنیا' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(lyricSegmentsToText(result.segments), 'سلام دنیا');
});
