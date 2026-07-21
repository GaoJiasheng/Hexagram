# 观书 · 选书路线图与接力说明(TODO)

> 「观书 · 私人书房」(隐藏入口 `/books`)持续扩充的**待做书单 + 接力工作法**。
> 任何 session(含新开的 Claude 会话)想续做观书,从这份文档起步。
>
> - 做一本书的**唯一作业标准(SOP)**:[books-production-standard.md](books-production-standard.md)(§0 四产物 / §1 版权红线 / §3 index schema / §5 脑图 / §6 block schema / §7 总览 / §8 章节 / §10 十步清单)。本文不重复 SOP,只补「选哪些书 + 怎么把一批书稳稳产出来」。
> - 产品/UI 设计:[study-feature-design.md](study-feature-design.md)。

---

## 0. 先做这一步:别信任何书单,查 `index.json`

**哪些书已经做完,唯一真相是 `src/data/books/index.json`,不是这份文档、也不是任何记忆。** 书单会随时推进,写死在文档里必然过时。开工前先跑:

```bash
# 已收录总数 + 全部书名
python3 -c "import json; d=json.load(open('src/data/books/index.json')); print(len(d),'本'); [print(b['slug'],b['title']) for b in d]"
# 某本是否已做完(目录文件数是否 = chapters 数)
ls src/data/books/<slug>/articles/ | wc -l
```

下面「待做书单」里的书,若已在 `index.json` 出现,就是**已完成、跳过**。

**截至最后更新(见文末),已收录 98 本**,其中 2026-07 完成的**社会学 14 本**成规模:社会学的想象力 / 新教伦理与资本主义精神 / 自杀论 / 日常生活中的自我呈现 / 独自打保龄 / 论美国的民主 / 社会分工论 / 孤独的人群 / 街角社会 / 菊与刀 / 流动的现代性 / 黑人的灵魂 / 规训与惩罚 / 社会理论与社会结构。

---

## 1. 待做书单(owner 已倾向、按簇组织)

### 簇 A · 人类学经典(社会学的姊妹学科,首选下一簇)

| slug 建议 | 书 | 作者 | 备注 |
|---|---|---|---|
| `xiangtu-zhongguo` | 乡土中国 | 费孝通 | 中国自己的社会学/人类学奠基作,「差序格局」;文化共鸣最强,**无额外红线,可放手写** |
| `youyu-de-redai` | 忧郁的热带 | 列维-斯特劳斯 | 结构人类学 + 文学杰作;与菊与刀正好对照 |
| `wenhua-de-jieshi` | 文化的解释 | 克利福德·格尔茨 | 「深描」范式 |
| `liwu` | 礼物 | 马塞尔·莫斯 | 礼物交换/互惠理论源头,接街角社会的互惠网络 |
| `jiejing-yu-weixian` | 洁净与危险 | 玛丽·道格拉斯 | 洁净/污秽、禁忌、分类如何组织世界观 |

> owner 未定序时的默认打头:**费孝通《乡土中国》+ 列维-斯特劳斯《忧郁的热带》**(一中一西、共鸣最强)。

### 簇 B · 补最薄的标签(文学 / 科学 / 政治哲学 / 经济思想)

现全站最空的两格是**文学(仅 3)**与**科学(仅 5)**。强单本候选:

| slug 建议 | 书 | 作者 | 补的标签 |
|---|---|---|---|
| `guojia-weishenme-shibai` | 国家为什么会失败 | 阿西莫格鲁 等 | 政治/经济;接《贫穷的本质》,2024 诺奖 |
| `jiyin-zhuan` | 基因传 | 悉达多·穆克吉 | 科学;接《自私的基因》,叙事体 |
| `zhengyi-lun` | 正义论 | 约翰·罗尔斯 | 政治/哲学;接《论美国的民主》《极权主义的起源》 |
| `xixifu-shenhua` | 西西弗神话 | 加缪 | 哲学×文学;存在主义,短而强 |

（这几本 slug/accent/motif 均**未预置**,做前需按下节流程新建母题。）

---

## 2. 敏感题材必须加批判性框注(硬规矩)

凡「用外部视角概括一整个文化/民族」的书(尤其早期人类学、战时国民性研究),站内分析声音要**比原著更审慎**,照《菊与刀》的做法:

- 第一章如实交代方法论局限(未做本土田野 / 战时委托 / 材料经中介筛选等),不美化;
- 争议观点讲「概念本身」与讲「它受的批评」**给同等篇幅**,不是一笔带过;
- 具体史实/因果拿不准,一律用「据称」「有观点认为」「有学者认为」审慎措辞,**绝不编造**精确年代人名;
- 全篇不用贬义/猎奇/刻板印象措辞。

**簇 A 里费孝通、莫斯、道格拉斯无此风险,可正常写**;忧郁的热带、以及任何涉及殖民/异文化凝视的,酌情加。已落地范例:`src/data/books/ju-yu-dao/`(菊与刀)、`heiren-de-linghun/`(黑人的灵魂)。

---

## 3. 一本书的产出流程(本轮 16 本验证有效)

