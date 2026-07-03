# 白话文章富媒体化 · Codex 交接规格

> 目标:在**不改动任何一个字的正文**前提下,给全站白话文章(易经 99 + 道 210 + 儒/佛/心/诸子/中医/谋略等,共 811 章)补齐、升级**配图(SVG)**,让每章图文并茂。
> 这份文档自足——照它执行即可,不需要额外上下文。**唯一验收标准:`npm run check-data` + `npm run build` 全绿,且没动过任何正文/引文字节。**

---

## 0. 铁律:哪些绝对不能碰(违反即作废)

数据文件:`src/data/<corpus>/baihua/<slug>.json`,结构是 `{ "章号": { title, subtitle, centralIdea, hero?, featured?, blocks: [...] } }`。

block 有五种 type:`lead` / `h2` / `p`(有 `.text`)、`quote`(有 `.original`+`.translation`)、`figure`(有 `.svg`+`.caption`+`.ftype`)、`refs`(有 `.items[]`)。

**你只能动 `figure` 块。以下一字不许改:**
- ❌ 任何 `lead` / `h2` / `p` 的 `text`;
- ❌ 任何 `quote` 的 `original` / `translation`(check-data 会逐字校验 original 是站内原文子串,改了直接红);
- ❌ 任何 `refs` 的 `items`;
- ❌ 每章的 `title` / `subtitle` / `centralIdea` / `hero` / `featured`;
- ❌ **任何已存在 figure 的 `caption` 文本**(见下 §3 允许项);
- ❌ 非 figure 块的顺序、增删。

**允许的操作,仅限:**
- ✅ 升级已有 figure 的 `svg`(把粗糙/占位图重画得更好);
- ✅ **新增** figure 块(带自己的新 `svg` + 新 `caption` + `ftype`),插在合适的正文块之间;
- ✅ (可选,需 owner 开启)归一已有 figure 的 `ftype` 标签,见 §4。

> 安全网:即便你手滑改了正文/引文,`check-data` 的引文子串校验会逮住;但请一开始就靠**只读 text、只写 figure** 的纪律避免。

---

## 1. 数据模型(figure 块的确切形状)

```json
{
  "type": "figure",
  "ftype": "结构图",
  "svg": "<svg viewBox=\"0 0 600 300\" ...>...</svg>",
  "caption": "一句话说明这张图在讲什么(≤60字,守红线)"
}
```

渲染方式(`src/features/reader/BaihuaBlock.jsx`,勿改):
```
<figure class="baihua-figure">
  <span class="baihua-figure__tag">{ftype}</span>   ← ftype 作为可见标签显示!所以必须是干净中文短词
  <div class="baihua-figure__svg" dangerouslySetInnerHTML={svg} />  ← svg 被信任注入,必须无脚本、无外链
  <figcaption class="baihua-figure__cap">{caption}</figcaption>
</figure>
```

---

## 2. SVG 编写规则(硬约束,踩了要么白屏要么校验红要么明暗色坏掉)

1. **颜色只用 CSS 变量或 currentColor,禁止写死 `#hex`**。而且**必须用 `style="fill:var(--x)"` / `style="stroke:var(--x)"`,不能用 `fill="var(--x)"` 属性**——SVG presentation 属性不认 `var()`,写成属性会不上色。
   - 正:`<text style="fill:var(--ink)">…</text>` / `<rect style="fill:var(--cinnabar);stroke:var(--rule)"/>`
   - 误:`<text fill="var(--ink)">` ❌  /  `<rect fill="#c0392b"/>` ❌(后者 check-data 软警告)
   - check-data 正则:`(fill|stroke)\s*[:=]\s*['"]?#[0-9a-fA-F]` 命中即软警告 → **别出现任何 `#` 颜色**。
2. **可用的主题 token**(明暗自适应,来自 `src/index.css`):
   - 前景/文字:`--ink`(正文墨)、`--ink-soft`、`--ink-faint`;
   - 主色(印朱,随分站变):`--cinnabar`;点缀青:`--azure`;
   - 底/纸:`--paper`、`--paper-raised`;分隔线:`--rule`;
   - 字体:`font-family:var(--font-serif)`(标题/正文衬线)。
   - 需要"主色的淡背景"用 `color-mix(in srgb, var(--cinnabar) 12%, transparent)` 之类,别写死色值。
