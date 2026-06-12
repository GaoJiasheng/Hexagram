# 「观象」六期 — 道藏内容期:六部原文 + 道德经全译注 v6.0

> 日期:2026-06-12 · 设计:Fable · 交付对象:Fable(实现)
> 本稿是 v1–v5 的增量规格,落实 v4 §3.7 圈定的道藏内容期。视觉/组件/数据约定沿用前稿;阅读器复用经传阅读器模式,注疏复用 v5 锚定模式。

---

## 0. 给实现者的说明(必读,含断点续作协议)

1. 本期三件事:**六部经文原文录入**(管线,§1–§2)、**章节阅读器**(§3)、**道德经 81 章白话译文 + 字词注疏**(§4–§5)。其余五部的译注留后续期。
2. 分 10 批,**每批 check-data 通过后 git commit 即检查点**。断点续作:任务清单(#43–#52)或 `git log --oneline` 找最后批次,`npm run check-data` 的道藏覆盖率报告精确到章。
3. **原文一律走管线生成,严禁手改、严禁凭记忆补写**(同 CLAUDE.md 数据规则 1);译文必须对照生成物原文逐段直译;注疏锚点必须命中原文。
4. 模块不互链(v4 §3 铁律):道藏注疏**不引**易经全局词表(无 ref 机制),道藏页面不出现易经入口。

## 1. 数据管线

### 1.1 共享库 `scripts/lib/wikisource.mjs`

从 fetch-data.mjs 抽出三件通用工具,两条管线共用:

- `fetchPages(titles, cachePath)`:维基文库 MediaWiki API(`zh.wikisource.org/w/api.php`,action=query + revisions + rvslots=main,跟随重定向),本地缓存 `scripts/.cache/wikisource.json` 命中则不再请求。
- `t2s(s)`:opencc-js 繁→简,保留「乾」字保护(先摘除、转换后回插)与「遯→遁」修正——参同契满篇乾坤,此保护必不可少。
- `clean(wikitext)`:去 `-{}-` 转换标签、`{{}}` 模板、图片/分类、HTML 标签、粗斜体,Wikilink 保留显示文本。

**抽库后必须重跑 `npm run data:fetch` 并确认 `git diff src/data/yijing` 为空**(易经管线零回归),才许提交。

### 1.2 抓取脚本 `scripts/fetch-dao.mjs`(npm run data:fetch-dao)

六部配置(页面名以抓取时实际命中为准,未命中响亮 warning 并中止该部,不得静默跳过):

| slug | 维基文库页面 | 章数(check-data 下限) | 解析 |
|---|---|---|---|
| daodejing | 道德經 | 81 | 按「第X章」类标题分章;若无标题按分隔结构切;必须恰得 81 章 |
| qingjingjing | 太上老君說常清靜經 | 1 | 单章,空行分段 |
| ganyingpian | 太上感應篇 | 1 | 单章,空行分段 |
| zhuangzi-neipian | 莊子/逍遙遊 …/應帝王 七子页 | 7 | 每篇一章,章 title 取篇名,空行分段 |
| yinfujing | 陰符經(或黃帝陰符經) | 3 | 上/中/下三章 |
| cantongqi | 周易參同契 | 3 | 上/中/下三篇为三章 |

- 输出 `src/data/dao/classics/{slug}.json`,schema 与易经经传完全一致:
  `{ book: slug, title, chapters: [{ no, title|null, paragraphs: [{ original, translation|null }] }] }`
- 人工译文合并自 `scripts/authored/dao-translations.json`,schema 同 classics-translations.json:`{ "daodejing": { "1": ["段译", …], … } }`(章号→段序数组)。
- 版本对照(王弼/帛书)、其余五部译注:本期不做(v4 §3.7 防蔓延条款继续有效)。

### 1.3 校验(check-data 扩展)

- 六部:文件存在、章数 ≥ 下限、段落非空、繁简哨兵(沿用 '無/當/見/龍' 等字表,扫道藏语料)。
- 道德经译文覆盖数、注疏锚点校验(§5)与覆盖率报告——道藏一节并入现有输出,作断点仪表。

## 2. texts.json 状态语义

`status: 'pending' | 'partial' | 'done'`:pending=无内容(占位网格,不可点);partial=原文可读、译注未齐(徽章「可读·译注中」);done=译注齐(徽章「已成」或不显)。本期:批次 3 六部全转 partial,批次 10 道德经转 done。

## 3. 章节阅读器

- **路由**:App.jsx 增 `/dao/:slug/:chapter`(DaoReadPage)。`/dao/:slug`(DaoTextPage)的章节网格在 status≠pending 时变为章节 Link,徽章文案按 §2。
- **装载** `src/features/dao/data.js`:`loadDaoText(slug)` 动态 import `src/data/dao/classics/{slug}.json` + 内存缓存(照 yijing/data.js loadClassics)。
- **DaoReadPage** 照 ClassicsReadPage 实现:左侧章节目录(sticky,当前章高亮)、字号三档与译文开关(全局 settings,直接复用)、ClassicText 渲染段落(anchors 接 §5)、上一章/下一章、`saveReadingProgress(slug, chapter)`(dao slug 与易经 book key 无冲突,直接共用 reading 表)、面包屑「← 书名」回 `/dao/:slug`。
- 样式全部复用 `.read-page/.read-toc/.read-content/.read-toolbar/.read-nav` 与 `.classic-text*`;道藏主色由 `.app-shell--dao` 换肤自动生效,**不新增样式**(确需补的以 `.dao-read-` 前缀)。
- 单章文本(清静经/感应篇)目录仅一项「全文」,翻页隐藏。

## 4. 道德经译文(批次 4–7,81 章 ÷ 4)

工序照 CLAUDE.md 译文工序:打开 `src/data/dao/classics/daodejing.json` **对照每个 original 逐段直译** → 写 `scripts/authored/dao-translations.json` → `npm run data:fetch-dao` → `npm run check-data`。

风格:平实直译、一段对一段;禁玄虚发挥与鸡汤化转写;名词保留并在注疏层解释(道/德/无为/玄牝不强行意译);歧义取王弼注为主,兼参河上公;韵文不强行押韵,达意为先。

## 5. 道德经字词注疏(批次 8–9)

- 数据 `src/data/dao/zhushi-anchored/daodejing.json`,人工维护:`{ "章号": { "段下标": [ { term, n?, note, reading?, source? } ] } }`——条目 schema 同 v5 §2 但**无 ref 字段**(模块不互链)。
- 装载 `src/features/dao/daoAnchored.js`:`getDaoAnchors(slug, chapterNo, paraIdx)`,本期只有 daodejing 有数据;AnnotatedText anchors 模式直接复用(组件零改动)。
- 校验:check-data 复用 nthIndex/checkEntries 逻辑(寻址有效、锚点命中≥n 次、同段不重叠、note ≤40 字且必填——无 ref 豁免)。
- 风格照 v5 §5:训诂体不复述译文、每段 0–4 条宁缺毋滥、生僻字必注音(橐籥/歙歙/纍纍…)、通假标「某,通某」、source 据实标(王弼《老子注》、河上公章句),没把握不标。

## 6. 批次表(10 批)

| # | 批次 | 产物 |
|---|---|---|
| 1 | v6 设计稿(本稿) | docs/design-v6.md |
| 2 | 基建一:wikisource 共享库 + fetch-dao + check-data 扩展 + 易经零 diff 回归 | 六部 classics JSON |
| 3 | 基建二:DaoReadPage + data.js + daoAnchored 骨架 + 路由/网格/徽章 + 走查 | 阅读器可用 |
| 4–7 | 道德经译文 1–20 / 21–40 / 41–60 / 61–81 | dao-translations.json |
| 8–9 | 道德经注疏 1–40 / 41–81 | zhushi-anchored/daodejing.json |
| 10 | 收尾:全量验收 + texts.json done + CLAUDE.md + v1.5.0 发版推送 | tag v1.5.0 |

## 7. 验收

- 管线:`data:fetch-dao` 六部 JSON 齐,道德经恰 81 章;`data:fetch` 重跑后易经生成物零 diff;check-data 零失败。
- 阅读器:书架 → 道德经 → 章节网格可点 → 第 1 章正文;翻页/字号/译文开关/进度恢复正常;清静经单章无翻页;未知 slug 404;全程 azure 主题;无任何易经入口。
- 内容:译文覆盖 81/81,开译文开关逐章可见;「谷神不死」「橐籥」等悬停出注且气泡视口内;注疏锚点全命中。
- 回归:102 项单测全过、构建正常、易经模块各页行为不变。
