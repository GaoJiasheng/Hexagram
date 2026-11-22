# 观象 · 书桌 —— 服务端说明(2026-11-22)

原生 App `pub.gavin.hexa.desk` 与网站共用账号与云同步。下面列的都是服务端已改好的部分,代码在 `functions/api/[[route]].js`、`server/apple-auth.js`、`server/apple-token.js`、`server/native-auth.js`,测试在 `server/desk-backend.test.js`。

## 上线前 owner 要做的事(按顺序)

1. **先在远端 D1 执行迁移 `migrations/0007-apple-identity.sql`,再发代码。** 它重建 `identities` 表:`provider` 的 CHECK 加上 `'apple'`(SQLite 改不了已有的 CHECK),并新增两列可空的 `refresh_token`、`refresh_aud`(注销时撤销 Apple 授权用)。不动 users 表;旧代码按列名读写,不受影响。执行前先跑 `SELECT type, name, sql FROM sqlite_master WHERE tbl_name='identities'`,核对远端结构和迁移的假设一致:一条 table(五列 `user_id, provider, provider_uid, created_at, secret`)加两条 `sqlite_autoindex_identities_*`,别无索引和触发器。新代码会读写那两列,**迁移没上之前发代码,Apple 登录与注销都会报错**。
2. 环境变量 `APPLE_AUDIENCES`(选填,逗号分隔):允许的 `aud`,不设时默认 `pub.gavin.hexa.desk`。这个值不是 secret。
3. 苹果开发者后台:给 App ID `pub.gavin.hexa.desk` 勾选「Sign in with Apple」,并重新生成描述文件。
4. **新:建一把「Sign in with Apple」私钥,设三个 secret。** 注销时撤销 Apple 授权要用(App Store 审核要求)。owner 自己做,密钥不经过任何代理或会话:
   1. 开发者后台 → Certificates, Identifiers & Profiles → Keys → 「+」;勾选 **Sign in with Apple**,点 Configure,Primary App ID 选 `pub.gavin.hexa.desk`,保存后 Register。
   2. 下载 `AuthKey_<KEYID>.p8`(**只能下载一次**,存进密码管理器);记下这把钥的 Key ID(10 位)和账号的 Team ID(10 位,Membership 页可查)。
   3. 在仓库根目录设 Pages secret(项目 `hexa-gavin-pub`),设完要重新部署一次才生效:
      ```bash
      npx wrangler pages secret put APPLE_TEAM_ID --project-name=hexa-gavin-pub      # 粘 Team ID
      npx wrangler pages secret put APPLE_KEY_ID --project-name=hexa-gavin-pub       # 粘 Key ID
      npx wrangler pages secret put APPLE_PRIVATE_KEY --project-name=hexa-gavin-pub < AuthKey_<KEYID>.p8
      ```
      第三条从文件重定向进去,PEM 的换行原样保留;万一换行被存成了字面量 `\n` 也认。
   4. 三个没配齐时,服务端静默跳过换码与撤销:登录、注销照常,不发外部请求。所以 secret 可以晚于代码上线,但**密钥配上之前登录的 Apple 用户,库里没有 refresh_token,注销时撤销不了**;他们下次登录就补上了。最好在 App 送审前配好。
5. Google 原生回跳不需要新配置,沿用现有的 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 和已登记的 `/api/auth/google/callback`。App 要注册 URL scheme `guanxiangdesk`。

## 接口变化

| 接口 | 请求 | 成功 | 失败 |
|---|---|---|---|
| `POST /api/auth/logout` | 改为同时认 cookie 和 `Authorization: Bearer` | 204,并删除服务端会话 | 503 |
| `POST /api/auth/apple`(新) | `{identityToken, nonce, authorizationCode?, displayName?}`;建议带 `X-Client: native` | `{ok, user, token}`(native)或 `{ok, user}` + Set-Cookie | 400 缺凭证 / 缺 nonce · 401 验签、声明或 nonce 不符 · 409 该邮箱账号已绑定另一个 Apple ID · 503 取不到苹果公钥 |
| `GET /api/auth/google/start?native=1&code_challenge=…` | `code_challenge` 为 S256(43 位 base64url),**native 模式必需**;网页模式不看 | 302 去 Google | 400 native 模式缺 challenge 或形状不对 |
| `GET /api/auth/google/callback` | 网页模式行为不变 | native 模式:302 `guanxiangdesk://auth?code=<短码>` | native 模式:302 `guanxiangdesk://auth?error=cancelled\|no_code\|google_failed\|unavailable` |
| `POST /api/auth/native/exchange`(新) | `{code, verifier}`,verifier **必需** | `{ok, user, token}`,不种 cookie | 400 `invalid verifier`(缺或形状不对) · 400「登录码无效或已过期」(含 verifier 不配对) · 503 |
| `DELETE /api/me` | 账号没有邮箱时(Apple 未共享邮箱),`confirm` 须为字符串「注销账号」;删号前先撤销该用户的 Apple 授权(尽力而为) | `{ok:true}` | 400 |
| `POST /api/sync` | 新增两个 MAP 键;`highlights` 单键上限 1,000,000 字节(其余仍为 200,000);整包上限 4,000,000 字节 | 同前 | 400 未知键 / 值过大 |

Apple 验签规则:用 `https://appleid.apple.com/auth/keys` 的公钥验 RS256,公钥按 kid 缓存 6 小时。遇到缓存里没有的 kid 会重取,但两次重取至少隔 60 秒;重取失败时,已过期的缓存可以兜底。声明须满足 `iss = https://appleid.apple.com`、`aud ∈ APPLE_AUDIENCES`、`exp` 未过(容差 60 秒)。只接受 `alg = RS256`。

