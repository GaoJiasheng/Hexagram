-- 通过 Apple 登录(原生 App「观象 · 书桌」,2026-11-22):identities.provider 的 CHECK 原只认
-- ('google','email','phone','wechat'),插 'apple' 会被拒。SQLite 改不了既有 CHECK,只能重建这张表。
-- **不动 users 表。** identities 不被任何表外键引用,重建不牵连别的表;列、主键、UNIQUE、外键照原样。
-- 上线顺序:先在远端 D1 执行本文件,再发带 /auth/apple 的代码(旧代码不受本迁移影响)。
-- 执行前建议先核一遍远端现有结构与本文件假设一致:
--   SELECT sql FROM sqlite_master WHERE tbl_name = 'identities';
CREATE TABLE identities_new (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('google', 'email', 'phone', 'wechat', 'apple')
  ),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  secret TEXT,
  PRIMARY KEY (provider, provider_uid),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO identities_new (user_id, provider, provider_uid, created_at, secret)
  SELECT user_id, provider, provider_uid, created_at, secret FROM identities;
DROP TABLE identities;
ALTER TABLE identities_new RENAME TO identities;