3. **根 `<svg>` 必须**:带 `viewBox="0 0 W H"`;带 `style="width:100%;height:auto"`(或 `max-width:100%`)保证移动端不溢出;带 `xmlns="http://www.w3.org/2000/svg"`。
4. **纯内联、自足**:禁止 `<script>`、禁止 `<image href>` 指向远程、禁止外链字体/样式表、禁止 `<foreignObject>` 里塞 HTML。只用 `<text>/<rect>/<line>/<path>/<circle>/<polygon>/<g>` 等原生图元。
5. 字号建议 13–22,中文用衬线;整图高度别太夸张(viewBox 高度一般 ≤ 420),避免一张图占满屏。
6. 深浅色都要能看:因为全走 token,别用「浅灰字 on 白底」这种写死组合。

---

## 3. caption 规则

- **已有 figure 的 caption:不动。** 若你把它的 svg 重画了,caption 保持原样(除非原 caption 明显与新图矛盾——那种情况请**跳过该图不改**,列进报告让人工定,别自作主张改字)。
- **新增 figure 的 caption**:你写,简洁一句(≤60 字),说明这图在讲什么;**守该组红线**(见 §5)。可点出图中生僻字训释,但别展开成段落。

---

## 4. ftype 标签集(它是可见 tag,要干净)

现状:全站 figure 的 ftype 有 100+ 种混乱取值(中英混、`structure`/`结构图`/`jiegou` 并存)。**新增 figure 一律从下面这套干净中文标签里选:**

| ftype | 用途 |
|---|---|
| `金句卡` | 把一句题眼/金句做成印章式大字卡 |
| `结构图` | 一个概念的层次/组成/框架 |
| `对比图` | A vs B(如 有为↔无为、古义↔今义) |
| `流程图` | 步骤/次序/因果链 |
| `时间线` | 成书流变/版本/历史脉络 |
| `关系图` | 概念之间怎么勾连 |
| `列举图` | 若干关键词+训释并排 |
| `卦象图`(仅易经) | 卦画六爻/上下经卦/爻位身份/错综卦 |

- **(可选,默认关闭)ftype 归一**:若 owner 开启,可把已有 figure 的英文/杂乱 ftype 映射到上表(纯标签替换,不动 svg/caption);默认**不做**,以免动到可见文本。先只管新增图用干净标签。

---

## 5. 各组红线(figure 的图形与 caption 也要守,不只正文)

图里画的、caption 里写的,都不能越界:
- **道(dao)**:不宗教宣化、不下成仙/福报/吉凶断语、不演内丹工法。丹经(参同契/黄庭)配图只作**结构/隐喻/义理**图,不画"炼丹步骤指南"。
- **佛(fo)**:研习不宣化,不下吉凶/果报/往生断语,不劝皈信。
- **中医(zhongyi)**:**研习不诊疗**——配图不画剂量/用法/疗程/对症自疗,只作字词训诂、医史源流、概念结构。**这组最敏感,拿不准就不配图。**
- **谋略(moulue)**:托名伪书,批判视角——配图揭示手法/防范,不作"权术施用图解",可标"⚠ 揭示防范非教施用"。
- **诸子(fa/mo/bing/zong)**:思想史视角,不作现代政治影射/权术实操图。
- **易经(yijing)**:讲义理/象数,**不算命、不作吉凶预言**(如损益、卦变图讲的是义理推演,别画成"运势预测")。

check-data 会对整章(含 svg/caption)做红线软扫描,命中会 warn;warn 不阻断构建,但**请人工复核清零**,别留隐患。

---

## 6. 「富媒体化」到底做到什么程度(明确目标)

**每章目标图密度**(据篇幅,text 不动、纯加/升级图):
- **加厚章**(易经 64 卦 + 十翼 + 道德经 + 鬼谷子):目标 **5–8 图**,至少含 1 金句卡 + 按内容配 2–4 张结构/对比/流程图 +(易经)1 卦象图。
- **普通档**(道其余 129 + 儒 120 + 佛 63 + 诸子/谋略/中医等):目标 **3–5 图**,至少 1 金句卡 + 1–2 张按内容图。
- **短章**(单段小经):≥2 图即可。

**每张图必须**:
- 从**该章已有正文**里提炼(图是把某段已经说过的意思可视化,不引入正文没有的新说法);
- 自解释(不看正文也大致看懂它在说什么);
- 明暗自适应、移动端不溢出;
- 有恰当 ftype 标签 + 简洁 caption。

