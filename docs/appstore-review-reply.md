# 2026-08-14 被拒回复稿(Guideline 2.1 · Information Needed)

> **这不是功能缺陷,是新 App 首次提交的例行索要材料。** 七项里只有第 1 项(真机录屏)
> 必须 owner 本人做,其余六项的答案已写好,**直接粘贴**到 App Store Connect →
> 「App 审核信息」→「备注 / Notes」,然后在解决中心回复。
>
> ⚠️ 一处 `【待填】`(演示账号密码)必须粘贴时补上,别原样交上去。
>
> 🔒 **密码不写进这个文件 —— 本仓库在 GitHub 上是 PUBLIC 的。**
> 它的唯一存放处是 App Store Connect →「App 审核信息」的密码字段(那里本来就有)。
> 2026-08-16 已验过 `appreview@hexa.gavin.pub` **可正常登录**(非 owner、非管理员,权限正合适)。

---

## build 50 已经能装(2026-08-16 owner 实机确认)

TestFlight 里可见 **1.32.0 (50)**,直接装上录屏即可。

> 我一度按 `builds/50/betaGroups` 返回空判成「装不到」,**判错了** ——
> 该 App 有内部测试组「内部测试」,而**内部测试员(ASC 账号用户)自动可见所有 build**,
> 不需要显式加组,所以那个关系查询本来就是空的。
> **下次判 TestFlight 可见性别只看 `betaGroups` 关系**,以设备上看到的为准。

---

## ⚠️ 先纠正一处:**App 里的评论是只读的**(2026-08-02 有意为之)

`CommentSection.jsx:361` 有 `IS_NATIVE` 分支 —— 原生壳里**不显示发表框**,
只显示「App 内暂不支持发表评论,可在网页版参与讨论」。
理由见提交 `876290c`:**不在 App 里开 UGC 发布**,但云端已有的评论照常展示、
**举报与屏蔽照常可用**(「只要 App『展示』UGC 就落进指南 1.2,不是只有能发才算」)。

**这推翻了两条我先前的判断:**
1. 录屏脚本里「注册 → 发评论 → 举报 → 屏蔽」的第 5 步在 App 里做不到,已重写(见下)。
2. 「上一轮审核员大概率卡在评论 403」**是错的** —— App 里根本没有发表入口,
   审核员碰不到那个 403(那是网页侧的 bug)。第二次被拒纯粹是要材料。

**建议维持只读,不要为这次审核临时开放发布** —— 开了要多担一层 UGC 审核面,
而 Apple 要的「reporting and blocking mechanisms」现在就能演示。

> ✅ 演示素材已就绪:`/dao/daodejing/1` 上有一条他人评论(`test@gmail.com` 发的
> 「道可道,非常道。」),正好用来演举报与屏蔽。**录屏前别删那条,也别删那个账号。**

**生产库现有 4 个账号**(2026-08-16 查):

| 邮箱 | 用途 | 能删吗 |
|---|---|---|
| `gaojiasheng.him@gmail.com` | owner(Google 登录) | 不能 |
| `appreview@hexa.gavin.pub` | **交给 Apple 的演示账号** | 不能 |
| `test@gmail.com` | 发了道德经那条评论 | **录屏前不能删** —— 删了评论会被级联清掉 |
| `review-probe-0812@example.com` | 上一轮排查时建的 | 可删(录完再说) |

---

## 第 1 项:真机录屏(**owner 做**)

要求:真机 + 最新系统 · **从启动 App 开始** · 走完核心流程 ·
须含**注册、登录、注销账号**与**UGC 的举报/屏蔽机制**。

一镜到底约 3–4 分钟。**每步停两秒**让画面看清。

