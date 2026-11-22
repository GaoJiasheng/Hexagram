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
  email TEXT,
  email_verified_at INTEGER
);

CREATE UNIQUE INDEX idx_users_email
  ON users (email) WHERE email IS NOT NULL;

CREATE TABLE identities (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('google', 'email', 'phone', 'wechat', 'apple')
  ),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  secret TEXT,
  -- 仅 provider='apple':登录时用授权码换来的 refresh_token 与换它用的 client_id(bundle id),注销账号时撤销授权用
  refresh_token TEXT,
  refresh_aud TEXT,
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

CREATE INDEX idx_comments_anchor
  ON comments (corpus, slug, chapter, created_at DESC);

CREATE INDEX idx_comments_user_time
  ON comments (user_id, created_at);

CREATE INDEX idx_auth_codes_expires_at
  ON auth_codes (expires_at);

-- 书房书架(迁移 0008-desk-shelf.sql;对象在 R2 桶 hexa-desk)
CREATE TABLE desk_shelf (
  id TEXT NOT NULL PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 64),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('classic', 'book', 'collection')),
  title TEXT NOT NULL,
  subtitle TEXT,
  authors TEXT NOT NULL DEFAULT '[]',      -- JSON 数组
  summary TEXT,
  category TEXT,                           -- 书架分栏;缺省取 book.json 的 category,管理员可改
  tags TEXT NOT NULL DEFAULT '[]',         -- JSON 数组
  unit TEXT,
  chapters INTEGER NOT NULL DEFAULT 0,
  chars INTEGER NOT NULL DEFAULT 0,        -- 字数:浏览器端完整校验时算出、随上传带来
  bytes INTEGER NOT NULL DEFAULT 0,        -- 书包文件大小
  sha256 TEXT,                             -- 书包文件的 SHA-256(小写十六进制)
  has_cover INTEGER NOT NULL DEFAULT 0 CHECK (has_cover IN (0, 1)),
  has_banner INTEGER NOT NULL DEFAULT 0 CHECK (has_banner IN (0, 1)),
  theme TEXT,                              -- JSON 对象
  disclaimer TEXT,                         -- JSON:字符串或数组
  source TEXT,                             -- JSON 对象
  object_key TEXT NOT NULL,                -- 当前书包在 R2 里的键
  uploaded_at INTEGER NOT NULL,            -- 首次上传(ms)
  updated_at INTEGER NOT NULL,             -- 最近一次上传或修改(ms)
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_desk_shelf_category
  ON desk_shelf (category, sort, title);
