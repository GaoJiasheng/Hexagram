# 观象 · 唯一 TODO

> **这是全站唯一的待办清单。** 后续所有进度更新只改这一份 —— 别再新开 TODO 文档。
> 其他 `docs/*.md` 只负责「**怎么做**」(作业标准、设计稿、上架文案),不负责「**还剩什么**」。
> 哪份管什么见 §六 文档地图。
>
> **别信本文的数字**(会过时)—— 先跑 §0 的脚本对现状。
> 最后通盘整理:**2026-11-19**(顶上「当前待办」重理,只剩没做完的;上一版搬去归档)。更早的整理记录见归档。

---

## ▶ 当前待办(2026-11-19 重理:只列没做完的;11-17 至 11-19 那一版原样搬到 `todo-archive.md`「2026-11-17 重理的当前待办」)

**现状(11-19 核过)**
- web **1.35.25** 在线(11-19):白话代理复核五批 1599 章、5779 处改动。
- iOS **1.35.24** 在售(11-19 查到 READY_FOR_SALE),App Store Connect 里没有在审的提交。
- App 比网页落后一版:1.35.25 的白话改动 App 里还没有。要跟进就打一个新包(`./ship-ios.sh` → `asc-release`),等 owner 开口。
- 每周一 9:00 有定时任务「观象 · 每周流量周报」,自动发报告给 owner;谷歌那块要等 B3 接入后才有数。
- **我这边没有不等 owner 就能开的活。** A–C 都要 owner 看、拍板或动手;D 是等数据或长期的事。

**A · 要 owner 看**
1. **白话复核结果**:`reports/baihua-review-2026-11.html`(可筛选,不入库)。改得对不对机器只保证没改坏;最需要抽的是标了「外部依据」的条目(代理凭记忆的他书原文 / 年代)。看完哪批不放心,可按批单独撤(每批一个提交)。
2. **收录**:`docs/indexing-check-2026-11-16.md` 文末三处(Search Console 的「网页」和「站点地图」、Bing 的站点地图);爬虫页面 11-17 已补站内链接,可对首页点一次「请求编入索引」。
3. **九月底 review 摘要**还没回的两节(`docs/review-2026-09-30-digest.md`):第二节四处看内容(易经两篇导读、观数三篇白话、学脉图八条虚线);第三节两处在手机上点(段尾小点、PWA 自动更新)。
4. **观数三份代理复核汇报**抽看:`docs/mingli-baihua-review-2026-10-01.md`、`-translation-review-`、`-doubt-review-`;11-17 导读订正的依据在 `docs/daodu-fixes-2026-11-17.md`。
5. **App 外壳二、三档的真机手感**(转场、返回回原位、标签记位、触感、外接键盘),iPad / iPhone 上用 1.35.24 走一遍。

