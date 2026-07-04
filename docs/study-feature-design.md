# 观书 · 私人研读书房 — 产品设计文档

> 状态:设计稿(待 owner 拍板 §9 开放问题后进入实现)
> 范围:新功能「观书」——owner 私人书房。owner 读完一本书(站外任意书:认知/经济/心理/管理/哲学…)交给助手,助手产出「①一篇总览 + ②每章一篇消化文章 + ③一张思想脑图」,落库提交上站,owner 随时回来复习。
> 本稿是该功能页面、交互、视觉、数据结构、生成管线的唯一规格。UI/交互为重点章节(§4)。

---

## 0. 一句话定位

**owner 的私人书房**:每本读完的书沉淀为「一张思想脑图 + 一篇总览 + 每章一篇消化文章」,以隐藏入口 `/study` 常驻站内,书越积越多,复习时三分钟找回一本书的骨架。

与站内既有内容的关系:读经诸站是「公共出版物」(古籍,面向任何访客);观书是「私人书架」(今书消化,只服务 owner 本人)。二者共用一套视觉语言与技术底座,但**互不链接、互不入索引**。

---

## 1. 目标用户场景(owner 复习旅程)

只有一个用户:owner。典型旅程有三条,UI 全部围绕它们设计:

**旅程 A · 「那本书讲什么来着」(最高频,索引级复习,目标 < 30 秒)**
1. 直接输入 `/study` → 书架页。
2. 扫分类行 / 搜书名 → 卡片上的**一句话中心思想**就是答案的一半。
3. 需要再多一点 → 点卡片进书主页,看**形象化图谱**的中心节点 + 一级枝(全书骨架),不必往下点。

**旅程 B · 「重温某个论点」(定点复习,目标 < 2 分钟)**
1. 书主页图谱逐层点开,顺着枝找到那个概念的叶子。
2. 点叶子 → 浮层里一句要点;不够 → 「打开该章详读」跳到章文章对应小节。
3. 章详读页左侧是大纲树(当前章相关节点已点亮),读完文章可顺树跳邻近概念。

**旅程 C · 「系统重过一遍」(整书复习,目标 20–40 分钟)**
1. 书主页 → 「总览导读」整篇读完(全书中心论点 + 核心概念)。
2. 章节列表从第一章起逐章读消化文章,←/→ 键翻章。
3. 收尾回图谱「全部展开」,对着整棵树自测:每个叶子能不能自己讲出来。

三条旅程对应三个信息密度档:**一句话(卡片)→ 一棵树(图谱/大纲)→ 一篇文(总览/章文章)**。每一层都要能独立成立,不逼用户下钻。

---

## 2. 信息架构 / 页面地图

### 2.1 页面层级

```
/study                      书架页(隐藏总入口,中性外壳)
 └ /study/<slug>            书主页:形象化图谱(门面)+ 总览入口 + 章节列表
     ├ /study/<slug>/map        全屏图谱(可选,M2)
     ├ /study/<slug>/overview   总览导读(整页文章,布局同章详读)
     └ /study/<slug>/<ch>       章详读:大纲树 + 该章消化文章 + 章间导航
```

每页职责一句话:
| 页 | 职责 | 不做什么 |
|---|---|---|
| 书架页 | 上百本书的索引:分类、搜索、标签、排序;每卡一句话中心思想 | 不展示任何书内层级细节 |
| 书主页 | 一本书的「门面」:图谱骨架 + 元信息 + 两个下钻入口(总览/章) | 不放长文;图谱初始只露两层 |
| 全屏图谱 | 大树的沉浸浏览(节点多、屏幕小时) | 无文章内容 |
| 总览导读 | 全书中心论点与核心概念的一篇文章 | 不逐章展开 |
| 章详读 | 一章的消化文章 + 大纲树导航 + 叶子要点 | 不承担全书骨架职责(树默认聚焦本章) |

### 2.2 路由与外壳接入(复用「中性外壳」既有机制)

- **隐藏方式与「原隐藏门户」同一先例**(v15 `MASTER_PORTAL_PATH` 曾是秘密路径):站内**零可见链接**指向 `/study`——不进任何 nav、门户、footer、搜索索引、sitemap;owner 靠直接输入 URL / 收藏进入。
- **中性外壳**:`App.jsx` 的 `isNeutralPath()` 加 `p === '/study' || p.startsWith('/study/')`——不套任何分站 nav/底栏/主色偏向,`data-site="portal"`,域名着陆豁免(与 `/concepts`、`/debates` 完全同路)。页内自带面包屑返回(仿 `ConceptsPage` 的 `.basics-breadcrumb`),但**面包屑只在观书内部游走,不出「← 诸学门户」链**(反向也零链接,双向不可见)。
- 路由全部懒加载(v11 约定),观书代码/数据对主包**零成本**:

```jsx
const StudyShelfPage   = lazy(() => import('./features/study/StudyShelfPage.jsx'))
const StudyBookPage    = lazy(() => import('./features/study/StudyBookPage.jsx'))
const StudyMapPage     = lazy(() => import('./features/study/StudyMapPage.jsx'))
const StudyChapterPage = lazy(() => import('./features/study/StudyChapterPage.jsx'))
…
<Route path="/study" element={<StudyShelfPage />} />
<Route path="/study/:slug" element={<StudyBookPage />} />
<Route path="/study/:slug/map" element={<StudyMapPage />} />
<Route path="/study/:slug/overview" element={<StudyChapterPage overview />} />
<Route path="/study/:slug/:ch" element={<StudyChapterPage />} />
```

