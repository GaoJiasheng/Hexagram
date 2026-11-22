# 详注层(全站)—— 数据、管线、显示的统一约定

> owner 2026-11-22:详注争取所有典籍都做,做完后**网站与所有 App 都要用上**;首发六本之后的全站批量不必再逐批确认。
> 起源与样例见 `docs/desk-app-plan.md`「详注主线」。本文件是管线、打包、网站显示三方共用的唯一约定。

## 1 · 是什么

比站内简注(`zhushi-anchored`,每条 ≤ 40 字)多且详的一层注释:每百个原文字 12–14 条,每条

```json
{ "k": "被注的词", "d": "一句话释义(≤ 40 字)", "x": "展开(40–150 字)", "r": "读音(可选)" }
```

- `k` 必须是所在段原文的**精确子串**;同一段各条按「在原文中第一次出现的位置」互不重叠、不重复。
- 口径:训诂、思想、史实、源流;有争议并陈不裁断;守各组红线(`scripts/lib/baihua-redlines.mjs` 的 `redlines(slug)`:中医不述功效、观数不断命、伪书不张目、佛不宣化……);外部说法(异文、某注家、见某书)拿不准就不点名、不加引号。

## 2 · 真源(按站内坐标存)

`src/data/<corpus>/xiangzhu/<slug>.json`

- **读经类(corpus 各站与道藏)**:`{ "<章号>": { "<段下标,0 起>": [ {k,d,x,r?}, … ] } }`,章号、段下标与 `src/data/<corpus>/classics/<slug>.json` 的 `chapters[].no`、`paragraphs[]` 一致。
- **易经十翼五种**(`xici-shang` `xici-xia` `shuogua` `xugua` `zagua`):同上。
- **易经六十四卦**:`src/data/yijing/xiangzhu/hexagrams.json`,`{ "<卦序 1–64>": { "<部位键>": [ … ] } }`,部位键:

| 键 | 对应 `hexagrams.json` |
|---|---|
| `judgment` | 卦辞 `judgment.original` |
| `tuan` | 彖 `tuan.original` |
| `daxiang` | 大象 `daxiang.original` |
| `l1`…`l6` | 爻辞 `lines[i].original`(初爻为 1) |
| `x1`…`x6` | 小象 `lines[i].xiaoxiang.original` |
| `use` / `xuse` | 用九 / 用六 `extra.use.original` 及其小象 |
| `w0` `w1` … | 文言 `extra.wenyan[j].original` |

没有详注的章 / 段 / 部位不写键。文件按章号数值升序、1 空格缩进输出,便于 diff。

## 3 · 闸(check-data)

`scripts/lib/check-xiangzhu.mjs`,挂进 check-data,逐条核:

1. 坐标存在(章、段 / 部位在原文数据里找得到)。
2. `k` 是该处原文子串;同处各条按首次出现位置不重叠、`k` 不重复。
3. `d` 1–40 字;`x` 40–150 字(字数按 Unicode 码点);`r` 有则非空。
4. 只许 `k d x r` 四个字段。

不过的条目是错误(check-data 失败),不是警告。

## 4 · 生产管线(`scripts/desk/notes-*.mjs`,按站内的书跑)

```
node scripts/desk/notes-prep.mjs <corpus>/<slug> [--size 1300]     # 备料:读 src/data,跳过已有详注的章,切单元 → scripts/.desk-notes/<corpus>--<slug>/in/uNNN.json + args.json(带 redline)
node scripts/desk/notes-codex.mjs <corpus>/<slug> [--concurrency 4]  # 本机 Codex 起草 → out/uNNN.json
node scripts/desk/notes-codex.mjs <corpus>/<slug> --verify            # 本机 Codex 核查(另起一次会话,就地改 out 文件;与 notes-wf.js 的 VERIFY 同标准)
node scripts/desk/notes-apply.mjs <corpus>/<slug>                     # 机器校验后并入 src/data/<corpus>/xiangzhu/<slug>.json
```

- 易经的写法:`yijing/hexagrams`、`yijing/xici-shang`……
- 单元里每个 item 带站内坐标(`ch` + `seg`,易经卦为 `ch` + 部位键)。
- **核查(owner 2026-11-22 晚定「中间那档,质量不必拉太高」)**:Codex 起草 → Codex 核查全量 → 机器闸 → 入库;之后主会话再用 Opus 复核一部分:
  - 中医、佛、谋略伪书(`dubious` 的五部)三类**整本**过 Opus(红线重:不述功效、不宣化、不为伪书张目);
  - 观数(91.5 万字)抽两成;其余各组抽一成;抽查改动率 > 3% 的书整本补跑。
  - 做法:`node scripts/desk/notes-sample.mjs <corpus>/<slug> [--frac 0.1|--all]` 选单元并备份现稿 → `Workflow scripts/desk/notes-wf.js`(`verifyOnly`)→ `notes-sample.mjs … --report` 看改动率 → `notes-apply.mjs` 重新并入。
  - 起草一直用 Codex;Codex 额度用完再改 Sonnet 起草(`notes-wf.js` 不带 `verifyOnly` 即 Sonnet 起草 + Opus 核查)。
- 全站连跑:`scripts/desk/notes-run-all.mjs`(按 §6 的顺序一本一本跑,可中断续跑,状态记在 `scripts/.desk-notes/run-all.json`)。

## 5 · 谁在用

- **书桌 App**:`scripts/build-desk-packs.mjs` 按每章的 `src {corpus, slug, ch}` 取详注并进内容包(详注优先,位置不重叠的简注照留)。
- **网站(及观象 App,它是网站的壳)**:`scripts/build-content-assets.mjs` 把真源拆成 `public/content/xiangzhu/<corpus>/<slug>/<章号>.json`(易经卦:`…/yijing/hexagrams/<卦序>.json`)+ 一份 `public/content/xiangzhu/index.json`(哪本书哪些章有详注)。阅读页打开一章时按需取这一章的分片,与简注合并(同上规则)后挂到原文上;气泡里先显示释义,下面是「展开」一段。设置里的注释开关同时管两层。

## 6 · 全站顺序

首发六本(道德经、孙子、鬼谷子、论语、周易、庄子)→ 道藏其余 → 儒 → 佛 → 兵 / 法 / 墨 / 纵横其余 → 心 → 古文 → 诗词曲 → 中医 → 谋略 → 观数(91.5 万字,最大,放最后)。
