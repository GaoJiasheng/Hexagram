# 观象 · App Store 上架执行手册(runbook)

> ℹ️ **进度不记在本文** —— 勾选状态以 [todo.md §1](./todo.md) 为准;本文只提供操作步骤与可粘贴文案。

> 配套文档:文案素材见 [appstore-listing.md](appstore-listing.md);大陆区 APP备案见 [appstore-china-icp.md](appstore-china-icp.md)。
> 本手册是**执行顺序**:从上到下照做,`[ ]` 打勾。标 **【你做】** 的是账号/后台操作(只能你本人);标 **【已就绪】** 的是我已经备好、你直接用。

---

## 0. 现状快照(已就绪的部分)

- **【已就绪】** Apple 开发者账号 · Team `D33974QQTD`
- **【已就绪】** App 记录已存在(在 TestFlight 能看到「观象」)
- **【已就绪】** 构建 **build 45** 已上传并进内部测试组(build 号每次 `./ship-ios.sh` 自增,以 TestFlight 实际最新为准)
- **【已就绪】** Bundle ID `pub.gavin.hexa` · 显示名「观象」
- **【已就绪】** 出口合规声明(Info.plist `ITSAppUsesNonExemptEncryption=NO`)
- **【已就绪】** 隐私政策页代码(`/privacy`)——但**需先把 dist 发到 CF 才线上可访问**
- **【已就绪】** 列表文案全套(中英)+ Review Notes,见 appstore-listing.md
- **无账号系统** → 不需要演示账号、不涉及 Sign in with Apple
- **待办**:① 发 dist 让隐私 URL 生效 ② 截图 ③ 大陆区 APP备案 ④ ASC 填表提交

## 决策:先发海外区,大陆区并行/后补(推荐)

你已定「含中国大陆」。但大陆区要 APP备案号(gavingao.cn 域名已备案 → 只需加一道轻量 APP备案,仍要几天)。**为不被备案卡住:**
- **先提交「除中国大陆外的全球区」**——素材齐,今天就能交,审核最快。
- **大陆区并行办 APP备案**(阶段 D),拿到备案号后,把中国大陆加进销售范围,提交一个小版本更新即可。
> 两步不冲突。若你坚持首发就含大陆,则必须先完成阶段 D 拿到备案号,再走阶段 B。

---

## 阶段 A · 上线前素材与部署(可并行,约 0.5–1 天)

- [ ] **A1【已就绪】发 web 到 Cloudflare**——`npm run build && npx wrangler pages deploy dist --project-name=hexa-gavin-pub`(owner 2026-07-14 起改用 CLI,不再拖后台;我可直接执行)。
- [ ] **A2【验证】** 浏览器打开 `https://hexa.gavin.pub/privacy`,确认隐私政策页能打开(这是 ASC 必填项的前提)。
- [ ] **A3 截图**(iPhone 6.9″ + iPad 13″ 各一套,每套 3–10 张)——两条路二选一:
  - **让我拍**:我装 build 到模拟器逐屏截给你选(你只需定明/暗、拍哪几卦);或
  - **【你做】自拍**:照 appstore-listing.md §六 的 `xcrun simctl io booted screenshot` 配方,在你常用的模拟器里 5 分钟出图(尺寸即所需,无需改)。
  - 建议 5 屏:①易经首页/总门户 ②卦详情(卦画+爻辞+注释) ③白话深读(hero+配图) ④推演工作台 ⑤学堂/义理专题。

## 阶段 B · App Store Connect 逐步填表(约 1–2 小时)【你做】

进 https://appstoreconnect.apple.com/apps → 点「观象」。左侧找到 **「App Store」/「分发(Distribution)」** 区(不是 TestFlight)。

- [ ] **B1 新建版本**:点「+ 版本或平台」,版本号填 **1.0.0**。
- [ ] **B2 填列表信息**(照 appstore-listing.md §一 复制粘贴):
  - 名称:`观象 · 国学经典研读`
  - 副标题:`易经道藏诸子 原文白话译注`
  - 宣传文本、描述、关键词、What's New(首版填「首个版本。」)