RRv6 静态段(`map`/`overview`)天然优先于 `:ch`,无顺序依赖。非法 slug / 越界 ch 显示「书不存在 / 章不存在」+ 返回链接(批A 越界章号既有约定)。所有页面接 `usePageTitle(标题, '观书')`(v11 约定)。

### 2.3 数据流(与白话模块同一条路)

- 源数据入库:`src/data/personal/`(提交进仓库的 JSON,见 §5)。
- **不打进 JS bundle**:`scripts/build-content-assets.mjs` 扩一段,把 personal 数据拷/拆到 `public/content/study/`(与白话拆分同机制,`public/content` 已 gitignore,`dev`/`build`/`build:cap` 自动前置)。
- 前端 loader `src/features/study/studyData.js`:异步 fetch + 内存缓存 + alive 竞态守卫(仿 `baihua.js`)。
- **不入全站搜索分片**(隐藏内容不能被 `⌘K` 搜出来):`build-content-assets.mjs` 的搜索索引段跳过 study;书架页自带的搜索是纯客户端过滤 `books.json`,不经全站索引。
- iOS 壳:`public/content/study/` 随 `cap sync` 进包,本地直供,离线可用(与白话同,已验证过的路)。Web PWA 离线同白话现状:`/content/` 不在预缓存,联网首访后走 HTTP 缓存。

---

## 3. 视觉语言(全部复用观象 tokens,明暗自适应零额外工作)

原则:**观书不自造风格**。它是观象的一间内室——同一张纸、同一方印、同一套衬线;私房感来自「赭石印 + 更密的卡片信息」而非新配色。所有颜色一律用 CSS 变量(明暗自动),SVG 内上色一律 `style={{fill:'var(--…)'}}`(v21 教训:SVG presentation 属性不认 `var()`)。

### 3.1 用色规范

| 元素 | Token | 说明(与站点哪条约定一致) |
|---|---|---|
| 页面底 / 卡片底 | `--paper` / `--paper-raised` | 全站同 |
| 正文 / 次级 / 弱化 | `--ink` / `--ink-soft` / `--ink-faint` | 全站同 |
| 观书品牌印(「观书」方印) | `--ochre` 赭石 | 书卷/批注色,站内既有「卦主小章」「验占 partial」即赭石;与读经站朱印区分,一眼知道进了私房 |
| 分类/书 accent | 复用十组色板:`--azure --confucian --buddha --xinxue --legalist --mohist --military --zongheng --zhongyi --moulue` | 与总门户卡片 `--card-accent` 同机制(v1.57.0),暗色自动反转,零新增色值 |
| 选中 / 当前态 | `--cinnabar` | 全站 active 惯例(`.read-toc__item--active`、`.tab-btn--active`) |
| 分隔线 / 树连接线 / 图谱边 | `--line` | 全站同 |
| hover 强调 | 该元素的 accent(`color-mix` 弱化投影) | 总门户卡 hover 先例 |

accent 注入方式与总门户一致:卡片/页面容器 `style={{'--study-accent': 'var(--azure)'}}`,内部样式引用 `var(--study-accent)`。

### 3.2 字号 / 字重 / 间距 / 圆角

| 元素 | 规格 | 依据 |
|---|---|---|
| 页面标题 | 复用 `.page-header`/`.page-title`/`.page-subtitle` | 全站页头统一 |
| 卡片书名 | `--font-serif` 1.3rem | `.dao-book__title` 同值 |
| 卡片一句话中心思想 | 0.84rem / line-height 1.7 / `--ink` | `.dao-book__brief` 同值(它是卡上唯一正文,用 ink 不用 soft,信号最强) |
| 卡片 meta(作者/日期/章数) | 0.74rem / `--ink-faint` | `.dao-book__meta` 同值 |
| 分类节标题 | `--font-serif` 1.1rem + 下 1px `--line` | `.dao-text-sections__title` 同值 |
| 文章正文 | 复用白话文章全套(`.baihua-lead/-h2/-p/-quote/-figure`) | §4.5,零新样式 |
| 卡片 | padding 22px 24px,radius 8px,border 1px `--line`,底 `--paper-raised` | `.dao-book` 同值 |
| 卡片网格 | `grid repeat(auto-fill, minmax(280px,1fr))`,gap 16px | `.dao-shelf` 同值 |
| hover 抬升 | `translateY(-2px)` + border→accent | `.dao-book:hover` 同值 |
| 图谱容器 | radius 11px,border 1px `--line` | 总门户卡容器同档 |
| 按钮 | 复用 `.btn .btn--secondary .btn--ghost` | 全站同 |
| 段控(图谱/大纲切换) | 复用 `.search-scope` 段控样式 | v1.42.0 本站/全站切换先例 |
| 动效 | 0.15–0.26s ease;全局 `prefers-reduced-motion` 已一刀切关闭 | 全站同 |

新增 CSS 一律 `.study-*` 前缀,追加进 `src/index.css`(单文件 CSS 约定),约 250–350 行。

---

## 4. 逐屏 UI 规格

### 4.1 书架页 `/study`

**职责**:上百本书时仍 10 秒定位一本。信息架构 = 分类(空间记忆)× 搜索(精确直达)× 标签(横切主题)× 一句话中心思想(卡上即答案)。

**布局(桌面 ≥768px)**:

