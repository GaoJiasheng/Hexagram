# 全站功能 / 交互 / 逻辑优化清单(v1.24.1 审查)

> 四片并发审查(导航路由 · 通用阅读器 · 易经互动 · 全局横切面)+ 关键项代码坐实后汇总。
> **本文是「准备」,不含改动**;按优先级与批次列出,逐条标了位置/影响/建议/工作量,供拍板后实施。
> 区分三类:🐞 确为 bug · 🧭 交互/体验瑕疵 · ⚖️ 设计取舍(需 owner 定调,不宜自动改)。

---

## 一、摘要:最该先治的五条(系统性 / 影响移动端核心)

| # | 一句话 | 类型 | 为何排前 |
|---|---|---|---|
| **P0-1** | **移动端章节目录被整体 `display:none`**(`.read-toc` @≤768px),长经(坛经 555 段、伤寒论单章近千段)只能从头滚到尾,paged 书看第 50 章要点 49 次「下一章」 | 🐞 已坐实 | 直接砸掉移动端「读经」核心体验,而站点主场景就是读经 |
| **P0-2** | **PWA 全量预缓存**:`globPatterns:['**/*.{js,...,json}']` 把全部 11 分站数据 chunk(韩非子 952K、传习录 580K…合计数 MB)塞进 SW precache。只读「佛」站的访客首装也下载法/墨/中医/谋略全量 | 🐞 已坐实 | 首装拉满带宽、费流量;且在网络层打穿了 v15 苦心做的分组隔离 |
| **P0-3** | **三互动页 hover-only**:消息卦 / 河图洛书 / 先天方圆图的 SVG 节点只有 `onMouseEnter`,无 onClick/onFocus/tabIndex。**触屏与键盘用户拿不到任何信息**(消息卦详情面板恒为空提示) | 🐞 已坐实 | 移动端这三页核心功能直接失效,与项目里 HexagramFigure/TermTip 已做对的可达性自相矛盾 |
| **P0-4** | **发版后旧标签页白屏**:`registerType:'autoUpdate'` + 全量懒加载 + **零 ErrorBoundary、无 `vite:preloadError` 兜底**。旧 hash chunk 部署后即失效,旧标签点进新页 `import()` reject → Suspense 永久挂起白屏 | 🐞 | 每次部署后长开标签必现概率白屏,用户无提示无自愈 |
| **P0-5** | **长章无虚拟化**:坛经机缘品 175 段、伤寒论单章 ~205 条、金刚经 253 段一次性渲染,每段还跑 AnnotatedText 全文最长匹配 + 每个 ZhuTerm 自带 state | 🧭 性能 | 大经移动端首屏/字号切换/译文开关卡顿,与 P0-1 叠加在同几部经上 |

> **共性**:P0-1/3/5 都集中在「移动端 + 长经」,P0-2/4 都集中在「PWA 部署」。先把这两簇收掉,移动端读经体验与发版稳定性即跨一大台阶。

---

## 二、P1 中优先级(逻辑 bug / 跨模块不一致)

