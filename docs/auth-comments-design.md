# 观象 · 登录与评论分批实施设计(auth-comments-design)

> 状态:**设计定稿,待逐批实施。**
> 决策来源:[docs/platform-upgrade-plan.md](./platform-upgrade-plan.md) §7(2026-07-17 owner 14 项逐条拍板),辅以 §2.4(登录)、§2.4a(同步一致性)、§2.5(评论)。本文只负责「怎么分批落地」;回溯「为什么这么设计」以 §7 为准,不在此复述。
> 操作铁律:**一次只做一个批次。做完必须构建、部署、按该批次的「验收清单」逐条点过,全绿后才开下一批。**「大体能用但要等下一批才有意义」的拆分是坏拆分,本文批次全部按「独立可交付、独立可验收」切割。每个批次章节自带全部上下文——未来任何会话只读 §0 + 该批次一节 + 代码库即可动工,不需要加载全文。
> 文中标注 **建议,非拍板** 的条目是起草时的工程判断(owner 未逐字确认),实施时如有更好做法可改;未标注的均为 owner 已定决策或既有代码事实,不得擅改。

---

## 0. 公共约定(每批动工前先读)

### 0.1 D1 迁移方式
- 现有六表(users / identities / auth_codes / user_data / reading_events / comments)已在生产 D1(`hexagram-db`,binding `DB`)上线。一切改动**只做加法**:`ALTER TABLE … ADD COLUMN` / `CREATE TABLE` / `CREATE INDEX`,不重建表、不改既有列与 CHECK。
- 新建 `migrations/` 目录,按批次编号存增量 SQL(如 `migrations/0001-auth-base.sql`)。执行:
  - 本地:`npx wrangler d1 execute hexagram-db --local --file=migrations/0001-auth-base.sql`
  - 生产:同命令换 `--remote`
- 每次迁移后**同步更新根目录 `schema.sql`**(全量现状镜像,供全新环境一次建库);`migrations/` 是增量历史,两者并存。

### 0.2 本地验证环境
- 纯前端改动:`npm run dev`(vite,无 Functions)。
- 涉及 API 的验证:`npm run build && npx wrangler pages dev`(读 wrangler.toml,静态 + Functions + 本地 D1 一起起,默认 `http://localhost:8788`)。各批「验收清单」凡涉及 API,一律在此环境或线上点。
- 环境变量:本地放 `.dev.vars`(勿提交);生产在 Pages 项目设置 → Environment variables,密钥一律 encrypted。

### 0.3 后端风格(沿用 `functions/api/[[route]].js` 既有约定,不另起炉灶)
- 错误:抛 `RequestError(status, message)`,handler catch 后 `c.json({ ok: false, error }, status)`。
- 校验:每个写接口配一个 `validateX(body)`,非法即抛,返回干净对象。
- DB:`getDb(c)`。运行时是 Cloudflare Workers,**无 Node API**——哈希/随机数只用 Web Crypto(`crypto.subtle` / `crypto.getRandomValues` / `crypto.randomUUID`),不引 bcrypt 等原生依赖。本方案**不需要 JWT 库**(会话用 D1 表 + 不透明 token,见批次 2)。
- 全局中间件已给所有响应盖 `Cache-Control: no-store`,新接口不必自理。
- 请求体上限:现有 `MAX_BODY_BYTES = 4096` 保持为默认;仅 `/api/sync` 单独放宽(见批次 5)。

### 0.4 前端风格
- localStorage 只走 `src/features/yijing/storage.js` 封装(前缀 `guanxiang.v1.`)。本方案新增的内部键(`authHint` / `syncMeta` / `lastSyncAt`)**一律不进 DATA_KEYS**(不参与导出/导入/清空)。
- 浮层复用 `src/features/SettingsSheet.jsx` 的壳:`settings-overlay` / `settings-sheet` 系列 class + `createPortal` 到 body + Esc 关闭 + 锁背景滚动 + 焦点还原。
- 颜色只用 CSS 变量(`--cinnabar` / `--cinnabar-bg` 等),让 `[data-site]` 分站换肤自然生效;任何新 UI 不写死颜色。
- iOS 壳(Capacitor):本阶段**隐藏一切登录相关入口**——`Capacitor.isNativePlatform()` 为 true 时不渲染(platform-upgrade-plan §2.4a 已定,web 先行,壳内后补)。

---

## 1. 总览:八个批次与依赖图

| # | 批次 | 一句话 | 依赖 |
|---|------|--------|------|
| 1 | 本地删除墓碑化 | 纯前端:集合类数据的删除改软删(tombstone),为同步铺路 | 无 |
| 2 | 邮箱注册/登录 + 会话基座 | sessions 表、密码哈希、AuthSheet;能注册、登录、退出,自动头像昵称 | 无 |
| 3 | Google 登录 | 服务端 OAuth code flow,按邮箱并入同一账号 | 2 |
| 4 | Owner 管理鉴权切换 | `/admin/*` 从临时口令切到 owner 正式会话 | 2 |
| 5 | 云同步 | `POST /api/sync` 按 §2.4a 已定合并算法双向同步 DATA_KEYS | 1、2 |
| 6 | 评论区 | 两类挂载点;看(无需登录)/发(登录+Turnstile)/删自己的 | 2 |
| 7 | 新评论邮件通知 | 每条新评论一封邮件到 owner 邮箱(Resend) | 6 |
| 8 | 评论管理 | owner 站内隐藏/恢复任意评论 + 后台最近评论流 | 4、6 |

依赖关系(DAG,无环):

```
批次1(墓碑)──────────────┐
                          ├──→ 批次5(云同步)
批次2(邮箱登录)──┬───────┘
                  ├──→ 批次3(Google)
                  ├──→ 批次4(owner 鉴权)──┐
                  └──→ 批次6(评论)──┬──→ 批次7(邮件通知)
                                    └──→ 批次8(评论管理)←──(批次4)
```

- 批次 1 与批次 2 互不依赖,可任选先后;推荐按编号顺序做。
- 合法的乱序例子:急着上评论可以走 2 → 6 → 7,把 1/5(同步线)放后面;但 4 必须在 8 之前、2 必须在 3/4/5/6 之前。
- 无任何环:1 和 2 是两个根,其余全部单向向后。

---

## 2. 批次 1 · 本地删除墓碑化(纯前端)

### 2.1 目标(交付后什么变为真)
- 集合类本地数据(段落收藏 `corpusMarks`、段落笔记 `corpusNotes`、卦收藏 `bookmarks`、占卜历史 `divinations`)的「删除」从物理删除改为**墓碑**:条目保留为 `{ deleted: true, at: <ISO时间> }`,读取侧统一过滤,用户观感零变化。
- `bookmarks` 从「无时间戳的 id 数组」升级为「按 id 键控、每条带 `at` 的 map」,旧数据自动迁移。
- 这是 §2.4a 已定同步算法(按条合并 + 墓碑防复活)的本地前置:没有墓碑,后续云同步会把已删条目「复活」。**未登录、纯本地场景行为不变**——本批不涉及任何网络请求。

### 2.2 依赖
无。可作为第一批直接动工。

### 2.3 非目标
- 不做任何后端/API/登录(本批不碰 `functions/`)。
- 不做云同步本体(批次 5)。
- `progress` 无删除路径,本批不动;`settings`/`quoteTheme`/`reading`/`recentHexagrams`/`notes` 是标量类(整键覆盖语义),不需要墓碑,不动。
- 不做墓碑定期清理(§2.4a 已定:量级小,留作日后按需优化)。

### 2.4 D1 变更
无。

### 2.5 API 变更
无。