```
┌──────────────────────────────────────────────────────────────┐
│ [观书·赭石方印]  观书 · 私人书房                                │  page-header
│ 读毕之书,各归其架;一句话见其心。                                │  page-subtitle
│                                                              │
│ [🔍 搜书名 / 作者 / 中心思想……………………]   排序[按分类 | 按读毕] │  工具行
│ 标签: (决策)(偏差)(组织)(定价)(叙事)… [清除]                     │  chips 行
│                                                              │
│ 认知 ─────────────────────────────────────── 5 本             │  分类节
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│ │▎思考，快与慢     │ │▎清醒思考的艺术  │ │▎超越智商        │        │
│ │ 卡尼曼 · 读毕    │ │ …             │ │ …              │        │
│ │ 2026-05 · 38章  │ │               │ │                │        │
│ │ 人脑有快慢两套系 │ │               │ │                │        │
│ │ 统，多数偏差来自 │ │               │ │                │        │
│ │ 快系统越权。     │ │               │ │                │        │
│ │ (决策)(偏差)     │ │               │ │                │        │
│ └───────────────┘ └───────────────┘ └───────────────┘        │
│                                                              │
│ 经济 ─────────────────────────────────────── 3 本             │
│ ┌───────────────┐ …                                          │
└──────────────────────────────────────────────────────────────┘
```

**组件清单**:`StudyShelfPage`(页) → `StudySearchBar`、`StudyTagChips`、`StudySortToggle`(段控)、分类节(`<section>` + 节标题)、`StudyBookCard`。

**卡片规格**(仿 `.dao-book`,新组件不复用 `ScriptureShelf`——字段差异太大:author/oneLine/finishedAt/tags vs era/sections/status,硬套会把两边都改脏;样式值逐条对齐 §3.2):

```
┌─────────────────────────────┐  border 1px --line, radius 8, bg --paper-raised
│▎书名(serif 1.3rem)     [整理中]│  ▎= 左侧 3px 分类 accent 竖线(baihua-entry 先例)
│ 作者 · 读毕 2026-05 · 38 章    │  meta 0.74rem --ink-faint
│ 一句话中心思想,最多两行,超出   │  0.84rem --ink,-webkit-line-clamp:2
│ 截断……                        │  (总门户卡 desc 同法)
│ (决策) (偏差)                  │  标签 pill 0.66rem,--line 描边(book-tier 同款)
└─────────────────────────────┘
```

- 左侧 accent 竖线取分类色。为什么用竖线不用满色印:上百本书满屏色块会闹,竖线是站内「弱着色」惯例(`.shelf-disclaimer`、`.baihua-entry` 皆左竖线)。
- 右上角状态徽标仅在 `status:'partial'` 时出「整理中」(`.dao-book__status` 同款);done 不出徽标(私房内 done 是常态,不值得占位)。

**交互与状态**:

| 状态 | 表现 |
|---|---|
| 默认 | 如上 |
| hover | border→分类 accent + `translateY(-2px)`(dao-book 同) |
| 键盘焦点 | 全站 `:focus-visible` ochre 外框 |
| 搜索中 | 输入即过滤(title/author/oneLine/tags 子串,大小写不敏感);空类目节整节隐藏;节标题计数实时变;IME 组合输入不截获(批D `/` 键 guard 同法,搜索框内 `/`、`⌘K` 不劫持——App 级 guard 已豁免 input) |
| 标签筛选 | chips 多选,取并集(OR);选中 chip 反色(`.search-scope__btn.is-active` 同款);与搜索词取交集;「清除」一键复位 |
| 排序=按分类(默认) | 分类节顺序 = `books.json` 里 `categories` 数组顺序;节内按 `finishedAt` 降序 |
| 排序=按读毕时间 | 取消分组,单一网格 `finishedAt` 降序;卡片 meta 前追加分类小徽(否则丢失归属感) |
| 无结果 | 居中 `text-faint`:「没有匹配的书。」+ [清除筛选] ghost 钮 |
| 空书房(0 本) | 居中:赭石「观书」印 + 「书房还空着。读完一本,交给助手整理上架。」+ 一行 `--font-mono` 提示 `node scripts/gen-study-wf.mjs <slug>`(私房页面,面向 owner 自己,可以直说工序) |
| 加载 | manifest fetch 期间出 6 张骨架卡(`.dao-section-cell--skeleton` 同款 pulse) |

**移动端(≤640px)**:网格自动单列(auto-fill 天然);搜索框全宽;排序段控放搜索框下一行;标签行横向滚动(`overflow-x:auto`,不换行,免得 chips 多时占半屏)。

**localStorage**:`guanxiang.v1.studyRecent`(`{slug, ch, at}` 数组,最近 5 条)。书架页顶部工具行下方出「最近在读」一行小链接(有记录才渲染,`PortalStudyTrail` 的 return-null 先例)。不入 `DATA_KEYS` 导出(私房足迹,轻数据,丢了无所谓;若 owner 要导出再议)。

### 4.2 书主页 `/study/<slug>`

**职责**:一本书的门面。开屏即见「书是谁 + 一句话 + 思想骨架(图谱)」,两个下钻入口各就各位。

