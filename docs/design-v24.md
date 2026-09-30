# 观象 · 二十四期设计稿 —— 全站交互化改造(I4–I13)

> 2026-09-30 立项。owner 拍板:**中医三件(I1–I3)先不做,其余全做**;质量为先,可外包代理;token 不设限。
> 思路与排期见 `docs/interactive-plan.md`;本稿是**唯一规格**:路由、数据形状、widget props、check-data 闸、红线。
> 沿用 design-v23 §5「件的总则」:管线只写参数不画图 · 每个点每条线挂原文出处并回查 · 「读者动什么 → 悟什么」是唯一验收标准 ·
> 明暗两套 · 320px 不横向溢出 · 键盘可操作。

## §0 通用约定

### 0.1 文件归属(并发施工的前提)
- 每件只动**自己的**文件:新页 `src/features/<组>/<Page>.jsx`(+ 同名 `.css`,页内 `import './X.css'`)、新件 `src/features/shared/widgets/<Kind>.jsx`(+ `.css`)、
  新数据 `src/data/<组>/<name>.json`、生成脚本 `scripts/gen-<name>.mjs`、校验闸 `scripts/lib/check-<name>.mjs`、单测放在被测文件旁 `*.test.js`。
- **共享文件由主会话统一接**,代理不改:`src/App.jsx`(路由)· `shared/widgets/schema.js` + `WidgetBlock.jsx`(件登记)· `scripts/check-data.mjs`(闸接线)·
  `src/index.css` · `scripts/check-links.mjs` · `scripts/build-content-assets.mjs`(og 索引)· 各组 `texts.json`(`shape` 入口)。
  代理交付时**列出**要接的路由 / 件名 / 闸函数 / `shape` JSON,主会话接。
- 例外(该件独占):I4 可改 `CorpusReadPage.jsx`;I6 可改 `dao/pages/DaoTextPage.jsx`(补 `shape` 入口);I7 可改 `FoHomePage`;I8 可改 `RuHomePage`/`XinHomePage` 与 `zhuzi/topology.js`;
  I10 可改 `ClassicReader.jsx`/`ClassicText`/设置项(`DEFAULT_SETTINGS`+白名单)与 `SettingsSheet`;I13 只改 `yijing/engine/najia.js`(+其测试)。

### 0.2 校验闸的形状
每件一个模块 `scripts/lib/check-<name>.mjs`,导出:
```js
export default function check({ ROOT, err, warn, info, readJson, chapterText }) { … }
```
- `err(msg)` 致命、`warn(msg)` 软警告、`info(msg)` 覆盖仪表一行;`readJson(absPath)`;`chapterText(corpus, slug, ch)` 返回该章 `title + 全部 paragraphs.original` 拼接(不存在返回 null)。
- **凡指章必带 `kw`**(该章原文中确有的字样)或 `quote`(精确子串),闸逐条回查;查不到即 `err`。这条不许放宽——观数与拓扑图两轮都靠它逮出凭记忆指章。
- 主会话在 `check-data.mjs` 末尾统一 `import` + 调用。

### 0.3 页面骨架(与观数诸页同款)
`usePageTitle(标题, 组名)` · 顶部 `.basics-breadcrumb`(回本书 / 本组)· `.page-header`(`.page-title` + `.page-subtitle`)· 一段 intro 说「动什么 → 悟什么」·
主体 · 末尾一行「凡例」(数据从哪来、哪些是示意、哪些存疑)。**SVG 着色只用 `style={{fill:'var(--x)'}}`**,不用 `fill=` 属性、不写死 hex;
**不用 rAF 节流**(用时间戳);**Hook 在任何提前 return 之前**;浮层 `createPortal` 到 body。

### 0.4 红线(按组)
- 道(I6/I9):讲取象、寓言、思想史;**不演火候工法**,不下成仙断语。
- 佛(I7):讲名相在各经里怎么定义、怎么用;**不宣化、不劝信、不下果报断语**。
- 儒 / 心(I5/I8):思想史视角,不作现代借用;学脉边的一手材料只引站内确有之文。
- 法(I4):经—说是韩非原书结构,照录;思想史视角,不作权术教程。
- 诗词(I10):只标韵书所记,**不判「出律」「不合格律」**;多音字标「可平可仄」不硬判;今音异者以韵书为准并说明。
- 地图(I11/I12):**示意图,非考古地图**——页面凡例明说;位置只表相对方位,不给经纬。
- 年代(I12):只写篇中人物在位可推的**大致年代**,`c:'approx'|'disputed'`;确数只在篇文自证时给。

