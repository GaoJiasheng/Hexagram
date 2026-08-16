# 2026-08-14 被拒回复稿(Guideline 2.1 · Information Needed)

> **这不是功能缺陷,是新 App 首次提交的例行索要材料。** 七项里只有第 1 项(真机录屏)
> 必须 owner 本人做,其余六项的答案已写好,**直接粘贴**到 App Store Connect →
> 「App 审核信息」→「备注 / Notes」,然后在解决中心回复。
>
> ⚠️ 两处 `【待填】` 必须先补,别原样交上去。

---

## build 50 已经能装(2026-08-16 owner 实机确认)

TestFlight 里可见 **1.32.0 (50)**,直接装上录屏即可。

> 我一度按 `builds/50/betaGroups` 返回空判成「装不到」,**判错了** ——
> 该 App 有内部测试组「内部测试」,而**内部测试员(ASC 账号用户)自动可见所有 build**,
> 不需要显式加组,所以那个关系查询本来就是空的。
> **下次判 TestFlight 可见性别只看 `betaGroups` 关系**,以设备上看到的为准。

---

## 第 1 项:真机录屏(**owner 做**)

要求:真机 + 最新系统 · **从启动 App 开始** · 走完核心流程 ·
必须包含**账号注册、登录、注销**与**用户生成内容及其举报/屏蔽机制**。

建议一镜到底,约 3–4 分钟,按下面顺序走。**边走边停两秒**,让画面看得清。

| # | 做什么 | 为什么必须有 |
|---|---|---|
| 1 | 从桌面点图标启动,停在门户首页 | 要求「begin with launching the app」 |
| 2 | 进一个组(如「儒典研读」)→ 开《论语》第一篇 | 核心功能:读经 |
| 3 | 点开某段的**注释气泡**、切**译文**、拉到章末点开**白话深读** | 展示这不是空壳套壳 |
| 4 | 章末点「评论」→ **注册**一个新账号(当场注册,别用已登录态) | Account registration flow |
| 5 | 发一条评论 → 显示它出现在列表里 | User-generated content |
| 6 | 点该评论的「**举报**」→ 走完弹窗 | content reporting mechanism |
| 7 | 点「**屏蔽此人**」→ 显示该用户内容消失 | content blocking mechanism |
| 8 | 退出登录 → **用同一账号重新登录** | Login flow |
| 9 | 设置 → 「**注销账号**」→ 抄邮箱确认 → 完成 | Account deletion flow(5.1.1(v) 硬要求) |
| 10 | 回到首页,展示易经卦页与推演工作台各一眼 | 核心功能全貌 |

> ⚠️ **第 4–7 步以前是走不通的** —— 评论功能自 2026-08-02 上线起一直被 Turnstile
> 挡在 403(secret 配错),**2026-08-16 才修好**。录屏前先自己发一条试试,确认能发出来。
> 上一轮审核员大概率就是卡在这里。
>
> ⚠️ 录屏用的测试账号,录完记得删(第 9 步正好把它删掉,一举两得)。

---

## 第 2–7 项:粘贴进 Notes 的英文回复

```
Thank you for the review. Below is the information requested.

2. DEVICES AND OS TESTED
【待填:例如 iPhone 15 Pro (iOS 26.x) — 真机;iPhone 17 Simulator (iOS 26.x) — 模拟器】

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
  Password: 【待填:那个演示账号的密码】

To reach the comment feature: open any chapter (for example the Confucian section ->
Analects -> Chapter 1), scroll to the bottom of the chapter, and tap "评论" (Comments).
Sign in there, post a comment, and the report ("举报") and block ("屏蔽此人") controls
appear on each comment.

Account deletion: Settings (gear icon in the navigation bar) -> "注销账号"
(Delete account). The user must retype their own email to confirm. Deletion is
immediate and cascades to all sign-in methods, sessions, synced study data,
comments, reports and blocks.

There is only one account type. There are no sample files to install.

5. EXTERNAL SERVICES USED
- Cloudflare Pages / Workers / D1 — web hosting, API backend and database
  (hexa.gavin.pub). This is the only backend.
- Google Sign-In (OAuth 2.0) — optional third-party sign-in, alongside the app's
  own email/password sign-in.
- Cloudflare Turnstile — bot protection on the comment form only.
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
- [ ] 自己先发一条评论,确认 2026-08-16 的修复在 App 里也生效(壳走的是同一个生产 API)
- [ ] 按上面十步录屏(真机 + 最新系统)
- [ ] 补上两处 `【待填】`:测试设备型号与系统、演示账号密码
- [ ] 确认 `appreview@hexa.gavin.pub` 这个演示账号**现在还能登录**(上次填的,隔了几天)
- [ ] Notes 粘贴进「App 审核信息」,录屏在解决中心回复里附上
- [ ] **build 50 一行代码没改就够** —— 两次被拒都是服务端/材料问题,客户端无需重新构建

> ⚠️ **别在解决中心只回一句「已修复」**。Apple 这次要的是**信息**,
> 七项缺一项就会再退一轮。
