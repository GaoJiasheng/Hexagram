# 富文本化打磨路线图(白话 + 观书)

> owner 2026-07-25 参照一份排版精良的科普 PDF 提出:文章要做**富媒体化打磨**,
> 覆盖**全部白话文章与观书文章**,且**此后新写的一律按新模板**。
> **现状以数据为准**,别信本文计数(会过时)——先跑 §0 的盘点脚本。

---

## 0. 先跑这个:盘点现状

```bash
python3 - <<'EOF'
import json, glob, os
from collections import defaultdict
NEW={'list','callout','pull','steps'}
bh=defaultdict(int); done=defaultdict(int)
for f in glob.glob('src/data/*/baihua/*.json'):
    c=f.split('/')[2]
    for k,ch in json.load(open(f)).items():
        if not isinstance(ch,dict): continue
        bh[c]+=1
        if any(b.get('type') in NEW for b in ch.get('blocks',[])): done[c]+=1
print('白话:', {k:f"{done[k]}/{bh[k]}" for k in sorted(bh)})
a=d=0
for f in glob.glob('src/data/books/*/overview.json')+glob.glob('src/data/books/*/articles/*.json'):
    a+=1
    if any(b.get('type') in NEW for b in json.load(open(f)).get('blocks',[])): d+=1
print(f'观书: {d}/{a}')
EOF
```

**截至最后更新**:白话 927 章(已做 74,均在 dao/daodejing)、观书 922 篇(未开始)。总盘子 **1849 篇**。

---

## 1. 铁律:只重新分块,一个字不许改写

> owner 原话:**「其实内容我觉得不用大动,更多的还是格式和阅读体验的优化。」**
> 「只要不完全重写,我都能接受。你只要能把它打磨的质量很好。」

- **不许润色、改写、增删内容、新增观点。**只把**已有文字**重新切进更合适的块。
- 唯一允许消失的字符:列表项被吃掉的**行首序号前缀**(「一、」「第一，」「①」「•」)。
- **护栏必须跑**(见 §3),不过就整章作废。修正方向永远是把文字改回原样,**不是去改校验脚本**。

### 唯一的例外:callout 的 label
`callout.label`(左上角小标签)本质是**排版元件**而非内容,允许新写短签。
校验脚本已豁免该字段,但**限长 12 字**——免得有人把正文塞进 label 里绕过比对。

**三条规矩(试点踩出来的):**
1. **不许把原文句子搬进 label。** label 一豁免比对,搬进去的句子就等于被删了。
   首轮就是这么中招的(护栏一改就暴露 40 章缺字)。正确做法:句子留在 `items`,label 另写。
2. **正文已自报家门就别再挂签。** 正文开头若是「打个比方：」「举个例子：」「顺带说一句：」,
   再挂个「一个比方」纯属重复——**这种情况不写 label**,靠框和色调已经足够。
   试点 99 处 callout 里,只有 **20 处**真的需要标签。
3. **标签要对得上正文语气**,别照 tone 一刀切。试点用过的:
   `留意用字` `留意句式` `留意层次` `放到今天` `设想一下` `一处澄清` `一处提醒` `容易读岔` `全章转折`。

---

## 2. 块规格(canonical,新旧文章共用)

渲染器:`src/features/reader/BaihuaBlock.jsx` 的 `Block()`;样式:`src/index.css` 搜 `v22.1 富文本块`。
**观书文章复用同一渲染器**,故规格完全一致。

### 既有块(结构不要动)
`lead` 导语 / `h2` 小节标题 / `p` 段落 / `quote{original,translation}` 引文 /
`figure{ftype,svg,caption}` 内联 SVG 图 / `refs{items[]}` 尾注

