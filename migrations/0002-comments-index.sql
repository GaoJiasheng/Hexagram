CREATE INDEX IF NOT EXISTS idx_comments_anchor ON comments(corpus, slug, chapter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_time ON comments(user_id, created_at);
