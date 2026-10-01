-- 研读统计 ⑥(docs/reading-stats-plan.md §7.3 末条,2026-10-01):匿名阅读事件只留 90 天原始行,
-- 更早的按「日 × 内容」滚成一张汇总表;滚存在 /admin/stats 被访问时懒触发(Pages Functions 无定时任务),一天至多一次。
-- 只做加法:新表 + 新索引,不动 reading_events 既有列。
CREATE TABLE IF NOT EXISTS reading_rollup_daily (
  day TEXT NOT NULL,                       -- UTC 日 YYYY-MM-DD
  corpus TEXT NOT NULL DEFAULT '',         -- 非读经页为 ''
  slug TEXT NOT NULL DEFAULT '',
  chapter TEXT NOT NULL DEFAULT '',
  events INTEGER NOT NULL DEFAULT 0,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  clients INTEGER NOT NULL DEFAULT 0,      -- 该日该内容的去重匿名编号数(跨日不可再去重,只作参考)
  PRIMARY KEY (day, corpus, slug, chapter)
);
CREATE INDEX IF NOT EXISTS idx_reading_events_ts ON reading_events(ts);
CREATE TABLE IF NOT EXISTS reading_rollup_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