| # | 做什么 | 对应 Apple 哪条 |
|---|---|---|
| 1 | 桌面点图标启动,停在门户首页 | 「begin with launching the app」 |
| 2 | 进「儒典研读」→ 开《论语》第一篇 | 核心功能:读经 |
| 3 | 点注释气泡 · 切译文 · 章末点开**白话深读** | 证明不是空壳套壳 |
| 4 | 设置(齿轮)→ **注册**一个新账号 A(当场注册) | Account registration |
| 5 | 去 `道藏研读 → 道德经 → 第一章` 章末,**展示已有的那条评论** | User-generated content |
| 6 | 点该评论的「**举报**」→ 选理由 → 提交 | content **reporting** |
| 7 | 点「**屏蔽此人**」→ 该评论消失 | content **blocking** |
| 8 | 同一处**停两秒展示只读提示**「App 内暂不支持发表评论…」 | 主动交代为何无发布框 |
| 9 | 退出登录 → **用账号 A 重新登录** | Login flow |
| 10 | 设置 → 「**注销账号**」→ 抄邮箱确认 → 完成 | Account deletion(5.1.1(v) 硬要求) |
| 11 | 回首页,易经卦页与推演工作台各一眼 | 核心功能全貌 |

> ⚠️ **顺序不能乱**:第 10 步注销的是**新注册的账号 A**,不是发评论的那个测试账号
> —— 删了测试账号,它那条评论会被级联删掉,第 5–7 步就没素材了。
>
> ⚠️ **Google 登录在 App 里是隐藏的**(`AuthSheet.jsx:110` 的 `!IS_NATIVE`),
> 录屏只演邮箱密码这一条路即可,不必解释。

---

## 第 2–7 项:粘贴进 Notes 的英文回复