| 位置(文件:行) | 问题 | 类型 | 影响 | 建议 |
|---|---|---|---|---|
| `registry.js:198-203` `siteForPath` | 用 `pathname.startsWith(prefix)` 无边界:`/foo`→fo 站、`/mox`→mo、`/daoxyz`→dao。这些是 404,却套了**别组的皮**(brand/主题色/顶栏/底栏) | 🐞 | 输错/猜测/脏外链 URL 时,404 页穿别组外衣,视觉隔离被污染 | 命中条件改 `pathname===prefix \|\| pathname.startsWith(prefix+'/')` |
| `App.jsx`(路由)+ `ClassicReader.jsx:111` | **超范围章号**:`/fa/hanfeizi/999`、`/-1` 落到「第N章不存在」**死胡同页(无返回链接)**,且 `saveReadingProgress(slug,999)` 把越界章号写进 localStorage | 🐞 | 深链/手改 URL 卡死,且污染续读 | 越界不写进度(find 命中才 save);死页加「返回目录」 |
| `dao` 站 `registry.js:43 hasSearch:false` | **道藏站独缺站内搜索**,而 9 个 corpus 读经站全有。同套阅读器、同类内容,功能不一致 | 🧭 一致性 | 道藏六部(道德经 81 章等)无法检索,预期落空 | 给 dao 接 corpusSearch 等价索引并开 hasSearch |
| `WorkbenchPage.jsx:648` | `?dong=` **不去重不取整**:`dong=5,5,5`→`[5,5,5]`、`dong=5.5`→`[5.5]`,后者使变卦/断法读 `binary[3.5]` 产 NaN | 🐞 | 他人分享/手改的非法 URL 致断法卡与变卦错乱 | filter 后 `[...new Set]` + `Number.isInteger` |
| `WorkbenchPage.jsx:663` | 写回 URL 的 effect **丢弃 `method`**,但 `initMethod` 读它 → 一进页面起卦法参数即被抹,刷新/分享回落默认法 | 🐞 | `?method=jinqian` 分享链接刷新后失真 | 写回时保留 `method`(非默认才写) |
| `WorkbenchPage.jsx:683` | 全局数字键 1–6 标动爻**无卦时也响应** → 空工作台敲数字悄悄累积 movingLines,起卦后凭空带动爻 | 🐞 | 起卦后出现未操作的动爻,断法错配 | handler 内 `if(!hex)return`;并限定监听在工作台聚焦时 |
| `CorpusSearchPalette.jsx` / `SearchPalette.jsx` | 搜索面板**无 focus trap、无 body scroll lock、无 `aria-modal`**;关闭后焦点丢到 body;背景可滚穿透 | 🧭 a11y | 键盘/读屏用户 Tab 逃逸、移动端背景滚穿 | 打开锁 body + 记录/还原焦点 + `aria-modal` + Tab 环绕 |
| `CorpusSearchPalette.jsx:41` `go()` | 搜索命中后只 `navigate(到章顶)`,**不定位到命中的那一段**;single 书更落到整书顶,得自己找 | 🧭 | 长章/单页书搜中等于没定位 | 链接带 `#段锚`,落地页 scrollIntoView(single 已有 hash effect 可复用) |
| `corpusSearch.js`/`searchIndex.js` + 调用处 | 每 keystroke **同步全表 `includes` 扫描**(中医/法家几千条),无 debounce / useMemo;索引未就绪时首搜先空后突现,无 loading 态 | 🧭 性能 | 大 corpus 输入掉帧;首搜结果闪现 | `useDeferredValue`/debounce + 索引构建放 `requestIdleCallback` + 未就绪占位 |
| `CorpusTextPage.jsx:18-30` / `DaoTextPage.jsx` | 篇目网格**异步取章名**:先渲染序号格,classics 到货后重排成带章名网格 → 首进一次**布局抖动/闪烁**,无 skeleton | 🧭 | 有章名的法/兵/纵横书篇目页首进可见跳变 | chapters 未到时按 sections 数出 skeleton 占位再淡入 |
| `storage.js` + `SettingsContext.jsx` | **localStorage 健壮性三连**:① 无 `storage` 事件 → 多标签互不同步、后写覆盖先写;② 无版本/迁移、`getSettings` 不校验(非法 fontScale 直接进 `--font-scale`);③ 配额满 `catch{}` 静默丢数据,用户以为已存 | 🐞/隐患 | 多标签数据互覆盖;旧结构变更后渲染异常;笔记/占例静默丢失 | 加 storage 监听同步 + `schemaVersion` migrate + theme/fontScale 白名单校验 + 关键写失败给提示 |
| `App.jsx:101` `'/'` 键监听 | guard 只查 INPUT/TEXTAREA,**漏 `isContentEditable`/`<select>`/IME 组字**(未查 `isComposing`) | 🧭 a11y | 可编辑区或中文输入法组字时误弹搜索框,打断输入 | guard 补 `isComposing`/`keyCode===229`/`SELECT`/`isContentEditable` |
| singlePage 书走 `/:slug/:chapter` | 金刚经(singlePage 但 32 分)被深链 `/fo/jingangjing/5` 命中 **paged 模式** → 同一本书两种阅读形态割裂 | 🧭 隐患 | 深链/搜索回链/历史 URL 命中时形态不一 | singlePage 书在 CorpusReadPage 入口重定向到 `/:slug#锚点` |
| `CorpusSinglePage.jsx:21` / `DaoSinglePage.jsx:21` | single 书续读**一打开 load 完就写「读至最后一章」**(没真读也算读完);书架又以 `sections>1` 判显 → 金刚经(sections=32 且 singlePage)书架显示「读至第 32 章」却根本是单页 | 🧭 | single 书续读语义失真/误导 | single 书不写续读,或书架对 singlePage 隐藏续读条 |
| `ClassicReader.jsx:33` single hash | 锚点跳转靠固定 `setTimeout(50)`,超长 single 经 50ms 内未必布局完→定位偏;**重复点同一锚点 hash 不变→effect 不重跑,第二次点无反应** | 🧭 | 长经偶定位不准 + 同锚二次点击失效 | 用 rAF/就绪轮询替定值;点击改受控 scroll |
| `AnnotatedText.jsx` / `TermTip.jsx` 触屏 | 注疏气泡**触屏首点可开**(非「看不到注疏」灾难,已确认),但 touch→合成 mouseenter→click 序列使**二次点关不稳**(靠 document touchstart 兜底) | 🧭 | 移动端注疏「能开、二次关不稳」 | 用 `pointerType` 区分,触屏只认 click toggle、不挂 hover-open |