---

## §1 I4 · 韩非子《储说》经—说联动(法)

**形状**:内储说上下 + 外储说四篇,原书每篇 = 「经」(若干条论点,每条末有「其说在…」,经部以「右经」收)+ 「说」(与经条一一对应的故事组,段首「一。」「二。」…)。
站内原文(`fa/classics/hanfeizi.json` 第 30–35 章)已保留这两层标记,但读者读到「其说在侏儒之梦见灶」找不到那则故事。

**数据** `src/data/fa/hanfeizi-chushuo.json`(由 `scripts/gen-hanfeizi-chushuo.mjs` **从原文派生**,不手写):
```json
{ "chapters": [ { "ch": 30, "title": "内储说上七术",
    "jing": [ { "no": 1, "label": "参观", "para": 1, "labelPara": 2, "shuoFrom": 15, "shuoTo": 21 }, … ],
    "youjingPara": 14 } ] }
```
- `para` = 经条正文段下标;`labelPara` = 「参观一」那种标签段下标(内储说上/下有,外储说无则省);`shuoFrom/To` = 该条对应说段区间(含)。
- 派生规则:经部 = 首段至「右经」段;经条按「其说在」段或 `^[一二三四五六七]。` 段切分;说部从「右经」之后起,按 `^[一二三四五六七]。` 起头段切分;**经条数必须等于说组数**,不等即脚本报错、不落盘。
- 内储说上首段是总纲(「七术:一曰…」),标为 `intro`。

**阅读器**(`CorpusReadPage` 对 `fa/hanfeizi` 30–35 章接线,用既有 `renderPieceHead` / `renderParaExtra`):
- 经条段末尾出小签 **「看这条的故事 →」**(跳到本章 `#ch-<no>` 内说段锚 `read-para` 的 id),说组首段前插「条头」**「说一 · 参观」+「← 回经文」**。
- 经部整体上方一行导语:「这一篇原是『经』与『说』成对写的,经是论点,说是故事。」

**闸** `check-hanfeizi-chushuo.mjs`:每章 `jing.length === 说组数`;`para` 段确含「其说在」或位于经部;说组首段确以 `^[一二三四五六七]。` 起头;`info('储说经说: 6 篇 · N 经 · N 说')`。

**验收**:`/fa/hanfeizi/30` 经条 7 签、说组 7 条头,双向跳转落位正确;`/fa/hanfeizi/32`(外储说左上,经六说六)同。

---

## §2 I5 · 论语孔门弟子出场索引(儒)

