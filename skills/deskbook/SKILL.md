---
name: deskbook
description: 做一本「观象 · 书桌」能读的书包(.deskbook 文件):从定体裁、列提纲、逐章写作、配图与动图,到校验、打包、交付,全程按公开的书包格式标准 v1 来。用户说「做一本书包」「做成 deskbook」「把这本书 / 这些文章 / 这部典籍放进观象书桌」「出一个 .deskbook」,或要把讲解、读书笔记、科普合集、公版古籍整理成书桌里可读的书时使用。自带校验器 deskbook.mjs(Node 18+,无依赖)、完整标准 standard.md、JSON Schema 与两本示例。
---

# 做一本书包(deskbook)

书包是「观象 · 书桌」读的书:一个 `.deskbook` 文件(zip),里面 `book.json` 书目清单 + `chapters/NNN.json` 每章一个文件 + `media/` 图片与短视频。不装网页、脚本、字体、SVG;版式由书桌统一排。

本 skill 目录(下称 `$SKILL`)里有:

| 文件 | 用途 |
|---|---|
| `standard.md` | 标准全文 + 附录「图解 fig 的字段」。**拿不准的一律查它,以它为准** |
| `deskbook.mjs` | 校验器与打包工具:`node $SKILL/deskbook.mjs <命令>` |
| `schema/` | `book.json` / `chapter.json` / `fig.json` / `mindmap.json` / `overview.json` 的 JSON Schema |
| `examples/sample-book/` | 现代书示例:三章,用到全部块类型,带图片、视频、全书总览 `overview.json` 与全书脑图 `mindmap.json` |
| `examples/sample-classic/` | 典籍示例:《道德经》三章,原文 / 译文 / 注 / 深读 |

命令(都在用户的工作目录里跑):

```
node $SKILL/deskbook.mjs init <目录> --kind book --title "书名" [--name 英文短名]
node $SKILL/deskbook.mjs validate <目录 | 书包>        # 有错误时退出码 1
node $SKILL/deskbook.mjs pack <目录> [-o 名字.deskbook] # 校验不过不打包
node $SKILL/deskbook.mjs unpack <书包> [-o 目录]
node $SKILL/deskbook.mjs gif2mp4 <a.gif> -o <目录>/media/a.mp4   # 需 ffmpeg
```

都支持 `--json` 输出机器可读结果。

## 工作流(照顺序,不跳步)

1. **问清三件事**:写什么(主题 / 原书 / 原文)、给谁读、多长。用户给了原书或材料就先读材料。
2. **定体裁 `kind`**(见下节)和 `source.type`:
   - 自己写的讲解、教程、科普 → `original`
   - 讲解、消化**别人的书** → `digest`(版权红线最严,见「红线」)
   - 公版古籍原文 → `public-domain`;已获授权的 → `licensed`
3. **列提纲,停下来等用户点头**。提纲写:书名、副题、一句话简介(≤ 60 字)、`kind`、`category`、每章标题 + 一句话中心、准备配哪些图 / 动画。用户确认前不写正文。
4. `init` 起骨架,填 `book.json`(id 用 init 生成的,**以后重出不换 id,只把 `revision` +1**)。
5. **一章一个文件地写**。每写完一章:
   - 在 `book.json` 的 `chapters` 里登记这一章(`no` / `file` / `title`,可加 `subtitle` `minutes`);
   - 跑 `validate`,**改到零错误再写下一章**。提示(warning)也逐条看,能消就消。
6. **媒体**:图片、动画做好放 `media/`,在块里引用;`w` `h` 填文件真实像素(validate 会核对并告诉你实际尺寸)。
7. 全书写完,**写书一级的两样**:全书总览 `overview.json` 与全书脑图 `mindmap.json`(见下两节;讲思想、论证的书都该有,纯资料汇编可省),`validate` 零错误 → `pack` → 按「最后检查」逐条过一遍。
8. **交付**(见下文)。

不要一次性生成全书再校验;一章一校验,问题不会越积越多。

## 三种体裁

