-- 邮箱验证码表(续跑 ⑥,2026-10-01 上线时在生产手工建过,此前没有迁移文件;这里补登,IF NOT EXISTS 对生产无副作用)。
-- target 主键 = purpose:邮箱 / purpose:userId;存哈希不存明文;expires_at 发出时刻 + 10 分钟;错 5 次作废。
CREATE TABLE IF NOT EXISTS auth_codes (
  target TEXT NOT NULL PRIMARY KEY CHECK (length(target) > 0),
  code_hash TEXT NOT NULL CHECK (length(code_hash) > 0),
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
