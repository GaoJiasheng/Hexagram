PRAGMA foreign_keys = ON;

-- All timestamps are Unix epoch milliseconds (UTC).
CREATE TABLE users (
  id TEXT NOT NULL PRIMARY KEY,
  display_name TEXT NOT NULL CHECK (
    length(trim(display_name)) BETWEEN 1 AND 80
  ),
  avatar_seed TEXT NOT NULL CHECK (
    length(avatar_seed) BETWEEN 1 AND 128
  ),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  is_owner INTEGER NOT NULL DEFAULT 0 CHECK (is_owner IN (0, 1)),
  email TEXT
);

CREATE UNIQUE INDEX idx_users_email
  ON users (email) WHERE email IS NOT NULL;

CREATE TABLE identities (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('google', 'email', 'phone', 'wechat')
  ),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  secret TEXT,
  PRIMARY KEY (provider, provider_uid),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user
  ON sessions (user_id);

CREATE TABLE auth_codes (
  target TEXT NOT NULL PRIMARY KEY CHECK (length(target) > 0),
  code_hash TEXT NOT NULL CHECK (length(code_hash) > 0),
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE TABLE user_data (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL CHECK (length(key) > 0),
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (user_id, key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reading_events (
  client_id TEXT NOT NULL CHECK (length(client_id) BETWEEN 8 AND 64),
  path TEXT NOT NULL CHECK (
    length(path) BETWEEN 1 AND 500 AND substr(path, 1, 1) = '/'
  ),
  corpus TEXT,
  slug TEXT,
  chapter TEXT,
  dwell_ms INTEGER NOT NULL DEFAULT 0 CHECK (dwell_ms >= 0),
  ts INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  -- Coarse geolocation resolved server-side by Cloudflare from the connecting
  -- IP (never stored). country is an ISO 3166-1 alpha-2 code; region is a
  -- best-effort state/province name and is null for many countries.
  country TEXT,
  region TEXT
);

CREATE INDEX idx_reading_events_ts
  ON reading_events (ts);

CREATE INDEX idx_reading_events_content
  ON reading_events (corpus, slug, chapter, ts);

CREATE INDEX idx_reading_events_geo
  ON reading_events (country, region);

CREATE TABLE comments (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  corpus TEXT NOT NULL CHECK (length(corpus) > 0),
  slug TEXT NOT NULL CHECK (length(slug) > 0),
  chapter TEXT NOT NULL CHECK (length(chapter) > 0),
  body TEXT NOT NULL CHECK (
    length(trim(body)) BETWEEN 1 AND 4000
  ),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (
    status IN ('visible', 'hidden')
  ),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_comments_content
  ON comments (corpus, slug, chapter, status, created_at);

CREATE INDEX idx_comments_user_id
  ON comments (user_id);

CREATE INDEX idx_auth_codes_expires_at
  ON auth_codes (expires_at);