**优先级**(先易后难,先高价值):
1. **补空**:当前 0–2 图的章,补到目标下限;
2. **升级**:把粗糙/占位/纯文字堆的图重画;
3. **金句卡覆盖**:每章至少 1 张题眼金句卡(印章式,主色);
4.(可选)ftype 归一。

---

## 7. 验收环(每批必跑,红了不算完)

```bash
npm run content:build   # 把改过的 baihua json 重新拆成 public/content 小文件(必跑,否则前端读的是旧图)
npm run check-data      # 必须出「✓ 校验通过 … 0 坏引文」;figure 缺 svg=红,写死#色=软警告(清零)
npm run build           # 必须构建成功
npm test                # 应保持 278 通过(理论上不受影响,跑一下保险)
```
- **0 坏引文**是硬指标(证明你没碰正文/引文)。
- figure 相关:任何 `figure 缺 svg`=红,必须修;`SVG 疑写死颜色`=软警告,应清零。
- 可选人工:`npm run dev` 打开 `/dao/daodejing/1`(点开白话抽屉或整页 `/dao/daodejing/baihua/1`)肉眼看图;切暗色看反转;窄屏看不溢出。

---

## 8. Git 工作流 & 分批

- 新开分支,如 `richmedia/baihua`;**只改 `src/data/*/baihua/*.json`**(以及若你要跑生成脚本产生的 `public/content/` 是 gitignore 的构建物,不入库)。
- **按书/按组分批提交**(如"道德经配图升级""论语补图"),每批过 §7 验收才提交,便于回滚。
- 提交信息标明"仅动 figure、正文零改"。
- 不要碰:`scripts/`、`src/features/`、阅读器组件、check-data 本身——只动数据层 figure。

---

## 9. 一个最小样板(照抄这个风格)

一张"对比图"(有为↔无为),明暗自适应、无写死色、移动安全:

```html
<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:var(--font-serif)">
  <text x="300" y="34" text-anchor="middle" style="fill:var(--ink)" font-size="20">无为 ≠ 不做</text>
  <line x1="300" y1="56" x2="300" y2="230" style="stroke:var(--rule)" stroke-width="1"/>
  <rect x="30" y="70" width="240" height="140" rx="10" style="fill:color-mix(in srgb,var(--cinnabar) 8%,transparent);stroke:var(--rule)"/>
  <text x="150" y="102" text-anchor="middle" style="fill:var(--cinnabar)" font-size="17">妄为(硬掰)</text>
  <text x="150" y="140" text-anchor="middle" style="fill:var(--ink-soft)" font-size="14">逆着事物本性使劲</text>
  <text x="150" y="168" text-anchor="middle" style="fill:var(--ink-soft)" font-size="14">越用力越糟</text>
  <rect x="330" y="70" width="240" height="140" rx="10" style="fill:color-mix(in srgb,var(--azure) 8%,transparent);stroke:var(--rule)"/>
  <text x="450" y="102" text-anchor="middle" style="fill:var(--azure)" font-size="17">无为(顺势)</text>
  <text x="450" y="140" text-anchor="middle" style="fill:var(--ink-soft)" font-size="14">顺着本性推一把</text>
  <text x="450" y="168" text-anchor="middle" style="fill:var(--ink-soft)" font-size="14">不折腾反而成</text>
</svg>
```
对应块:
```json
{ "type":"figure", "ftype":"对比图", "svg":"<svg …>…</svg>",
  "caption":"「无为」不是不做,是不妄为——顺着事物本性去推,而非逆着硬掰。" }
```

---

## 10. 验收清单(交付前自查)

- [ ] 全程只改 `figure` 块;`git diff` 里没有任何 text/quote/refs/title/hero 的字节变化
- [ ] `check-data` 出「0 坏引文」且无 `figure 缺 svg`
- [ ] 无任何 `#hex` 颜色(软警告清零)
- [ ] 所有 svg 用 `style=` 上色(非 `fill=` 属性)、带 viewBox + width:100%
- [ ] 每章达 §6 目标图密度
- [ ] 各组红线在 figure/caption 上守住(中医尤其)
- [ ] `content:build` + `build` + `test` 全绿
- [ ] 按组分批提交,信息标明"仅 figure"
```
