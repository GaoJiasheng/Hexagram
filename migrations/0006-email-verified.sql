-- 邮箱验证(owner 2026-10-06:「邮箱登录做好一点,先做邮箱验证和重置密码」)。
-- users.email_verified_at:验证通过的时刻(ms);NULL = 未验证。只做加法。
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
-- 回填:用 Google 登录过的账号,邮箱由 Google 担保,视为已验证
UPDATE users SET email_verified_at = unixepoch() * 1000
WHERE email_verified_at IS NULL
  AND id IN (SELECT user_id FROM identities WHERE provider = 'google');
