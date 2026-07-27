# 观象 · 总 TODO(单一索引)

> 本文只记「还剩什么 / 卡在谁手上 / 从哪开工」;**详细工序在各专题文档里**,本文给指路。
> **别信本文的数字**(会过时)——先跑 §0 的脚本对现状。
> 最后核对:2026-07-27(HEAD `94be044`)。上一版是 2026-06-14 的旧清单,其中已完成项见 §6。

---

## 0. 先跑这个:确认现状

```bash
python3 - <<'EOF'
import json, glob, os
NEW={'list','callout','pull','steps'}
gap=[]
for f in glob.glob('src/data/*/classics/*.json'):
    c,s=f.split('/')[2], os.path.basename(f)[:-5]
    if not os.path.exists(f'src/data/{c}/baihua/{s}.json'):
        gap.append(f'{c}/{s}({len(json.load(open(f))["chapters"])}章)')
bh=rich=0
for f in glob.glob('src/data/*/baihua/*.json'):
    for ch in json.load(open(f)).values():
        bh+=1
        if any(b.get('type') in NEW for b in ch.get('blocks',[])): rich+=1
ba=br=0
for f in glob.glob('src/data/books/*/overview.json')+glob.glob('src/data/books/*/articles/*.json'):
    ba+=1
    if any(b.get('type') in NEW for b in json.load(open(f)).get('blocks',[])): br+=1
print(f'典籍 {len(glob.glob("src/data/*/classics/*.json"))} 部 · 白话 {bh} 章(富文本 {rich})')
print(f'观书 {len(glob.glob("src/data/books/*/"))} 本 {ba} 篇(富文本 {br})')
print(f'争鸣 {len(json.load(open("src/data/debates/index.json"))["topics"])} 辩')
print('无白话的书:', gap or '无')
EOF
```

---

## 1. 卡在 owner(外部账号/审批,我替不了)

### 1.1 登录 + 评论上生产 ⬅ **最该先办**
八批代码 2026-07-19 已全部完成、逐批 review + 本地验证,**至今未上生产**。
详见 [platform-upgrade-plan.md §8](./platform-upgrade-plan.md)、[auth-comments-design.md](./auth-comments-design.md)。

| | 事项 | 性质 |
|---|---|---|
| 8.1 | Google OAuth 客户端 | 阻塞 Google 登录 |
| 8.2 | **Cloudflare Turnstile 生产站点** | **硬阻塞,不可跳过** |
| 8.3 | Resend 邮件账号 | 可跳过,只影响「有人评论了」的通知邮件 |
| 8.4 | 部署后用自己邮箱注册正式账号 → 我执行 `is_owner=1` | 部署后的收尾 |

> ⚠️ 8.2 的分量:`src/features/comments/config.js` 现在配的是 Cloudflare **官方测试 sitekey**
> (`1x00000000000000000000AA`,永远直接判过),本是给本地开发跑通链路用的。
> **不换成真凭证就上线,评论区等于完全没有机器人防护。**

拿到凭证后我这边:换 sitekey → 配环境变量 → 跑生产 D1 迁移 → 部署。

### 1.2 App Store 上架(海外区)
截图 + ASC 填表 + 提交审核,见 [appstore-runbook.md](./appstore-runbook.md)。
⚠️ **该 runbook 已过期**(写着「选 build 10」,现已 40+;「拖 dist 到 CF 后台」,现走 wrangler)。
开工前先让我刷新一遍再照做。

### 1.3 安卓端
需本机装 Java + Android SDK,方案见 [mobile-app-plan.md](./mobile-app-plan.md)。iOS 已 TestFlight 内测。

### 1.4 域名个人备案(大陆区)
Phase 3,与上面三项**不构成阻塞**,可并行办。

---

## 2. 内容缺口(我可以直接开工)

### 2.1 白话
| 书 | 量 | 背景 |
|---|---|---|
| 中医 · 难经 | 81 章 | 中医组最后一部(素问/灵枢/伤寒论/本草经/金匮均已铺完) |
| 儒 · 诗经余下 | 226 首 | 已做精选 79 首(**诗级粒度**,一诗一篇,键用「组-序」) |
| 道 · 悟真篇 | 6 章 | Wave 7 收原文时 owner 定「白话暂不铺」 |

### 2.2 《赛博·百家争鸣》B 级 5 题
现 75 辩,`planned` 已清零。剩下的都是**两方明文确凿、第三方锚点未坐实**——
按 owner 铁律「不为凑 topic 硬拼」,须先 grep 找到真章句才能开工:
志功·动机与效果 / 师法与自得 / 统类与推知 / 农战与末业 / 独与群。
方法(概念索引法)与已否决清单见 [debates-roadmap.md](./debates-roadmap.md)。

