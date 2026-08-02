-- App Store 审核指南 1.2(用户生成内容)要求四件套:内容过滤、举报入口、拉黑滥用者、公开联系方式。
-- 过滤在服务端代码里(server/content-filter.js),联系方式是静态文案,这里只建前两样要的表。
--
-- 注意:**只要 App 里「展示」UGC 就落进 1.2**,不是只有能发才算。所以 iOS 端虽然不开发帖,
-- 举报与拉黑仍然要能用 —— 这两张表和对应接口是网页与 iOS 共用的。

-- 举报:一人对一条评论只能报一次(UNIQUE),重复点不叠加计数。
-- handled_at 为空即「待处理」,owner 在后台处理后写入时间戳。
CREATE TABLE IF NOT EXISTS comment_reports (
  id TEXT NOT NULL PRIMARY KEY,
  comment_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  handled_at INTEGER,
  UNIQUE (comment_id, reporter_id),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
-- 后台「待处理举报」列表按此索引取
CREATE INDEX IF NOT EXISTS idx_reports_pending ON comment_reports(handled_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_comment ON comment_reports(comment_id);

-- 拉黑:拉黑是**单向且仅对本人生效**的视图过滤,不删对方内容、不通知对方。
-- 谁拉黑了谁属于隐私,除本人外任何接口都不返回。
CREATE TABLE IF NOT EXISTS user_blocks (
  user_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (user_id, blocked_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);