### 新增块(v22.1)
```jsonc
// 列表——并列要点;ordered 出编号,否则出圆点
{ "type": "list", "ordered": true, "items": ["…", "…"] }

// 提示框——tone: note(青·比方/补充) | warn(赭·澄清/易误读) | mute(灰·旁注/免责)
{ "type": "callout", "tone": "note", "label": "一个好懂的比方", "items": ["…"] }

// 重点引言——全章最要紧一句,粗左竖条无底色。一章至多一处,宁缺毋滥
{ "type": "pull", "text": "…" }

// 次第——有先后的步骤;state: done|now|todo,badge 为可选小药丸
{ "type": "steps", "items": [ { "title":"…", "text":"…", "state":"now", "badge":"可选" } ] }
```
`items` 内仍支持 `**加粗**`。

### 用哪种块
| 情形 | 用 |
|---|---|
| 连续「一、…二、…」「第一，…第二，…」 | `list` ordered,**删掉行首序号** |
| 明显并列的三四条短判断(原文无编号) | `list` 无序;**拿不准就别动** |
| 「打个比方」「这就像」「举个例子」开头及其展开 | `callout` note |
| 纠正误读、划清界限(「但这不等于…」「不是说…」) | `callout` warn |
| 旁注、免责、版本存疑 | `callout` mute |
| 全章最该被记住的那一句(常已整句加粗) | `pull`,**每章至多一处** |
| 有明确先后的过程/阶段 | `steps` |

### 分寸(最重要的一条)
**不是每篇都要用满。** 大部分文章只多出 1–2 个块,**有的一个都不加也正常**——
结构服从内容,**不许为了用新块而硬拆**。首轮 81 章里有 7 章未动,是合理的。

---

## 2b. 机械重分块 `scripts/reblock-auto.mjs`(**存量补账的主力**)

规则由《道德经》试点反推,**零 LLM 成本**。用法:

```bash
node scripts/reblock-auto.mjs <corpus> <slug>              # 试跑,结果落 /tmp
node scripts/reblock-auto.mjs <corpus> <slug> --write      # 落盘
node scripts/reblock-auto.mjs <corpus> <slug> --candidates # 只导 pull 候选
node scripts/reblock-auto.mjs <corpus> <slug> --write --pulls=选句.json  # 人工改判 pull
```

- `callout`/`list`/`steps` 是**纯词法**判定,机械即可,规则见脚本头部注释。
- `pull` 是语义判断,脚本只给**提议**(与 `centralIdea` 重合度最高的段尾加粗句);
  拿试点 40 处人工选择测:top-1 命中 60%、前二 85%。落选的也都是作者自己加粗的强调句。
  读着不对就用 `--pulls={"章号":"那一句"}` 改判,值给 `null` 则本章不出 pull。
- **易经 + 道 309 章实测**:752 新块、0 失败。产出比试点更齐(试点 agent 把
  「其一，/其二，」的落地启发多半漏成了普通段落,脚本一律成表)。

---

## 3. 护栏:逐字校验

```bash
git show HEAD:src/data/<corpus>/baihua/<slug>.json > /tmp/before.json
node scripts/verify-reblock.mjs <corpus> <slug> <改后文件> /tmp/before.json
```
把改前/改后每章全部可见文字拼起来(抹掉加粗标记、空白、列表行首序号)逐字比对。
**必须 `失败 0`**,且「结构有变化」应是个可观数字(否则说明没真做分块)。

⚠️ **改后文件若已覆盖回原位,必须显式传「改前文件」**——否则默认改前路径就是改后文件本身,
校验会空转(首轮就中过招,脚本现已加同文件检测强制报错)。

观书文章结构不同(单篇一个 JSON,非 `{章号: 章}`),需**先扩展该脚本支持 books 布局**再开工。

---

## 4. 分批计划

**串行,一批一验一提交。** 每批完成后 `npm run content:build` + `check-data` + `build`。

### 白话(927 章)
| 批 | 范围 | 章数 | 状态 |
|---|---|---|---|
| ✅ 试点 | dao/daodejing | 81 | **已完成**(人工分块) |
| ✅ 1 | **yijing 全部**(64 卦 + 十翼 35) | 99 | **已完成**(机械,0 失败) |
| ✅ 2 | **dao 全部**(含道德经补漏) | 210 | **已完成**(机械,0 失败) |
| ✅ 3 | **余下九组**(儒120/兵110/法89/中医88/谋略69/佛63/墨42/纵横33/心4) | 618 | **已完成**(0 失败) |
| ✅ 4 | **观书全部**(98 本 × 总览+章) | 922 | **已完成**(0 失败) |