- [ ] **B3 上传截图**:iPhone 6.9″ 一套 + iPad 13″ 一套(阶段 A3 产出)。
- [ ] **B4 选构建**:在「构建」处选**最新 build**(截至本次刷新为 43;若还没出现,等 Apple 处理 10–30 分钟刷新)。
- [ ] **B5 隐私政策 URL**:填 `https://hexa.gavin.pub/privacy`(A2 已验证可打开)。
- [ ] **B6 支持 URL**:`https://hexa.gavin.pub/about`;营销 URL 可留空或填 `https://hexa.gavin.pub`。
- [ ] **B7 App 隐私问卷**(左侧「App 隐私」):选 **不收集数据 / Data Not Collected**(本 App 只存本机 localStorage、无后端无 SDK)。
- [ ] **B8 年龄分级问卷**:如实答;含「占卜/命理」项按实际填(本 App 是易经**义理研读**、明示非吉凶预言)。预期 4+ 或 12+。无暴力/成人/赌博/UGC。
- [ ] **B9 类目**:主类目 **教育(Education)**;次类目 **参考(Reference)** 或 图书。**不要选生活/占卜类**。
- [ ] **B10 价格与销售范围**:价格 **免费**;销售范围 → **取消勾选「中国大陆」**(先发海外区的关键一步),其余地区保留。
- [ ] **B11 版权行**:`© 2026 高嘉晟`(或你的署名)。
- [ ] **B12 Review Notes**:把 appstore-listing.md §五 那段**原样贴入**「App 审核信息 → 备注」(讲清教育定位、离线、无账号、非算命/非诊疗、原文公有领域)。
- [ ] **B13 发布方式**:选「手动发布」(审核通过后你点一下才上架,更可控)或「自动发布」。
- [ ] **B14 提交审核**:点「添加以供审核 / 提交」。

## 阶段 C · 审核与应对(约 1–3 天)

- [ ] **C1** 等审核(现在通常 24–48 小时)。状态在 ASC 顶部。
- [ ] **C2 若被拒**——本 App 三个高概率理由,已备好应对(见文末附录):4.2 套壳最低功能 / 占卜内容 / 中医医疗。多数可用 Review Notes 里的话回复,或按提示补充。
- [ ] **C3 通过后**:若选了手动发布,点「发布此版本」正式上架。

## 阶段 D · 大陆区(并行进行,拿到备案号后回来补)【你做】

详见 appstore-china-icp.md。要点:
- [ ] **D1** 登录 gavingao.cn 备案所在的云厂商(阿里云/腾讯云)控制台 → 「移动应用备案 / APP备案」→ 在**已有备案主体**下新增「观象 iOS」(Bundle ID `pub.gavin.hexa`,分发市场 App Store)→ 拿 **APP备案号**。
- [ ] **D2** 拿到号后:ASC「App 信息」处填 APP备案号 → 销售范围勾回「中国大陆」→ 陆区文案/截图收敛为「国学古籍·传统文化教育」(剥离算命/宗教修行/诊疗暗示)→ 提交一个版本更新(可 1.0.0 加区,或 1.0.1)。

---

## 附录 · 三个高概率被拒理由 + 回复要点

**① Guideline 4.2 最低功能(套壳最常见)**
> 回复:本 App 内容(经文/译注/白话/配图)随包打包、**完全离线可用**,并内置**易经推演工作台(起卦+六爻断法)、卦画闪卡与练习、本地收藏批注、离线全站搜索**等原生交互,非网页书签。可附一段截图/录屏展示推演与离线。

**② 占卜/命理内容**
> 回复:本 App 为**国学教育/古籍研读**工具,易经部分讲**义理推演**,应用内多处明示「非吉凶预言、不算命」;类目已选教育。非付费算命、无占卜变现。

