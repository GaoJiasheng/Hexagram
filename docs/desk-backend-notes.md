# 观象 · 书桌 —— 服务端说明(2026-11-22)

原生 App `pub.gavin.hexa.desk` 与网站共用账号与云同步。下面列的都是服务端已改好的部分,代码在 `functions/api/[[route]].js`、`server/apple-auth.js`、`server/native-auth.js`,测试在 `server/desk-backend.test.js`。

## 上线前 owner 要做的事(按顺序)

1. **先在远端 D1 执行迁移 `migrations/0007-apple-identity.sql`,再发代码。** 它重建 `identities` 表,让 `provider` 的 CHECK 认 `'apple'`(SQLite 改不了已有的 CHECK)。不动 users 表,旧代码不受影响。执行前先跑 `SELECT sql FROM sqlite_master WHERE tbl_name='identities'`,核对远端结构和迁移的假设一致:五列、无额外索引。
2. 环境变量 `APPLE_AUDIENCES`(选填,逗号分隔):允许的 `aud`,不设时默认 `pub.gavin.hexa.desk`。这个值不是 secret,Apple 登录也不需要 secret。
3. 苹果开发者后台:给 App ID `pub.gavin.hexa.desk` 勾选「Sign in with Apple」,并重新生成描述文件。
4. Google 原生回跳不需要新配置,沿用现有的 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 和已登记的 `/api/auth/google/callback`。App 要注册 URL scheme `guanxiangdesk`。

## 接口变化

| 接口 | 请求 | 成功 | 失败 |
|---|---|---|---|
| `POST /api/auth/logout` | 改为同时认 cookie 和 `Authorization: Bearer` | 204,并删除服务端会话 | 503 |
| `POST /api/auth/apple`(新) | `{identityToken, displayName?}`;建议带 `X-Client: native` | `{ok, user, token}`(native)或 `{ok, user}` + Set-Cookie | 400 缺凭证 · 401 验签或声明不符 · 409 该邮箱账号已绑定另一个 Apple ID · 503 取不到苹果公钥 |
| `GET /api/auth/google/start?native=1[&code_challenge=…]` | `code_challenge` 为 S256(43 位 base64url),选填 | 302 去 Google | 400 challenge 形状不对 |
| `GET /api/auth/google/callback` | 网页模式行为不变 | native 模式:302 `guanxiangdesk://auth?code=<短码>` | native 模式:302 `guanxiangdesk://auth?error=cancelled\|no_code\|google_failed\|unavailable` |
| `POST /api/auth/native/exchange`(新) | `{code, verifier?}` | `{ok, user, token}`,不种 cookie | 400「登录码无效或已过期」 · 503 |
| `DELETE /api/me` | 账号没有邮箱时(Apple 未共享邮箱),`confirm` 须为字符串「注销账号」 | `{ok:true}` | 400 |
| `POST /api/sync` | 新增两个 MAP 键;`highlights` 单键上限 1,000,000 字节(其余仍为 200,000);整包上限 4,000,000 字节 | 同前 | 400 未知键 / 值过大 |

Apple 验签规则:用 `https://appleid.apple.com/auth/keys` 的公钥验 RS256,公钥按 kid 缓存 6 小时。遇到缓存里没有的 kid 会重取,但两次重取至少隔 60 秒;重取失败时,已过期的缓存可以兜底。声明须满足 `iss = https://appleid.apple.com`、`aud ∈ APPLE_AUDIENCES`、`exp` 未过(容差 60 秒)。只接受 `alg = RS256`。

Apple 账号解析顺序:
1. 先按 `sub` 找已绑定的账号。
2. 找不到时,若 `email_verified` 为真,按邮箱并入已有账号(邮箱注册的和 Google 的都算),并把邮箱标为已验证。
3. 再找不到就新建账号。邮箱可以缺失,也可以是中转邮箱;如果邮箱未验证、却已被别的账号占用,新账号不写邮箱。昵称取 `displayName`(24 字以内,过内容过滤),没有就取邮箱前缀;中转邮箱或没有邮箱时叫「读者」。

Google 短码的规则:
- 格式为 `<userId>.<32 字节随机>`,有效期 2 分钟,只能用一次(靠条件 DELETE 保证)。
- 存在 `auth_codes` 表,`target = native:<userId>`,只存哈希。同一人发新码会顶掉旧码;输错 5 次作废。

## 同步新键(网页端只收发,不使用)

- `highlights`(MAP,逐条按记录内 `at` 比较,新者胜):
  - 键为记录 id(UUID)。
  - 值为 `{book, corpus, slug, ch, no, layer, seg, start, end, text, color, note?, at}`,删除用墓碑 `{deleted:true, at}`。
  - `at` 为 ISO 字符串。服务端不校验记录内部字段,多带字段也照存。
- `finished`(MAP):键为 `corpus:slug`,值为 `{at}` 或 `{deleted:true, at}`。
- 已有键放宽后的情况:服务端对记录形状本来就不做校验。`readPos`(SCALAR,整值按 `at` 新者胜)多带 `off` / `dev`,`readDays`(MAP)多带字数 `c`,都会原样存回,有测试钉住。
- MAP 合并是并集。网页端发空 `{}` 不会抹掉 App 写入的条目,删除只能走墓碑。
- 两处 `DATA_KEYS` 已同步登记:`src/features/yijing/storage.js` 和服务端。

## 原生端三种登录怎么调

1. **邮箱**:沿用现有的 `/auth/register`、`/auth/login`、`/auth/password/reset`,请求头带 `X-Client: native`,响应体里取 `token`。之后每个请求带 `Authorization: Bearer <token>`。登出调 `POST /auth/logout`,带同一个 Bearer 头。
2. **Apple**:
   - 用 `ASAuthorizationAppleIDProvider` 取 `identityToken`(UTF-8 字符串),POST `/api/auth/apple`,带 `X-Client: native`。
   - 首次授权时,把 `fullName` 拼成 `displayName` 一起发;以后苹果不会再给名字。
3. **Google**:
   - App 生成 `verifier`(43–128 位),算出 `challenge = base64url(sha256(verifier))`。
   - 用 `ASWebAuthenticationSession`(callbackURLScheme `guanxiangdesk`)打开 `https://hexa.gavin.pub/api/auth/google/start?native=1&code_challenge=<challenge>`。
   - 回调 URL 里取 `code`,POST `/api/auth/native/exchange {code, verifier}`,得到 `token`。
   - **强烈建议带 PKCE**:不带也能用,但自定义 scheme 可能被别的 App 抢注截走短码。

## 没验证 / 没做的

- 只在 vitest 里验过:Apple 验签用的是测试自己生成的 RSA 密钥,D1 用 node:sqlite 模拟。**没有用真实的 Apple token、真实的 Google、远端 D1 跑过。**
- 迁移 0007 只在本地按 `schema.sql` 的结构验过,远端 `identities` 的实际结构没核对。
- `schema.sql` 补了 `users.email_verified_at` 一列:迁移 0006 早已在线上加过这一列,这次只是让文件和线上对齐,不需要再迁移。
- 没做的:
  - Apple 的 `nonce` 防重放:identityToken 在有效期内(约 10 分钟)可以被重放。
  - 注销账号时调苹果 revoke 接口:App Store 要求过,需要 client secret 和 authorization code,目前没有。
  - 登录接口限流。
- 网页端会把 `highlights` 原样存进 localStorage,单键最大约 1MB,在浏览器配额内,但会占掉一部分。