```
┌──────────────────────────────────────────────────────────────┐
│ ← 观书书房                                                    │  basics-breadcrumb
│                                                              │
│ [分类印] 思考，快与慢                                          │  书头:印 46px(master-portal__seal 同款,着分类色)
│ 卡尼曼 · 认知 · 读毕 2026-05 · (决策)(偏差)                     │  meta 行
│ 「人脑有快慢两套系统,多数偏差来自快系统越权。」                   │  一句话:serif 1.05rem,--ink,左 3px accent 竖线
│                                                              │
│ ┌────────────────────────────────────────────┐ [图谱|大纲] ⤢  │  视图段控 + 全屏
│ │                                            │               │
│ │           (形象化图谱,初始两层)              │  高 440px      │
│ │                                            │  (§4.3)       │
│ └────────────────────────────────────────────┘               │
│                                                              │
│ ┌ 总览导读 ────────────────────────────────────┐              │
│ │ 全书中心论点与核心概念 · 约 8 分钟 → 开始读     │              │  仿 .shelf-today 横幅(朱描边+cinnabar-bg)
│ └─────────────────────────────────────────────┘              │
│                                                              │
│ 章节 ──────────────────────────────────── 38 篇               │
│ ① 故事中的人物   直觉与努力的双系统隐喻…        →              │  每章一行:序号徽+章题+takeaway 一句
│ ② 注意与努力     慢系统是懒惰的…               →              │
│ …                                                            │
└──────────────────────────────────────────────────────────────┘
```

**组件清单**:`StudyBookPage` → 书头(印/标题/meta/一句话)、`MindmapView`(§4.3)/`OutlineTree`(§4.4)二选一渲染 + `.search-scope` 段控、总览横幅、章节列表(`StudyChapterList`)。

**关键决策**:
- **图谱是门面而非附件**:放在折叠线以上、总览之前。旅程 A/B 都从骨架进入,文章是第二层。
- **图谱/大纲同屏同位切换**(段控),不是两个页面:同一份 `mindmap.json` 两种渲染,用户心智是「换个看法」,不是「换个地方」。段控选择记入 `guanxiang.v1.studyRecent` 同键下的 `view` 字段,下次进来保持。
- 章节列表用「行」不用「格」:章有 takeaway 一句话要展示,格放不下;行式与 `.dao-section-cell--titled`(带标题篇目格)同族,序号徽复用 `.dao-section-cell__no` 样式。
- 续读:若 `studyRecent` 有本书记录,该章行尾出「读至」徽 + 总览横幅下出「继续读 · 第 N 章」(`.dao-text-resume` 同款)——续读全站惯例(v1.40.0 P0④)。

**状态**:mindmap/manifest 加载中图谱容器内出 `route-loading` 同款「⋯」;fetch 失败出「图谱暂时无法载入 [重试]」;`status:'partial'` 的书,未产出的章行灰置(`.dao-book--pending` 同法,`aria-disabled`)。

**移动端**:书头竖排;图谱容器高 `clamp(320px, 60vh, 440px)`、全宽出血(负 margin 到屏边,触屏拖拽面积最大化);段控在容器上方;章节行不变(天然单列)。

### 4.3 形象化图谱(视图 A)——`MindmapView`

**定位**:书主页门面 + `/map` 全屏。空间化节点图,初始只露中心 + 一级枝,点节点逐层长出,可拖拽平移、可缩放。要像思维导图(有机、向外生长),不是文件树。

**技术形态**:纯手写 SVG 组件(站内约定不引 UI 库;`DebatePage` 的 SVG 图谱已是先例)。无物理引擎——确定性布局,同一棵树每次长得一样(复习场景要空间记忆,力导向图每次形状不同,反而伤记忆;这是拿「保真度」换「可记性」的有意取舍)。

#### 布局算法(两翼水平思维导图,Reingold–Tilford 简化版)

- 中心节点在原点;一级枝**对半分左右翼**(前一半向右,后一半向左)——经典思维导图形态,宽高比友好。
- 翼内为整齐树:`x = ±(depth × 170px)`;叶子沿 y 依序堆叠(`节点高 30px + 间距 14px`),父节点 y = 子节点 y 均值。**只有「已展开」的节点参与布局**,收起的子树不占空间——树是活的,点开才长。
- 节点宽:按 label 字数量出(`字数 × 15px + 24px padding`,clamp 64–180px)。
- 边:三次贝塞尔 `M px,py C mx,py mx,cy cx,cy`(mx = 两端 x 中点)——圆滑的「枝」而非折线。
- 布局纯函数 `layoutMindmap(root, expandedSet, wing)`,输入变才重算(memo);平移缩放只改外层 `<g transform>`,**不触发重排**。
- 移动端(<768px)改**单翼右展**(根靠左),树向右下生长——竖屏下两翼太宽,单翼配合拖拽更顺。

#### 节点样式(按层级配色,全部走 tokens)

| 层级 | 形态 | 用色 |
|---|---|---|
| 中心(书名) | 圆角矩形 rx=8,内文 serif 15px/600 | 底 `--study-accent`(分类色),文字 `--paper-raised`——总门户印章同款反色印 |
| 一级枝(核心概念) | 胶囊描边 rx=14,serif 13px | 边 1.5px `--study-accent`,底 `--paper-raised`,文字 `--ink` |
| 二级及以下 | 无框文字节点 + 下划短线,12px | 文字 `--ink-soft`,短线 `--line` |
| 叶子(挂要点) | 同上 + 文字前 4px 圆点 | 圆点 `--study-accent`;有 `ref` 的叶子文字带点状下划线(全站「可点注词」暗示) |
| 展开徽 | 节点尾部小圆 `+3`(隐藏子节点数) | 边 `--line` 文字 `--ink-faint`;hover 转 accent |
| 选中/活动 | 外圈 ring 脉冲 | `--cinnabar`,`.debate-node__ring` 同款动画 |
| 边 | 1.2px | `--line`;根→选中节点的路径整链转 accent 1.6px(「你在树的哪根枝上」) |

