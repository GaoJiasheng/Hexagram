// 原生 App 走网页 Google 登录后「回到 App」用的一次性短码(2026-11-22)。
// /auth/google/start?native=1 → Google → callback 不种 cookie,改发一枚短码并 302 到 guanxiangdesk://auth?code=…
// → App 拿短码 POST /auth/native/exchange 换会话 token。
// 存放复用 auth_codes 表:target = native:<userId>(一人同时只留一枚,新码顶掉旧码),只存哈希,2 分钟有效,用一次即删。
// 可选 PKCE(S256):start 带 code_challenge 时,exchange 必须交出对应的 code_verifier ——
// 自定义 scheme 可能被别的 App 抢注截走短码,有了 verifier,截到短码也换不出会话。
import { hashCode } from './auth-code.js'

export const NATIVE_CODE_TTL_MS = 2 * 60 * 1000
export const NATIVE_REDIRECT_URL = 'guanxiangdesk://auth'
export const nativeCodeTarget = (userId) => `native:${userId}`

const USER_ID_RE = /^[A-Za-z0-9-]{1,64}$/
const SECRET_RE = /^[A-Za-z0-9_-]{43}$/
// RFC 7636:challenge = BASE64URL(SHA256(verifier)),43 字符;verifier 43–128 位 unreserved 字符
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/

function bytesToBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const isCodeChallenge = (value) => typeof value === 'string' && CHALLENGE_RE.test(value)
export const isCodeVerifier = (value) => typeof value === 'string' && VERIFIER_RE.test(value)

export async function challengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return bytesToBase64Url(new Uint8Array(digest))
}

// 短码 = <userId>.<32 字节随机>;库里只存 hash(target, 随机部分|challenge)
export function generateNativeCode(userId, random = (a) => crypto.getRandomValues(a)) {
  const bytes = new Uint8Array(32)
  random(bytes)
  const secret = bytesToBase64Url(bytes)
  return { code: `${userId}.${secret}`, secret, target: nativeCodeTarget(userId) }
}

export function parseNativeCode(code) {
  if (typeof code !== 'string' || code.length > 200) return null
  const dot = code.lastIndexOf('.')
  if (dot < 1) return null
  const userId = code.slice(0, dot)
  const secret = code.slice(dot + 1)
  if (!USER_ID_RE.test(userId) || !SECRET_RE.test(secret)) return null
  return { userId, secret, target: nativeCodeTarget(userId) }
}

export function nativeCodeHash(target, secret, challenge) {
  return hashCode(target, `${secret}|${challenge || ''}`)
}
