// Apple 授权码换 refresh_token、注销账号时撤销授权(原生 App「观象 · 书桌」,2026-11-22)。
// App Store 审核要求:提供「通过 Apple 登录」的 App,在 App 内注销账号时须调苹果 revoke 接口撤销该用户的授权。
// 撤销要交 refresh_token(或 access_token),而 refresh_token 只能在登录时拿 authorizationCode 去 /auth/token 换 ——
// 所以登录时换一次、存在 identities 行上,注销时拿出来撤销。
//
// 两个接口都要 client_secret:一枚 ES256 JWT,用开发者后台建的「Sign in with Apple」私钥(.p8)签。
// 密钥三件走环境变量(owner 自己用 wrangler pages secret put 设,代码里不出现):
//   APPLE_TEAM_ID · APPLE_KEY_ID · APPLE_PRIVATE_KEY(.p8 的 PEM 全文)
// 没配齐时两件事都静默跳过(登录照常、注销照常),不发任何外部请求。
// client_id 用 identityToken 的 aud(即 App 的 bundle id),与苹果签发授权码时的 client 一致。
//
// 只用 WebCrypto(Workers 运行时没有 Node crypto)。**日志里绝不写 token / 授权码 / 密钥**,只写 HTTP 状态与苹果的 error 代号。

export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke'
const APPLE_AUDIENCE = 'https://appleid.apple.com'
// client_secret 苹果允许最长半年;每次现签,给 5 分钟足够
const CLIENT_SECRET_TTL_S = 5 * 60
const REQUEST_TIMEOUT_MS = 8000
// 授权码是苹果给的短串(实测几十到一百多字符);上限放宽,只防垃圾
const AUTH_CODE_RE = /^[\x21-\x7e]{1,1024}$/

export const isAppleAuthorizationCode = (value) => typeof value === 'string' && AUTH_CODE_RE.test(value)

export function appleSecretsConfigured(env) {
  return Boolean(
    typeof env?.APPLE_TEAM_ID === 'string' && env.APPLE_TEAM_ID.trim()
    && typeof env?.APPLE_KEY_ID === 'string' && env.APPLE_KEY_ID.trim()
    && typeof env?.APPLE_PRIVATE_KEY === 'string' && env.APPLE_PRIVATE_KEY.trim(),
  )
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const jsonPart = (obj) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(obj)))

// .p8 是 PKCS#8 PEM。wrangler secret 里有时换行被存成字面量「\n」,一并认
function pemToPkcs8(pem) {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '')
  if (!body || !/^[A-Za-z0-9+/]+=*$/.test(body)) throw new Error('APPLE_PRIVATE_KEY is not a PEM')
  return Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0))
}

// client_secret JWT:header {alg:ES256, kid},payload {iss:团队 ID, iat, exp, aud:https://appleid.apple.com, sub:client_id}。
// WebCrypto 的 ECDSA 签名直接就是 r‖s 64 字节,正是 JWS 要的格式,不用转 DER。
export async function buildAppleClientSecret({ teamId, keyId, privateKeyPem, clientId, now = Date.now() }) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const iat = Math.floor(now / 1000)
  const signingInput = `${jsonPart({ alg: 'ES256', kid: keyId })}.${jsonPart({
    iss: teamId,
    iat,
    exp: iat + CLIENT_SECRET_TTL_S,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  })}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`
}

function clientSecretFor(env, clientId, now) {
  return buildAppleClientSecret({
    teamId: env.APPLE_TEAM_ID.trim(),
    keyId: env.APPLE_KEY_ID.trim(),
    privateKeyPem: env.APPLE_PRIVATE_KEY,
    clientId,
    now,
  })
}

async function postForm(fetchImpl, url, fields) {
  return fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
}

// 苹果出错时回 {error: "invalid_grant"} 一类代号;只取这个代号进日志
async function appleErrorCode(res) {
  try {
    const body = await res.json()
    return typeof body?.error === 'string' ? body.error.slice(0, 40) : ''
  } catch {
    return ''
  }
}

// 授权码 → refresh_token。成功返回字符串;没配密钥返回 null(不发请求);苹果拒绝 / 连不上抛错(调用方记日志后继续登录)
export async function exchangeAppleAuthorizationCode({ env, clientId, code, now = Date.now(), fetchImpl = fetch }) {
  if (!appleSecretsConfigured(env) || !isAppleAuthorizationCode(code) || typeof clientId !== 'string' || !clientId) return null
  const res = await postForm(fetchImpl, APPLE_TOKEN_URL, {
    client_id: clientId,
    client_secret: await clientSecretFor(env, clientId, now),
    code,
    grant_type: 'authorization_code',
  })
  if (!res.ok) throw new Error(`Apple token HTTP ${res.status} ${await appleErrorCode(res)}`.trim())
  const body = await res.json().catch(() => null)
  const refreshToken = body?.refresh_token
  if (typeof refreshToken !== 'string' || !refreshToken || refreshToken.length > 2048) {
    throw new Error('Apple token response has no refresh_token')
  }
  return refreshToken
}

// 撤销授权。没配密钥返回 false(不发请求);成功 true;苹果拒绝 / 连不上抛错(调用方记日志后照常注销)
export async function revokeAppleRefreshToken({ env, clientId, refreshToken, now = Date.now(), fetchImpl = fetch }) {
  if (!appleSecretsConfigured(env) || typeof refreshToken !== 'string' || !refreshToken || typeof clientId !== 'string' || !clientId) return false
  const res = await postForm(fetchImpl, APPLE_REVOKE_URL, {
    client_id: clientId,
    client_secret: await clientSecretFor(env, clientId, now),
    token: refreshToken,
    token_type_hint: 'refresh_token',
  })
  if (!res.ok) throw new Error(`Apple revoke HTTP ${res.status} ${await appleErrorCode(res)}`.trim())
  return true
}

// 错误对象里可能带 URL 之类,日志只留一句短消息(上面抛出的消息本身不含任何凭证)
export const safeErrorMessage = (error) => String(error?.name === 'TimeoutError' ? 'timeout' : (error?.message || error)).slice(0, 120)