### 2.6 前端改动(核心全在 `src/features/yijing/storage.js`)
- [ ] `toggleCorpusMark(...)`:删除分支从 `delete m[k]` 改为 `m[k] = { deleted: true, at: new Date().toISOString() }`;新增分支不变。
- [ ] `saveCorpusNote(...)`:空文本分支同上改墓碑。
- [ ] `getCorpusMarks()` / `getCorpusNotes()`:返回前过滤 `deleted: true` 条目(返回浅拷贝,不改底层存储)。注意:所有消费方(ClassicReader 的标记态、CorpusMePage 列表、易经 MarkableBlock/MePage「逐句标记」等)都经这两个读口,读口过滤后消费方零改动。
- [ ] `getStudyStats()`:计数改为只数非墓碑条目(当前直接 `Object.keys(...).length` 会把墓碑算进去)。
- [ ] **bookmarks 换形**:存储形状改为 `{ [hexId]: { at: <ISO> } | { deleted: true, at: <ISO> } }`。
  - `getBookmarks()`:若读到旧数组形状,先就地迁移(每个 id 记 `at = 当前时间` 写回),再返回**非墓碑 id 数组、按 at 升序**(保持"先收藏在前"观感);对外签名不变,消费方零改动。
  - `toggleBookmark(id)`:加 → `{ at: now }`;取消 → `{ deleted: true, at: now }`。
  - `saveBookmarks` 若仍有直接调用方,改造或收敛到 toggle(先 `grep -rn "saveBookmarks" src/`)。
- [ ] **divinations 增加统一 `at` 字段**(同步用的"最后变更时间",ISO 字符串):
  - `saveDivination`:新条目 `at = createdAt`。
  - `setDivinationOutcome`:更新后 `at = outcome.recordedAt`(清除 outcome 时 `at = 当前时间`)。
  - `deleteDivination(id)`:条目原地替换为 `{ id, deleted: true, at: now }`(保留 id 供合并对齐)。
  - `getDivinations()`:过滤墓碑。
  - **撤销删除的现有 UI 有一个真实陷阱,实现时务必绕开**:`MePage.jsx` 当前的 `undoDelete()` 是「`getDivinations()` 取列表 → push 备份的原条目 → `saveDivinations(list)` 整体写回」。一旦 `getDivinations()` 变成"过滤墓碑后的展示视图",这个写回会用一份**已经丢失了其它墓碑行**的数组去覆盖底层存储——等于撤销这一条的同时,把这次操作之前所有其它已删除条目的墓碑都冲掉、变相"复活"。**正确做法**:`storage.js` 新增一个不做过滤的原始读写辅助(如 `getDivinationsRaw()` 直接返回底层数组),`undoDelete` 改为在**原始数组**里按 id 定位并整条替换回原对象(而不是 `push` 到过滤后的列表再整体覆盖),`at` 置为当前时间。`deleteDivination`/`saveDivinationOutcome` 等其它写函数一律只操作原始数组,只有面向 UI 的 `getDivinations()` 才做墓碑过滤。
  - `MAX_DIVINATIONS` 截断只数非墓碑条目(墓碑不占名额)。
- [ ] **导出/导入兼容**:`exportData()` 原样导出含墓碑的新形状;`importData()` 兼容旧备份(bookmarks 为数组时按迁移逻辑转换)。导入确认弹窗文案不用改。

### 2.7 验收清单
- [ ] 读经站任意段落:收藏 → 取消收藏 → DevTools 里 `guanxiang.v1.corpusMarks` 该键是 `{deleted:true,at:…}` 而非消失;页面星标态正确熄灭;再次收藏能重新点亮(新条目覆盖墓碑)。易经卦页(`/hexagram/:id`)的逐句 ★/✎(MarkableBlock)与「我的·逐句标记」聚合视图同样验一遍(同一套读写口)。
- [ ] 笔记:写一条 → 清空保存 → 同上验证墓碑;「我的」列表不显示已删条目;足迹统计计数不含墓碑。
- [ ] 卦收藏:旧数据(手工把 `guanxiang.v1.bookmarks` 改回 `[1,2]` 数组)刷新后自动迁移为 map,页面收藏列表正常;取消收藏产生墓碑。
- [ ] 占卜历史:删除 → 撤销 → 条目回来且 `at` 为撤销时刻,**且这次操作之前的其它已删记录仍保持已删状态**(专项验证上面提到的陷阱已避开);删除不撤销 → 列表不显示、localStorage 里是墓碑。
- [ ] 设置浮层导出 JSON → 清空全部数据 → 导入刚才的 JSON → 收藏/笔记/历史全部还原,已删的不复活。
- [ ] 导入一份旧版备份文件(bookmarks 为数组)不报错、正常显示。
- [ ] `npm run build` 通过;线上部署后抽点上述 2–3 条复验。

### 2.8 人工前置
无。

---

## 3. 批次 2 · 邮箱注册/登录 + 会话基座

### 3.1 目标
- 访客可用「邮箱 + 密码(两次确认)」注册,之后用邮箱+密码登录;登录态由 **HttpOnly Cookie + D1 sessions 表**承载,TTL 1 个月,过期静默失效(下次要用再登录即可,无「记住我」)。
- 注册即自动获得:昵称 = 邮箱 @ 前缀;像素风默认头像 = 由 `avatar_seed` 确定性生成(纯前端 SVG,无上传、无图片存储)。`users.display_name` / `users.avatar_seed` 建表时已为此预留,**本批无需为头像昵称加任何字段**。
- 全站唯一入口:设置浮层(SettingsSheet)新增「账号」区。**登录绝不侵入**——不登录一切照旧,无任何横幅/弹窗/拦截;首次打开站点的访客连 `/api/me` 请求都不会发(见 3.6 authHint)。
- 「退出登录」可用(服务端销毁会话)。

### 3.2 依赖
无(与批次 1 互不依赖)。

### 3.3 非目标
- 不做 Google 登录(批次 3)、云同步(批次 5)、评论(批次 6)。
- 不做邮箱验证码/手机验证码登录(后续批次;`auth_codes` 表为其预留,本批**不读不写不改**该表)。
- 不做:改昵称、传头像、找回密码、注销账号、Turnstile 人机校验(**建议,非拍板**:注册接口暂不加 Turnstile——注册无发信等成本副作用、站点小众,先保批次最小;若日后被机器人刷注册,在 register 校验里补一段 Turnstile 验证即可,基建批次 6 会建好)。
- 不做 owner 标记与管理后台切换(批次 4);本批上线后只要**不手工设置 is_owner=1**,现有 `/admin/*` 口令通道照常工作,不受影响。
- iOS 壳内不开放(入口按 §0.4 隐藏)。

### 3.4 D1 变更(`migrations/0001-auth-base.sql`)
```sql
-- 邮箱并账的合并键:两种登录方式(邮箱注册 / Google)建号时都写入,小写规范化
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- 密码哈希挂在 email identity 行上(provider='email' 时使用,其余 provider 恒为 NULL)
ALTER TABLE identities ADD COLUMN secret TEXT;

-- 会话:id 存 token 的 SHA-256 hex(库泄露不等于 token 泄露),原始 token 只进 Cookie
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```
执行后把以上合并进 `schema.sql`。

### 3.5 API(全部在 `functions/api/[[route]].js`,沿用 §0.3 风格)

