# 观象 · 十四期设计稿 — 分站平台化(v14)

> 主题:把现在写死的「易经/道藏」两模块,抽成**配置驱动的多站平台**。目标:加一家新站(儒/佛…)= 一条 manifest + 数据 + 内容,**不碰平台代码**。形态为「站感分站」:各站独立首页/主题/URL 前缀 + 门户切换,共享一个 app、一次构建、一次部署。零内容新增、零功能语义变化。

## 0. 总则与批次

- 这是重构,**每批必须验证「重构前后渲染与交互一致」**再 commit;不改任何可见行为(门户、导航、主题色、阅读、桥、移动栏、搜索)。
- 模块隔离与「桥」(v8)规则不变:站间不互链,唯一例外参同契/阴符经→易经卦页。

| # | 批次 | 内容 |
|---|---|---|
| 1 | v14稿 + 站点 manifest + 主题 token 化 | 平台壳 |
| 2 | 通用 ClassicReader 抽取 | 阅读器 |
| 3 | 书目/管线 registry 化 + 加新站文档 | 数据层 |
| 4 | 收尾 + 发版 | — |

## 1. 站点 manifest(批次 1)

- 新建 `src/sites/registry.js`:`SITES` 数组,每站声明
  `{ key, brand(印), portalTitle, portalDesc, home, prefix, accent, switchLabel, hasSearch, nav[], mobileNav[], mobileSwitch }`。
- `siteForPath(pathname)`:按 `prefix` 最长匹配定当前站,无前缀者(易经)为默认兜底。
- App.jsx 的 `MODULES`/`MOBILE_NAV` 退役,Nav/MobileNav/ModulePortal/AppContent 全部读 manifest;`module.key==='yijing'` 之类硬判换成 `hasSearch`/`mobileSwitch` 等声明字段。
- 路由仍显式列在 App.jsx(每站页面是各自的代码,无法配置生成);manifest 只驱动「壳」:品牌、导航、主题、门户、移动栏。

## 2. 主题 token 化(批次 1)

- 现状:`.app-shell--dao { --cinnabar: var(--azure) … }` 一个特例。
- 改为:app-shell 上挂 `data-site={key}`,CSS 用 `[data-site="dao"] { --cinnabar: var(--azure); --cinnabar-bg: … }`。新站换肤 = 加一个 `[data-site="x"]` 块设主色,manifest 的 `accent` 仅作记录/校验。

## 3. 通用 ClassicReader(批次 2)

- 现状三份近重复:`ClassicsReadPage`(易经经传)、`DaoReadPage`(道藏逐章)、`DaoSinglePage`(短经单页)。
- 抽 `src/features/reader/ClassicReader.jsx`(置于跨站公共目录):配置驱动——
  `{ loadBook, getAnchors, getYanyi?, tocBase, singlePage, header? }`。负责目录 + 字号/译文工具条 + ClassicText(挂 anchors) + 章末延伸 + 逐章翻页/单页锚点 + 阅读进度。
- 三处页面改薄包装,传各自 loader/anchors/yanyi;DOM class(read-page/read-toc/read-content)与交互全保留,**桥(道藏注疏内卦名跳转)不受影响**(桥在 ClassicText/AnnotatedText 层,reader 不感知)。
- 验收:易经经传、道藏逐章、短经单页三面渲染、字号、译文开关、锚点、翻页、延伸,重构前后逐一比对一致。

## 4. 书目/管线 registry 化 + 文档(批次 3)

- check-data 与 fetch 脚本中硬编码的书单(如 `DAO_BOOKS`)改为读一份共享书目 registry(`scripts/lib/books.mjs` 或复用 manifest 的 books 字段),加书/加站免改校验与管线。
- CLAUDE.md 增「**如何加一个新站**」分步:① manifest 加一条 ② CSS 加 `[data-site]` 主色 ③ 数据/内容文件 ④ 路由若干 ⑤ check-data 自动覆盖。强调平台代码零改动。

## 5. 验收(批次 4)

- [ ] 易/道门户、导航、主题色、移动栏、搜索('/' 键)、桥,重构前后逐一一致
- [ ] 三处阅读面(经传/道藏逐章/短经单页)渲染与交互不变
- [ ] data:fetch + check-data 不变;test/build 全过
- [ ] CLAUDE.md「加新站」指南可照做;规格句加 v14;tag 推送