```
Thank you for the review. Below is the information requested.

2. DEVICES AND OS TESTED
- iPhone 16 Pro Max, iOS 26.6 — physical device (primary test device; the submitted
  screen recording was captured on this device)
- iPhone 17, iOS 26 — iOS Simulator (development)

3. APP FUNCTION AND TARGET AUDIENCE
Guanxiang (观象) is a reading and study app for classical Chinese texts.
It contains 74 public-domain classical works organized into 13 schools of thought
(Confucian, Taoist, Buddhist, Legalist, Mohist, Military, Diplomatic, Medical,
Strategy, Yangming, and classical poetry collections).

For every text the app provides four layers: the original text, a modern Chinese
translation, word-level annotations, and a long-form plain-language explainer
(2,031 chapters written for readers with no classical background). Additional
features include cross-school topic comparisons, a curated quotation collection,
full-text search, bookmarks and personal notes, and an I Ching study section.

Target audience: general readers, students and hobbyists who want to read Chinese
classics but find the original language inaccessible. The problem it solves is that
authoritative editions of these texts are either scholarly and hard to approach, or
scattered across low-quality websites. The value is a single, consistently annotated,
offline-capable reader.

The app is free. There is no paid content, no subscription, and no advertising.

4. HOW TO SET UP AND ACCESS MAIN FEATURES
No account is required to read any content — all 74 texts are fully readable
immediately on launch, offline.

An account is only needed to post comments and to sync study data across devices.
Demo account (email/password sign-in):
  Email:    appreview@hexa.gavin.pub
  Password: 【粘贴时填 —— 见下方说明,本仓库是公开的,密码不写进文件】

USER-GENERATED CONTENT — PLEASE NOTE: the iOS app is intentionally READ-ONLY for
comments. Comments posted on the website are displayed inside the app, and the
report and block controls are fully functional there, but the app itself does not
offer a way to post a comment. Where the composer would be, the app shows:
"App 内暂不支持发表评论,可在网页版 hexa.gavin.pub 参与讨论"
(commenting is not available in the app; you may join the discussion on the website).
This is a deliberate product decision, not a defect.

To see user-generated content and its moderation controls in the app:
open 道藏研读 (Taoist section) -> 道德经 (Tao Te Ching) -> Chapter 1, and scroll to
the bottom of the chapter. An existing comment is shown there. Each comment carries
a report control ("举报", with a reason picker) and a block control ("屏蔽此人").
A comment reported by three different users is automatically hidden pending review;
blocking is one-way and affects only the blocking user's own view.

Sign-in inside the app uses email and password. Google Sign-In is available on the
website only and is deliberately hidden in the app, so there is no non-functional
button to encounter.

Account deletion: Settings (gear icon in the navigation bar) -> "注销账号"
(Delete account). The user must retype their own email to confirm. Deletion is
immediate and cascades to all sign-in methods, sessions, synced study data,
comments, reports and blocks.

There is only one account type. There are no sample files to install.

5. EXTERNAL SERVICES USED
- Cloudflare Pages / Workers / D1 — web hosting, API backend and database
  (hexa.gavin.pub). This is the only backend.
- Google Sign-In (OAuth 2.0) — optional third-party sign-in on the website only;
  hidden inside the app, which uses email/password sign-in.
- Cloudflare Turnstile — bot protection on the website's comment form only
  (not reachable from the app, which cannot post comments).
- Resend — transactional email; used solely to notify the developer when a new
  comment is posted. No marketing email is sent to users.

There are no payment processors, no advertising SDKs, no analytics SDKs, and no
AI services. The classical texts are not fetched at runtime: they are compiled into
the app at build time and ship inside the bundle, which is why reading works offline.

6. REGIONAL DIFFERENCES
The app functions identically in all regions. There is no region-gated content,
no region-specific behaviour, and no server-side geo logic. The interface and all
content are in Chinese. (Mainland China is excluded from the sales territories, but
this is a distribution choice only and does not change how the app behaves.)

7. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
All 74 texts are Chinese classical works in the public domain — the newest was
written in the 19th century, and most are over 1,000 years old. They are sourced
from Wikisource (public domain). All translations, annotations and explanatory
essays are original work created for this app. No copyrighted third-party material
is reproduced.

Two content areas deserve explicit note:

(a) Traditional Chinese medical classics (Huangdi Neijing, Shanghan Lun, etc.) are
    included as literature and history of ideas, not as medical guidance. The app
    does not diagnose, does not recommend treatment, and does not provide dosage or
    usage instructions. Every page in this section carries a visible disclaimer
    ("⚠ 非医疗建议" — not medical advice), and the annotations are deliberately
    restricted to philology and historical context. The app is not a medical app
    and does not operate in a regulated medical capacity.

(b) The I Ching section includes a traditional hexagram-casting tool. It is presented
    as a cultural and philosophical study aid — the app explicitly states it does not
    predict the future and does not tell fortunes, and the interpretive text is drawn
    from the classical commentaries rather than any predictive claim. No payment,
    subscription or personalised "reading" is offered.

The app also contains a private, administrator-only section of personal reading notes,
which is not part of the user-facing product: it is blocked at the server edge and
returns HTTP 404 to every account except the developer's own, so it is not reachable
by reviewers or users.
```

---

## 交之前的检查清单

- [x] ~~装 build 50~~ —— TestFlight 里已可见 1.32.0 (50)
- [ ] **在 App 里打开 `道藏研读 → 道德经 → 第一章`,确认底部能看到那条评论**
      (App 只读,发布框不出是正常的;要确认的是「看得到 + 举报/屏蔽点得动」)
- [ ] 按上面十步录屏(真机 + 最新系统)
- [x] ~~确认演示账号可登录~~ —— 2026-08-16 实测 `appreview@hexa.gavin.pub` 登录正常
- [ ] 粘贴 Notes 时把密码补进第 4 项(**密码从 ASC 的密码字段取,别从本文件找**)
- [ ] **别删** `/dao/daodejing/1` 那条评论、**别删**发它的测试账号 —— 那是录屏素材
- [ ] Notes 粘贴进「App 审核信息」,录屏在解决中心回复里附上
- [ ] **build 50 一行代码没改就够** —— 两次被拒都是服务端/材料问题,客户端无需重新构建

> ⚠️ **别在解决中心只回一句「已修复」**。Apple 这次要的是**信息**,
> 七项缺一项就会再退一轮。