**通用件(本批新增,后续批次复用):**
- 常量:`SESSION_COOKIE = 'gx_session'`,`SESSION_TTL_MS = 30 * DAY_MS`,`PBKDF2_ITERATIONS = 100_000`。
- `sha256Hex(text)`:`crypto.subtle.digest('SHA-256', …)` → hex。
- 密码哈希:PBKDF2-SHA-256,16 字节随机盐,输出 32 字节,存 `pbkdf2:<iterations>:<salt_b64url>:<dk_b64url>`;校验时按存储的 iterations 重算 + 现有 `constantTimeEqual` 比较。(**建议,非拍板**:10 万次迭代是 Cloudflare 官方示例值;若免费档 CPU 限额触发 1102 错误,降到 50_000 并在此处记录一笔——威胁模型是个人站 + 加盐 + D1 泄露场景,可接受。)
- `createSession(db, userId)`:raw = `crypto.getRandomValues(new Uint8Array(32))` 的 base64url;`INSERT INTO sessions (id, user_id, expires_at) VALUES (sha256Hex(raw), userId, Date.now() + SESSION_TTL_MS)`;返回 raw。
- Cookie 读写用 `hono/cookie` 的 `getCookie`/`setCookie`(hono 内置,零新依赖,已确认 `node_modules/hono/dist/cjs/helper/cookie` 存在):`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`。同源部署 + SameSite=Lax + 全 JSON POST,CSRF 面已收住,不再加 token。localhost 的 http 下现代浏览器同样接受 Secure Cookie,本地可测。
- `getSessionUser(c)`:读 Cookie → sha256 → `SELECT s.expires_at, u.id, u.display_name, u.avatar_seed, u.email, u.is_owner FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`;过期则删行返回 null;无 Cookie/无行返回 null。
- `requireUser(c)`:null 时抛 `RequestError(401, 'login required')`。
- `publicUser(row)` → `{ id, displayName, avatarSeed, avatarUrl: null, email, isOwner: !!is_owner }`(`avatarUrl` 从第一天就占位返回 null,给日后头像上传批次留缝,前端按「有 url 用 url,否则种子生成」渲染)。

**`POST /api/auth/register`** — body `{ email, password, password2 }`
- 校验(`validateRegister`):email trim + 小写规范化,正则 `^[^\s@]+@[^\s@]+\.[^\s@]+$`,≤254;password 8–72 字符;`password2 === password` 否则 400「两次输入的密码不一致」。
- `identities(provider='email', provider_uid=email)` 已存在 → 409「该邮箱已注册,请直接登录」。
- `users.email = ?` 已存在(将来 Google 建的号)→ 409「该邮箱已通过 Google 登录创建账号,请改用 Google 登录」。**安全注记(建议,非拍板,但强烈建议不改)**:注册时未验证邮箱所有权,绝不能把未验证的注册自动并入已存在的账号,否则任何人可凭密码占据他人 Google 账号的数据。owner「同邮箱=同账号」的决策由两点共同兑现:①此处拒绝重复建号(一个邮箱永远只有一行 users);②批次 3 里 Google→已有邮箱账号方向的自动并账(Google 已验证过邮箱,方向安全)。反向遗留的「抢注占号」窗口(先用他人邮箱注册、等真主人 Google 登录被并进来)在后续「邮箱验证码」批次上线注册验证后彻底关闭,当前站点体量下风险接受。
- 通过:`users` 插入 `{ id: crypto.randomUUID(), display_name: 邮箱@前缀(截 80,空则'读者'), avatar_seed: crypto.randomUUID(), email }`;`identities` 插入 `{ user_id, provider:'email', provider_uid: email, secret: <哈希> }`;建会话、Set-Cookie;`201 { ok: true, user: publicUser }`。

**`POST /api/auth/login`** — body `{ email, password }`
- email 同上规范化;查 `identities(email, <email>)`:
  - 无此行但 `users.email` 命中 → 401「该邮箱账号通过 Google 创建,请用 Google 登录」(批次 3 前该分支不可达,现在写好,批次 3 就不用回头改这里)。
  - 无任何命中,或哈希比对失败 → 统一 401「邮箱或密码不正确」(不区分"账号不存在",少泄露一点)。
- 通过:顺手 `DELETE FROM sessions WHERE user_id = ? AND expires_at < ?`(机会式清理),建新会话、Set-Cookie;`200 { ok: true, user }`。
- 暴力破解防护(**建议,非拍板**):代码内不做计数器(Workers 无状态);如日后有需要,在 Cloudflare 控制台给 `/api/auth/*` 配一条 Rate Limiting 规则即可,零代码。

**`POST /api/auth/logout`** — 读 Cookie,有则删 sessions 行;无论如何清 Cookie(Max-Age=0);`204`。

**`GET /api/me`** — 恒 200:`{ user: publicUser | null }`。前端所有"我是谁"都走这一个接口。

### 3.6 前端改动
新目录 `src/features/auth/`:
- [ ] `AuthContext.jsx`:App 根部挂 Provider。状态 `{ user, loading }`;方法 `refresh()`(拉 `/api/me`)、`login/register/logout`(调上述接口,成功后更新 user)、`openAuth()/closeAuth()`(控制 AuthSheet,任何功能点都能唤起)。**关键:非侵入护栏**——挂载时只有 localStorage 存在 `guanxiang.v1.authHint` 才调 `/api/me`;登录/注册成功写 `authHint = true`,登出或 `/api/me` 返回 null 时清除。从没登录过的访客零 auth 请求。`Capacitor.isNativePlatform()` 时 Provider 直接固定 `user: null` 且 `openAuth` no-op。
- [ ] `AuthSheet.jsx`:登录/注册浮层,复用 settings-sheet 壳(§0.4)。两个 tab「登录」「注册」;注册 = 邮箱 + 密码 + 确认密码;错误信息就地红字(直接显示 API 返回的中文 error)。顶部文案(**建议,非拍板**):标题「登录观象」,副题「云端保存足迹、参与评论。不登录不影响任何浏览。」成功后关闭浮层,调用方各自响应 user 变化。
- [ ] `PixelAvatar.jsx`:确定性像素头像。**建议,非拍板**(视觉细节可调,确定性必须保留):seed 字符串 → cyrb53 一类的内联字符串哈希 → xorshift32 PRNG → 5×5 网格,左 3 列随机、右 2 列镜像,全空则补中心格;前景色从 8 色矿物色盘(朱、赭、黛、青、竹、紫、褐、墨)按哈希取一,底为纸色;`<svg viewBox="0 0 5 5" shape-rendering="crispEdges">` 渲染,`size` prop 控制尺寸。组件签名 `<PixelAvatar seed={user.avatarSeed} size={32} />`;将来支持上传后调用方改为「`user.avatarUrl` 有值渲染 `<img>`,否则 PixelAvatar」,本批先只做后者。
- [ ] `SettingsSheet.jsx`:顶部新增「账号」区(iOS 壳隐藏,§0.4)。未登录:一行说明 +「登录 / 注册」按钮 → `openAuth()`;已登录:PixelAvatar + 昵称 + 邮箱(灰字)+「退出登录」。
- [ ] `App.jsx`:挂 AuthProvider,AuthSheet 懒加载(参照 SettingsSheet 的 lazy 方式)。
- [ ] CSS 进 `src/index.css`,类名循例(`auth-sheet__*`),颜色走 `--cinnabar` 变量。

### 3.7 验收清单
- [ ] `wrangler pages dev` 起本地环境,先跑迁移(--local)。设置浮层见「账号」区。
- [ ] 注册:两次密码不一致被拦;弱于 8 位被拦;成功后浮层关闭,账号区显示头像 + 邮箱前缀昵称;DevTools → Application → Cookies 见 `gx_session`(HttpOnly)。
- [ ] 刷新页面登录态还在(authHint 生效,Network 里能看到 `/api/me`)。
- [ ] 退出登录:账号区回到未登录;刷新后 Network **无** `/api/me` 请求;sessions 表该行已删(`wrangler d1 execute --local --command "SELECT COUNT(*) FROM sessions"`)。
- [ ] 无痕窗口首次访问:全站可正常浏览,无任何登录提示,Network 无任何 `/api/auth`、`/api/me` 请求。
- [ ] 重复注册同邮箱 → 409 文案正确;错密码登录 → 「邮箱或密码不正确」。
- [ ] 同一账号刷新多次,头像图案逐次一致(确定性)。
- [ ] `/admin/stats` 口令方式仍正常(本批没建 is_owner=1 的行,过渡通道未被触发失效)。
- [ ] 跑生产迁移(--remote),部署,线上复验注册/登录/退出一轮。