文字/填色一律 `style=`/CSS class,禁 SVG 属性色(v21/v22 教训)。

#### 交互状态机

```
状态: idle | panning | leafOpen(nodeId)
持有: expanded:Set<nodeId>(初始 = {root 及一级枝})、tx,ty,k(视口变换)、selected:nodeId|null

事件 → 转移:
pointerdown(任意处)      记起点;不改状态
pointermove(位移>4px)    → panning:rAF 节流更新 tx,ty(触屏单指同;移动阈值防误触)
pointerup(panning 中)    → idle,吞掉这次 click(拖完不触发点击)
click(枝节点)            expanded 含它 → 收起整个子树(后代一并出 expanded);
                         不含 → 加入其直接子节点;布局重算,新节点从父位淡入滑出
                         (transform+opacity 240ms,子节点错峰 40ms;>80 个新节点时跳过错峰,一次到位)
click(叶节点)            → leafOpen(id):selected=id,弹要点浮层(下详)
click(空白)/Esc/浮层外   leafOpen → idle,浮层关
wheel / 双指捏合          k = clamp(k×factor, 0.4, 2.4),以指针/捏合中心为锚
dblclick(空白)/[⊙]钮     视图复位:fit-to-extent(算已展开节点包围盒,缩放平移居中)
[全部展开]钮             expanded = 全部枝节点;完成后自动 fit(整树一览,旅程 C 收尾用)
[收拢]钮                 expanded = {root+一级},复位视图 → 回到初始态
展开态持久               expanded 与 tx,ty,k 存内存(路由内往返保留);不落 localStorage(每次进来从骨架长起,本身就是复习动作)
```

**工具条**(容器右上角悬浮一排 ghost 圆钮,28px):`＋ − ⊙复位 ⛶全部展开/收拢 ⤢全屏`(书主页出 ⤢ 链去 `/map`;`/map` 页此位为 ✕ 返回)。

#### 叶子要点浮层

- **桌面**:节点旁浮出 260px 卡(优先右侧,视口钳位翻边),**`createPortal` 到 body + fixed 定位**——图谱容器内有 transform,浮层放里面必被裁/错位(v1.58.1 注释气泡同一教训,同一解法)。内容:
  ```
  ┌──────────────────────────┐
  │ 峰终定律            (叶标题)│ serif 0.95rem
  │ 体验的记忆由峰值与结尾決定, │ note 0.85rem --ink-soft
  │ 而非平均值。              │
  │ 第 35 章 · 打开该章详读 →  │ 0.8rem --cinnabar 链
  └──────────────────────────┘
  ```
  链接目标 `/study/<slug>/<ch>#<anchor>`(锚见 §5.3)。无 `ref` 的叶子不出链接行。
- **移动端**:底部抽屉(全宽、圆角顶、上滑入 0.26s)——移动端浮层易被手指挡,底抽屉是白话移动浮层的既有形态。点抽屉外/再点它叶切换内容。

#### 初始态 / 全展开态 / 性能

- **初始态**:中心 + 一级枝,自动 fit 居中。开屏动画:一级枝自中心错峰淡出(120ms 起步、每枝 +60ms)——`debate-node` 开坛错峰同款,给「长出来」的第一印象;reduced-motion 下全局已禁动画。
- **全展开态**:fit 后整树一览;若缩放后节点字号 <9px(树太大),节点文字降为省略号点阵,hover/点击仍可读(浮层显全文)——防几百节点时糊成一团。
- **性能预算**:单书节点 ≤300(check-data 软警告线);**收起的子树不渲染进 DOM**,常态可见节点 <100,SVG 毫无压力;平移缩放 transform-only + rAF;布局 memo 只在 expanded 变化时重算。不需要 canvas/虚拟化——规模到不了那儿。
- **可访问性**:SVG 焦点管理成本高、收益低(单用户私房),明确取舍:图谱 `role="img"` + aria-label,**键盘用户的等价物是大纲树(B)**,段控一键可达。

### 4.4 可折叠大纲树(视图 B)——`OutlineTree`

**定位**:密集导航与键盘/无障碍主视图。书主页与图谱同位切换;章详读页左栏常驻。owner 已认可它做详读足够。

```
┌ 树(flex:1) ────────────────────────┐ ┌ 要点面板 280px(sticky) ┐
│ ▾ 思考，快与慢                       │ │ 峰终定律               │
│ │ ▾ 双系统                          │ │ ─────────────         │
│ │ │  · 系统1:快、自动、联想          │ │ 体验的记忆由峰值与结尾   │
│ │ │  · 系统2:慢、費力、懒惰   §3 →   │ │ 決定,而非平均值。       │
│ │ ▸ 启发式与偏差            (+9)     │ │                       │
│ │ ▾ 两个自我                        │ │ 第 35 章 · 打开详读 →   │
│ │ │  ·[峰终定律]              §35 → │ │                       │
│ │ │  · 体验自我 vs 记忆自我    §35 → │ └───────────────────────┘
└────────────────────────────────────┘
```

