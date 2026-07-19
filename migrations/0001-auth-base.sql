-- 邮箱并账的合并键:两种登录方式(邮箱注册 / Google)建号时都写入,小写规范化
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- 密码哈希挂在 email identity 行上(provider='email' 时使用,其余 provider 恒为 NULL)
ALTER TABLE identities ADD COLUMN secret TEXT;

-- 会话:id 存 token 的 SHA-256 hex(库泄露不等于 token 泄露),原始 token 只进 Cookie
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