### 3.8 人工前置
无外部控制台操作(本批特意做到零外部依赖)。仅需 owner 执行两次 `wrangler d1 execute`(本地/生产迁移)。

---

## 4. 批次 3 · Google 登录(按邮箱并账)

### 4.1 目标
- AuthSheet 新增「用 Google 登录」;走**服务端 authorization code flow**(整页跳转),不在站内注入任何 Google JS(不碰 CSP、不给每个访客加第三方脚本)。
- **同邮箱 = 同账号**(owner 决策 2):Google 登录的邮箱若已被邮箱注册过,自动把 Google 身份并入那一行 users(方向安全:Google 已验证邮箱所有权);全新邮箱则建号,规则与批次 2 相同(昵称 = @ 前缀、随机 avatar_seed)。
- 登录成功回到出发页面,登录态与批次 2 完全同构(同一套 Cookie/session)。

### 4.2 依赖
批次 2(sessions/Cookie/AuthSheet/`users.email` 列全部来自批次 2;批次 2 的 login 接口已预写「请用 Google 登录」分支,本批不需要回改它)。

### 4.3 非目标
- 不做 GIS 按钮/One Tap(避免第三方脚本;大陆访客本就加载不了 Google 脚本,code flow 只在用户主动点击时才跳转,失败面最小)。已知限制:大陆网络点「用 Google 登录」会打不开 Google 页——属预期,邮箱密码是大陆路径,手机验证码是终态(后续批次)。
- 不做 Apple 登录、微信登录(platform-upgrade-plan §2.6 已定不做微信)。
- 不做「账号设置里绑定/解绑 Google」管理界面——并账只在登录动线里自动发生。

### 4.4 D1 变更
无(批次 2 的 email 列 + identities 表已够;Google 身份行:`provider='google'`,`provider_uid = Google sub`,`secret = NULL`)。

### 4.5 API

**`GET /api/auth/google/start?return_to=<路径>`**
- `return_to` 校验:必须以 `/` 开头且不以 `//` 开头(防开放重定向),非法回退 `/`。
- 生成 `state = crypto.randomUUID()`;`setCookie('gx_oauth', JSON.stringify({ state, returnTo }), { httpOnly, secure, sameSite: 'Lax', path: '/', maxAge: 600 })`。
- 302 到 `https://accounts.google.com/o/oauth2/v2/auth` 携带:`client_id=env.GOOGLE_CLIENT_ID`、`redirect_uri=<origin>/api/auth/google/callback`(origin 从 `new URL(c.req.url).origin` 取,本地/生产自适应)、`response_type=code`、`scope=openid email`、`state`、`prompt=select_account`。

**`GET /api/auth/google/callback?code&state`**
- 读并立即清除 `gx_oauth` Cookie;`state` 不匹配/缺失 → 400。
- `fetch('https://oauth2.googleapis.com/token', …)` form 编码换 token:`code, client_id, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri(同上), grant_type=authorization_code`;失败 → 502。
- 解析 `id_token`:按 `.` 切三段,base64url 解码 payload 为 JSON。**不需要验签**(OIDC 规范:token 直接经 TLS 从 Google token 端点取得时,签名校验可省)——因此全程零 JWT 依赖。仍须校验:`iss ∈ {'https://accounts.google.com','accounts.google.com'}`、`aud === GOOGLE_CLIENT_ID`、`exp` 未过、`email_verified === true`(false → 403)。
- 取 `sub`、`email`(trim + 小写)。并账三步:
  1. `identities('google', sub)` 已存在 → 直接该 user 登录;
  2. 否则 `users.email = ?` 命中 → 给该 user 插入 `identities('google', sub)`(并账完成)→ 登录;
  3. 否则建号(同批次 2 规则,email 写入 users.email)+ 插 identity → 登录。
- `createSession` + Set-Cookie,302 到 `returnTo`。
- 错误路径统一返回一页极简 HTML(中文错误 + 「返回观象」链接回 returnTo),不做复杂的前端错误穿透。

### 4.6 前端改动
- [ ] `AuthSheet.jsx`:登录 tab 底部加分隔线 + 「用 Google 登录」按钮;点击先写 `authHint = true`(跳转回来后 AuthContext 才会去拉 `/api/me`;若登录失败,`/api/me` 返回 null 会自动清掉 hint),再 `window.location.href = '/api/auth/google/start?return_to=' + encodeURIComponent(location.pathname)`。
- [ ] 按钮样式循例,不用 Google 官方品牌件也可(个人站),文案「用 Google 登录」。

### 4.7 验收清单
- [ ] 本地(`wrangler pages dev` + `.dev.vars` 里配好两个变量):点按钮 → Google 授权页 → 回站内出发页,设置浮层显示登录态。
- [ ] 全新 Google 邮箱:`users` 新增一行,`identities` 一行 google;昵称 = 邮箱前缀。
- [ ] **并账主验证**:先用邮箱 `x@y.z` 密码注册 → 退出 → 用同邮箱 Google 登录 → `wrangler d1 execute --local --command "SELECT user_id, provider FROM identities WHERE user_id = (SELECT id FROM users WHERE email = 'x@y.z')"` 应见**同一 user_id 两行**(email + google),users 表该邮箱仅一行;两种方式登录看到同一昵称头像。
- [ ] 反向:先 Google 建号 → 退出 → 同邮箱走「注册」→ 409「请改用 Google 登录」;走「登录」输任意密码 → 401「请用 Google 登录」。
- [ ] `state` 篡改(改 URL 参数重放)→ 400,不建会话。
- [ ] 线上配好正式 redirect URI 后部署,复验完整一轮。

### 4.8 人工前置(owner 在 Google Cloud Console 操作)
- [ ] 建(或复用)一个 GCP 项目 → 「API 和服务 → OAuth 同意屏幕」:External,填应用名/邮箱,发布(个人用途无需审核,scope 只有 openid/email)。
- [ ] 「凭据 → 创建凭据 → OAuth 客户端 ID」类型 Web application;**Authorized redirect URIs** 填两条:`https://hexa.gavin.pub/api/auth/google/callback` 与 `http://localhost:8788/api/auth/google/callback`。
- [ ] 把 client ID / client secret 配到 Pages 环境变量 `GOOGLE_CLIENT_ID`(明文可)/ `GOOGLE_CLIENT_SECRET`(encrypted),本地写入 `.dev.vars`。

---

## 5. 批次 4 · Owner 管理鉴权切换(口令 → 正式会话)

### 5.1 目标
- owner 用自己的正式账号(批次 2/3 注册的)标记 `is_owner = 1` 后,`/admin/stats` 及一切 `/admin/*` 接口凭 **owner 会话**放行;临时口令 `X-Admin-Passphrase` 通道按既有设计自动作废。
- 背景(务必理解再动手):现有 `/admin/*` 中间件是**故意留了一半的过渡态**——只要 `users` 表存在任何 `is_owner=1` 的行,它就直接 401「owner login required」,口令分支永远走不到。也就是说:**谁先把 is_owner 置 1,口令当场失效**。本批的全部意义就是在那之前把「会话放行」补上,并按正确顺序切换。
- 顺带产出 `requireOwner` 能力,供批次 8(隐藏评论)复用。