**数据** `src/data/ru/lunyu-people.json`(由 `scripts/gen-lunyu-people.mjs` 派生;**人名表**写在脚本里,≈25 人,每人 `{id, name, aliases[], note}`——
aliases 收原文实际称呼:子路 / 季路 / 由、子贡 / 赐、颜渊 / 颜回 / 回、曾子 / 参、子夏 / 商、子张 / 师、冉有 / 冉求 / 求、宰我 / 予、樊迟 / 樊须、子游 / 偃、闵子骞、仲弓 / 冉雍 / 雍、公西华 / 赤、冉伯牛、南宫适、公冶长、原思、子羔、子贱、有子、子服景伯…;
单字别名(由 / 赐 / 回 / 参 / 商 / 师 / 求 / 予 / 偃 / 雍 / 赤)**只在「子曰…」对话语境中作呼名计**,即匹配 `「X也」「X，」「X！」「X乎」「X曰」` 等呼格,不匹配散见于他词(如「回」作动词)——脚本按正则 + 人工排除表处理,派生结果附 `evidence`(命中的原文片段 ≤20 字)。
输出:`{ people: [ { id, name, aliases, note, hits: [ { ch, para, evidence } ] } ] }`。

**页面** `/ru/lunyu/renwu` `LunyuPeoplePage`:左列人物(按出场篇数降序,子贡 / 子路 / 子张 / 子夏…),右列该人所有段落(原文首句 + 篇名 + 链到 `/ru/lunyu/<ch>#ch-<ch>` 段锚)。
点人 → 段列表;每段旁「读这一段 →」。**书页入口**:`ru/texts.json` lunyu 加 `shape`(主会话接)。

**闸** `check-lunyu-people.mjs`:每 hit 的 `evidence` 是该章原文子串;每人 ≥1 hit(0 hit 的人从表里删);人数 ≥ 20;`info`。

**验收**:子贡 14 篇、子路 12 篇量级(脚本以原文为准);「回也不改其乐」计入颜渊、「回也」不误计到无关段。

---

## §3 I6 · 参同契月相纳甲盘(道 → 易经桥)

**数据** `src/data/dao/cantongqi-moon.json`(人工策展,**每条挂 quote 回查**):
```json
{ "phases": [
  { "day": 3,  "hex": 51, "name": "震", "gan": "庚", "dir": "西", "quote": "三日出为爽，震庚受西方", "slug": "cantongqi", "ch": 4 },
  { "day": 8,  "hex": 58, "name": "兑", "gan": "丁", "dir": "南", … },
  { "day": 15, "hex": 1,  "name": "乾", "gan": "甲", "dir": "东", … },
  { "day": 16, "hex": 57, "name": "巽", "gan": "辛", "dir": "西", … },
  { "day": 23, "hex": 52, "name": "艮", "gan": "丙", "dir": "南", … },
  { "day": 30, "hex": 2,  "name": "坤", "gan": "乙", "dir": "东", … } ],
  "center": [ { "hex": 29, "name": "坎", "gan": "戊", "quote": "…", "ch": … }, { "hex": 30, "name": "离", "gan": "己", … } ],
  "intro": "…", "caveats": ["…"] }
```
- `hex` 用**六十四卦序号**(震 51 / 兑 58 / 乾 1 / 巽 57 / 艮 52 / 坤 2 / 坎 29 / 离 30,即八纯卦),经「桥」链到 `/hexagram/<hex>`(v8 规则:只在道藏侧单向)。
- 原文出处:《圣人上观章第四》《晦朔合符章第十八》(两章在库,已确认含「三日」「震」「八日」「兑」「十五」「乾」等);`quote` 须为该章原文**精确子串**。

**件** `moon`(`src/features/shared/widgets/MoonDial.jsx`,props `{ phase?: 0–7, showHex?: true }`):
圆盘一月三十日,月相 8 格(朔 / 三日 / 八日 / 十五 / 十六 / 二十三 / 三十 + 晦朔合符),拖动或点日 → 中央出该日卦画(复用 `HexagramFigure`)+ 纳甲干 + 方位 + 原文一句;
坎离戊己居中常显。`schema.js` 校验:`phase` 整数 0–7。

**页面** `/dao/cantongqi/moon` `CantongqiMoonPage`:大盘 + 右侧「这一日」详情(卦画 / 干 / 方位 / 原文 / 「读第 N 章 →」/ 「到易经看此卦 ↗」)+ 下方「六卦一览」表 + 凡例(纳甲是取象系统,本页不演火候)。
`DaoTextPage` 加 `shape` 入口渲染(照 `CorpusTextPage` 的 `.book-shape`);`dao/texts.json` cantongqi `shape` 由主会话接。

**闸** `check-cantongqi-moon.mjs`:每 quote 为所指章原文子串;`hex` 1–64 且与 `name` 对得上(查 `scripts/lib/hexagram-table.mjs`);六相 + 二中齐;`info`。

**验收**:点「十五」→ 乾 / 甲 / 东 / 「十五乾体就」类原文;点卦画到 `/hexagram/1`;暗色下盘面可读。

---

## §4 I7 · 佛名相索引 + 十二因缘环(佛)

**数据** `src/data/fo/concepts.json`,**结构照抄** `src/data/mingli/concepts.json`(`clusters[{term, gloss, loci[{corpus:'fo', slug, ch, label, kw}]}]`),
25–35 个名相:五蕴 / 六根六尘(十二处)/ 十八界 / 十二因缘 / 四谛 / 八正道 / 六度(布施…般若)/ 三法印 / 空 / 般若 / 涅槃 / 菩提 / 菩萨 / 如来 / 法身 / 佛性 / 自性 / 顿悟 / 禅定 / 戒定慧 / 无我 / 无常 /
缘起 / 中道 / 不二 / 方便 / 净土 / 念佛 / 忍辱 / 布施 / 无住 / 三界 / 六道 / 阿罗汉 …;每个落点 `kw` 是该章原文确有的字样(心经「五蕴皆空」、金刚经「应无所住」、坛经「自性」、维摩诘「不二法门」、阿弥陀「净土」/「极乐」…)。
gloss 只讲「这个词在经里指什么、哪几部经怎么用」,**不含劝信 / 果报用字**(闸扫「必得 / 往生 / 消业 / 福报 / 灭罪」)。

**页面** `/fo/concepts` `FoConceptsPage`(照 `MingliConceptsPage`:速跳 + 列表 + 各书短名 心经 / 金刚 / 坛经 / 维摩 / 弥陀 / 四十二章 / 遗教 / 八大人觉 / 信心铭 / 证道歌)。
`FoHomePage` 加入口(书架之上或之下一行,与观数首页「概念索引」同款)。

**件** `ring`(`src/features/shared/widgets/RingChart.jsx`,通用环形序列):props `{ items: [{ label, note?, href? }], center?, focus?: number, arrows?: boolean }`;
十二因缘(无明 → 行 → 识 → 名色 → 六入 → 触 → 受 → 爱 → 取 → 有 → 生 → 老死)12 节点环排,点节点出 note(该支在经中的定义,**引站内原文**——心经「无无明亦无无明尽」为总纲,各支释义引坛经 / 维摩诘 / 遗教经中确有之句,查不到的支只给字义不引)。
`schema.js` 校验:items 3–24 项、label 非空、focus 在范围内。名相页顶部嵌 `ring` 一件(十二因缘)+ 八正道一件。

**闸** `check-fo-concepts.mjs`:与观数概念闸同规则(kw 回查、gloss 禁用字、书存在、章存在)+ `ring` 数据里的引文回查;`info('佛名相索引: N 概念 · M 落点')`。

**验收**:`/fo/concepts` 搜「空」落到心经 / 金刚经 / 坛经各章;十二因缘环点「爱」出释义与出处;无劝信语。

---

## §5 I8 · 儒门学脉图(儒 / 心)

**数据** `src/data/ru-lineage.json`,**结构与 `zhuzi-topology.json` 相同**(eras / schools / edgeTypes / nodes / edges / end),内容换成儒门:
- eras:先秦 / 汉 / 北宋 / 南宋 / 明;schools:儒(ru)/ 心学(xin)/ 理学(li,着 ru 色偏)。
- nodes:孔子 / 曾子 / 子思 / 孟子 / 荀子 / 董仲舒 / 周敦颐 / 程颢 / 程颐 / 朱熹 / 陆九渊 / 王守仁(+ 颜回 / 子贡 可选),`book` 系站内书(论语 / 大学 / 中庸 / 孟子 / 荀子 / 近思录 / 传习录 / 大学问),`when` 用人物志 `renwu.json` 已有的年代口径,**不给人物志没给的确数**。
- edges:`lineage`(师承 / 传述:孔→曾→子思→孟按《史记》旧说标 `disputed`;周→二程;程→朱〔经杨时、罗从彦、李侗,图上省为一边并 note〕;程颢→陆九渊〔学脉旧说〕;陆→王〔非师承,王自谓接续〕)· `criticize`(荀子《非十二子》斥子思孟轲;朱陆之争;王阳明辨朱子格物)· `praise`(孟子尊孔;王阳明「求之于心而非也,虽其言之出于孔子」类)。
  **每条边 ≥1 条 `cites`,quote 为站内该章原文精确子串**(孟子 / 荀子 / 近思录 / 传习录 / 大学问里确有的话);站内没有原文的关系(如朱陆鹅湖之会)只作 `lineage`/`note` 不作带引文的 `criticize`。
- `end`:清代考据转向一句(不展开)。

**页面** `/ru/lineage` `RuLineagePage`:复用 `zhuzi/topology.js` 的布局与几何(**先把它改成接收数据的工厂** `makeTopology(data)`,原诸子页零功能变化),边类型开关、点人出详情 + 站内书链、点边出引文 + 「读原文 →」;
窄屏列表视图沿用。`RuHomePage` / `XinHomePage` 各加一行入口(「儒门学脉图 →」)。

**闸** `check-ru-lineage.mjs`:与 7c 拓扑闸同规则(id 唯一 / era·school·type 合法 / cites 逐字回查收窄到该章 / `book` 存在);`info`。

**验收**:`/ru/lineage` 默认亮师承骨架;点「荀子→子思孟轲」边出《非十二子》原文;点王守仁到 `/xin/chuanxilu`;`/debates/map` 不变(截图对比)。

---

## §6 I9 · 庄子寓言索引(道)

**数据** `src/data/dao/zhuangzi-fables.json`:`{ fables: [ { id, title, slug, ch, kw, gist, chengyu? } ] }`,60–90 则;`slug` ∈ zhuangzi-neipian / waipian / zapian;`kw` 该篇原文确有字样(如「庖丁为文惠君解牛」「庄周梦为胡蝶」「儵鱼出游从容」「日凿一窍，七日而浑沌死」);
`gist` 一两句讲这则寓言在讲什么(思想史 / 文学视角,不宣化);`chengyu` 由此而来的成语(庖丁解牛 / 邯郸学步 / 朝三暮四 / 涸辙之鲋 / 螳臂当车 / 东施效颦 / 井底之蛙〔标「后人概括」〕…)。

**页面** `/dao/zhuangzi/fables` `ZhuangziFablesPage`:按内 / 外 / 杂三篇分节,每则 标题 + gist + 成语 pill + 「读原文 →」(`/dao/<slug>/<ch>`);顶部按成语速查。
三部庄子的 `shape` 都指向本页(主会话接 `dao/texts.json`)。

**闸** `check-zhuangzi-fables.mjs`:kw 回查;id 唯一;总数 ≥ 60;`info`。

---

## §7 I10 · 诗词曲格律层(唐诗 / 宋词 / 元曲)

### 7.1 韵书数据(公版,维基文库;走 `scripts/lib/wikisource.mjs` 的 `createFetcher`,同缓存)
`scripts/fetch-rhyme.mjs` 抓三页并解析,写:
- `src/data/rhyme/pingshui.json`:平水韵 106 部。页面结构:`==上平聲部==` 等五节;`上平聲一{{++|東}}` 为部题,下一行为该部字串,再下一行 `【詞】…` 为词韵增补字(收入同部,标 `ci:true`)。
  输出 `{ parts: [ { id:'上平一東', sheng:'上平'|'下平'|'上'|'去'|'入', tone:'平'|'仄', no:1, name:'東', chars:'…', ciChars:'…' } ], index: { '東': ['上平一東'], … } }`,
  `index` 一字多部照列(多音字);繁体原样 + 简体键(t2s)双收。**部数必须 = 106**(上平 15 / 下平 15 / 上 29 / 去 30 / 入 17),否则脚本报错不落盘。
- `src/data/rhyme/cilin.json`:词林正韵 19 部(`==第N部==` / `===平聲：…===` / `【一東】…`),括注 `（…）` 剔除;输出 `{ parts:[{no, tone, chars}], index }`。
- `src/data/rhyme/zhongyuan.json`:中原音韵 19 韵(`=中原音韻卷上=` 之后 `==東鍾==` 等;`【平聲】△陰 / △陽`、`【上聲】`、`【去聲】`、`【入聲作X聲】`;`○` 为小韵分隔),输出 `{ parts:[{name, groups:{阴平,阳平,上,去,入作…}}], index }`。
- 单测 `rhyme.test.js`:部数;抽样(東→上平一東·平;月→入声六月·仄;花→下平六麻;「中」多音 → 两部)。

### 7.2 运行时 `src/features/reader/prosody.js`
- `toneOf(char, book)` → `'平'|'仄'|'多'|null`(平水韵;简繁皆查);`rhymePart(char, scheme)`,scheme ∈ `pingshui|cilin|zhongyuan`。
- `analyzeLine(text)`:按句读切句,逐字 tone,句末字韵部;返回 `[{ chars:[{c,tone}], endPart }]`。
- **不判出律**。只把韵书所记摆出来。

### 7.3 阅读器
- `ClassicReader` 加 prop `prosody`(`{ scheme, tones: boolean }` 或 null);开启时每个韵文段(verse)之下渲染 `ProsodyRow`:每句一行 ○(平)●(仄)◐(可平可仄)小符号 + 句末韵部小签(同部同色,用 5–6 个 token 色轮);符号用 CSS 不用图片。
- 工具条加开关「格律」(与「译文」「字号」同排),状态入 `settings`(`prosody:boolean`,进 `DEFAULT_SETTINGS` + 白名单)。
- 接线:`CorpusReadPage` 对 tangshi(第 4–7 章 近体:tones+韵脚,平水韵;第 1–3 章 古诗乐府:只韵脚)、songci(只韵脚,词林正韵)、yuanqu(只韵脚,中原音韵)传 `prosody`。
- 页面凡例:「依《平水韵》/《词林正韵》/《中原音韵》所记;多音字标 ◐ 不硬判;今音不同者以韵书为准。本页只标韵书所记,不判合律与否。」

**闸**:三份 json 存在且部数正确(pingshui 106 / cilin 19 / zhongyuan 19);`info('韵书: 平水韵 N 字 · 词林 N 字 · 中原 N 字')`。

**验收**:`/tangshi/tangshi300/4`《送杜少府之任蜀州》开「格律」→ 每句 5 符,「秦 / 津 / 人 / 邻 / 巾」同韵部签同色;宋词一首韵脚签出词林部;关掉即无。

---

## §8 I11 · 诗经十五国风示意图(儒)

**数据** `src/data/ru/shijing-map.json`:`{ view:{w:1000,h:700}, regions:[ { id:'zhounan', name:'周南', ch:1, x, y, note:'…' }, … ] }`,15 国风 + 二南共 15 组(周南 / 召南 / 邶 / 鄘 / 卫 / 王 / 郑 / 齐 / 魏 / 唐 / 秦 / 陈 / 桧 / 曹 / 豳),`ch` 对应 `ru/classics/shijing.json` 前 15 章;
位置只表**相对方位**(秦西、齐东、豳在西北、陈在南…),`note` 一句(采于何地、几首)。另 `rivers:[{name:'黄河', d:'M…'}]` 一两条示意曲线可选。

**页面** `/ru/shijing/map` `ShijingMapPage`:SVG 示意图,点国 → 右侧出 note + 该组诗题列表(读 classics 该章诗题段)+ 「读这一组 →」;凡例明写「示意图,只表相对方位,非考古地图」。`ru/texts.json` shijing `shape` 主会话接。

**闸** `check-shijing-map.mjs`:15 条;`ch` 存在且章题含该国名;坐标在画布内;`info`。

---

## §9 I12 · 战国策七国示意图 + 合纵连横时间轴(纵横)

**数据** `src/data/zong/zhanguoce-map.json`:
```json
{ "states": [ { "id":"qin", "name":"秦", "x":…, "y":… }, … 七国 + 周 ],
  "pieces": [ { "ch": 1, "title": "…", "states": ["qin","zhao"], "from": -334, "to": -333, "label": "约前 330 年代", "c": "approx", "kw": "苏秦", "note": "篇中苏秦说秦惠王,惠文君在位前337—前311,故系于此" } ] }
```
- 18 篇每篇:所涉国、大致年代(**只据篇中人物在位可推**,`c:'approx'`;推不出的 `c:'disputed'` 只给「战国中期」类 label,`from/to` 给宽区间)、`kw` 该篇原文确有字样(人名 / 地名)。
- 年代范围 -475 ~ -221 之外即闸报错。

**页面** `/zong/zhanguoce/map` `ZhanguoceMapPage`:上半七国示意图(点国 → 亮出所涉篇);下半时间轴(复用 `TimelinePage` 的泳道贪心思路,一篇一条,存疑虚线),点条 → 篇。凡例同 I11 + 「年代为推定」。`zong/texts.json` zhanguoce `shape` 主会话接。

**闸** `check-zhanguoce-map.mjs`:18 篇齐;kw 回查;states 合法;年代在范围;`info`。

---

## §10 I13 · 易经纳甲改吃 ganzhi 底座(内部)

`src/features/yijing/engine/najia.js` 内手写的干支 / 五行表改为 `import { GAN, ZHI, zhiWuxing, … } from '../../shared/ganzhi/index.js'`;**导出签名与返回值零变化**,`najia.test.js` 原样全过;
`ZHI_ELEMENT` 导出保留(由 ganzhi 派生)。不动 `bagong.js` 逻辑。

---

## §11 主会话接线清单(代理交付后)
1. `App.jsx` 路由(**具体路径排在通用 `/:slug`、`/:slug/:chapter` 之前**):`/fa/hanfeizi`(无新路由)· `/ru/lunyu/renwu` · `/dao/cantongqi/moon` · `/fo/concepts` · `/ru/lineage` · `/dao/zhuangzi/fables` · `/ru/shijing/map` · `/zong/zhanguoce/map`。
2. `schema.js` + `WidgetBlock.jsx`:登记 `moon`、`ring`;design-v23 §5 表补两行。
3. `check-data.mjs`:import 八个闸 + 调用;`check-links.mjs` 加路由;`build-content-assets.mjs` og 索引加页面条。
4. 各组 `texts.json` `shape`:fa/hanfeizi(「经与说」→ 本书阅读器第 30 章?——储说是章内结构,`shape` 指 `/fa/hanfeizi/30` 并说明)· ru/lunyu · dao/cantongqi · dao/zhuangzi-×3 · ru/shijing · zong/zhanguoce。
5. `npm run build` + `check-data` + `check-links` + 全测 + 浏览器逐页走查(明 / 暗 / 375)+ CLAUDE.md 状态节 + todo §X。

## §12 验收清单(逐条核;2026-09-30 全部核过)
- [x] I4 六篇经说条数相等、双向跳转落位
- [x] I5 ≥20 人、evidence 全为原文子串、页面按出场篇数排
- [x] I6 六相二中原文回查过、卦画与卦序一致、桥到 `/hexagram/N`
- [x] I7 ≥25 名相、kw 全过、gloss 无劝信字、十二因缘环 12 节点
- [x] I8 边引文全过、诸子拓扑图零变化、两组首页有入口
- [x] I9 ≥60 则、kw 全过、三部 shape 指向本页
- [x] I10 三韵书部数正确、近体诗出 ○●◐ 与韵脚签、词曲只韵脚、开关持久
- [x] I11 15 组、点国出诗题、凡例「示意」
- [x] I12 18 篇、年代在范围、kw 全过、时间轴与地图联动
- [x] I13 najia 测试原样全过、导出零变化
- [x] 全站 build / check-data / check-links / 测试全绿;明暗 / 375 走查;CLAUDE.md + todo 更新

---

## §13 中医三件 I1–I3(2026-10-01 owner 定做;原「先不做」改口)

守中医组「研习不诊疗」铁律:三件都**只排原书的结构**,每格挂原文出处、闸回查;不画传变路径、不述功效用法、每页带「⚠ 非医疗建议」。

**I1 本草六部三品矩阵** `/zhongyi/bencaojing/matrix` `BencaoMatrixPage`:行 = 玉石/草/木/果菜/米谷/虫兽 六部,列 = 上/中/下 三品,
十八格由十八类题名派生;格文「N 味」,note = 该类药名(段首「药名 + 全角空格」切出,`shapes.js` `parseBencao`),href 下钻到章。**零策展数据文件**。
**I2 素问五行藏象图** `/zhongyi/suwen/zangxiang` `SuwenZangxiangPage`:数据 `src/data/zhongyi/suwen-zangxiang.json`——《阴阳应象大论》五段排比(段 14–18)
摊成 15 行 × 5 列(五方 / 在天 / 在地 / 在味 / 在藏 / 在体 / 藏之所生 / 在窍 / 在志 / 在色 / 在音 / 在声 / 在变动 / 志之所伤 / 志之相胜),
每格 `kw` 是该段原文精确字样;页顶 `wuxing` 件挂 `labels`(木肝 火心 土脾 金肺 水肾);页尾列五段原文。
**I3 伤寒六经目录** `/zhongyi/shanghanlun/liujing` `ShanghanLiujingPage`:数据 `src/data/zhongyi/shanghan-liujing.json`——六经各挂篇(太阳 5–7、阳明 8、少阳 9、太阴 10、少阴 11、厥阴 12),
受病次第六句引《伤寒例》(第 3 篇段 12–17)原文;三阳 / 三阴分行;前四篇 / 六经之外两篇 / 可与不可八篇另列三组,二十二篇各归一处不重不漏。
**闸** `scripts/lib/check-zhongyi-shapes.mjs`(一模块三件):题名合「某部某品」且六部三品齐全、每段切得出药名;藏象每行 5 格 5 kw 逐格回查、五段各含「某方生」;
六经二十二篇归位、篇题含经名、引文为所指段子串、组 note 无断语字。`shape` 入口:本草 / 素问 / 伤寒三书 texts.json。

## §14 可选件三件(2026-10-01 owner 定做,原 O10)

**I14 人物索引推广到孟子 / 传习录** `/ru/mengzi/renwu` `MengziPeoplePage` · `/xin/chuanxilu/renwu` `ChuanxiluPeoplePage`:
论语版(§2)的派生器抽到 `scripts/lib/people-index.mjs`(`deriveIndex` / `matchPersonIn` / `checkPeopleIndex`),页面抽到 `ru/PeopleIndexPage.jsx`(`spec` 传数据与文案),
论语改为薄包装、输出逐字不变。人名表各一份(`gen-mengzi-people.mjs` 53 人、`gen-chuanxilu-people.mjs` 24 人);
《孟子》几乎全用全称,单称只收旧注所定的六个(章子 / 子敖 / 徐子 / 许子 / 夷子 / 陈子);《传习录》多用短称,`vocativeNext` 换成「问曰因又请对在尝举谓」。
传习录三卷各三四百段,链接经 `chapterParts` 带 `?p=` 落屏。闸:`check-mengzi-people` / `check-chuanxilu-people`(同一把尺子,≥30 / ≥15 人)。
**I15 禅宗传灯图** `/fo/lineage` `FoLineagePage`:儒门学脉图的视图抽成 `ru/LineageView.jsx`(数据经 context 下发,儒门页改薄包装、测试原样全过),
换一份 `src/data/fo-lineage.json`:三行(祖师 / 南宗 / 北宗)三带(南北朝 / 隋 / 唐),15 人 17 边 25 引文,**只画《坛经》本文写到的人**——
祖序(付嘱品「第二十八、菩提达摩尊者」…「惠能是为三十三祖」)、弘忍传惠能(行由品)、曹溪门下八人各是怎么来的(机缘品 / 顿渐品)、南能北秀(顿渐品);
达摩→惠能「衣为争端,止汝勿传」画点线存疑。年代除惠能(本经自记)外只写朝代。闸 `check-fo-lineage`(`checkLineage` 与儒门同源)。释典首页加入口。
**I16 唐诗体裁 × 诗人矩阵** `/tangshi/tangshi300/matrix` `TangshiMatrixPage`:数据 `src/data/tangshi/tangshi-poets.json` 由 `gen-tangshi-poets.mjs`
从抓取缓存各诗页 header 的 `author` 派生(单行 / 多行两种 header,子页取末段),77 家 320 首与站内诗题段逐首对齐;`matrix` 件行 = 诗人(按首数)列 = 七体裁,
格文首数、note 篇目、href 第一首(经 `chapterParts` 带 `?p=`);下方按诗人列全部篇目。闸 `check-tangshi-poets`:每首落点确为诗题段、一首不漏不重。

### §14.1 验收(2026-10-01)
- [ ] I1 18 格 358 味、点格列名、无功效字样;I2 75 格全过、点格跳段;I3 22/22 归位、六句引文全过
- [ ] I14 论语 JSON 零变化、孟子 ≥30 人、传习录 ≥15 人、传习录链接带 ?p=
- [ ] I15 25 引文 0 坏、儒门测试原样过、释典首页有入口;I16 320 首对齐、点格跳第一首
- [ ] build / check-data / check-links / 测试全绿;浏览器走查六页