1. **建封面母题**(SOP §0):在 `src/features/books/BookCover.jsx` 里,`function Motif({ motif })` **之前**加一个母题组件(纯 SVG,只用常量 `CREAM`/`CINNABAR`/`rgba(...)`;画布 viewBox `0 0 300 420`,母题落在 x≈50–240、y≈250–370,**避开左上朱印**〔26,26–60,60〕**和右侧竖排书名区**);再在 `Motif` 分发器顶部加 `if (motif === '<key>') return <Xxx />`。挑一个 accent 色(与既有 book 不撞,近期用色见 index.json)。`npm run build` 过一遍确认能编译。
2. **派 agent 产出**(用 Opus):一本书一个 agent,prompt 里必须写清——① SOP 与 2 个参考实现要通读(`dierzuoshan/` + 最近做完的一本);② 7 章的章题与每章核心论点/易错点;③ **篇幅硬指标**:overview 8000–9500 字(有 hero)、每章 3800–4500 字(无 hero,硬顶 4800),**要求 agent 逐篇边写边用 python3 数字符自查、超顶当场削减**(否则常写超,历史上《论美国的民主》超过一次靠手工削);④ 版权红线(引文 `quote.original` ≤100 字/条、≤16 条/篇,原创消化非摘抄);⑤ 中文用「」不用弯引号;⑥ figure SVG 上色用 `style="fill:var(--cinnabar)…"` **不能**用 `fill="var(...)"` 属性;⑦ 预置的 accent + motif;⑧ index.json 追加条目的 schema。派完 agent 的 prompt 模板可直接抄本轮任一本(见 git log `feat(books): 观书上架…` 提交)。
3. **独立核验**(别只信 agent 自报,逐项自己跑):见下节脚本。
4. **浏览器走查封面**:`preview_start name=dev` → `/books/<slug>` 截图,确认母题渲染、书名不被截断、accent 正确。
5. **提交**:`git add` 只加**这本书的目录 + index.json + BookCover.jsx**(仓库里可能有 pre-existing 未提交改动,**别 `git add -A` 扫进来**);提交信息 `feat(books): 观书上架《书名》(作者·标签)` + 简述核心论点与红线处理。

### 核验脚本(每本必跑)

```bash
SLUG=<slug>
# JSON 合法 + index 合法
for f in src/data/books/$SLUG/*.json src/data/books/$SLUG/articles/*.json src/data/books/index.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))" && echo "OK $f" || echo "FAIL $f"; done
# 字数(排除 svg)+ hero + 引文条数长度
python3 - <<EOF
import json,re,glob
def tlen(o):
    n=0
    def w(x):
        nonlocal n
        if isinstance(x,dict):
            for k,v in x.items():
                if k!='svg': w(v)
        elif isinstance(x,list):
            [w(v) for v in x]
        elif isinstance(x,str): n+=len(re.findall(r'[一-鿿]',x))
    w(o); return n
def quotes(o,a):
    if isinstance(o,dict):
        if o.get('type')=='quote': a.append(o)
        [quotes(v,a) for v in o.values()]
    elif isinstance(o,list): [quotes(v,a) for v in o]
b='src/data/books/$SLUG'
ov=json.load(open(f'{b}/overview.json')); q=[]; quotes(ov,q)
print('overview hero:','hero' in ov,'chars:',tlen(ov),'quotes:',[len(x.get('original','')) for x in q])
for i in range(1,8):
    a=json.load(open(f'{b}/articles/{i}.json')); qq=[]; quotes(a,qq)
    print(f'art{i} hero={"hero" in a} chars={tlen(a)} quotes={[len(x.get("original","")) for x in qq]}')
EOF
# 图色不能用 fill="var / 不能有弯引号
grep -rn 'fill="var' src/data/books/$SLUG/ || echo "fill=var clean"
python3 -c "import glob;[print('CURLY',f) for f in glob.glob('src/data/books/$SLUG/**/*.json',recursive=True) if '“' in open(f).read() or '”' in open(f).read()]"
# mindmap 非根节点 ref 覆盖率应 ~100%(只有根节点允许无 ref)
npm run build 2>&1 | tail -3
```

**通过标准**:overview 有 hero、8000–9500 字;每章无 hero、3800–4800 字;引文每条 ≤100、每篇 ≤16 条;`fill=var` 与弯引号零命中;mindmap 仅根节点无 ref;build 无错。**内容准确性**另需人读关键章:概念归属对不对(借用/改造的概念别误植为作者原创)、易错点框注在不在、敏感题材分寸够不够。

---

## 4. 双并发(一次写两本)——2 本已验证可行

owner 常说「双并发写前两本」。做法:同一条消息里发**两个独立 Agent**(各写一本、都 `run_in_background: true`)。要点:

- **两本会同时追加同一个 `index.json`**。prompt 里必须要求 agent:「追加前重读文件最新内容 → 程序化 splice 插到末尾 `]` 前 → 写后复查两本条目都在、无重复 slug」。本轮 4 组双并发实测均干净落地(无覆盖、无重复)。
- 收尾核验时务必确认:`python3 -c "import json;d=json.load(open('src/data/books/index.json'));s=[b['slug'] for b in d];print(len(d),[x for x in set(s) if s.count(x)>1] or 'no dup')"` —— 两本都在、零重复。
- 两本共享一次 index.json 改动,**一个提交把两本一起提**比人为拆开更干净。
- **3 本及以上是否还稳、未验证**;量更大时先按脚本核对每本文件数,别默认并发规模能无限放大(见 memory `books-batch-production-notes`)。

---

## 5. 上线(可选,owner 说「四件套」才做)

写完书**默认只提交本地**。owner 说「四件套」= 提交 + push + TestFlight + 部署 CF,才执行:

```bash
git push origin main
./ship-ios.sh              # 后台跑,bump build 号→归档→上传 TestFlight→自动加内部测试组
npm run deploy:cf          # = build + wrangler pages deploy dist(线上 hexa.gavin.pub)
# ship-ios.sh 跑完后:提交它 bump 的 ios/App/App.xcodeproj/project.pbxproj + Info.plist,再 push
```

细节见 [appstore-runbook.md](appstore-runbook.md) 与 CLAUDE.md「部署」节。

---

_最后更新:2026-07-20(社会学 14 本完成、观书共 98 本;人类学簇待开工)。更新本文时请同步「已收录 N 本」与完成清单,但真相永远以 `index.json` 为准。_
