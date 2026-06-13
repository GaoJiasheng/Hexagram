# 「观象」十六期 — 儒典研读:四书译注与延伸 v16.0

> 日期:2026-06-13 · 设计 / 实现:Opus 4.8 · 交付对象:实现者(逐批)
> 本稿是 v6(道藏内容期)/ v9(脱锚分级)/ v13(每章延伸)/ v15(分组隔离)的内容期增量。**数据 schema、管线模式、阅读器、锚定注疏机制、延伸分级、批次工序全部照 v6 §1–§5、v9 §4、v13 执行,本稿不重复**;只固化:① 通用 corpus 基建(把道藏那套逐 corpus 复制改成一次泛化)② 四书分书风格 ③ 批次表。
>
> 内容是「儒(ru)」独立单站组,与易道·佛两两零可见链接(v15)。佛站另见 v17。
>
> **执行记录(已发 v1.17.0)**:大学/中庸 inline 逐批译注延;论语 20 篇 + 孟子 14 卷由**并发 workflow**(每篇/卷 译+校双代理)产出后程序化装配(term 须原文精确子串、note≤40、段数对齐,违规即弃)。底本:论语/孟子维基文库通行子页,大学/中庸取《礼记》古本(《大学章句》标准页缺经、《中庸章句》带注,礼记本经传洁净足本);孟子按 14 卷分章。管线另修页脚/校勘/异体字/多变体转换标记若干。

## 0. 断点续作

每批 = 该范围**译文 + 注疏 + 篇级延伸一体**(读一遍原文产出三层);token 紧时可拆「先译文、后注疏+延伸」两次。`data:fetch-ru` + `check-data` 通过 → commit 即检查点。恢复:任务清单 / `git log` 批次 commit / check-data 儒覆盖率仪表。底本/源页/切片在**批次 1 一次 settle**,内容批只填译注延、不碰管线。

## 1. 通用 corpus 基建(批次 1,唯一代码批)

道藏当年是 `daoAnchored.js / data.js / DaoTextPage / DaoReadPage / DaoSinglePage / YanyiBlock` 一整套 corpus 私有件。再为佛/儒各抄一套 = 10 个近重复文件。本期改为**一次泛化**,道藏保持原样不动(零回归),佛/儒走新通用路:

- **装载层 `src/features/reader/corpus.js`**:`CORPORA = { ru:{...}, fo:{...} }`(各持 texts.json);导出 `loadText(key,slug)`(`import.meta.glob('../../data/*/classics/*.json')` 满足 Vite 静态分析)、`getMeta(key,slug)`、`getAnchors(key,slug,ch,idx)`(glob `zhushi-anchored`)、`getYanyi(key,slug,ch)`(eager 引入各 yanyi.json)。**无「桥」**(hex 字段道藏专属,佛/儒不收)。
- **通用阅读器三页 `src/features/reader/`**:`CorpusTextPage` / `CorpusReadPage`(paged)/ `CorpusSinglePage`(single),`corpus` 由路由 element 传入(`<CorpusReadPage corpus="ru"/>`);内部薄包装现成 `ClassicReader`(v14 已通用)。通用 `YanyiBlock`(玄青沿用,挂章末/篇末)。
- **路由(App.jsx)**:`/ru/:slug` → `CorpusTextPage corpus="ru"`、`/ru/:slug/:chapter` → `CorpusReadPage corpus="ru"`(`/ru` 首页 `RuHomePage` 已在)。佛同构。
- **check-data 泛化**:把道藏 §4b/§6/§7.3 抽成 `checkCorpus(key, textsPath, dataDir)`,对 dao(输出须与现状逐字一致,防回归)/ ru / fo 各调一次;书单从各自 texts.json 派生(加书免改校验)。
- **抓取 `scripts/fetch-corpus.mjs <key>`**(读 `scripts/corpus/<key>.config.mjs` 的 BOOKS,复用 `scripts/lib/wikisource.mjs` 与共享缓存);`package.json` 加 `data:fetch-ru` / `data:fetch-fo`。
- **texts.json 补字段**:四书各加 `authorNote`(撰人小传,check-data 要求)+ `singlePage`(大学/中庸 true);**录原文后 status pending→partial**。

### 阅读模式与分章(批次 1 settle)

| 书 | 模式 | 分章 |
|---|---|---|
| 大学 | single 单页 | 1 篇(礼记本 11 自然段:经一章+传十章) |
| 中庸 | single 单页 | 1 篇(礼记本 34 自然段) |
| 论语 | paged 逐篇 | 20 篇(每篇为章,篇内语录各为一段) |
| 孟子 | paged 逐卷 | 14 卷(上下各一;texts.json sections 7→14,书架仍称「七篇」) |

底本(实测落定):论语/孟子取维基文库《論語》《孟子》通行子页(每篇/卷一页);**大学/中庸取《禮記》古本足本单篇**——《大學章句》标准页缺经一章、《中庸章句》带朱注难洁净剥离,礼记本经传俱全且无注,故取之(朱子改本之补传、经传分章另在延伸里讲)。管线每源页 = 一章;页内 ==标题==、章号标记(论语「一之X」div)、页尾「有声文献」诵读块、孟子卷尾横线/卷次、行内 `<ref>` 校勘一律剔除。**主流参照仍是朱熹《四书章句集注》**(译注取义、训诂)。

## 2. 四书分书风格(在 v6 §4–§5 通则、v9 §4 分级之上)

- **主流参照 朱熹《四书章句集注》**:译文取义、注疏取训诂,歧义从朱子主流;论语兼采刘宝楠《论语正义》、孟子兼赵岐注 / 焦循《孟子正义》。
- **译文**:平实直译、一段对一段、语录体一条一译;禁义理铺陈、禁「心灵鸡汤」化、禁拔高断语。
- **注疏**(锚定,0–4 条/段、≤40 字、无 ref):人名 / 地名 / 官制礼制 / 通假 / 生僻注音 / 虚词关键义;长词优先。
- **延伸**(篇级一段叙事,挂篇末;大学/中庸章级):讲思想与故事与源流——孔门弟子与成书、孟子论辩的对手与时局、宋明尊四书升「经」之由;**脱锚照 v9 §4**(共识直写 / 考证标出处 / 存疑明示 / 宁缺毋滥),不做 500 条逐条延伸。

## 3. 批次表(20 批)

| # | 批次 | 量 |
|---|---|---|
| 1 | v16 稿 + 通用 corpus 基建 + 儒 fetch 配置 + 四书原文录入(→partial) | 代码 |
| 2 | 大学 译注延(经传 11 章,**先打通端到端**,→done) | ~1,750 字 |
| 3 | 中庸 译注延(33 章,→done) | ~3,560 字 |
| 4–9 | 论语 译注延(每批 3–4 篇 + 篇级延伸,20 篇→done) | ~15,900 字 |
| 10–19 | 孟子 译注延(每批 ~1.5 卷 + 篇级延伸,14 卷→done) | ~35,400 字 |
| 20 | 收尾:全量验收 + 四书 status 全 done + CLAUDE.md + tag v1.17.0 | — |

## 4. 验收

- 每批:`npm test` + `build` + `check-data` 零失败,儒译文 / 注疏 / 延伸覆盖仪表上涨;`/ru` 阅读器抽查(译文逐段、注疏气泡、篇末延伸)。
- 完书批次(2/3/9/19):texts.json status→done,书架徽章「可阅读」。
- 批次 20:四书全 done 走查(含暗色 / 移动端)、跨组零链接复核(`/ru`↔易道 / 佛 双向 0)、CLAUDE.md 儒条目更新、tag **v1.17.0** 推送。