**行规格**:高 34px,padding 6px 8px,缩进 18px/层;children 容器左 `border-left:1px solid var(--line)`(垂直连接线,`.read-toc` 左线同族);折叠符 ▸/▾ 占 18px、点击热区 28px;叶子行首 accent 圆点;有 ref 的行尾 `§章号` 小徽(`.dao-section-cell__no` 同款着色)+ hover 出「→」。

**交互**:

| 事件 | 行为 |
|---|---|
| 点折叠符 或 双击行 | 展开/收起(仅改该节点) |
| 点行(单击) | 选中:行底 `--cinnabar-bg` + 左 2px `--cinnabar`(read-toc active 同款);要点面板载入该节点 label+note+ref 链 |
| ↑ / ↓ | 上/下一可见行(跳过收起的) |
| → | 收起则展开;已展开则进首子节点 |
| ← | 展开则收起;否则跳父节点 |
| Enter | 有 ref → 进章详读对应锚;无 ref → 等同 →(展开) |
| 「全部展开 / 收拢」 | 树顶工具行两个 ghost 小钮,与图谱工具条动作对应 |

**要点面板**:桌面右侧 280px `position:sticky; top:80px`;未选中时出弱提示「点选节点看要点」。**窄屏(≤768px)不出右栏**,选中行下方就地手风琴展开 note(避免移动端浮层;树本来就是逐行阅读的形态,内联展开最顺)。

**与图谱的关系**:同一份 `mindmap.json`、同一个 `expanded` 状态源(提升到父组件)——图谱里点开的枝,切到大纲仍是开的,反之亦然。「两个视图一个状态」是切换不迷路的关键。

### 4.5 章详读页 `/study/<slug>/<ch>`(及 `/overview`)

**职责**:一章的消化文章 + 树上下文。布局仿读经 `.read-page`(左 toc 右正文,owner 肌肉记忆零成本)。

```
┌──────────────────────────────────────────────────────────────┐
│ ← 思考，快与慢                                                │
│ ┌ 大纲树 240px ──────┐  ┌ 文章 max-width:--read-w ─────────┐  │
│ │ (OutlineTree 紧凑态)│  │ 第 35 章 · 两个自我               │  │
│ │ 本章相关枝自动展开,  │  │ takeaway 一句(lead 样式)          │  │
│ │ 相关叶点亮 accent 底│  │                                  │  │
│ │ 其余枝收拢可点开     │  │ [中心思想] …(.baihua-idea 同款)   │  │
│ │                    │  │ 正文 blocks:lead/h2/p/quote/     │  │
│ │ (sticky,独立滚动)   │  │ figure/refs — 复用白话渲染器      │  │
│ │                    │  │                                  │  │
│ └────────────────────┘  │ ← 上一章 34 | 章节列表 | 36 下一章 →│  │
│                         └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**正文渲染 = 复用白话文章渲染器**:章文章数据与白话章同构(§5.2),直接用 `BaihuaArticle`(`BaihuaBlock.jsx` 中已导出)渲染 blocks——lead/h2/p/quote/figure/refs 全套样式白拿,含 `**加粗**` 富文本、figure 内联 SVG、明暗自适应。唯一轻改:`BaihuaArticle` 加可选 prop `footText`(现尾注写死「— 白话研读…—」),观书传「— 私房消化,仅代表读时所得 —」;quote 块样式不变但语义变为「原书摘句」(字段名不变,`translation` 留空即只渲原句)。

**树的章聚焦逻辑**:进入时 `expanded` = 所有「含 ref.ch===当前章 的叶子」的祖先链;这些叶子行加 accent 底色点亮;其余一级枝收拢。树顶出小切换「只看本章 / 全书」(默认本章)。锚点深链 `#h2-N`:文章 h2 块渲染带 id,`useLayoutEffect` 滚动定位(v1.40.0 教训:勿用 rAF,headless/后台会被节流)。

**章间导航**:底部 prev/next(`.btn--ghost`)+ 中间「章节列表」回书主页;←/→ 键翻章(读经 v1.27 惯例,input 聚焦时不截获);翻章写 `studyRecent`。`/overview` 就是 ch 的特例:树全书态、无 prev(next=第 1 章)、标题「总览导读」。

**移动端**:左树整栏隐藏,顶部换「章节 ▾」下拉(`.read-toc-mobile__select` 同款,批A 先例);下拉项为章列表,树导航靠回书主页大纲视图承担。文章正文全宽。

---

## 5. 数据模型(全部提交进仓库;字段定义 + 校验点)

目录:
```
src/data/personal/
  books.json                     书目总表 + 分类表
  <slug>/
    digest.json                  总览导读(一篇文章)
    mindmap.json                 思想脑图(一棵树)
    articles/<ch>.json           每章一篇(1..N)
```

### 5.1 `books.json`

```jsonc
{
  "categories": [                      // 顺序 = 书架分类节顺序(owner 自定义)
    { "key": "cognition", "label": "认知", "accent": "azure" },
    { "key": "econ",      "label": "经济", "accent": "zongheng" }
  ],
  "books": [
    {
      "slug": "thinking-fast-and-slow",   // 全局唯一,kebab-case,进 URL
      "title": "思考，快与慢",
      "author": "丹尼尔·卡尼曼",
      "category": "cognition",            // 必须命中 categories.key
      "tags": ["决策", "偏差"],            // 0–5 个,每个 ≤6 字
      "oneLine": "人脑有快慢两套系统，多数偏差来自快系统越权。",  // ≤40 字,索引级最强信号
      "finishedAt": "2026-05-12",         // ISO 日期;展示到月
      "chapters": 38,                     // 章数,与 articles/ 文件数对账
      "accent": null,                     // 可选覆盖,默认继承分类;取值限 §3.1 token 名单
      "status": "done"                    // done | partial(逐批产出中)
    }
  ]
}
```