---

## 三、P2 低优先级 / 打磨

| 位置 | 问题 | 类型 | 建议 |
|---|---|---|---|
| `corpusSearch.js` GROUP_CAP=6 | 每组最多 6 条且**静默截断**,命中多时大量结果被吞,用户以为就这些 | 🧭 | 显示「还有 N 条」或可展开 |
| `App.jsx:10` `CORPUS_SEARCH_SITES` | 站点能否搜索来自**两处**(registry `hasSearch` + App 硬编码 Set),需手动保持一致,漏改一处=按钮点了没反应 | 隐患 | 从 registry 派生(加 `searchKind`),删硬编码 Set |
| `XiaoxiPage`/`HetuLuoshuPage` SVG | 用**固定 `width=320/240`**(方圆图是 100% 自适应),窄屏(<360px)+legend/覆盖层可能横向溢出 | 🧭 移动端 | 改 `width=100% + viewBox`,覆盖层用百分比定位 |
| MobileNav 单卦详情 | 卦详情 `/hexagram/:id`(单数)`startsWith('/hexagrams')` 为 false → 看一卦时**底栏「卦」不高亮**,定位感弱 | 🧭 | active 判据兼容 `/hexagram` 单数 |
| `GuideTour.jsx:50` | backdrop `onClick=next`(前进),且描边环未禁 `pointer-events` → 走查中点高亮区可能误触下方真实按钮 | 🧭 | 环加 `pointer-events:none`,遮罩拦底层点击 |
| `index.css` `.dao-book__dubious` | 伪书警示徽标暗色下 `opacity:0.85` 叠暗底**对比度偏低**(恰是不该弱化的合规提示) | 🧭 a11y | 暗色去 opacity 用实色,校对比度 ≥4.5:1 |
| `MePage.jsx:91` 撤销删除 | `undoDelete` 按 `createdAt` 排序,**旧条目可能无该字段**(localeCompare on undefined),撤销后位置错乱 | 🐞 小 | 改按 `id`(=Date.now)排序 |
| `storage.js:87` 续读 key | key 仅用 `slug` 无 corpus 前缀。当前 slug 全局唯一不撞,但**约定脆**,日后重名即跨组串读进度 | 隐患 | key 改 `${corpus}/${slug}` |
| `AnnotatedText.jsx` 锚点未命中 | 数据漂移致锚点 term 在段内找不到时**静默 `continue`**,线上无痕,坏锚难发现 | 可观测性 | dev 模式 `console.warn` 未命中锚点 |
| 配置域名 404 | 配了 HOST_GROUPS 的域名上**真 404 被重定向到组首页**,`*` 404 页失效,输错网址静默跳首页 | ⚖️ 可接受 | 如需 404 反馈,重定向前先判是否真有匹配 Route |

---

## 四、需 owner 拍板的设计取舍(不宜自动改)

