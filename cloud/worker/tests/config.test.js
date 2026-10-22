/**
 * Config contract checks that do not need a running server.
 * Guards the things a path refactor can silently break.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Strips // comments so the jsonc config can be parsed without a dependency. */
function readConfig() {
  const raw = readFileSync(join(workerDir, 'wrangler.jsonc'), 'utf8')
    .split('\n')
    .map((line) => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
  return JSON.parse(raw);
}

test('admin assets directory exists and contains the SPA', () => {
  const config = readConfig();
  assert.ok(config.assets?.directory, 'assets.directory must be configured');
  const dir = join(workerDir, config.assets.directory);
  assert.ok(existsSync(dir) && statSync(dir).isDirectory(), `${config.assets.directory} must be a directory`);
  assert.ok(existsSync(join(dir, 'admin', 'index.html')), 'admin/index.html must exist');
  assert.ok(existsSync(join(dir, 'admin', 'admin.js')), 'admin/admin.js must exist');
});

test('worker entrypoint and migrations exist', () => {
  const config = readConfig();
  assert.equal(config.main, 'src/index.js');
  assert.ok(existsSync(join(workerDir, config.main)));
  assert.equal(config.d1_databases?.[0]?.migrations_dir, 'migrations');
  assert.ok(existsSync(join(workerDir, 'migrations', '0001_init.sql')));
});

test('queue consumer and DLQ stay configured', () => {
  const config = readConfig();
  const consumer = config.queues?.consumers?.[0];
  assert.equal(consumer?.queue, 'sonora-import');
  assert.ok(consumer?.dead_letter_queue, 'a dead letter queue must be configured');
});