**校验点(check-data 新增 `checkStudy`)**:slug 唯一且 `^[a-z0-9-]+$`;category 命中;accent(含分类 accent)∈ token 白名单;oneLine ≤40 字非空;finishedAt 合法日期;chapters ≥1;done 书必须 digest+mindmap+全部 articles 齐。

### 5.2 `digest.json` 与 `articles/<ch>.json`(与白话章同构)

```jsonc
// articles/35.json —— digest.json 同构(无 no/takeaway,可带 hero)
{
  "no": 35,
  "title": "两个自我",
  "takeaway": "体验自我活在当下,记忆自我负责讲故事——决策听后者的。",  // ≤40 字,书主页章行 + 章头 lead 用
  "centralIdea": "……",                  // ≤60 字(白话同名字段同规)
  "blocks": [                            // 类型集与白话完全一致(design-v22 §3)
    { "type": "lead",   "text": "…" },
    { "type": "h2",     "text": "…", "id": "h2-1" },   // id 由 assemble 顺序分配,脑图锚用
    { "type": "p",      "text": "…支持 **加粗**…" },
    { "type": "quote",  "original": "原书短句摘录(≤50字)", "source": "第35章" },  // translation 可省
    { "type": "figure", "ftype": "结构图", "svg": "<svg…>", "caption": "…" },
    { "type": "refs",   "items": ["…"] }
  ]
}
```

**篇幅档**:章文章 1000–2000 字(速览复习档,明确**不是**白话的 5000–10000 加厚档);总览 2000–3500 字。**版权护栏(硬校验)**:quote 块每章 ≤8 条、每条 ≤50 字——消化评述短引属合理使用,原书成段文本绝不入库(站是公开部署的)。figure 遵白话铁律:SVG 用 `style=` + tokens 上色,不写死前景色(check-data 已有该检查,直接复用)。

### 5.3 `mindmap.json`

```jsonc
{
  "root": {
    "id": "root",                        // 全树唯一,建议语义短串
    "label": "思考，快与慢",              // 节点标签 ≤12 字(图谱节点量宽依据)
    "children": [
      {
        "id": "two-selves", "label": "两个自我",
        "children": [
          {
            "id": "peak-end", "label": "峰终定律",
            "note": "体验的记忆由峰值与结尾決定,而非平均值。",   // 要点一句 ≤80 字;叶子必填
            "ref": { "ch": 35, "anchor": "h2-2" }               // 回链:章号 + 可选 h2 锚
          }
        ]
      }
    ]
  }
}
```

**校验点**:id 全树唯一;label ≤12 字(超限图谱排不下,硬校验);叶子(无 children)必有 note,note ≤80 字;ref.ch ∈ [1, chapters] 且该章 article 存在;anchor 若填必须命中该章某 h2 块的 id;深度 ≤5 软警告、节点总数 ≤300 软警告(图谱性能与可读预算);一级枝 2–8 个软警告(两翼布局的甜区)。

### 5.4 构建产物与 loader

`build-content-assets.mjs` 新增 study 段:`books.json → public/content/study/index.json`;每书 digest/mindmap/articles 原样拷到 `public/content/study/<slug>/…`(源文件已按章分粒度,无需再拆);**跳过搜索索引**。`check-links.mjs` 增一组:index 里每本 done 书的 mindmap/digest/articles 资源存在、ref 链无坏链。

---

## 6. 生成管线(复用白话 workflow 骨架)

流水与白话完全同构:**gen(出 workflow 脚本)→ 并发 agents(起草+校对)→ assemble(装配落盘)→ check-data → commit**。差异只在:输入不是站内经文管线,而是 owner 提供的书稿;引文校验从「站内原文子串」放宽为「结构 + 版权护栏」(原书不在库里,无从子串比对)。

| 环节 | 复用 | 新增 |
|---|---|---|
| 源文本 | — | `scripts/.study-src/<slug>/{meta.json, chapters/<ch>.txt}`——owner 把书稿(epub/pdf 转 txt)按章切好放这;**目录进 .gitignore,原书全文绝不入库**(版权红线) |
| gen | 仿 `gen-baihua-wf.mjs`(单元切法、跳过已生成章、CAP、schema 强约束提示词) | `scripts/gen-study-wf.mjs <slug> [from] [to]`:每章一单元(起草 agent 读该章 txt+全书 meta → 章文章 blocks+takeaway+**3–6 条候选脑图叶**;校对 agent 核篇幅/quote 条数字数/figure 用色/风格);全章毕后追加一个**汇总单元**(读全部章 takeaway+候选叶 → digest + mindmap 整树,refs 落章) |
| assemble | 仿 `assemble-baihua.mjs`(标点规范化 norm、坏块剔除保整章、结构自校) | `scripts/assemble-study.mjs`:写 `src/data/personal/<slug>/…`;h2 块顺序分配 id;mindmap ref/anchor 对账;quote 超限直接剔该块(护栏在装配层就兜住) |
| 校验 | check-data 框架、warn 软警告、figure 用色检查 | `checkStudy`(§5 全部校验点)+ 覆盖仪表一行(N 本 · M 章 · 节点数) |
| 构建 | `content:build` / `check-links` 管线位 | 各加 study 段(§5.4) |
| 运维经验 | 串行铁律、CAP≤10、限流 salvage 起草版、`.baihua-attempts` 防死循环 | 照搬,无新增 |

