/** Minimal D1 shim over node:sqlite so the worker's SQL is tested for real. */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }
  bind(...params) {
    this.params = params.map((p) => (p === undefined ? null : p));
    return this;
  }
  _run() {
    return this.db.prepare(this.sql).run(...this.params);
  }
  async run() {
    const info = this._run();
    return { meta: { changes: Number(info.changes), last_row_id: info.lastInsertRowid } };
  }
  async first() {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ?? null;
  }
  async all() {
    const rows = this.db.prepare(this.sql).all(...this.params);
    return { results: rows };
  }
}

export function createTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const schema = readFileSync(join(here, '..', 'migrations', '0001_init.sql'), 'utf8');
  db.exec(schema);
  return {
    raw: db,
    prepare(sql) {
      return new Statement(db, sql);
    },
  };
}

/** Scriptable AI binding for deterministic tests. */
export function fakeAi({ transcript = 'سلام دنیا', cleaned = null, fail = false } = {}) {
  return {
    async run(model, payload) {
      if (fail) throw new Error('AI unavailable');
      if (String(model).includes('whisper')) {
        return {
          text: transcript,
          segments: [
            { start: 0, end: 2.5, text: transcript },
            { start: 2.5, end: 5, text: 'دوباره' },
          ],
        };
      }
      if (cleaned !== null) return { choices: [{ message: { content: cleaned } }] };
      return { choices: [{ message: { content: '{"segments":[{"id":"seg-0","text":"سلام دنیا"}]}' } }] };
    },
  };
}

/** In-memory R2 bucket with Range-ready semantics. */
export function fakeR2() {
  const store = new Map();
  return {
    store,
    async put(key, value, opts = {}) {
      const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
      store.set(key, { bytes, httpMetadata: opts.httpMetadata || {} });
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return { body: entry.bytes, size: entry.bytes.length, httpMetadata: entry.httpMetadata, httpEtag: '"test"' };
    },
    async head(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return { size: entry.bytes.length, httpMetadata: entry.httpMetadata, httpEtag: '"test"' };
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export function fakeQueue() {
  const sent = [];
  return { sent, async send(body) { sent.push(body); } };
}

export function fakeEnv(overrides = {}) {
  return {
    DB: createTestDb(),
    AI: fakeAi(),
    MEDIA: fakeR2(),
    IMPORT_QUEUE: fakeQueue(),
    TOKEN_ENCRYPTION_KEY: 'test-encryption-key-please-rotate',
    ALLOWED_ORIGINS: 'https://mhdlabs.github.io',
    PUBLIC_WORKER_URL: 'https://sonora-cloud.test.workers.dev',
    TELEGRAM_BOT_TOKEN: '123456:test-bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'secret-token-abcdefghijklmnop',
    MEDIA_BASE_URL: 'https://sonora-cloud.test.workers.dev/media',
    ...overrides,
  };
}
