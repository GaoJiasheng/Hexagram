# 观书 · 制作标准(每本新书照此办理)

> 这是「观书 · 私人书房」(隐藏入口 `/books`)**做一本新书的唯一作业标准(SOP)**,反映已落地实现。
> 产品/UI 原始设计见 [study-feature-design.md](study-feature-design.md)(注:该稿路由写作 `/study`,实现已改为 `/books`)。
> owner 读完一本站外的书 → 交给助手 → 助手照本标准产出「封面 + 脑图 + 总览 + 每一级章一篇」,落库提交,owner 随时回来复习。

---

## 0. 一本书 = 4 件产出

| 产出 | 文件 | 档位 |
|---|---|---|
| ① 生成式封面 | `index.json` 的 `cover.motif`(+ 必要时 `BookCover.jsx` 加母题) | 原创 SVG |
| ② 思想脑图 | `<slug>/mindmap.json` | 4 级句子树 |
| ③ 全书总览(一篇读懂) | `<slug>/overview.json` | 加厚档 ≤1 万字,**有 hero** |
| ④ 一级章各一篇 | `<slug>/articles/<no>.json` | 普通档 ≤5000 字,**无 hero** |

**性质**:owner 私人自用。不入数据导入导出、不入公共搜索/索引、与读经诸站互不链接(中立外壳 `data-site="portal"`,隐藏入口,站内无公开链接指向)。

---

## 1. 版权红线(最重要,不可破)

1. **原书全文绝不入库。** 文章是**原创消化/转述**——用自己的话讲清楚思想,不是把书抄进来。
2. **引文 `quote.original`**:每条 **≤100 字**、每篇 **≤16 条**(章文章更短,自然更少);且必须是"点睛式"短引,服务论述,不得靠拼接引文还原原文。
3. **封面 100% 原创**(`BookCover` 生成),**不使用任何出版社封面/插画素材**。
4. 书名、作者名是事实,可自由使用。
5. 目前书文章**不走 `check-data`**,引文红线靠人工把关(日后可加 `checkBooks`);每本落库前**自查引文条数/字数 + 是否全文入库**。

---

## 2. 文件落位

```
src/data/books/
  index.json                     # 书目登记(数组,每本一条)
  <slug>/
    mindmap.json                 # 思想脑图
    overview.json                # 全书总览文章
    articles/
      1.json … N.json            # 一级章各一篇(文件名 = 章号)
```

`slug`:简洁英文/拼音,可不与拼音完全一致但别乱凑(《第二座山》= `dierzuoshan` ✓)。

---

## 3. `index.json` 条目 schema

```jsonc
{
  "slug": "dierzuoshan",
  "title": "第二座山",                 // 中文书名(封面竖排取前 5 字)
  "subtitle": "The Second Mountain",  // 原文名/英文名(封面脚注、书主页副标)
  "author": "David Brooks",
  "tags": ["人生", "哲学", "心理"],    // 取自固定标签表(见下),可多挂
  "oneLine": "第一座山为自我……",       // 一句话中心思想(书架卡/书主页)
  "accent": "#3f7d6e",                // 本书主色(驱动封面+卡片+抽屉印),一本一色、与已有书区分、取沉静调
  "finishedAt": "2026-07",            // 读毕年月 "YYYY-MM"
  "cover": { "motif": "two-mountains" }, // 封面母题;无专属母题可省略(走通用款)
  "chapters": [                        // 只列一级章(N=no,文件名对应)
    { "no": 1, "title": "两座山:人生的两种活法" }
  ]
}
```

**标签表(筛选固定 6 类)**:`哲学 / 人生 / 管理 / 心理 / 经济 / 政治`。要加新类,须同步改 `BooksIndexPage.jsx` 的 `TAGS`。

---

## 4. 封面 `BookCover.jsx`

