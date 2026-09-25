# 观数组 · 书级导读「前世今生」派工共用规格

你在为古籍研读站「观象」的命理典籍组(观数,corpus=`mingli`)写**一部书的书级导读**:讲这部书本身的命运——其人、其时、其书、其传(最重)、其旨(几百字点到为止)、从哪读起。

## 动手前只读这几样(别的不用翻,翻了是白花轮数)
1. `docs/daodu-production-standard.md` —— **唯一作业标准,逐条照做**(体裁/笔法/图表/引文两层规矩/厚度/十步清单)。
2. `src/data/mingli/daodu/zhenquan.json` —— 同组已过关的一篇,看形(字段、块类型、cite 写法、table 写法、SVG 写法)。
3. 本书的 `src/data/mingli/texts.json` 条目(`authorNote`/`caveat`/`brief`)与 `scripts/sources/mingli/SOURCES.md` 里「第二批:命理源头五书」一节(底本怎么来的、择本取舍、缺字、篇目判定——**底本事实以此为准**)。
4. `src/data/mingli/school.json`(家级导读)里提到本书的段落——口径要和它一致,不要自相矛盾。
5. 本书原文:`src/data/mingli/classics/<slug>.json`(chapters[].no/title/paragraphs[].original/translation)。文件大的(三命通会 ~3MB)**用脚本按需取章,不要整本 Read**。

## 组铁律「研习不断命」
这是命理**典籍**的文献研读,不是算命。写「书里怎么说、这书怎么来的、后人怎么读它」;**不为其说背书、不教读者拿去套用、不下任何预测性断语**;可如实指出此说无从验证、诸家分歧。真伪与依托如实交代(旧题鬼谷子/郭璞/珞琭子之类,四库馆臣怎么考的就怎么写)。

## 版权红线
**不得引用或转述 20 世纪以后注家的评注文字**(徐乐吾、韦千里、袁树珊等);作为「民国某人曾评注/重刊」的**流传史事实**可以提一句,不展开其观点。四库提要、清人及更早的材料可转述并标出处。

## 引文
- 本书原文才作 `quote` 块:`{type:'quote', original, translation, cite:{corpus:'mingli', slug, ch, label}}`,`original` **必须用脚本从数据里切出来**(严禁手打),须是该章原文的精确子串。注意:三部四库本(三命通会/李虚中命书/玉照定真经)的 original 在已断句的章里带标点、未断句的章是白文,**切到什么就引什么**。translation 取站内译文对应句(没有站内译文的章就自己平实直译)。
- 站外材料(史志、四库提要、他书)一律**正文转述 + 标出处**,不作 quote 块。
- 拿不准的年份、卷数、刊刻者、「首次」「最早」一律**不给确数**,宁缺毋滥;在 `refs` 块里交代哪些是站内原文、哪些是站外转述、哪些仍有争议。

## 形
`{title, subtitle, centralIdea, hero:{badge,headline,tagline}, blocks:[…]}`;块类型只用 `lead / h2 / p / quote / figure / table / pull(≤1) / refs`。**`callout`/`list`/`steps` 一律不用**。小标题意象化、不编号。图表 ≥4 处(时间线/谱系/分岔/对照表),SVG 着色只许 `style="fill:var(--ink)"` 这类写法(可用变量:--ink --ink-soft --ink-faint --line --paper-raised --cinnabar),`font-family:var(--font-serif)`,带 viewBox,手写坐标别越出画布。字数按标准定档,**不低于 4000 汉字**。

## 交付
把成品写到**指定的分片文件**(见派工末尾),然后自查:
`cd /Users/gavin/work/hexagram && node scripts/check-daodu-draft.mjs mingli <slug> <你的分片文件>`
报「✓ 硬项全过」才算完。**只许写你那一个分片文件,不要改仓库里任何文件,不要 git 操作。**
最后用几行话回报:定的哪一档、字数、图表数、引了哪几章、**你没把握因而没写或写得含糊的史实清单**(这一条最重要,主会话要据此人读复核)。