| 议题 | 现状与张力 | 选项 |
|---|---|---|
| **⚖️ logo→总门户 vs 分组隔离** | 你刚把左上角 logo 全站链向 `/hexagram`(列全部 10 组)。这与 v15「跨组零可见链接、唯一切换点是门户」的硬隔离设计**直接矛盾**:任意分站(佛/儒/法…)现在都有一键直达「所有其他组」的可见入口;域名分流下点别组卡片会**跳到别的域名**且无提示。**两位 agent 独立指出此矛盾。** | (A) 保留全局 logo 导航、正式放弃隔离承诺,文档改口为「门户是公开总入口」;(B) logo 收回为隐藏入口(仅 owner),恢复隔离;(C) 维持现状但接受语义不一致。**建议先定调再动其余导航项。** |
| **⚖️ 总门户套易经外壳** | `/hexagram` 被 `siteForPath` 默认站兜底判为 yijing → 整页套易经 brand/顶栏/搜索/配色,一个中立全组枢纽打扮成易经分站,且顶栏把人带进易道路由 | 给 `/hexagram` 一套门户专用精简外壳:隐藏 module nav + 隐藏搜索 + 中性 data-site + brand 不自指。(与上一条联动,B/C 下更该修) |
| **⚖️ 闪卡「全对才通过」门槛** | GuahuaQuiz 每轮 10 题全对才 passed,中途答错仍走完 10 题才知失败,挫败感强 | 可加「答错即可重练当前题」或降单轮题量;非 bug,纯体验取舍 |

---

## 五、建议实施批次(拍板后)

- **批 A · 移动端读经急救(P0-1/3/5)**:① `.read-toc` 移动端改可折叠抽屉 / 顶部「章节 ▾」下拉(single 锚点同理);② 消息卦/河图洛书/方圆图补 `onClick`+`onFocus`+`tabIndex`+`role`(触屏点选、键盘可达);③ 长章窗口化或按章懒挂载。→ 一次性把移动端核心体验补齐。
- **批 B · PWA 部署稳健(P0-2/4)**:① `globPatterns` 收窄到壳+入口,数据 chunk 改 runtime 缓存(顺带恢复网络层隔离);② 加根 ErrorBoundary + `vite:preloadError → reload`;③ 顺手补 SW 更新提示。
- **批 C · 路由/工作台逻辑 bug(P1 前半)**:siteForPath 边界、章号越界守卫、`?dong=`/`?method`/数字键三处工作台修正、singlePage 章路由重定向。
- **批 D · 搜索与一致性(P1 后半)**:搜索面板模态化(focus/scroll/aria)+ 命中定位 + debounce;dao 站接搜索;篇目网格 skeleton;`'/'` 键 guard;localStorage 健壮性三连。
- **批 E · 打磨(P2)**:按表顺手清。
- **门户取舍(第四节)**:需你先选 A/B/C,再决定是否动 logo 与总门户外壳。

> 工作量:批 A/B 各约半天(含走查),批 C 较碎但都局部,批 D 中等,批 E 零碎。**建议先批 A+B**(收益最高、面向所有访客),其余按你节奏。

---

## 附:审查确认「已经做对」的点(给信心,无需动)

- 推演工作台状态机严谨:`selectHex` 集中清理、换卦清空动爻、`toggleMoving` 天然去重、断法 n=0..6 全覆盖且配单测。
- **注疏气泡触屏可见**(React state 驱动、CSS 不依赖 `:hover`、trigger 带真 onClick/onKeyDown)——常见的「触屏看不到注疏」灾难这里不存在。
- `HexagramFigure`/`TermTip` 的键盘可达性(role/tabIndex/onKeyDown/Esc)是模范实现。
- 颜色全走 CSS 变量,暗色无硬编码色;`:focus-visible` 全局兜底;reduced-motion 已关动画。
- 配置驱动 + 分组抽象确实做到「加站零改平台代码」;`siteForPath` 最长前缀排序让 `/moulue` 不被 `/mo` 抢;slug 全局唯一使续读进度当前不串味。
- 翻章 `window.scrollTo(0,0)` 回顶正确(仅超长章偶有先渲染后回顶的微闪)。