### 5.2 依赖
批次 2(必须先能注册正式账号并登录;批次 3 非必需——owner 用邮箱注册即可)。

### 5.3 非目标
- 不新增任何统计/管理功能(`/admin/stats` 数据内容零变化);评论管理在批次 8。
- 不删口令代码路径:保留「无 owner 行时口令兜底」的原样逻辑(它在 owner 标记后自然死掉,这正是 platform-upgrade-plan §2.3「自动收口、不靠人记得删」的设计;留着也保护「万一回滚 users 表」的极端场景)。

### 5.4 D1 变更
无表结构变更。有**一次性数据操作**(在代码部署之后执行,见验收顺序):
```sql
-- 换成 owner 自己的注册邮箱
UPDATE users SET is_owner = 1 WHERE email = '<owner邮箱>';
```

### 5.5 API
- [ ] `/admin/*` 中间件改为三段:
  1. `getSessionUser(c)` 有值且 `is_owner` → `next()`(新增,放最前);
  2. 否则查「是否存在 is_owner=1 行」:存在 → 401「owner login required」(原样);
  3. 不存在 → 口令兜底(原样)。
- [ ] 无新增端点。`/api/me` 已含 `isOwner`(批次 2)。

### 5.6 前端改动(`src/features/admin/AdminStatsPage.jsx`)
- [ ] 首次加载先直接 `fetch('/api/admin/stats')`(同源 fetch 默认带 Cookie,无需 credentials 配置):
  - 200 → 渲染统计(已登录 owner);
  - 401 且 error 为 `owner login required` → 显示「此页面需 owner 账号登录」+ 按钮唤起 AuthSheet(登录成功后重试请求);
  - 401 且 error 为 `access denied`(即还没有 owner 行的过渡期)→ 显示现有口令表单(原逻辑保留)。
- [ ] 口令 sessionStorage 相关代码保留不删(过渡期仍用得上)。

### 5.7 验收清单(**顺序敏感,严格照做**)
- [ ] ① 部署新代码。此时尚无 is_owner 行:验证口令方式**仍然可用**(没破坏现状)。
- [ ] ② owner 在线上注册/登录自己的正式账号,记下邮箱。
- [ ] ③ 执行 5.4 的 UPDATE(`wrangler d1 execute hexagram-db --remote --command "…"`),`SELECT id, email, is_owner FROM users WHERE is_owner = 1` 确认恰好一行。
- [ ] ④ 带旧口令请求 `/admin/stats`(curl 加 `X-Admin-Passphrase` 头)→ 401(口令已自动作废)。
- [ ] ⑤ owner 登录态浏览器打开 `/admin/stats` → 统计正常渲染,无口令表单。
- [ ] ⑥ 退出登录 → 该页显示「需 owner 账号登录」;用一个普通测试账号登录 → 仍 401 提示(非 owner 不放行)。
- [ ] ⑦ (可选)删除 Pages 环境变量 `ADMIN_PASSPHRASE`——已无用武之地。

### 5.8 人工前置
仅 5.4 的一次性 UPDATE(owner 本人执行,需要知道自己注册用的邮箱)。

---

## 6. 批次 5 · 云同步

### 6.1 目标
- 已登录用户的本地足迹(DATA_KEYS 全量:settings / quoteTheme / bookmarks / notes / divinations / reading / recentHexagrams / progress / corpusMarks / corpusNotes)与 D1 `user_data` 表双向同步:换设备、换浏览器,登录即回来。
- 合并算法即 platform-upgrade-plan §2.4a **已定案**方案,只许实现不许重设计:**标量类整键「新 updated_at 赢」;集合类按条取并集、同键比 `at` 新者赢、删除靠墓碑参与比较**(墓碑基建来自批次 1)。**首次登录 = 云端为空的同一次合并**(owner 决策 4:「本地和云端 merge 起来,做一个加项,而不是覆盖」),不写任何特例分支。
- 同步对未登录用户完全不存在(零请求、零 UI 变化);登录即开启,不设独立开关(**建议,非拍板**:owner 决策 1 把「主动开启云同步」列为唤起登录的动作之一,故「登录」本身即是开启;不再多一个开关减少状态组合)。

### 6.2 依赖
批次 1(墓碑 + bookmarks 换形 + divinations 的 `at`)、批次 2(会话)。

### 6.3 非目标
- 不做同步冲突 UI/历史版本/多端实时推送——合并是静默的,算法保证不丢加项。
- 不做墓碑清理、不做按 key 选择性同步设置项。
- 不改导出/导入/清空(它们仍是纯本地功能,和云端无关;清空本地后下次同步会从云端把数据合并回来——这是「加项」语义的自然结果,不视为 bug)。
- 不动 `reading_events` 埋点,不动 `auth_codes`。

### 6.4 D1 变更
无(`user_data (user_id, key, value, updated_at)` 建表时即为此准备;一个 key 存一整块合并后 JSON)。

### 6.5 API

