-- Sonora Cloud schema. D1 is authoritative for catalog state.
PRAGMA foreign_keys = ON;

CREATE TABLE admins (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  iterations    INTEGER NOT NULL DEFAULT 600000,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','viewer')),
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE sources (
  id             TEXT PRIMARY KEY,
  chat_id        TEXT NOT NULL UNIQUE,
  title          TEXT,
  kind           TEXT NOT NULL DEFAULT 'channel',
  enabled        INTEGER NOT NULL DEFAULT 1,
  access_status  TEXT NOT NULL DEFAULT 'unverified',
  access_error   TEXT,
  last_update_id INTEGER NOT NULL DEFAULT 0,
  last_sequence  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE telegram_updates (
  update_id   INTEGER PRIMARY KEY,
  chat_id     TEXT,
  message_id  INTEGER,
  source_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'received',
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE tracks (
  id                  TEXT PRIMARY KEY,
  source_id           TEXT REFERENCES sources(id) ON DELETE SET NULL,
  source_sequence     INTEGER,
  telegram_chat_id    TEXT,
  telegram_message_id INTEGER,
  title               TEXT,
  artist              TEXT,
  album               TEXT,
  year                INTEGER,
  genre               TEXT,
  language            TEXT,
  duration_seconds    INTEGER,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','needs_review','ready','failed','deleting','deleted')),
  source_metadata     TEXT,
  cover_key           TEXT,
  audio_key           TEXT,
  dropbox_account_id  TEXT,
  dropbox_path        TEXT,
  error               TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ready_at            TEXT,
  deleted_at          TEXT,
  UNIQUE (source_id, source_sequence),
  UNIQUE (telegram_chat_id, telegram_message_id)
);
CREATE INDEX idx_tracks_status ON tracks(status, created_at DESC);
CREATE INDEX idx_tracks_cover ON tracks(cover_key);

CREATE TABLE track_storage (
  track_id        TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('r2','dropbox')),
  object_key      TEXT NOT NULL,
  state           TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending','uploading','stored','failed','deleted')),
  size_bytes      INTEGER,
  checksum        TEXT,
  idempotency_key TEXT NOT NULL,
  last_error      TEXT,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (track_id, provider, object_key)
);

CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('import','transcribe','cleanup','repair')),
  track_id        TEXT REFERENCES tracks(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','dead')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  lease_until     TEXT,
  next_attempt_at TEXT,
  last_error      TEXT,
  payload         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_jobs_status ON jobs(status, next_attempt_at);

CREATE TABLE lyrics (
  track_id        TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  source          TEXT NOT NULL
    CHECK (source IN ('embedded','generated','manual','none')),
  format          TEXT NOT NULL
    CHECK (format IN ('plain','line','word')),
  status          TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready','needs_review','retrying','failed')),
  text            TEXT,
  segments        TEXT,
  raw_transcript  TEXT,
  model           TEXT,
  manual_override INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE dropbox_accounts (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  refresh_token_iv  TEXT NOT NULL,
  access_token      TEXT,
  access_expires_at TEXT,
  enabled           INTEGER NOT NULL DEFAULT 1,
  health            TEXT NOT NULL DEFAULT 'unverified',
  health_error      TEXT,
  quota_used        INTEGER,
  quota_total       INTEGER,
  folder            TEXT NOT NULL DEFAULT '/sonora',
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE oauth_states (
  state       TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at  TEXT NOT NULL
);

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  admin_id   TEXT,
  action     TEXT NOT NULL,
  target     TEXT,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE error_log (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  stage      TEXT,
  track_id   TEXT,
  message    TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_error_log_open ON error_log(resolved_at, created_at DESC);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