- 由 `cover.motif` 驱动;`accent` 自动决定主色(换一本红调的书,封面自动变红)。
- **颜色写死**(封面是一件"作品",明暗模式下不反色):底 = `accent`;朱印/朱日 = `CINNABAR`;字 = `CREAM`;山体/意象用 `rgba(黑/白,α)` 叠出明暗——**任何 accent 通用**,不引入第三种彩色。
- **固定版式**:accent 底 + 顶部微亮天光 + 母题 + 内细框 + 左上朱印「观」+ 右侧竖排衬线书名 + 左下英文题(大写)/作者。
- **母题 motif**:一本书一个核心视觉隐喻,十来行 SVG。已有 `two-mountains`(两座山与山谷 + 朱日升在第二座之后,呼应《第二座山》)。
  - 加新母题:在 `BookCover.jsx` 里写一个 `<Motif>` 组件 + `motif === 'xxx'` 分支,只用同一套 `rgba` 明暗 + `CINNABAR` 点睛。
  - 没配 motif 的书走通用款(一道地平线),仍是一张体面封面。
- **母题构思原则**:抓全书**最核心的一个**视觉隐喻,抽象、克制,不与书名字面重复表意。

---

## 5. 脑图 `mindmap.json`

**目标:不是大纲,是"能展开全书思想的树"——节点可以用完整句子。**

- **4 级**:根(书名)→ 一级枝(全书骨架,通常 5–7 条,一条对一个一级章/大板块)→ 概念 → 句子级子点。
- 节点 schema:
  ```jsonc
  { "id": "唯一串", "label": "短(框里放得下)", "note": "选:一句展开",
    "ref": { "ch": 1 }, "children": [ … ] }
  ```
- `ref` **只挂在"对应某一级章"的节点上**(通常是一级枝),点它下方出「打开该章详读 ↗」跳到该章;深层纯概念/句子节点**不挂 ref**(呼应"桥"的原则:只在该跳处给跳转,不泛滥)。
- 一级枝配色由脑图自动分配(内置 `HUES`),数据里**不写颜色**。
- 规模参考:《第二座山》约 100 节点。

---

## 6. 文章数据模型(总览 & 章共用 = 站内"白话文章"同款)

顶层:`{ title, subtitle, centralIdea, featured?, hero?{badge,headline,tagline}, blocks:[…] }`

`blocks[]` 块类型(见 design-v22 §3):

| type | 字段 | 说明 |
|---|---|---|
| `lead` / `h2` / `p` | `.text` | 正文;`**加粗**` 自动转 `<strong>` |
| `quote` | `.original`(+ `.translation?`) | 引文,守版权红线 |
| `figure` | `.svg` `.caption` `.ftype` | 内联 SVG 配图 |
| `refs` | `.items[]` | 出处/参考(可省) |

- **配图 SVG 上色必须用 `style="fill:var(--cinnabar)…"`,不能用 `fill` 属性**(SVG presentation 属性不认 `var()`);字体用 `var(--font-serif)`;明暗与主色自适应。
- 文风照站内白话:**中心思想优先 + 脑回路 + 生活化比喻 + 逐段服务主线**,讲给完全没读过的人听。

---

## 7. 全书总览 `overview.json`(加厚档 ≤1 万字)

- **有 hero**(封面级):`hero{ badge(如"全书·核心"), headline(一句最锋利的中心论点), tagline }`;`centralIdea` 必写。
- 内容:中心论点 + 核心概念加厚导读 + **5–8 张图**(金句卡 / 结构图 / 对比图…)。
- 它是书主页「**一篇文章读懂《书名》**」入口;书主页脑图上方小字取它的 `hero.headline`。

---

## 8. 章文章 `articles/<no>.json`(普通档 ≤5000 字)

- **只写一级章**(`no` = `index.json chapters` 的章号)。**不再往下钻小节。**
- **无 hero**(用 `centralIdea` 中心思想框即可,层级清爽)。
- **3–6 张图/章**。引文红线同 §1(章更短,引文自然更少)。