**全部完成:1849 篇 · 3093 新块 · 0 失败。** 复跑一次即知现状(§0)。

### ⚠ 核对口径(别被数字吓到)
「有新块的篇数」≠「已处理的篇数」。**全部 1849 篇都跑过脚本**;其中约 93% 产出了新块,
其余是**规则判定本篇没有可转的结构**(没有枚举、没有比方/旁注话术、没有够格的金句)——
这正是规格里「一整章一个新块都不加也正常,绝不硬拆」。判断有没有漏跑,看的是
**整本 0 命中**:白话仅 `fo/xinxinming`(信心铭,四言偈颂,最高分候选 0.44 差阈值 0.45 一点点),
观书 0 本。别拿单篇 0 命中当漏跑。

**教训**:批处理时 corpus 列表是手写的,`xin` 组(阳明心学 4 章)第一轮就这么被漏掉了,
是 owner 让复核才发现。以后一律用 `ls src/data/*/baihua` 枚举,不要手写清单。

### 现在起
新写的白话/观书文章由生成规格自带富文本(§5);若有新书/新组补进来,
直接 `node scripts/reblock-auto.mjs <corpus> <slug> --write` 再过护栏即可。

### 各组红线照旧
中医「研习不诊疗」、佛「不宣化不劝信」、道「不下成仙断语」、谋略「伪书批判」、
法「思想史非权术教程」——**重新分块不改字,理论上不会触碰红线,但 check-data 的软警告仍要看**。

---

## 5. ✅ 新文章一律按新模板(已完成)

**已止血**——此后新写的白话/观书文章自带富文本,不再欠账。改动:

1. **`scripts/gen-baihua-wf.mjs`** —— 新增 `RICHSPEC` 常量(4 种块 + label 规矩 + 分寸),
   注入三条 draft 支线(易经卦 / 易经经传 / 通用 corpus)与三条 verify 支线;
   `SCHEMA` 的 `type` enum 补 `list/callout/pull/steps`,并补 `ordered`/`tone`/`label`/`steps` 字段。
   > `steps` 的项是**对象**,而 `items` 已被约束为字符串数组,故 schema 里单开 `steps` 字段,
   > 由 `assemble-baihua.mjs` 归一到 `items`(顺带丢弃空块、丢弃超长 label)。
2. **`docs/books-production-standard.md` §6** —— 块规格表补 4 行 + 分寸/label 两条。
3. **`docs/design-v22.md` §3.3b** —— 新开一节作 canonical 出处(块清单 + 用哪种块 + 分寸 + label)。
4. **`scripts/check-data.mjs`** —— 新增校验:`pull` 每章至多 1 处、`callout.label` ≤12 字、
   `list/callout/steps` 不许空。

余下只剩 §4 的存量补账。

---

## 6. 质量线(首轮试点达成,别退化)

| 指标 | 试点(道德经 81 章) |
|---|---|
| 文字逐字一致 | **81/81(失败 0)** |
| 结构有变化 | 74 章 |
| 新块总数 | 174(note 74 / pull 40 / list 19 / warn 17 / steps 16 / mute 8) |
| 每篇 pull 数 | ≤1 |
| callout 挂签比例 | 20/99(**只在正文没自报家门时挂**,不是每个都挂) |

### 全量收官(1849 篇)
| 指标 | 结果 |
|---|---|
| 逐字一致 | **1849/1849(失败 0)** |
| 新块总数 | 3093(pull 1399 · list 857 · callout 765 · steps 72) |
| 有金句的篇数 | 1399(75%)——够不上阈值的不硬凑 |

---

_最后更新:2026-07-26(全量收官+复核补 xin 组)。1849 篇全部处理,1719 篇产出新块(93%)。计数以 §0 脚本为准。_
