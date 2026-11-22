-- 书房书架(2026-11-22):管理员上传的 .deskbook 书包,对象在 R2 桶 hexa-desk(绑定 DESK_BUCKET),这里只存目录行。
-- 只做加法:新建一张表,不碰已有表。**先在远端 D1 执行本迁移,再发代码**(新代码读写这张表,表不在会让书房接口 503)。
-- 对象键:shelf/<id>/r<revision>.deskbook(同一修订号覆盖上传时另加随机后缀,见 object_key)、shelf/<id>/cover.jpg、shelf/<id>/banner.jpg
-- (封面 / 题图键名固定,真实图片类型记在 R2 的 Content-Type 里)。
CREATE TABLE IF NOT EXISTS desk_shelf (
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

CREATE INDEX IF NOT EXISTS idx_desk_shelf_category
  ON desk_shelf (category, sort, title);