---

## 9. 阅读入口 / 路由 / 交互(已实现,勿改语义)

- `/books` 书架(封面横排卡 + 标签筛选)
- `/books/:slug` 书主页(顶部封面 + 脑图[缩放 `＋/－`、全屏、工具条浮在框内] +「一篇文章读懂《书名》」入口 + 一级章 TOC + 左上「← 书房」)
- `/books/:slug/overview` 总览整页;`/books/:slug/:chapter` 章整页(左 TOC + 右文章)
- **文章一律先弹抽屉图层**(白话同款,`BookArticleDrawer`),点 **⤢** 再进整页 URL;`⌘/Ctrl/中键`点击保留"新标签打开该 URL"。
- 全站配色规范:书内朱色用 `--cinnabar-pure`(门户主题下 `--cinnabar` 被 muted 成褐黑,招牌/悬停一律用 pure)。

**隐藏入口(怎么进 `/books`)**:
- **web**:直接访问 `/books`(全站无公开链接指向,靠"不给链接"隐藏)。
- **iOS App**(无地址栏):**长按主屏 App 图标 →「书房」快捷入口 → `/books`**。实现 = `@capawesome/capacitor-app-shortcuts` 插件 + `src/native/appShortcuts.js`(仅 iOS 生效:`AppShortcuts.set` 注册"书房"、`addListener('click')` 收到 `shortcutId==='books'` 时 `navigate('/books')`;动态 import,web/Android 短路无操作),在 `App.jsx` 的 `AppContent` 里挂一个 effect。
- **必需的原生接线**:该插件要求在 `ios/App/App/AppDelegate.swift` 里手动转发 shortcut——`didFinishLaunching`(冷启动)+ `application(_:performActionFor:)`(热启动)各 `NotificationCenter.post` 一条 `handleAppShortcutNotification`(userInfo key `shortcutItem`)。**`cap sync` 不会自动加、重建 iOS 工程会丢,勿删**;冷启动靠插件 `retainUntilConsumed` 缓存到 JS 监听就绪。为免 SPM 模块名歧义,AppDelegate 直接用通知契约字符串常量、不 `import` 插件模块。
- **注意**:这是首个 Capacitor JS 集成。以后凡加原生插件,须 `npx cap sync ios` 同步进 iOS 工程(SPM,非 pod),并 **`./ship-ios.sh` 重发一版 TestFlight** 才到 owner 手机;纯 web 改动不需要。改原生后先 `xcodebuild ... -sdk iphonesimulator build` 编译自检(本次已过);设备上的长按行为在开发环境无法验证,以真机/下一个 TestFlight build 为准。

---

## 10. 上新一本书 · 步骤清单

1. `index.json` 加条目(`accent` / `tags` / `cover.motif` / `chapters` 只列一级章)。
2. 封面:需专属母题 → `BookCover.jsx` 加 `motif` 分支;否则用通用款,免改代码。
3. 写 `mindmap.json`(4 级句子树,`ref` 挂一级章)。
4. 写 `overview.json`(加厚 ≤1 万字,有 hero)。
5. 每个一级章写 `articles/<no>.json`(普通 ≤5000 字,无 hero)。
6. **自查**:引文 ≤100 字/条、≤16 条/篇,全文未入库;`figure` 用 `style` 不用 `fill` 属;`npm run build` + 浏览器走查(封面 / 脑图缩放全屏 / 抽屉 / 整页 / 返回)。
7. commit。

---

## 11. 生成方式(可选)

手工可做;量大可仿站内白话 workflow(作者 agent 据真实章节起草 → 校 agent 核引文为原文子串 + 字数 + 版权红线,schema 强约束)。但书文章是"原创消化"而非"逐句译注",校验重点是**引文 ≤100 字且确为原文短子串、全文不入库**这条硬红线。