## 三项加固(2026-11-22 第二轮)

1. **Apple nonce,必需。** App 每次点「通过 Apple 登录」现生成随机 nonce(32 字节 base64url,43 位),授权请求里放 `SHA256(nonce)` 的小写十六进制,苹果把它写进 identityToken 的 `nonce` 声明;App 把原始值作为请求体 `nonce` 发来。服务端核 `sha256_hex(body.nonce) === 声明`,定长比较,声明大小写不敏感。请求体缺 nonce 或形状不对(8–256 位可见 ASCII)→ 400;令牌没有 nonce 声明或对不上 → 401。截获的 identityToken 因此无法重放。
   - **为什么直接做成必需,不留宽松期**:唯一的客户端是书桌 App,它每次都带(`AccountSheet.swift` 的请求闭包每次都设 `req.nonce`,`Account.swift` 把原始值发来);网页端没有 Apple 登录;App 还没发行过。将来若有不带 nonce 的客户端,它会被 400 拒掉。
2. **Google 原生流程 PKCE 必需。** `start?native=1` 不带合法 `code_challenge` → 400,不发 cookie。`/auth/native/exchange` 不带 `verifier` 或形状不对 → 400;不配对 → 与输错码同样处理(计次,5 次作废)。App 每次都带:verifier 是 48 字节 base64url(64 位),challenge = base64url(SHA256(verifier))。网页 Google 登录不看这个参数,行为不变,有测试钉住。
3. **注销时撤销 Apple 授权。** 代码在 `server/apple-token.js`。
   - 登录:App 多发 `authorizationCode`(`ASAuthorizationAppleIDCredential.authorizationCode`,一次性,5 分钟有效)。配齐 `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` 时,服务端 POST `https://appleid.apple.com/auth/token`,表单为 `client_id`(令牌的 `aud`,即 bundle id)、`client_secret`、`code`、`grant_type=authorization_code`。回来的 `refresh_token` 连同 `client_id` 存到这条 Apple identity 的 `refresh_token` / `refresh_aud`。换失败(苹果拒绝、8 秒超时、私钥坏)只记日志,**登录照常成功**。
   - `client_secret` 每次现签:ES256 JWT,头 `{alg:ES256, kid:Key ID}`,声明 `{iss:Team ID, iat, exp:iat+300, aud:https://appleid.apple.com, sub:client_id}`,用 WebCrypto 签。
   - 注销:`DELETE /api/me` 删行之前,对该用户每条存了 refresh_token 的 Apple identity POST `https://appleid.apple.com/auth/revoke`,表单为 `client_id`、`client_secret`、`token`、`token_type_hint=refresh_token`。失败只记日志,不挡注销。
   - 没配密钥或没存 token:静默跳过,不发请求。日志只写 HTTP 状态和苹果回的 `error` 代号,绝不写 token、授权码、密钥(有测试扫日志)。
   - refresh_token 明文存在 D1,和会话表一样靠 D1 访问控制保护;单拿它换不出 access token,还要 client_secret。同一用户再次登录,新 token 覆盖旧的;苹果的 revoke 撤销的是该用户对本 App 的整份授权,撤最新一枚即可。

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
   - 每次登录现生成随机 `nonce`,授权请求里设 `request.nonce = sha256_hex(nonce)`。
   - 用 `ASAuthorizationAppleIDProvider` 取 `identityToken` 和 `authorizationCode`(都按 UTF-8 转成字符串),POST `/api/auth/apple {identityToken, nonce, authorizationCode}`,带 `X-Client: native`。
   - 首次授权时,把 `fullName` 拼成 `displayName` 一起发;以后苹果不会再给名字。
3. **Google**:
   - App 生成 `verifier`(43–128 位),算出 `challenge = base64url(sha256(verifier))`。
   - 用 `ASWebAuthenticationSession`(callbackURLScheme `guanxiangdesk`)打开 `https://hexa.gavin.pub/api/auth/google/start?native=1&code_challenge=<challenge>`。
   - 回调 URL 里取 `code`,POST `/api/auth/native/exchange {code, verifier}`,得到 `token`。
   - PKCE 必需:不带 challenge / verifier 一律 400(自定义 scheme 可能被别的 App 抢注截走短码)。

## 没验证 / 没做的

- 只在 vitest 里验过:Apple 验签用的是测试自己生成的 RSA 密钥;client_secret 用测试生成的 P-256 密钥对验签;苹果的 token / revoke 接口是 mock;D1 用 node:sqlite 模拟。**没有用真实的 Apple token、真实的苹果 token / revoke 接口、真实的 Google、远端 D1 跑过。** 苹果接口的回包形状(`refresh_token` 字段、错误体 `{error}`)是按苹果文档写的。
- 迁移 0007 在本地按「线上现有结构」验过:`server/test-d1.js` 的 `schemaBefore0007()` 用 3d71b91 的建表语句加 0001 的 `ALTER ADD COLUMN secret` 重建线上那张表;跑完迁移,核对数据不丢,列、索引、外键与 `schema.sql` 新建的一致。远端的实际结构仍请按上面第 1 条先查一遍。
- `schema.sql` 补了 `users.email_verified_at` 一列:迁移 0006 早已在线上加过这一列,这次只是让文件和线上对齐,不需要再迁移。
- 没做的:
  - 登录接口限流。
  - 苹果的服务端通知(用户在系统设置里停用本 App 的 Apple 登录、删除 Apple ID 时推送的事件)没接。
- 网页端会把 `highlights` 原样存进 localStorage,单键最大约 1MB,在浏览器配额内,但会占掉一部分。