### 2.3 观书选书
[books-roadmap.md](./books-roadmap.md) 的三簇 14 本(人类学/补薄标签/尼采)**已全部收官**,现 112 本。
**下一批选什么待 owner 定方向**,或让我按现有标签分布提候选。

---

## 3. 质量债(机器产出,未经人眼通校)

内容由并发 workflow 产出 + 程序化装配,经第二代理校验但**未人眼通读**。横跨 67 部书。
改完跑 `fetch-corpus <key>` / `data:fetch` + `check-data`。

- **3.1 译文抽查校订** ★ —— 纠错译/漏译/臆增/生硬。重点:论语·孟子(歧解)、坛经(公案偈颂)、
  韩非子·墨经(名辩)、传习录(语录)。儒合朱熹《四书章句集注》、佛守字面直译、诸子守思想史立场。
- **3.2 注疏勘误与增补** ★ —— ① 训诂准确性、梵汉对音(佛);② **装配时被弃的锚**复看:
  儒 15 / 佛 2 / 诸子 14+1 / 新经 5(term 非原文子串);佛 22 条 note 曾在句读处被机器截断,可能生硬;
  ③ 选注非每段都有(墨子 491/585、传习录 635/967),关键未注段可补。
- **3.3 延伸质量复核** —— 脱锚分级(共识直写/考据标出处/存疑明示)是否到位,有无空泛说教。
- **3.4 铁律深度复核** —— 人读一遍:佛(不宣化/不下果报吉凶)、诸子(不政治影射/不作权术教程)、
  中医(不诊疗)、谋略伪书(不为伪书张目)。机器扫描已 0 真违规,人眼再确认潜伏表述。
- **3.5 注音抽查** —— 异读/破音字拼音。

> **不算债**:富文本未命中的篇(白话 ~29 章 / 观书 ~101 篇)。规则找不到可转的结构就不转,
> 这是规格明写的分寸(「一整章一个新块都不加也正常」),不要为了铺满而硬拆。

---

## 4. 学习层增强(旧清单遗留,均未做;做不做由 owner 定)

- **各组导读页** —— 对标易经学堂/道藏题解:四书/释典/心学/诸子各家的源流与读法,思想史角度。
- **名句集** —— 对标「今日一卦」:论语「学而时习之」、金刚经「应无所住」…(分享卡 `QuoteCard` 已有,缺集子)
- **思想史 / 人物谱** —— 现仅易经有源流页 + 人物志(`renwu.json`);儒道统、佛译场与禅宗祖师、
  诸子学派谱系均无。守佛/诸子铁律,纯思想史。
- **长章内锚点** —— 现 TOC 到篇/卷/品级;长章(坛经机缘品 175 段、荀子大略 109 段)章内跳转。
- **孟子章号体例** ◆ —— 现按 14 卷,可加「梁惠王上·N」式章号便于引用(论语章号已加)。

---

## 5. 文档过期,待刷新

| 文档 | 过期处 |
|---|---|
| `appstore-runbook.md` | build 号(10 → 40+)、部署方式(CF 后台拖 dist → wrangler) |
| `CLAUDE.md` | 「中医组仍剩伤寒论/本草经/金匮/难经共 146 章未铺」→ 实际只剩难经 81 |
| `CLAUDE.md` 部署节 | 「owner 用 CF 后台拖 dist」→ owner 2026-07-14 改口用 wrangler CLI |
| `richtext-rollout.md` | 计数(927 章/922 篇)→ 现 1006/1034;§4 §5 均已收官 |
| `baihua-todo.md` | 整份已完成,可归档 |
| `todo-followup.md` P3 | 「佛/儒 hasSearch=false 未进搜索」→ v1.22.0 早已接入 |

---

## 6. 已收官(留档,别再当 TODO)

- **富文本化 v22.1** —— 白话 + 观书全量铺完;**新文章由生成规格自带**
  (`gen-baihua-wf.mjs` 的 `RICHSPEC` + `books-production-standard.md §6` + `design-v22 §3.3b`)。
  存量工具 `scripts/reblock-auto.mjs` + 护栏 `scripts/verify-reblock.mjs`;
  **新加书跑一句 `reblock-auto --write` 再过护栏即可**。详见 [richtext-rollout.md](./richtext-rollout.md)。
- **典籍拓展 Wave 1–8**(`expansion-ideas.md`)、**观书路线图 14 本**、**争鸣 A 级 16 题**
- **产品/UX/国学 review 18 项**(`product-ux-review.md`)
- 旧清单里的:全站搜索接入(v1.22.0 全站可搜、非「仅易经」)、术语表/概念页(`/concepts`)、
  门户印章按组着色(v1.57.0)、多域名分发(已改 `hexa.gavin.pub` 单域名路径分组,`HOST_GROUPS` 不再需要)
