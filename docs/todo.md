# 观象 · 唯一 TODO

> **这是全站唯一的待办清单。** 后续所有进度更新只改这一份 —— 别再新开 TODO 文档。
> 其他 `docs/*.md` 只负责「**怎么做**」(作业标准、设计稿、上架文案),不负责「**还剩什么**」。
> 哪份管什么见 §六 文档地图。
>
> **别信本文的数字**(会过时)—— 先跑 §0 的脚本对现状。
> 最后通盘整理:**2026-11-16**(瘦身:已完成的旧段落原样搬到 [`todo-archive.md`](./todo-archive.md),这里只留标题和一行指路,所以别处写的「todo.md §0.1」之类仍找得到);上一次重列待办是 2026-11-15。

---

## ▶ 当前待办(2026-11-15 重列;下面 10-01 以来的各段留作记录)

**在途**
- iOS **1.35.19 build 61** 在审(WAITING_FOR_REVIEW,过审自动上架)。TestFlight 另有 **1.35.20 build 62**(外壳第二、三档 + 目录页批 5)与 **build 63**(再加震动插件 @capacitor/haptics)。owner 在 iPad 上验真机手感:回弹、横竖屏导航切换、安全区、推入 / 退回动画、返回回原位、点导航的轻震、外接键盘快捷键。**1.35.20 等 1.35.19 过审后再送审**(同时只能有一个版本在审)。
- web **1.35.21** 在线(11-15 深夜发,儒、道两组新首页)。**main 已到 1.35.22(五组新首页 + 小组首页两行 + 版本流变 61 本),只发了预览分支** https://preview-portal.hexa-gavin-pub.pages.dev ,**生产未动、iOS 包未打**——11-16 这两步都被权限检查拦下(owner 说的是「A 先做起来」,没有明说上线 / 打包),等 owner 明确开口:① 发生产 ② `./ship-ios.sh` 打 TestFlight。发生产时不必再 bump(1.35.22 还没上过线)。

**A · 我能做的** —— 11-15 两轮 + 11-16 一轮都做完了,**全在 main,生产未发**(等 owner 说「上线」/「打包」)。
- **11-16 做的**:① 新首页推到佛 / 兵 / 法 / 中医 / 谋略(七组 60 本);书少的组与一组一书的首页(心 / 墨 / 纵横 / 古文 / 诗词曲)加「接着读」「门道」两行 ② 版本流变条从 7 本推到 **61 本**(三个 opus 代理写、主会话核,1016 引文 0 坏)③ check-links 补「数据里的链接」④ 本文瘦身,旧段落搬 `todo-archive.md` ⑤ 1.35.22 发版说明。
- **11-16 给 owner 备好、等他一句话的**(都只是文档,数据没动):
  - `docs/ditiansui-publisher-note.md`:《滴天髓阐微》是**袁树珊 1933 年校订影印**,不是徐乐吾;必须改 5 句、建议改约 18 句,各配改后句子。**等 owner 回「同意」→ 我照表改。**
  - `docs/mingli-doubt-68-triage.md`:68(实 69)条存疑归五类——须他定 3 个读音(澄 / 冠带 / 煞)· 改弱 25 · 删 6 · 留 31 · 刊行者口径 2。**等 owner 回「照建议办」→ 我照表改。**
  - `docs/review-2026-09-30-digest.md`:九月底 31 条压成 9 处要他看的(三处「我拍的板」认不认)。
  - `docs/indexing-check-2026-11-16.md`:**谷歌 `site:` 零条、必应只收首页且是旧快照**;站点侧无阻挡。要他看 Search Console 三处。
  - `docs/promotion-drafts.md`:四平台首发帖 + 简介三档 + 可提交列表(稿中【确认】处要他定)。

> B–E 这几段 owner 11-16 让记成他自己的待办:已写进他的 Doris(四条「观象:…」任务,各带清单),这里留作对照。

**B · 推广(上线已一个月,可以看数据了)**
4. 先看 Search Console / Bing 收录与来源,再定:第二档 ⑦ 百度站长平台(owner 验证一次 + 自己填推送密钥)⑧ 每周流量周报(Search Console 只读授权一次);第三档 ⑨ 社区首发帖(V2EX / 即刻 / 豆瓣 / 知乎,我写稿 owner 发)⑩ GitHub awesome 列表 PR ⑪ 国学导航站提交。

**C · 内容质量,要 owner 看 / 拍板**
5. O1 review `docs/review-2026-09-30.md`(九月底那批)。
6. 观数三份代理复核汇报抽看:`docs/mingli-baihua-review-2026-10-01.md` · `-translation-review-` · `-doubt-review-`。
7. 拍板:《滴天髓阐微》刊行者口径(多章写徐乐吾,代理与底本框注指向袁树珊 1933 年刊行)· 跨章核后仍存疑的 68 条留不留 · 其他组要不要照观数跑一轮代理复核(费额度)。

**D · 只有 owner 能做的外部事**
8. T1 大陆 4G 实测(含微信内置浏览器登录、验证码邮件是否进垃圾箱)· T3 关 Web Analytics · A5 用手机在生产上走一遍注册 + 评论。
9. O7 安卓 keystore(生成后我出包上 Play 内测;安卓 App Links 也卡在这里)。
10. O8 ICP 备案(问清护照持有人的人脸核验)。

**E · 等数据 / 可选 / 长期**
- 大陆登录与邮件体验第二批(等 T1)· 研读统计 `reading_events` 滚存表(量起来再做)· O11 观数备选书目(可选)· D1 全站人眼通校(长期,读到哪改到哪)。

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
