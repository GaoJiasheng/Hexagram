-- 通过 Apple 登录(原生 App「观象 · 书桌」,2026-11-22):
--   ① identities.provider 的 CHECK 原只认 ('google','email','phone','wechat'),插 'apple' 会被拒。
--      SQLite 改不了既有 CHECK,只能重建这张表。
--   ② 顺带加两列(可空,只给 provider='apple' 用):refresh_token = 登录时拿 Apple 授权码换来的 refresh_token,
--      refresh_aud = 换它时用的 client_id(App 的 bundle id)。注销账号时据此调苹果 revoke 撤销授权(App Store 审核要求)。
-- 线上现有结构(3d71b91 建表 + 0001 的 ALTER ADD COLUMN secret,其后 0002–0006 都没碰这张表):
--   user_id, provider, provider_uid, created_at, secret;主键 (provider, provider_uid)、UNIQUE (user_id, provider)、
--   外键 user_id → users(id) ON DELETE CASCADE;除主键 / UNIQUE 自带的 autoindex 外没有别的索引、没有触发器。
-- 本文件按列名拷贝那五列(不依赖列序),新两列落 NULL;主键、UNIQUE、外键、默认值照原样。
-- **不动 users 表。** identities 不被任何表外键引用,删旧表、改名都不牵连别的表。
-- D1 始终开着外键约束:若线上有指向不存在用户的孤儿行,INSERT 会报错、整份迁移不生效(不会半途而废),
--   有外键在,这种行本不该存在。
-- 上线顺序:先在远端 D1 执行本文件,再发带 /auth/apple 的代码(旧代码按列名读写,多两列不受影响)。
-- 执行前先核一遍远端现有结构与上面的描述一致:
--   SELECT type, name, sql FROM sqlite_master WHERE tbl_name = 'identities';
-- 应只有一条 table 和两条 sqlite_autoindex_identities_*(sql 为空)。
CREATE TABLE identities_new (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('google', 'email', 'phone', 'wechat', 'apple')
  ),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  secret TEXT,
  refresh_token TEXT,
  refresh_aud TEXT,
  PRIMARY KEY (provider, provider_uid),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO identities_new (user_id, provider, provider_uid, created_at, secret)
  SELECT user_id, provider, provider_uid, created_at, secret FROM identities;
DROP TABLE identities;
ALTER TABLE identities_new RENAME TO identities;