| `kind` | 是什么 | 每章必有 | 不许有 |
|---|---|---|---|
| `book` 现代书 | 一本书的讲解、消化,或自己写的书 | `article` | `segs` `yanyi` |
| `collection` 文集 | 若干独立文章:科普合集、一期刊物 | `article`;`book.json` 每章宜带 `author` `date` `summary` | `segs` `yanyi` |
| `classic` 典籍 | 以原文为主的书 | `segs`(原文分段);`article` 可有(章末深读) | — |

### 最小的 `book.json`

```json
{
  "format": "deskbook", "version": 1,
  "id": "u-pendulum-3f9a2c1b", "revision": 1,
  "kind": "book",
  "title": "摆的道理", "authors": ["作者名"], "lang": "zh-Hans",
  "summary": "一句话说这本书讲什么,不超过 60 字。",
  "source": { "type": "original" },
  "unit": "章",
  "chapters": [ { "no": 1, "file": "chapters/001.json", "title": "是什么把球拉回来" } ]
}
```

可选:`subtitle` `description`(≤ 400 字)`category`(一个词,书架按它分栏)`tags`(≤ 8)`disclaimer` `theme{accent,accent2,paper}`(#RRGGBB,可只给其中几项)`cover`(建议竖 2:3)`banner`(建议横 3:2)`parts[{title,from,to}]`(须连续覆盖全部章)`generator`。章条目可选 `subtitle` `summary`(一句话说这一章,≤ 80 字、一行,目录列表里显示;文集每篇都写)`minutes` `author` `date`(YYYY-MM-DD)`head`(章题头图,建议横 3:2)。

- `id`:必须以 `u-` 开头(自己做的,`u-<英文短名>-<8 位十六进制>`,`init` 自动生成)或 `g-`(站点管理员书房)。不带前缀的 id(`daodejing` `lunyu` 等)留给书桌内置的官方典籍,用了校验报错。
- 章文件以 `chapters[].file` 为准,但必须写成 `chapters/` + 章号补零三位 + `.json`(校验器核)。
- `digest` / `licensed` 必须写原书:`"source": { "type": "digest", "of": { "title": "原书名", "author": "原作者", "publisher": "出版社", "year": 2019 } }`。
- `unit`:章的叫法,章 / 篇 / 讲 / 期 / 卦…

### 现代书 / 文集的章文件

```json
{
  "no": 1,
  "title": "是什么把球拉回来",
  "article": {
    "idea": "一句话中心(≤ 200 字,可无)",
    "blocks": [
      { "t": "lead", "x": "导语:先说结论。" },
      { "t": "p", "x": "正文。可以有 **加粗**、`等宽` 和 [链接](https://example.org)。" }
    ]
  }
}
```

### 典籍的章文件

```json
{
  "no": 1,
  "title": "一章",
  "segs": [
    { "o": "道可道，非常道，名可名，非常名；",
      "t": "可以言说的道，就不是恒常之道；可以称呼的名，就不是恒常之名。",
      "n": [ { "k": "非常道", "d": "不是恒常不变的道。常，恒久。", "x": "40–150 字的展开,可无", "r": "读音,可无" } ] }
  ],
  "yanyi": ["章后短延伸,一段一项(可无)"],
  "article": { "title": "深读题目", "blocks": [ { "t": "p", "x": "……" } ] }
}
```

- `o` 是底本原文,**一个字不改**,底本写进 `source.note`。
- 注 `n`:`k` 必须是这一段 `o` 的**精确子串**;同段各条按首次出现位置**不能重叠**;`d` ≤ 40 字;`x` 40–150 字。

## 块速查(`article.blocks`)

| `t` | 字段 | 说明 |
|---|---|---|
| `lead` | `x` | 导语 |
| `h2` / `h3` | `x` | 小标题(两级) |
| `p` | `x` | 正文段 |
| `quote` | `o` `tr?` 或 `x` `by?` | 引文,**两种形状取其一**:原文式 `o` + 可选译文 `tr`;一般式 `x` + 可选出处 `by`。`o` 与 `x` 不许同块,`tr` 只配 `o`、`by` 只配 `x` |
| `callout` | `tone` `label?` `items[]` | 提示框,`tone` 为 `note` / `tip` / `warn` |
| `pull` | `x` | 金句,**一章至多 1 处** |
| `steps` | `items[]` | 有先后的步骤 |
| `list` | `ordered` `items[]` | 列举,`ordered` 必填 true / false |
| `outline` | `items[]` | 多级提纲,每项 `{x, children?}`,**最多四层** |
| `fig` | `fig` `cap?` | 图解(结构化数据,书桌原生排版,见下) |
| `img` | `src` `alt` `cap?` `w` `h` | 图片,`w` `h` 为真实像素 |
| `video` | `src` `poster` `cap?` `w` `h` `sec` `loop?` `sound?` | 视频 / 动图,默认循环静音自动播 |
| `code` | `x` `lang?` | 代码或等宽文字(公式也可放这里) |
| `divider` | — | 分隔 |
| `refs` | `items[]` | 文末出处、参考 |
| `ask` | `q` `a` | 自问:先见问题(≤ 120 字,一行),点开才见回答(≤ 600 字)。用在读者该停下想一想的地方,一章一两处 |

规则:`img` / `video` 的 `w` `h` 必填且等于文件像素;每章至少一个 `p` 或 `lead`;不许空块;不许自造块类型;行内只有 `**加粗**`(必须成对)、`` `等宽` ``、`[文字](https://…)`(只许 https),别的记号按字面显示——**不要写 HTML、Markdown 标题、表格语法**,结构一律用块表达。

### 图解 `fig` 速查

一律给结构化数据,书里**不放 SVG、不把图解画成图片**。十种 `kind`(完整字段见 `standard.md` 附录、`schema/fig.json`):

| kind | 用于 | 关键字段 |
|---|---|---|
| `flow` | 流程、推理链、循环 | `steps[{head,body?}]`(≥ 2)`result?` `loop?` |
| `cols` | 并列、对比(2–4 栏) | `cols[{head, lines[]}]` |
| `rows` | 列举、层次 | `items[{mark?, head, body?}]` |
| `tree` | 结构 | `root?` `branches[{head, body?, children?}]`(≥ 2) |
| `timeline` | 时间线 | `points[{when?, head, body?}]`(≥ 2) |
| `table` | 每格都短的表 | `heads?` `rows[[…]]`(各行等长) |
| `quote` | 金句卡 | `text` `gloss?` `source?` |
| `gua` | 卦画 | `guas[{name, form: hex/tri}]` `yao?`(6 或 7 项,自上而下) |
| `ring` | 方位、环形 | `items[{at: N/NE/…/NW, head}]`(≥ 3,at 不重复)`center?` |
| `notes` | 以上都不合适 | `lines[]` |

公共:`title?` `foot?[]`;任何条目可加 `accent: true`;单个字符串 ≤ 120 字。拿不准用 `rows` 或 `notes`,不要硬造结构。

```json
{ "t": "fig", "cap": "一次完整的往返", "fig": { "kind": "flow", "title": "单摆一个周期",
  "steps": [ { "head": "右端", "body": "停住" }, { "head": "最低点", "body": "最快" }, { "head": "左端", "body": "停住" } ], "loop": true } }
```

## 书一级:全书总览(`overview.json`)

一本书分两层:**书一级**(全书总览 + 全书脑图,先读、常回来看)和**章一级**(目录里的各章)。书桌分开呈现,总览不进目录、没有章号。

- 什么时候写:讲思想、论证、体系的书,或章与章之间有一条主线的书,都该写;各章独立的文集可写一篇「本期导读」;纯资料汇编可省。
- 写什么:全书讲什么、为什么值得读、几大部分怎么连起来、怎么读。先说结论。可放一个 `ask` 让读者带着问题进书。**不要把它写成第一章**,也不要在 `chapters` 里再登记一个「总览」章。
- 放在包的根上,`book.json` 里写 `"overview": "overview.json"`。形状同章的 `article`,可多一个 `head` 题头图(建议横 3:2,不带文字):

```json
{ "title": "这本小书讲什么", "idea": "一句话中心", "head": "media/banner.jpg",
  "blocks": [ { "t": "lead", "x": "……" }, { "t": "p", "x": "……" },
              { "t": "ask", "q": "一个更重的球,摆得会更快吗?", "a": "不会。……" } ] }
```

- 块规则同章(至少一个 `p` 或 `lead`,`pull` ≤ 1);digest 书的引文上限对总览同样适用。完整示例见 `examples/sample-book/overview.json`。

## 书一级:全书脑图(`mindmap.json`)

一棵**能展开全书思想的树**,放在包的根上,`book.json` 里写 `"mindmap": "mindmap.json"`。它不是目录:根是全书的中心论点,往下分出各部分的主张、论据、例子;读者从根一路点开,就能看到整本书是怎么立起来的。

```json
{ "root": { "label": "单摆:一个能数时间的来回", "note": "一两句说全书的中心。",
  "children": [
    { "label": "球为什么会回来", "note": "回复力是重力沿弧线的分力。", "ch": 1,
      "children": [ { "label": "重力拆成两份", "note": "……" } ] },
    { "label": "周期只看摆长", "ch": 2 } ] } }
```

- 节点只有 `label`(必有,一行,≤ 60 字;可以是一整句判断)、`note`(可无,≤ 1500 字,点开后的展开)、`ch`(可无)、`children`(可无,非空)。手写的脑图用这四个就够了;标准另有两个可无字段 `id`(稳定身份,同一份里不重复)与 `full`(label 是长句截下的开头时写整句),主要给程序批量生成时用,见 `standard.md` §10。**别的字段不要加。**
- `ch` 只挂在与某一章对应的节点上(通常是第一层的几支),值是本书存在的章号;不要每个节点都挂。
- 连根至多 5 层,全树 ≤ 600 个节点;一般 2–4 层、几十个节点最好读。
- 写法:先定根(全书一句话的主张),再定第一层(三到七支,对应全书的几大块),再往下补论据与例子;label 写结论、不写「概述」「第二部分」这类空标签,细节放 note。
- 讲别人的书时,脑图也是你自己的话,不搬原书目录。脑图里的字不计入字数。完整示例见 `examples/sample-book/mindmap.json`。

## 媒体

- 图片:`.jpg`(照片,扩展名写 `.jpg` 不写 `.jpeg`)`.png` / `.webp`(线条图);长边 ≤ 4096;单张 ≤ 4 MB。`media/` 下可分子目录。
- 视频:`.mp4`(H.264、yuv420p、`+faststart`),长边 ≤ 1280,≤ 60 秒,无声或 AAC,≤ 24 MB。
- 整包 ≤ 300 MB,`book.json` 与章文件各 ≤ 2 MB,章数 ≤ 2000,zip 条目 ≤ 10000,路径 ≤ 255 字符。文件名只用小写字母、数字、`-` `_` `.`。
- **封面、题图、章题头图不带文字**(书名由书桌排)。
- 每个 `img` / `video` 引用的文件必须在包里;放进 `media/` 却没人引用的文件会被提示,删掉或用上。
- **图与动画是为了讲清一件事,不为装饰。** 需要「动起来才看得懂」的(摆动、齿轮、动作分解、数据随时间变化),才做动画。
- 自己画图:可用 Python(PIL / matplotlib)或 ffmpeg 生成;图中文字只留必要的字母标注,解释放进 `cap` 和正文。不要用来路不明的网图,不用出版社的封面与插图。

### GIF 怎么变成 video 块

GIF 不进包(同样画面,GIF 常大十倍以上)。先做出 GIF(或逐帧画好再合成 GIF),然后:

```
node $SKILL/deskbook.mjs gif2mp4 swing.gif -o mybook/media/swing.mp4
```

它会转出 H.264 mp4(长边 ≤ 1280、偶数尺寸、无声、faststart)和封面图 `swing-poster.jpg`,并打印一块现成的 JSON:

```json
{"t":"video","src":"media/swing.mp4","poster":"media/swing-poster.jpg","w":480,"h":360,"sec":4,"loop":true}
```

贴进章文件,补一句 `cap`。原 GIF 留在包外。没有 ffmpeg 时请用户装(macOS `brew install ffmpeg`)。有声音的讲解视频要标 `"sound": true`(不自动播)。

## 文字口径与红线(必须遵守)

1. **版权(`source.type = digest`,讲别人的书)**
   - 全文绝不进包;文章用**自己的话**重新组织,不逐段改写原文。
   - 直接引用**每条 ≤ 100 字,每章 ≤ 16 条**:`quote` 块、`pull` 金句、`fig` 金句卡(`kind: quote` 的 `text`)都算引用,一并计数(校验器卡这两个数)。不得靠拼引文还原原书。
   - 不用原书、出版社的封面与插图;图自己画。
   - `source.of` 写明原书名、作者(出版社、年份能写就写)。
2. **典籍**:原文取通行底本,在 `source.note` 写明;`o` 一字不改、不凭记忆补写——原文要从用户给的文本或可靠来源逐字取;译注讲训诂、思想、史实,有争议的说法并陈,不裁断。
3. **不编造出处**。引文、人名、书名、年代、数据,拿不准就不写,或明说「未能核实」。不虚构文献条目放进 `refs`;流传的故事要标明是传说。
4. **一章一个中心**,先说结论再展开;`idea` 写那个中心。
5. **声明**(`disclaimer`,校验器按 `category` / `tags` 查):
   - 讲医学、养生、健身、营养、心理治疗 → 必须 `"disclaimer": "medical"`。内容上:不给诊断、处方、剂量;不承诺疗效;健身动作写明量力而行、出现不适停下。
   - 讲命理、占卜、风水、相术 → 必须 `"disclaimer": "divination"`。内容上:只讲「书里怎么说、为什么这么说」,不替人断命,不下吉凶断语。
   - **两类都讲的书两个都带**:`"disclaimer": ["medical", "divination"]`。数组里还可以加自写的一句(每句 ≤ 120 字)。
   - 其余题材不需要声明;也可以自写一句(≤ 120 字)。
6. 不写任何可执行内容;文字里的尖括号按字面显示,别指望它变成标签。

## 交付

1. `pack` 得到 `<名字>.deskbook`,把**完整路径**告诉用户,并报:书名、体裁、章数、字数、文件大小(`validate --json` 里有)。
2. 怎么放进书桌:
   - 把文件**隔空投送**到 iPhone / iPad,或存进「文件」App、或从任何 App 的**分享菜单**,选「用书桌打开」;也可以在书桌里粘贴一个 https 下载链接。导入的书**只存在这台设备上,不上传**;换设备要再导入一次(阅读进度按 `id` 照常同步)。
   - 站点管理员:在观象网站的书房上传页(网站 `/books` 下,仅管理员可见)上传 `.deskbook`,书会进管理员账号的「书房」。
3. 以后要改:改源目录 → `revision` +1 → 重新 `pack`,id 不变,书桌认得是同一本书的新版。

## 最后检查(逐条过)

- [ ] `validate` 零错误;每条提示都看过、能消的已消
- [ ] `kind` 与内容相符;典籍每章有 `segs`,现代书 / 文集每章有 `article`
- [ ] `id` 带 `u-` 前缀;重出时 id 未变、`revision` 已 +1
- [ ] `summary` 一句话、≤ 60 字;`source` 如实(digest 写了 `of`,典籍在 `note` 写了底本)
- [ ] digest:没有大段转述原文;quote / pull / 金句卡合计每章 ≤ 16 条、每条 ≤ 100 字
- [ ] 没有编造的引文、出处、数据;不确定的已删或标「未能核实」
- [ ] 医学 / 健身 / 命理题材带了对应 `disclaimer`(两类都沾就写成数组带两个),正文守了相应约束
- [ ] 每张图、每段视频都在讲一件事;`cap` 写了它在讲什么;封面题图无文字
- [ ] 视频由 `gif2mp4` 或同等参数转出,`w` `h` `sec` 与文件一致
- [ ] 有全书总览:`book.json` 写了 `"overview": "overview.json"`,它不是第一章、`chapters` 里没有「总览」章
- [ ] 有全书脑图:`book.json` 写了 `"mindmap": "mindmap.json"`,根是中心论点而非书名重复,`ch` 只挂在对应章的节点上
- [ ] 每章 `pull` ≤ 1;`outline` ≤ 4 层;`**` 成对;链接全是 https
- [ ] 把 `.deskbook` 的路径和放进书桌的方法告诉了用户