单书成本估算:38 章 × (1000–2000 字/章) ≈ 白话一部中型书的量级,单 workflow 一次跑完(CAP 10),不触「勿两大齐发」红线。

**「一句话中心思想」的产出位**:汇总单元产 digest 时一并给 `oneLine` 草稿,owner 终审改定后写进 `books.json`——它是索引级最强信号,机器起草、人拍板(见 §9-Q3)。

---

## 7. 「复用既有」vs「新增」边界清单

**直接复用(零改动)**:设计 tokens 全套 / 中性外壳机制(`isNeutralPath`)/ 懒加载路由 + ErrorBoundary / `usePageTitle` / `.page-header`、`.btn*`、`.search-scope` 段控、`.basics-breadcrumb`、骨架 pulse、`.read-toc-mobile` 下拉 / 白话 blocks 全套 CSS / figure 用色校验 / content:build+check-links 管线位 / storage 薄封装。

**轻改既有(各一处,风险低)**:`App.jsx` 路由 5 条 + `isNeutralPath` 一行;`BaihuaArticle` 加 `footText` prop;`build-content-assets.mjs`、`check-links.mjs`、`check-data.mjs` 各加一段(既有输出不变)。

**新增(全部收在 `src/features/study/` + `scripts/`)**:`StudyShelfPage / StudyBookCard / StudyBookPage / StudyChapterPage / StudyMapPage / MindmapView(布局纯函数 layoutMindmap 单独成模块,配单测)/ OutlineTree / studyData.js loader`;`.study-*` CSS;`gen-study-wf.mjs / assemble-study.mjs / checkStudy`;`src/data/personal/` 数据目录。

**明确不做**:不进 `booksIndex.js`(那是公共书目底座,喂跨组搜索/自动链——观书要的恰是不被它们看见);不进全站搜索;不接「义理互见」「金句卡」;不做站内编辑器(数据一律走管线,与全站「人工内容进 JSON、check-data 把关」一致)。

---

## 8. MVP 与分期

**M1 · 闭环(先跑通「一本书进得来、读得了」)**
- 数据模型 + `gen-study-wf` / `assemble-study` / `checkStudy` / content:build 段;
- 书架页(分类分组 + 搜索 + 卡片;标签/排序可后置)、书主页(**暂以大纲树为门面**,段控位留好)、章详读页(树 + BaihuaArticle + 章间导航)、overview;
- 用 owner 手头一本真书做样板走全程(≈白话「道德经第一章样板」的角色),owner 验收文章档位与脑图粒度。
- 验收:`/study` 三级页全通、check-data/check-links/build 全绿、移动端可用。

**M2 · 门面(图谱视图 A)**
- `layoutMindmap` 纯函数 + 单测(两翼分配/堆叠/包围盒);`MindmapView`(展开收起/拖拽/浮层/工具条);书主页段控接入、`/map` 全屏;移动端单翼 + 底抽屉。
- 缩放(wheel/捏合)在本期内做完——拖拽没有缩放的图谱在 30+ 节点时基本不可用,不宜再拆期。

**M3 · 书房成型(书多起来才需要的)**
- 标签筛选 + 排序切换 + 「最近在读」;树/图谱状态互通打磨;anchor 深链;全展开态的缩字策略;批量再整理 2–3 本书,回头修管线提示词。

先后理由:大纲树是图谱的可用性下限(owner 已认可「详读足够」),先上它闭环最快;图谱是门面价值,紧随其后而不阻塞内容积累——M1 期间就可以开始往库里进书。

---

## 9. 开放问题(待 owner 拍板)

1. **隐藏路径与隐私档次**:站(hexa.gavin.pub)是公开部署,`/study` 纯靠不外链(obscurity),数据在 `public/content/study/` 任何知道 URL 的人可见。三档:(a)就这样,与原隐藏门户先例同(推荐 MVP);(b)公开构建剔除——`VITE_STUDY=0` 时 content:build 跳过 study 段、路由仍在但空态(iOS 私包/本地构建带上);(c)进门口令(localStorage 解锁)。路径名也请定:`/study` / `/shufang` / 带随机尾串(如 `/study-x7k2`)。
2. **图谱保真度档**:本稿按「确定性两翼布局 + 拖拽缩放 + 逐层生长」设计(可记忆、可实现、无依赖)。要不要更「炫」的档(力导向微动、minimap、节点图标)?我的建议:不要,复习工具稳定压倒生动。
3. **oneLine 与脑图的终审权**:机器起草、owner 改定(本稿假设);还是 owner 全手写?影响 gen 汇总单元的产出物清单。
4. **分类清单首版**:请给 4–8 个类目名 + 各配一个 §3.1 色板 accent(如 认知=azure、经济=zongheng、心理=xinxue、管理=legalist、哲学=confucian)。
5. **版权护栏量值**:quote 每章 ≤8 条、每条 ≤50 字(硬校验)是否认可?外文译本引句同限。
6. **章文章篇幅档**:1000–2000 字/章(速览复习)是否合适,还是向白话 3000+ 靠?影响单书 token 成本约 2–3 倍。
7. **studyRecent 是否纳入数据导出**:私房足迹现设计不入 `DATA_KEYS`(不随设置导出);若 owner 换机要带走,则纳入并加白名单一行。