**③ 中医医疗建议(Guideline 1.4.1)**
> 回复:中医典籍为**文献训读**,应用内显著声明「**研习不诊疗·非医疗建议**」,注疏/延伸不述功效用法用量、不作诊疗指导;仅供学习研究。

**通用**:强调无账号(故未附演示账号)、无数据收集(隐私 URL: https://hexa.gavin.pub/privacy)、原文取自公有领域(维基文库等)。

---


## 附录 B · 2026-08-11 被拒实录:2.1.0 App Completeness(已修,待重交)

**发生了什么**:1.32.0(build 50)排队 7 天后被拒,附图是审核员在 App 内注册,界面报
「Load failed」。

**根因不是注册逻辑,是服务端缺 CORS。** 壳里的页面从本地包加载,origin 是
`capacitor://localhost`,调 `https://hexa.gavin.pub/api/*` 属跨源;请求带 `X-Client` 与
JSON body,浏览器必先发 OPTIONS 预检 —— 而 API **没有注册 OPTIONS,预检 404**,
真正的 POST 根本没发出去。代码里当时写着「前端与 API 同源,不需要 CORS」,
**那句话对网页成立,却漏了 iOS/安卓壳是第二个 origin**。

**因此 App 内的登录/注册/评论/云同步自上线起就没通过**,只有阅读能用
(内容打包在本地、不走网络),所以自测时从没暴露 —— 审核员做的恰恰是我们没在真机试过的那件事。

**修复**(2026-08-12,`functions/api/[[route]].js`):白名单放行两个 origin、预检在路由匹配前答掉、
**不发 `Access-Control-Allow-Credentials`**(原生走 Bearer,网页那条 httpOnly Cookie 的路不被削弱)。
`functions/api/cors.test.js` 6 例钉住。

**验证**:生产预检返回 204;iOS 模拟器实机注册成功;同账号 curl 登录 200、
token 43 字符、Bearer 走 `/api/me` 200。

**为什么重交同一个 build 50**:客户端一行没改,问题在服务端且已修复 —— 换包不解决任何事,
还多一轮风险。

### 可粘贴的回复(解决中心 → Reply)

> Thank you for the detailed report and the screenshot — it pinpointed the problem exactly.
>
> **Root cause.** The failure was not in the sign-up logic but in our server configuration.
> The app's web view is served from the local bundle (`capacitor://localhost`), so its calls to
> our API at `https://hexa.gavin.pub` are cross-origin. Our API did not answer the CORS
> preflight (`OPTIONS`) request, so the browser rejected the request before it was ever sent,
> which surfaced in the UI as "Load failed".
>
> **Fix.** We have added an explicit CORS allow-list for the app's origin and deployed it to
> production. **No change to the binary was required**, so we are resubmitting the same build (50).
> We have verified on an iOS simulator running this exact build that account registration,
> sign-in, and cloud sync now complete successfully.
>
> **To verify:** open Settings (gear icon, top right) → Account → Register. You may also sign in
> with this test account: `<邮箱>` / `<密码>`.
>
> Please note that an account is entirely optional — all 74 classical texts and their
> translations, annotations and commentary are bundled with the app and fully readable offline
> without signing in. The account only adds cross-device sync of personal study marks and
> access to the chapter discussion threads.
>
> Thank you for your time.

⚠️ **贴之前把 `<邮箱>`/`<密码>` 换成真的测试账号** —— 审核员刚在这一步栽过,
给一个能直接用的账号比让他再注册一次稳妥。

---

## 一页速查(最短路径:先发海外)

1. 【我】wrangler 发 CF → 验证 `/privacy` 打开
2. 截图(我拍 or 你拍)iPhone 6.9″ + iPad 13″
3. ASC → 观象 → App Store → 新版本 1.0.0
4. 贴文案(listing.md)+ 传截图 + 选最新 build + 隐私URL + 隐私/年龄问卷 + 类目=教育 + 免费 + **去掉中国大陆** + 贴 Review Notes
5. 提交 → 等审核 → 通过后发布
6. (并行)办 APP备案 → 拿号后加中国大陆区