**B · 要 owner 拍板**
6. ~~复核留下的两堆(存疑 1741 / 译文疑误 1056)~~ → **owner 11-19:不做**。留在 `reports/baihua-review-2026-11.html`,日后人眼通校时顺手参考。
7. ~~App 跟不跟 1.35.25~~ → **owner 11-19:跟进**。✅ 11-19 build 66 已上 TestFlight 并送审,WAITING_FOR_REVIEW,过审自动上架(发版说明 `docs/release-notes/1.35.25.md`)。
8. ~~GitHub 提交~~ → **owner 11-19:署名 Gao Jiasheng**。✅ 已提:[1c7/chinese-independent-developer#1883](https://github.com/1c7/chinese-independent-developer/issues/1883) · [ruanyf/weekly#13544](https://github.com/ruanyf/weekly/issues/13544)(去掉草稿里「纯前端静态站」「人工译注」两处不实说法,写明译注与白话主要由大模型生成、本人审校)。HelloGitHub owner 没答,未提。
9. ~~两个导航站~~ → **owner 11-19:不提**。

**C · 只有 owner 能做的外部事**
10. **百度**:在百度搜索资源平台验证站点,推送 token 写进仓库根目录 `.baidu.env`(`BAIDU_PUSH_TOKEN=…`);之后每次发版 `npm run baidu-push` 自动推。
11. **谷歌周报接入**:Google Cloud 建服务账号、启用 Search Console API,密钥存 `.search-console.json`,Search Console 里把该账号加为受限用户(步骤在 `scripts/weekly-report.mjs` 头注释)。
12. **四个平台首发帖**(V2EX / 即刻 / 豆瓣 / 知乎)由你发,隔几天一处;稿在 `docs/promotion-drafts.md`。
13. **T1** 大陆 4G 实测(含微信内置浏览器登录、验证码邮件是否进垃圾箱)。
14. **A5** 用手机在生产上走一遍注册和评论。
15. **T3** 关 Cloudflare Web Analytics(11-19 查线上首页,beacon 还在注入)。
16. **O7** 安卓 keystore:你生成并备份到本机之外,我就出 release APK(gradle 与 `.gitignore` 已备好)。
17. **O8** ICP 备案:先打电话问清护照持有人怎么做人脸核验。

**F · 新项目:观象 · 书桌(2026-11-22 立项)**
- 纯原生 iPhone / iPad 学习 App。方案 [`desk-app-plan.md`](./desk-app-plan.md),当前状态见其中「进度」一节。M0–M4 已完成(11-22),M5 白话深读在做。

- **详注主线**(owner 11-22:争取全部典籍、App 与网站都用):道德经 → 首发另五本 → 其余典籍。做法、顺序、规模与待办见 `desk-app-plan.md`「详注主线」。全站 254 万字,首发六本只占 6%;进其余典籍前先报实测消耗。
- **Codex 额度 11-23 01:18 用完,四条线都已停,18:27 之后可续**(owner 定:用完就停、记进度、恢复再跑;全部可续跑,已出的不重做):
  - 观书插画:`node scripts/desk/gen-art-guanshu.mjs --all --concurrency 3`(1828 张里出了 54 张;自带额度暂停,进度 `scripts/.cache/desk-art/books/paused.json`)
  - 典籍插画:`scripts/desk/art-run-all.sh 3`(73 本约 2200 张,出到道藏组中段;已有的图跳过)
  - 典籍图解:`scripts/desk/figs-run-all.sh 4`(约 8500 张里转了两千余张,儒家组已过大半;已转的跳过)
  - 观书图解:`node scripts/desk/figs-codex.mjs books --concurrency 3 && node scripts/desk/figs-apply.mjs books`(5736 张里已入库 3693 张)
  - 详注 11-23 起改由 Sonnet 做(Codex 做到《孟子》为止),不再占 Codex。
- **11-22 晚已发生产 1.35.26**:迁移 0007 已在远端 D1 执行(执行前核过表结构,12 条绑定原样保留),书桌服务端接口、六本内容包与白话包、273 张插画、详注层的网站显示都已在线。书桌 App 1.0.0 (1) 已上 TestFlight 内部测试(App Store Connect 记录 id 6837960311)。**还差**:owner 配 Apple 密钥三个 secret(注销时向 Apple 撤销授权用)、真机验三种登录与同步、送审。观象 App(套壳)要带上详注需另发一版 iOS。
- **书桌进度(11-22 晚)**:M0–M4 做完并入库(阅读器、六本内容包、深色、横屏双栏、划线批注、查书、账号与云同步、时长时钟、统计、每周目标、今日一章、学过 / 学完);M3 服务端代码已入库**未部署**(见上一条);六本插画 273 张已出(只在本机,未入库);M5 白话深读在做(内容包已带白话,图解结构化管线在试跑,格式见 `desk-baihua-spec.md`)。
- **书桌总待办(2026-11-23 owner 要求汇总;每项等他 trigger 再动,除非标了「在跑」)**
  - **A · 观书在书桌里的形态重做(owner 11-23 提,最要紧)**:现在脑图、全书总览、分章文章揉在一条目录里,体验差。要:① 全书层(脑图 + 总览 / 总纲)单独成区,分章内容才归目录管;② 为「读书消化」类书定一个互动更强的形态(标准层面:总览不再充当第 1 章;脑图 ↔ 章互跳;书首页重排),我先出方案再做;③ 改完重出 153 本书包、更新书房。
  - **B · 插画(全部 Codex 出)**:① 观书 153 本各一张封面、一张题图、每章一张按当章内容画的图,共 1828 张,已出 54 张;② 典籍 73 本约 2200 张,已出道藏组一部分;③ **owner 11-23:Codex 额度没恢复前,先把每张图的 prompt 整理好,额度一恢复就能直接出图**(现在是 Codex 边读材料边写 prompt,可改成 Claude 先写好、Codex 只出图,省 Codex 额度);④ 额度用完即停、记进度、恢复再续(脚本已支持);⑤ 成品放仓库会多约 400 MB,要不要改放对象存储或缩尺寸待定。续跑命令见下「Codex 额度」条。
  - **C · 详注长线**:见下条。另:鬼谷子补密度;大学、中庸是低密度那批,可重做。
  - **D · 发布线**:① 书桌 build 3(脑图页、79 部典籍、书包、书房)11-23 上传 TestFlight,owner 真机验:长按划线(含 iPad 右栏)、三种登录与同步、导入书包、书房加书、脑图;② owner 配 Sign in with Apple 密钥三个 secret;③ 书桌送审:商店文案定稿、送审测试账号、owner 说「送审」(清单 `desk-appstore.md` §4);④ 观象 App 1.35.28(详注 32 部)build 68 已上 TestFlight;**提审卡住**:1.35.26 还在 WAITING_FOR_REVIEW,苹果不许同时建新版本——等它过审上架后跑 `node scripts/asc-release.mjs 1.35.28 docs/release-notes/1.35.28.md`(或 owner 决定撤回 1.35.26 直接换 1.35.28)。
  - **E · 书桌 App 欠账**:默认封面五字书名溢出 · 生僻字「𩐈」各字体都是方框 · 统计页把已下载的书全读进内存 · iPad 横屏长译文框偶尔少一行 · 命理九本白话里的交互小件 446 处被去掉(没有原生实现)· 脑图「读这一章」偶发把节点收起(未复现,已加防护)· 没做 VoiceOver 全走查 · iPad 横屏诗体、默认封面深色没验 · 旧包读新书目只会平铺(发版要连带新包)。
  - **F · 书包标准 / 开放**:标准、工具、skill 已上线 `/desk/standard/`;skill 还没装到别的会话能用的位置(`~/.claude/skills/deskbook`,等 owner 说);脑图里被截短的长句节点是靠推断识别的,可加显式字段;节点没有稳定 id;网站上传页在观象 App 壳里不能用。
  - **G · 观象网站原有待办**:仍在本文件上方 A–D 各节(收录核查、百度 token、Search Console 接入、四平台首发帖、T1 / A5 / T3 / O7 / O8 等)。
- **详注 · 长线跟踪(owner 11-23 定)**:不赶工,长期补;**每次有新书的详注入库,都要让它在网站、观象 App、书桌 App 三处上线**(网站发生产;书桌走内容包,随网站发;观象 App 是壳,要打新包送审)。
  - 已完成 32 部 54.1 万字:易 6、道 15、儒 9、孙子、鬼谷子。
  - 还差 54 部 201.3 万字:命理 9 部 91.5 万 · 谋略 9 部 28.3 万 · 法 4 部 16.5 万 · 古文 2 部 13.7 万 · 中医 6 部 13.4 万 · 心学 2 部 8.7 万 · 墨 7.5 万 · 佛 10 部 7.3 万 · 诗词曲 4 部 7.3 万 · 兵 6 部 5.5 万 · 战国策 1.6 万。
  - 做法与实测:Codex 起草 + Codex 核查 + Opus 抽查最省也最好(Opus 抽查改动率约 1.4%,不占 Claude 额度),但 Codex 额度要先紧着插画;Claude 的做法是 Sonnet 起草(带 `notes-check.mjs` 自查保密度)+ Opus 全量核查,每万字约 0.6 个周额度点(Sonnet 自己核不住:颜氏家训 Sonnet 核后 Opus 仍改 5.9%)。红线重的中医、佛、谋略伪书整本过 Opus;命理最大,放最后。
  - 命令:`node scripts/desk/notes-prep.mjs <corpus>/<slug>` → `Workflow scripts/desk/notes-wf.js`(`{jobs:[{dir,book,n}]}`)→ `notes-apply.mjs` → `npm run check-data`;清单 `node scripts/desk/notes-run-all.mjs --list`。
  - 鬼谷子密度偏低(7.5 条 / 百字)待补;大学、中庸是早先低密度那批(7.5 / 8.4),可重做。
- **书桌 owner 11-22 晚回的**:鬼谷子封面 / 题图重出(已重出入库);插画成品入库(已入);换账号要先问一句(M6 做);M6 直接开,上架与提交审核放最后、能做的先做。**还等 owner**:挑 App 图标(四个候选 `scripts/.cache/desk-art/icon/`)、翻插画样张、送审前清单里只有他能做的几项(见 `desk-appstore.md` §4)。
- **书桌 M6(11-22 晚开)**:App 打磨与送审准备在做(换账号询问、字号、离线状态、各尺寸 iPad、关于页、隐私清单、商店截图、`ship.sh` 只写不跑);商店文案、隐私问卷、送审备注、送审前清单在 `desk-appstore.md`;隐私页已补「观象 · 书桌」一节(未发);待做服务端加固(Apple nonce、强制 PKCE、注销时向 Apple 撤销授权)。**送审等 owner 开口。**

**D · 等数据 / 可选 / 长期(我做,不急)**
- 大陆登录与邮件体验第二批,等 T1 的结果。
- 安卓 APK,等 O7。
- O11 观数备选书目(神峰通考等五部),可选。
- 诗词曲三组(唐诗 / 宋词 / 元曲 677 章)白话复核:owner 11-19 定不做。
- §三质量债和 D1 全站人眼通校:长期,读到哪改到哪。

---

## 2026-10-01 N 表收口后重列(留作记录)

> 已归档(95 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0. 先跑这个:确认现状

```bash
cd /Users/gavin/work/hexagram
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
print(f'争鸣 {len(json.load(open("src/data/debates/index.json"))["topics"])} 辩 · 书级导读 {len(glob.glob("src/data/*/daodu/*.json"))} 篇')
print(f'家级导读 {len(glob.glob("src/data/*/school.json"))} 篇(目标 10,易经不做)')
print('无白话的书:', gap or '无')
EOF
npm run check-data
```

**2026-08-16 快照**:典籍 **74 部** · 白话 **2031 章** · 观书 **146 本 / 1287 篇** ·
争鸣 **88 辩** · 书级导读 **69 篇** · 家级导读 **13 篇** · 名句集 **1236 句**(14 组全覆盖)·
概念聚类 **8 组** ·
iOS **build 51** / 版本 **1.33.0 —— 2026-08-19 已提交审核(WAITING_FOR_REVIEW)**;
1.32.0 已于 2026-08-18 上架(READY_FOR_SALE)。生产 `hexa.gavin.pub`(Cloudflare Pages),
**2026-08-19 已发线上,内容与代码追平**。

> ✅ **2026-08-08 已发线上,内容追平**(此前线上停在 08-02、落后 124 个提交:
> 整整三个组〔唐诗/宋词/元曲〕与道藏修心三种线上根本不存在)。
> 线上白话 1337 → **2031 章**。同批上线的还有 sitemap/robots/RSS/章末牌记/四屏首页。
> **以后内容做完记得发** —— 不发等于没做,读者看不到。

> 脚本现在只会报**一本**「无白话」:`zhongyi/nanjing`(81章)——
> **那是 owner 定的不做,不是缺口**。除它之外,**站内每一本该有白话的书都满了**。
> (脚本只判「文件在不在」、不判满没满;满没满另跑 §2.2 那张表。)

## 0.1 🆕 观数(命理学)+ 全站交互化 · **全量 TODO**(2026-09-19 owner 定:列全 → 我一路做成成品 → 他统一 review)

> 已归档(166 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0.15 ⏳ 1.34.0 **已提交审核**(2026-08-21)

> 已归档(13 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0.2 ✅ 1.33.0 **已上架**(2026-08-21)—— 一次过,没被拒

> 已归档(28 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0.3 ✅ 评论功能修复三连(2026-08-16)—— **它此前从来没成功过一次**

> 已归档(33 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0.4 ✅ 观书已改为管理员专属(2026-08-13 完成并上线)

> 已归档(24 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 0.5 队列 —— **2026-08-21 重整:进入沉淀期**

> 已归档(73 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

# 一、还卡着的(全是要你本人去外部控制台点的)

> 代码与内容都齐了。这一节里我替不了的部分已标「**你做**」。

## 1.1 App Store 上架 · 海外区(队列 #2)

> 已归档(119 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 1.2 邮件:以 `hexa@` 发信 + 评论通知(队列 #3 #4)

> 已归档(33 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 1.3 中国大陆区 —— **App 不上陆区了(owner 2026-08-08)**;网站 ICP 保留(队列 #5)

### ~~APP 备案 / 陆区上架 D1–D4~~ —— **作废,别再捡回来**

owner 2026-08-08 定:**iOS 不上中国大陆区**。原 D1–D4(拿 APP 备案号 → 收敛陆区文案
→ ASC 填备案号 → 勾回大陆)全部取消。销售范围保持已排除大陆的状态。

### 站点自身的**个人 ICP 备案** —— 保留,这是队列 #5

**与上面那条是两回事,别一起砍掉。** 这条是给**网站**用的:生产在 Cloudflare Pages,
大陆访问时快时慢,是 CF 免费版在大陆的常态、调不好。要稳只有备案 + 大陆 CDN 回源。

路线 [platform-upgrade-plan.md §3](./platform-upgrade-plan.md) 已定案,不必再决策:
选一家大陆云厂商作接入商 → 提交**个人**备案(身份证实名)→ 批下来给静态资源接大陆 CDN,
**API 仍留 Workers/D1,架构不动**。owner 已拍板:不注册企业/个体工商户、微信登录彻底放弃。

**审批以周计,建议早交、边等边做别的。**

**参考**:[appstore-china-icp.md](./appstore-china-icp.md)(其中 App 备案部分已作废,只看 ICP 部分)

---

## 1.4 安卓端(队列 #6)—— **2026-08-17 已立计划**

**执行计划:[android-plan.md](./android-plan.md)**(现状盘点 / 三个要写代码的地方 /
分阶段 / 安卓与 iOS 的差异清单)。总规划仍在 [mobile-app-plan.md](./mobile-app-plan.md)。

owner 拍板两条边界:**① 只做到「可安装的 APK」,不上 Google Play**;
**② 先走模拟器**,真机过两天到手再补一轮。

⚠️ **订正**:此前这里写「需本机装 Java + Android SDK」—— **SDK 那半是错的**,
`~/Library/Android/sdk` 早已装好(platforms 35/36、build-tools 35/36、cmdline-tools)。
**唯一缺的是 JDK 21**(`brew install openjdk@21`;Android SDK 不含 JDK,两回事)。

三个真正要写代码的地方(不是把 iOS 抄一遍):
1. **硬件返回键** —— 现在代码里一行没有,不处理就是按一下直接退出 App;
   且浮层(白话抽屉/搜索/设置/每日一辩)都 portal 到 body,返回键默认不认它们。
2. **观书隐藏入口** —— `appShortcuts.js:7` 写死 `!== 'ios'` 直接返回,安卓没有。优先级低。
3. **签名 keystore** —— **丢了不可恢复**(iOS 证书能重签,安卓不能),必须备份到
   本机之外,且 `.gitignore` 先加 `*.keystore`/`*.jks` —— **本仓库是 PUBLIC 的**。

> Google Play 若日后要上:个人账号需 **12 测试员 × 连续 14 天**封闭测试才能申请正式发布
>(政策改过几次,届时先在 Play Console 确认)。**出 APK 几天,上 Play 至少两周起。**

---

# 二、内容 —— **没有缺口了**

> 本章已归档 → [`todo-archive.md`](./todo-archive.md)(标题同名)。

## 2.0 三处封关(owner 2026-08-03 拍板,**别再当待办**)

> 已归档(13 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 2.4 把已有内容连起来 —— ✅ **两件都已完成(2026-08-08)**

> 已归档(24 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 2.3 2026-08-08 这一波新书 —— 三层已成,**只欠白话**

> 已归档(33 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 2.2 诗词曲三组 —— ✅ **四层全成(2026-08-07 收官)**

> 已归档(76 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 2.1 下次再产内容时记住的(经验留档,不是待办)

完整手册在 [batch-production-playbook.md](agent-specs/batch-production-playbook.md),这里只留最贵的几条:

- **机器校验一条事实错误都抓不到。** 引文子串/块型/字数全绿,不代表内容对。
  家级导读那批:兵篇自查揪出 8 处硬伤;谋略篇反过来纠正了派工里两处凭记忆写的托名对象
  (权谋术托张居正非岳飞、韬晦术托杨慎与苏轼无涉)。**扩这一层务必人读一遍。**
- **事实一律回站内核、引文一律脚本切片。** 争鸣那批救了三次:异体字「为**髙**必因丘陵」、
  底本作「茍得」非「苟」、『予子冠履』用双角引号 —— 手打全错。
- **派工必写「不许委派、交付即文件落盘」。** 踩过:agent 把活派给下级后提前返回,磁盘上只留空目录。
- **续写优于重跑。** agent 逐章落盘,撞额度只丢正在写的那一章;
  续写派工要写明「哪些文件已完成、一个字都不要改、只写缺的那几章」。
- **共享文件一律不让 agent 碰。** 观书用 `scripts/merge-books.mjs` 统一并入 index.json 并做落库体检;
  封面母题改外挂目录 `src/features/books/motifs/`(glob 自动收录),加书不再改共享文件。

---

# 二·五、我能自己推进的(不等 owner)

> 本章已归档 → [`todo-archive.md`](./todo-archive.md)(标题同名)。

# 三、质量债(机器产出,未经人眼通校)

内容由并发 workflow 产出 + 程序化装配,经第二代理校验但**未人眼通读**,横跨 67 部书。
**没有 deadline,是长期活。** 改完跑 `fetch-corpus <key>` / `data:fetch` + `check-data`。

> **2026-08-08 新加了两道机器闸门**,人眼通校时不必再管这两类:
> ① **全层覆盖审计** —— 逐部书查 原文/译文/注疏/延伸/白话/书级导读 六层,缺哪层报哪层
>    (译文比例低时直接提示「装配后是否忘了重跑 fetch-dao / fetch-corpus?」)。
> ② **导读「第 N 篇〈名〉」序号自核** —— 见 §3.7。

- **3.1 译文抽查校订** ★ —— 纠错译/漏译/臆增/生硬。重点:论语·孟子(歧解)、坛经(公案偈颂)、
  韩非子·墨经(名辩)、传习录(语录)。儒合朱熹《四书章句集注》、佛守字面直译、诸子守思想史立场。
- **3.2 注疏勘误与增补** ★ —— ① 训诂准确性、梵汉对音(佛);② **装配时被弃的锚**复看:
  儒 15 / 佛 2 / 诸子 14+1 / 新经 5(term 非原文子串);佛 22 条 note 曾在句读处被机器截断;
  ③ 选注非每段都有(墨子 491/585、传习录 635/967),关键未注段可补。
- **3.3 延伸质量复核** —— 脱锚分级(共识直写/考据标出处/存疑明示)是否到位,有无空泛说教。
- **3.4 铁律深度复核** —— 人读一遍:佛(不宣化/不下果报吉凶)· 诸子(不政治影射/不作权术教程)·
  中医(不诊疗)· 谋略伪书(不为伪书张目)。机器扫描已 0 真违规,人眼再确认潜伏表述。
- **3.5 注音抽查** —— 异读/破音字拼音。
- **3.7 事实性主张的机器化**(2026-08-08 起,已做成一条、验废一条)——
  机器校验一向只管「引文是不是原文子串」,管不了**事实主张**。已证明可行的是
  **有锚点的**那类:`check-data` 的「导读『第 N 篇〈名〉』序号自核」——序数后紧跟真实章题时可核,
  全站 349 处候选零误报,逮到跨两篇文档的同一个错。**已验废的**是无锚点的那类:
  「全书 N 篇」总数自核,claim 里的单位常与站内章单位不是一回事(长短经 64 篇归 10 卷、
  金匮 3 卷即 25 篇),噪声太大。**判据:主张里有没有一个能对回站内数据的锚。**
- **3.6 「注疏训释 vs 译文用词」冲突批扫** —— **需换思路,暂不做**。写过一版启发式
  (注疏核心训释词不见于译文即报),跑出 **9635 条候选、几乎全噪声** —— 正常换词意译也会命中。
  《匏有苦叶》`軓` 那处的真问题是**注疏与译文指了两样不同实物**,不是用词不同,这个启发式抓不住。

> **不算债**:富文本未命中的篇(白话约 29 章 / 观书约 101 篇)。规则找不到可转的结构就不转,
> 这是规格明写的分寸(「一整章一个新块都不加也正常」),**不要为了铺满而硬拆**。

---

# 四、零散增强

> 本章已归档 → [`todo-archive.md`](./todo-archive.md)(标题同名)。

## 4.1 待做

> 已归档(3 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 4.2 已完成 · 2026-08-08(独立站四件 + 首页)

> 已归档(21 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 4.3 已完成 · 2026-08-03

> 已归档(39 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 4.4 已完成 · 2026-08-02

> 已归档(20 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

## 4.5 已废弃(**别再捡回来**)

> 已归档(15 行)→ [`todo-archive.md`](./todo-archive.md) 同名小节。

# 五、工程上会重复踩的坑

> 只列**跨会话仍会再踩**的。一次性的坑写在上面对应条目里。

- **原生壳是「第二个 origin」,不是同源。** 2026-08-11 因此被 App Store 拒。
  代码里当时写着「前端与 API 同源,不需要 CORS」—— 那句话**只对网页成立**:
  壳里页面从本地包加载,origin 是 `capacitor://localhost`,调生产 API 属跨源,
  带 `X-Client`/JSON body 必触发 OPTIONS 预检,而预检没人应答就是 404 →
  fetch 在真正发出前就失败,界面只显示「Load failed」。
  **后果是 App 内登录/注册/评论/同步自上线起从没通过**,而阅读走本地包,所以自测永远发现不了。
  ⚠️ **凡是「只有装进壳才复现」的缺陷,一律补测试钉住**(`functions/api/cors.test.js`)。
- **`max-width` 不配 `margin:auto` 等于没居中。** 父元素若是普通 block,不会替子元素居中。
  更要命的是**验证方法会骗自己**:我当时比的是「各段之间左右边界是否一致」,
  它们全都一致 —— 但整块偏了 166px。
  **验居中一律拿 `documentElement.clientWidth / 2` 作参照**(要扣掉滚动条),别拿段与段互比。
- **给容器加 `align-self: stretch` 会掀翻既有的 `align-items: center` 布局。**
  同理,**把一批元素多包一层 `<div>`,它们就脱离了原父级 flex 的居中与 gap**。
  改布局前先问:这些元素原本**靠什么**在对齐?

- **配置错了却只回一句「请重试」,等于把 bug 藏两周。** 评论功能自上线起一直 403
  (Turnstile secret 配错),但界面上永远是那句「人机验证未通过,请重试」——
  访客以为自己没验过,站长以为没人评论。**凡是第三方校验,一定要把对方给的
  `error-codes` 分流成不同的话**:哪些是访客重试能好的、哪些是站长要去改配置的。
  同理,**失败后要重置控件**:Turnstile token 一次性、约 5 分钟过期,只在成功分支
  reset 会让控件一直显示绿色「成功!」而 token 早已作废,重试永远撞同一堵墙。
- **邮件/通知这类「拼出来的东西」,必须真渲染一遍再信。** 今天两条会点开 404 的死链
  (`/classics/hexagrams/1`、`/fo/xinjing/all`)都长得人模人样,**读代码看不出来**,
  是把邮件正文打印出来才发现的。凡是拼 URL / 拼文案,写个五行脚本把成品打出来看。
- **查 App Store 审核状态别靠翻邮件** —— 08-12 重交后又被拒,躺了 4 天没人知道。
  直接问 ASC API(`.ios-ship.env` 里的 key 就能查,注意账号下有多个 app,
  要按 `bundleId === 'pub.gavin.hexa'` 筛):
  `appStoreVersions` 的 `appStoreState` 与 `reviewSubmissions` 的 `state`
  ——`REJECTED` / `UNRESOLVED_ISSUES` 就是被拒了。**被拒原文在解决中心,API 取不到。**
- **`_redirects` 的 SPA 回退让任何不存在的路径都返回 200 的 HTML** ——
  拿 HTTP 码判断「部署成功了没」会被骗,**必须 grep 文件内容才作数**。
- **Cloudflare 边缘有传播延迟** —— 部署后第一次查自定义域可能还是旧 chunk,
  等一分钟再查;先用 `wrangler pages deployment list` 确认环境确实是 Production。
- **发 CF 前确认 `dist/sw.js` 在** —— `build:cap` 产出的是禁掉 service worker 的版本。
- **`wrangler pages secret put` 第一个参数是变量名不是值**,且**变量名不加密**。
- **wrangler 的 OAuth 登录态会过期**,过期后非交互环境直接报「需要 CLOUDFLARE_API_TOKEN」。
- **iOS 独有的显示问题在浏览器里一个都看不见** —— `env(safe-area-inset-*)` 恒为 0、
  `hover: none` 不匹配、`<button>` 的 UA 默认字色不同。**改动涉及这三样,必须上模拟器验。**
- **装配完译注延,必须 re-run `fetch-dao` / `fetch-corpus`** —— 译文的真源在
  `scripts/authored/*-translations.json`,不重跑就不会并进 `classics/*.json`,
  **页面上译文开关点开是空的**(道藏修心三种踩过,数据在库里躺着、一个字没显示)。
  `check-data` 现有「全层覆盖审计」会报这一条(译文比例低即提示)。
- **「手写 import + 手写映射表」的注册表会静默漏挂** —— `daoAnchored.js` 就这么把悟真篇
  漏了一整波:332 条注疏躺在数据里,**页面上一条都没渲染过**,加新书时才发现。
  **不报错、不报警、check-data 也管不着**(数据是齐的,只是没人 import)。
  已改 `import.meta.glob` 自动收录。**再见到这种「加东西要记得在某处登记一行」的地方,
  优先改成 glob**;改不了就在 check-data 里加一条「数据目录 ⊆ 注册表」的校验。
- **测试里写死内容数量,每加一本书就红一次** —— `booksIndex.test.js` 断言「道藏 12 部」,
  加三本道书即失败。**数量一律用下界 + 点名抽查关键条目**,别写等号。
- **`?p=` 分屏参数是 1 起不是 0 起**(`ClassicReader` 的 `part` 默认 1、取 `parts[part-1]`)。
  外部拼深链时按 0 起算会静默落到上一屏——名句集深链踩过。
- 其余通用坑(rAF 节流 / Hook 顺序 / `content-visibility` 裁剪 / SVG `var()` /
  繁简顺序 / 大小写不敏感 / 改真源不改生成物)见 **CLAUDE.md「工程上踩过的坑」**。

---

# 六、文档地图:哪份管什么

> **待办只记在本文。** 下面这些是「怎么做」的规格与留档,**不要在里面记进度**。
> 已完成的旧段落在 [todo-archive.md](./todo-archive.md)(2026-11-16 从本文原样搬出);更早的里程碑细节在 [status-archive.md](./status-archive.md)。

### 作业标准(动手前必读)
| 文档 | 管什么 |
|---|---|
| [school-intro-standard.md](./school-intro-standard.md) | **家级导读** SOP |
| [daodu-production-standard.md](./daodu-production-standard.md) | **书级导读** SOP |
| [books-production-standard.md](./books-production-standard.md) | **观书** SOP(十步清单 + 版权红线) |
| [agent-specs/batch-production-playbook.md](agent-specs/batch-production-playbook.md) | **批量并发生产**手册:编排 / 合并校验 / 内容质量 / 红线守法 |
| [richtext-rollout.md](./richtext-rollout.md) | 富文本块规格 + `reblock-auto` 用法 |
| [design-v22.md](./design-v22.md) | 白话模块 canonical 规格(§3.3b 块结构) |

### 上线与平台
| 文档 | 管什么 |
|---|---|
| [appstore-listing.md](./appstore-listing.md) | 上架**文案**(可直接粘贴);§三/四/五 已按 build 48+ 重写 |
| [appstore-runbook.md](./appstore-runbook.md) | 上架**逐步操作** + 被拒应对附录 |
| [appstore-china-icp.md](./appstore-china-icp.md) | 陆区 APP 备案 |
| [platform-upgrade-plan.md](./platform-upgrade-plan.md) | 登录 / 评论 / 统计的总规划 |
| [auth-comments-design.md](./auth-comments-design.md) | 登录 + 评论的分批实施细节 |
| [mobile-app-plan.md](./mobile-app-plan.md) | Capacitor / 安卓 |

### 选题与方法
| 文档 | 管什么 |
|---|---|
| [debates-roadmap.md](./debates-roadmap.md) | 争鸣选题铁律 · 概念索引法 · **已否决清单**(别再提)。代码也引它 |
| [books-roadmap.md](./books-roadmap.md) | 观书选书法(留作方法留档) |
| [expansion-ideas.md](./expansion-ideas.md) | 典籍拓展(Wave 1–8 已收官) |

### 历史报告 / 设计稿(**不是待办**)
- **审查报告**(所列各项均已实施):`product-ux-review.md` · `ux-review.md` · `ux-opportunities.md` ·
  `baihua-review-yidao.md`(被 `scripts/gen-polish-wf.mjs` 引用)
- **旧 plan**:`baihua-plan-next.md`(白话铺开的总 plan,已收官;CLAUDE.md 的历史条目引它)
- **设计稿** `design-v4..v22` / `yijing-design*` —— 里面的 `[ ]` 是当年的里程碑清单,
  **均已落地**,别误当待办

### 2026-08-02 已删除(内容全部收官且无处引用,git 历史可查)
`baihua-todo.md` · `todo-followup.md` · `baihua-richmedia-handoff.md` ·
`baihua-fine-grained.md` · `optimize-rufo.md` · `copy-review.md` · `content-qa.md`

---

_维护约定:改完任何一项,回来更新本文对应行。新开的活也写进这里,不要另起清单。_