**`POST /api/sync`**(需登录,`requireUser`)
- 本接口**单独放宽请求体上限**:`readJsonBody` 加可选参数 maxBytes,此处传 `SYNC_MAX_BODY_BYTES = 1_000_000`(其余接口维持 4096)。单 key value 序列化后 > 200KB → 400(**建议,非拍板**的护栏值)。
- 请求体:`{ data: { <key>: { value: <任意JSON>, at: <毫秒时间戳> } } }`——client 对每个 key 带上本地值与「本地最后编辑时间」(见 6.6 syncMeta;集合类 key 的顶层 `at` 仅作参考,合并按条内 `at`)。
- 校验:key 必须 ∈ DATA_KEYS 白名单(后端复制一份该数组常量),未知 key → 400;value 必须 JSON 可序列化(D1 CHECK `json_valid` 兜底)。允许只传部分 key。
- 服务端流程:
  1. `SELECT key, value, updated_at FROM user_data WHERE user_id = ?` 读云端全量;
  2. 逐 key 合并(规则见下);
  3. `db.batch` UPSERT 全部结果行:`INSERT … ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;
  4. 返回 `{ ok: true, data: { <key>: { value, at: <存入的updated_at> } } }`(全量,含 client 没传的 key)。
- **合并规则(照抄实现,勿再发明)**:
  - 标量类 `settings` / `quoteTheme` / `reading` / `recentHexagrams` / `notes`(notes 是遗留只读数据,按标量整块处理):比较云端行 `updated_at` 与 client `at`,新者整块胜;胜方为 client 时,存入的 `updated_at` = client `at`(截到不超过服务器当前时间 + 5 分钟,防客户端时钟跑飞)——存「编辑时间」而非「写库时间」,否则两设备交错编辑会误判新旧。客户端时钟偏差属可接受误差,不另设机制。
  - 集合类(条目均为 `{ …, at: ISO字符串 }` 或墓碑 `{ deleted: true, at }`,`at` 比较用 `Date.parse`):
    - `corpusMarks` / `corpusNotes`:两边 map 键取并集;同键比 `at` 新者留(墓碑一视同仁参与,新删除盖旧记录,防复活——§2.4a 原文);单边有则留。
    - `bookmarks`(批次 1 后的 map 形):同上。
    - `divinations`(数组):按 `id` 索引成 map 后同上,输出按 `createdAt` 降序回数组;含墓碑总量截 400(**建议,非拍板**)。
    - `progress`(**建议,非拍板**,与通用规则略有出入,理由是保住既有「只升不降」不变量):`read` / `used` 子 map 按 topic 并集,两边都有取**较早**时间(语义为「首次」);`quiz` 按 topic 字段级合并:`passed = a||b`,`best = max`,`at = max`,`total` 取 `at` 新一侧。无删除路径,无墓碑。
  - 集合类存入的 `updated_at` = `Date.now()`(仅供参考,不参与下次合并判定——判定靠条内 `at`)。

### 6.6 前端改动
- [ ] `storage.js`:`set(k, v)` 内,若 `k ∈ DATA_KEYS`:①更新 `guanxiang.v1.syncMeta`(`{ [key]: Date.now() }` 形状,不入 DATA_KEYS);②`window.dispatchEvent(new CustomEvent('gx:data-changed', { detail: { key: k } }))`。应用合并结果时会绕过此逻辑(见下),不会自触发循环。
- [ ] 新文件 `src/features/auth/sync.js`:
  - `collectLocal()`:按 DATA_KEYS 读原始存储(含墓碑,不走过滤读口——批次 1 已把「过滤读口」与「原始读写」分开,这里必须用原始口)+ syncMeta 拼请求体;
  - `applyMerged(data)`:置一个模块级 `applying` 标志后逐 key 原样写回 localStorage(直接 `set`,标志位使其跳过 syncMeta 更新与事件),syncMeta 各 key 更新为返回的 `at`,记 `guanxiang.v1.lastSyncAt = Date.now()`(不入 DATA_KEYS);
  - `syncNow()`:POST `/api/sync` → applyMerged;401 时静默清登录态(会话过期的「静默要求重新登录」,owner 决策 8);
  - `startSyncLoop(user)`:监听 `gx:data-changed`,防抖 60s 调 `syncNow`(**建议,非拍板**的间隔,对齐容量规划「1–2 次/日」量级)。
- [ ] `AuthContext.jsx`:登录成功(注册/登录/Google 回跳后的 refresh 拿到 user)→ 立即 `syncNow()`(这一次就是「首次登录合并」)并 `startSyncLoop`;登出 → 停监听。**登出不清本地数据**(本地数据本就属于这台设备,owner 未要求登出即清)。
- [ ] `SettingsSheet.jsx` 账号区(已登录时):一行「云同步:上次 xx:xx」+「立即同步」按钮(调 syncNow,转菊花,完成刷新时间)。
- [ ] 同步结果需要反映到已渲染页面的场景(如「我的」列表),接受「刷新可见」,不做全局状态推送(**建议,非拍板**,保持批次小)。

### 6.7 验收清单(用「正常窗口 + 无痕窗口」模拟两台设备,记为 A / B)
- [ ] A 未登录,先攒数据:收藏 2 段、写 1 条笔记、改一个设置。登录(新账号)→ Network 见一次 `/api/sync`;`wrangler d1 execute --remote --command "SELECT key, length(value) FROM user_data"` 见各 key 行。
- [ ] B 无痕窗口登录同一账号 → A 攒的收藏/笔记/设置全部出现(首次登录=合并,云端胜在这里表现为「带下来」)。
- [ ] B 新增一条收藏、A 同时(未同步前)新增另一条 → 各自触发/等待防抖同步后,A、B 都能看到**两条都在**(加项,不覆盖)。
- [ ] B 删除 A 建的那条收藏 → 同步 → A 点「立即同步」→ A 该条消失且不复活(墓碑跨端生效);D1 里 value 中该键为 `deleted:true`。
- [ ] A 改主题设置 → B 同步后跟上(标量新者胜)。
- [ ] 未登录窗口做任何操作 → Network 全程无 `/api/sync`。
- [ ] 登出后 `syncNow` 不再被防抖触发(改数据等 2 分钟观察 Network)。
- [ ] 导出/导入/清空仍正常;清空后手动「立即同步」→ 云端数据合并回来。

### 6.8 人工前置
无。

---

## 7. 批次 6 · 评论区(看、发、删自己的)

### 7.1 目标
- 两类挂载点(owner 决策 13,**一字不多**):
  1. **读经章评论**:锚 = `(corpus, slug, chapter)`,挂单章正文页末(原文→注疏→延伸→白话之后)。落到代码 = `ClassicReader.jsx` 的 `paged` 模式,由三个单章页传参启用:`CorpusReadPage.jsx`(九站,corpus 各站码)、`DaoReadPage.jsx`(corpus `dao`)、`ClassicsReadPage.jsx`(易经经传,corpus `yijing`)。整卷滚动页(CorpusSinglePage / DaoSinglePage)**不挂**(一页多区,噪音)。**注意一个既有代码事实**:`CorpusReadPage.jsx`/`DaoReadPage.jsx` 目前已经把 `markCtx={{ corpus, slug }}` 传给 `ClassicReader`(供逐句 ★/✎ 用),但 `ClassicsReadPage.jsx` 当前**并没有**传 `markCtx`(易经经传的逐句标记走的是另一套——`/hexagram/:id` 页面里独立的 `MarkableBlock` 组件,`ClassicsReadPage.jsx` 尚未接入)。这不影响本批:`commentCtx` 是全新、独立的 prop,`ClassicsReadPage.jsx` 直接新增 `commentCtx={{ corpus: 'yijing', slug: book }}` 即可,不依赖它是否已有 `markCtx`。
  2. **观书主页评论**:每本书一区,锚 = `('books', <书slug>, 'home')`,挂 `BookHomePage.jsx` 页末;书内文章页不挂。
  - **明确排除:`BaihuaPage.jsx`(白话整页)不挂评论区。这是 owner 有意决策,不是遗漏——日后任何人想"顺手"加上,先回 platform-upgrade-plan §7 决策 13 对齐。**
- 未登录可看全部评论;**发**才要登录——未登录时输入框位置本身就是登录引导(点它唤起 AuthSheet),页面其余位置零登录提示(owner 决策 1、11)。
- 登录用户可删**自己的**评论;服务端以会话身份校验归属,绝不信客户端传的 user id(owner 决策 12)。
- 发评论过 Cloudflare Turnstile 人机校验(既定防刷方案)+ 服务端限频。
- **懒加载铁律**(platform-upgrade-plan §2.3 容量规划的前提,不可省):打开页面不自动拉评论,用户点开评论条才发第一个请求。

### 7.2 依赖
批次 2(登录会话、AuthSheet、PixelAvatar)。不依赖 3/4/5(Google/管理/同步与评论互不阻塞)。

### 7.3 非目标
- 不做嵌套回复、点赞、置顶、分页(单锚一次取 100 条足够冷启动;超了再议)。
- 不做邮件通知(批次 7)、owner 隐藏(批次 8)——本批 owner 与常人同权,仅能删自己的。
- 不做敏感词/自动审核(owner 决策 9:仅手动隐藏,批次 8)。
- 不收紧 `comments.body` 的 DB CHECK(1–4000):500 字上限在 API 校验层实现(owner 决策 14)。**理由**:SQLite/D1 改 CHECK 需整表重建,毫无收益;4000 留作宽松的最后防线,产品约束以 API 层的 500 为准。

### 7.4 D1 变更(`migrations/0002-comments-index.sql`)
```sql
-- 锚查询与限频查询的索引;comments 表本体不动
CREATE INDEX IF NOT EXISTS idx_comments_anchor ON comments(corpus, slug, chapter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_time ON comments(user_id, created_at);
```

### 7.5 API

**锚校验(`validateAnchor`,GET/POST 共用)**:`corpus` 匹配 `/^[a-z0-9_-]{1,32}$/i`;`slug`、`chapter` 非空字符串 ≤160、无控制字符。三者与埋点 `validateBeat` 同风格。

**`GET /api/comments?corpus=&slug=&chapter=`**(无需登录)
- `SELECT c.id, c.body, c.created_at, c.user_id, u.display_name, u.avatar_seed FROM comments c JOIN users u ON u.id = c.user_id WHERE c.corpus=? AND c.slug=? AND c.chapter=? AND c.status='visible' ORDER BY c.created_at DESC LIMIT 100`。
- 可选读会话(`getSessionUser`,不 401):响应 `{ ok: true, comments: [{ id, body, createdAt, mine: <user_id===会话id>, user: { displayName, avatarSeed } }] }`。不外露 user_id 本身。

**`POST /api/comments`**(`requireUser`)— body `{ corpus, slug, chapter, body, turnstileToken }`
- `validateComment`:锚同上;`body` trim 后 1–500 字符(**500 是产品上限,在这里挡**),超限 400「评论最长 500 字」;`turnstileToken` 非空字符串 ≤2048。
- Turnstile 服务端校验:`fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify')`,form 传 `secret: env.TURNSTILE_SECRET_KEY, response: turnstileToken`;`success !== true` → 403「人机验证未通过,请重试」。
- 限频:`SELECT COUNT(*) FROM comments WHERE user_id=? AND created_at > ?`(now−60000)≥ 3 → 429「发得太快,歇一歇」(**建议,非拍板**:3 条/分钟)。
- 插入:`id = crypto.randomUUID()`,status 走默认 `visible`。返回 `201 { ok: true, comment: <同GET条目形状, mine: true> }`。

**`DELETE /api/comments/:id`**(`requireUser`)
- `DELETE FROM comments WHERE id = ? AND user_id = ?`(user_id 取自会话,**这就是归属校验**);`meta.changes === 0` → 404「评论不存在或无权删除」;成功 204。物理删除(owner 决策 12 的"删除"按本义实现;owner 的治理型"隐藏"在批次 8 是软藏,两者不同门)。

### 7.6 前端改动
- [ ] 新目录 `src/features/comments/`:
  - `CommentSection.jsx`,props `{ corpus, slug, chapter }`。折叠态:一条通栏「评论」按钮(不显示数量——数量也要请求,违背懒加载);点开才 fetch 列表。展开态:列表(PixelAvatar 28px + 昵称 + 日期 + 正文 `white-space: pre-wrap`,React 默认转义防注入)+ 底部输入区。`mine: true` 的条目带「删除」(window.confirm 后调 DELETE,成功从列表移除)。空态文案:「还没有评论,来写第一条。」
  - `config.js`:`export const TURNSTILE_SITE_KEY = '<sitekey>'`(sitekey 是公开值,硬编码即可;本地开发换 Turnstile 官方测试 sitekey `1x00000000000000000000AA`,恒通过)。
- [ ] 输入区两态:
  - 未登录:同样式的占位框,文案「登录后参与评论」,整框即按钮 → `openAuth()`(AuthContext 来的);登录成功后 user 变化,**原地**切换为真输入框,不刷新页面。**这就是全页唯一登录引导**(owner 决策 11)。
  - 已登录:textarea + 字数计 `n/500`(超 500 禁提交)+ Turnstile 容器 + 「发布」。Turnstile 脚本**首次进入已登录输入态才注入**(动态 `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async>`,一次),`turnstile.render(el, { sitekey, theme: 'auto' })`;提交成功后 `turnstile.reset(widgetId)` + 清空输入 + 新评论插到列表顶。403/429 错误就地红字。
- [ ] `ClassicReader.jsx`:新 prop `commentCtx = null`(`{ corpus, slug }`,命名对齐现有 `markCtx`);`paged` 模式且 commentCtx 存在时,在章内容最末(白话块之后)渲染 `<CommentSection corpus slug chapter={String(章号)} />`。
- [ ] `CorpusReadPage.jsx` / `DaoReadPage.jsx`:传 `commentCtx`(与各自既有 `markCtx` 同值即可,两者字段一样)。`ClassicsReadPage.jsx`:新增 `commentCtx={{ corpus: 'yijing', slug: book }}`(它目前没有 `markCtx`,这是本批唯一需要单独新增、不能"抄现有 prop"的挂载点,见 7.1 的既有代码事实说明)。
- [ ] `BookHomePage.jsx`:页末 `<CommentSection corpus="books" slug={slug} chapter="home" />`。
- [ ] CSS 进 `index.css`(`comment-section__*`),accent 一律 `var(--cinnabar)`——各站评论区自动跟站色。

### 7.7 验收清单
- [ ] 打开任一读经章(如 `/dao/daodejing/1`):页面加载时 Network **无** `/api/comments`;点「评论」才见请求(懒加载)。
- [ ] 未登录:能看到已有评论;输入框位置是「登录后参与评论」;点它弹 AuthSheet;登录后原地变输入框。页面其他任何位置无登录提示。
- [ ] 发一条:出现在列表顶;刷新后还在;换无痕窗口(未登录)也能看到。
- [ ] 501 字被前端禁 + 用 curl 直接 POST 501 字 → 400。
- [ ] 一分钟内连发 4 条 → 第 4 条 429。
- [ ] curl 不带 Cookie POST → 401;不带/伪造 turnstileToken → 403。
- [ ] 自己的评论有「删除」且删得掉;别人的没有;用 curl 伪造 DELETE 别人的 id(带自己 Cookie)→ 404。
- [ ] 挂载矩阵抽查:`/ru/lunyu/1`(九站代表)、`/classics/xici-shang/1`(易经经传)、`/dao/daodejing/1`、`/books/<某书>` 都有评论区;`/dao/daodejing`(整卷单页)、白话整页、书内文章页**没有**。
- [ ] 各站评论区 accent 跟随站色(dao 站是青,fo 站是佛金……抽两站对比)。
- [ ] 手机宽度(375px)排版不破。

### 7.8 人工前置(owner 在 Cloudflare Dash 操作)
- [ ] Turnstile → Add site:域名 `hexa.gavin.pub`,widget 模式选 **Managed**(**建议,非拍板**);得 sitekey + secret。
- [ ] sitekey 写进 `src/features/comments/config.js`;secret 配 Pages 环境变量 `TURNSTILE_SECRET_KEY`(encrypted);本地 `.dev.vars` 用官方测试 secret `1x0000000000000000000000000000000AA`。

---

## 8. 批次 7 · 新评论邮件通知

### 8.1 目标
- 任何人发出一条评论,owner 邮箱在一分钟内收到一封通知邮件(谁、在哪一章、全文、直达链接)。**最简实现**(owner 决策 10):一条评论一封信,无聚合、无角标、无退订管理。
- 发信失败绝不影响评论发布本身(异步 + 只记日志)。

### 8.2 依赖
批次 6(通知挂在 `POST /api/comments` 成功路径上)。

### 8.3 非目标
- 不做通知中心/角标/每日摘要(owner 明确推后)。
- 不做给评论者的邮件(如"有人回复你")——没有回复功能。
- 不做邮件模板美化,纯文本即可。

### 8.4 D1 变更
无。

### 8.5 API/后端改动
- [ ] 选型:**Resend HTTP API**(纯 `fetch`,Workers 原生可用,免费档 100 封/日,个人站量级绰绰有余)。**注意**:platform-upgrade-plan §2.4 曾为另一件事(邮箱验证码登录,已推后)提到 Resend——两个功能**共用同一个 Resend 账号与 API key,但互不相干**,先为通知把账号建好,将来验证码批次直接复用。
- [ ] `POST /api/comments` 成功插入后:
  ```js
  c.executionCtx.waitUntil(sendCommentNotification(c.env, comment, user))
  ```
  `waitUntil` 保证响应先回、发信在后;`sendCommentNotification` 内部 try/catch,失败仅 `console.error`。
- [ ] `sendCommentNotification`:`env.RESEND_API_KEY` 或 `env.OWNER_NOTIFY_EMAIL` 缺失时直接 return(本地开发静默跳过);评论者是 owner 本人时跳过(**建议,非拍板**,自己给自己发信没意义)。发送:
  - `POST https://api.resend.com/emails`,头 `Authorization: Bearer <RESEND_API_KEY>`,JSON:`from: '观象 <notify@gavin.pub>'`(发信域名必须是 Resend 已验证域)、`to: env.OWNER_NOTIFY_EMAIL`、`subject: '观象新评论 · <corpus>/<slug>/<chapter>'`、`text`: 昵称 + 时间 + 正文全文 + 直达链接。
- [ ] 直达链接辅助函数 `commentPageUrl(corpus, slug, chapter)`(批次 8 后台也用):
  - `books` → `https://hexa.gavin.pub/books/<slug>`
  - `yijing` → `https://hexa.gavin.pub/classics/<slug>/<chapter>`
  - 其余(dao 及九站)→ `https://hexa.gavin.pub/<corpus>/<slug>/<chapter>`

### 8.6 前端改动
无。

### 8.7 验收清单
- [ ] 本地(不配 key):发评论一切正常,无报错(静默跳过验证)。
- [ ] 线上配好 key 后:用测试账号发一条 → owner 邮箱一分钟内收到;主题/昵称/正文/链接正确,点链接直达该章。
- [ ] 检查未进垃圾箱;信头 SPF/DKIM 通过(邮箱客户端「显示原文」里看)。
- [ ] owner 自己发评论 → 不收信。
- [ ] 故意把 `RESEND_API_KEY` 改错再发 → 评论仍发布成功(通知失败不阻断),Pages 部署日志里有 error。改回。

### 8.8 人工前置(owner 操作)
- [ ] 注册 Resend 账号;Domains → 添加 `gavin.pub`,按提示到 DNS 服务商加 SPF/DKIM 记录,等待验证通过(通常几分钟)。
- [ ] 建 API key;配 Pages 环境变量 `RESEND_API_KEY`(encrypted)、`OWNER_NOTIFY_EMAIL`(owner 收件邮箱,明文可)。

---

## 9. 批次 8 · 评论管理(owner 隐藏/恢复)

### 9.1 目标
- owner 用**正式账号登录后**(批次 4 的会话鉴权,非口令),不写 SQL 就能治理评论:
  1. **就地隐藏**:任何评论区里,owner 看到每条评论旁多一个「隐藏」(已隐藏则「恢复」);隐藏 = `status='hidden'`(软藏,不删数据),普通访客即刻不可见,owner 视角保留为置灰条目。
  2. **后台评论流**:`/admin/stats` 页末新增「最近评论」——全站最近 50 条(含已隐藏),每条带锚链接与隐藏/恢复按钮,配合批次 7 的邮件,不必逐页巡逻。
- 这补完了批次 4 预告的「评论治理动作走 owner 会话」,口令时代彻底翻篇。

### 9.2 依赖
批次 4(`/admin/*` 会话鉴权 + owner 账号已标记)、批次 6(评论本体)。

### 9.3 非目标
- 不做删除他人评论(隐藏已够,保留数据可回溯)、不做封禁用户、不做批量操作。
- 不做敏感词/自动过滤(owner 决策 9)。
- 不做隐藏原因/申诉流——个人站不需要。

### 9.4 D1 变更
无(`comments.status IN ('visible','hidden')` 建表已备)。

### 9.5 API
- [ ] **`PATCH /api/admin/comments/:id`**(在 `/admin/*` 中间件之后,即仅 owner 会话)— body `{ status: 'visible' | 'hidden' }`,其余值 400;`UPDATE comments SET status = ? WHERE id = ?`,`changes === 0` → 404;成功 204。
- [ ] **`GET /api/admin/comments?limit=50`**(同上仅 owner)— `SELECT c.id, c.corpus, c.slug, c.chapter, c.body, c.status, c.created_at, u.display_name FROM comments c JOIN users u … ORDER BY c.created_at DESC LIMIT ?`(limit 1–200,默认 50)。响应 `{ ok: true, comments: [...] }`。
- [ ] **`GET /api/comments` 改动**:会话用户为 owner 时,去掉 `status='visible'` 条件并在条目里附 `status` 字段(owner 能看到已隐藏的);普通人/未登录行为不变(仅 visible,无 status 字段)。

### 9.6 前端改动
- [ ] `CommentSection.jsx`:`user.isOwner` 时每条评论 meta 行加「隐藏」/「恢复」文字按钮(与「删除」同样式位);`status === 'hidden'` 的条目整条置灰 + 「已隐藏」角标(仅 owner 可见这些条目)。操作成功就地更新条目状态。
- [ ] `AdminStatsPage.jsx`:统计图表之下加「最近评论」区块:时间、昵称、锚(用批次 7 的 `commentPageUrl` 生成链接,前端同构一份)、正文(截 120 字)、状态、隐藏/恢复按钮。数据来自 `GET /api/admin/comments`,与 stats 一起加载。

### 9.7 验收清单
- [ ] owner 登录,任一评论区:每条评论见「隐藏」;普通账号与未登录:不见。
- [ ] 隐藏一条 → 无痕窗口该条消失;owner 视角置灰 + 「恢复」;恢复后无痕窗口重新可见。
- [ ] `/admin/stats` 底部见最近评论(含刚隐藏那条,状态标注正确);点锚链接直达对应章;在后台隐藏/恢复同样生效。
- [ ] curl 用普通账号 Cookie 调 PATCH → 401;不带 Cookie → 401;owner Cookie → 204(证明治理动作走的是批次 4 的会话鉴权)。
- [ ] 用户删自己评论(批次 6 功能)不受影响。

### 9.8 人工前置
无。

---

## 10. 后续批次(暂不设计,防遗忘清单)

以下各项均为**有意推迟**,不是遗漏。任何一项要启动时,另起设计小节,不改本文已交付批次。

| 项 | 为什么现在不做 |
|---|---|
| 邮箱验证码登录 | owner 决策 3 明确推后;`auth_codes` 表已预留。上线时**顺带给邮箱注册补所有权验证**,关闭批次 2 安全注记里的「抢注占号」窗口 |
| 手机验证码登录 | owner 决策 3 推后;是国内登录的终态方案(§1.2/§2.6),依赖短信通道选型 |
| 找回/重置密码 | 依赖邮件验证码基建(上一行);当前忘记密码者可用同邮箱 Google 登录兜底 |
| 注销账号(彻底删数据) | owner 决策 5:第一批不做;退出登录已覆盖日常需要 |
| 头像照片上传 | owner 决策 6:后续批次。届时 `ALTER TABLE users ADD COLUMN avatar_url TEXT` + R2 存储;API 的 `avatarUrl: null` 占位与前端「有 url 用 url」的渲染缝已留好 |
| 昵称自助修改 | owner 决策 7:后续批次;届时 `PATCH /api/me` 一个字段即可 |
| 更完整评论通知(角标/摘要/通知中心) | owner 决策 10:先只做单封邮件 |
| 自动内容过滤/前置审核 | owner 决策 9:只做手动隐藏 |
| 「记住我」/会话续期 | owner 决策 8:1 个月定长,过期静默重登即可 |
| iOS 壳内登录适配 | platform-upgrade-plan §2.4a 已定 web 先行,壳内隐藏入口,后补 Capacitor 会话/Cookie 适配(届时才涉及 Apple 登录合规) |
| 逐段评论/嵌套回复/owner 置顶 | §2.5 已定最小集;锚字段加 `para` 即可扩展,不动架构 |
| 注册接口加 Turnstile | 批次 2 判断暂不加(无成本副作用);被刷再补,基建批次 6 已备 |
| 墓碑定期清理 | §2.4a 已定:量级可忽略,按需再说 |
