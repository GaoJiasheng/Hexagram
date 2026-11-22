// 通过 Apple 登录(原生 App「观象 · 书桌」,2026-11-22)。
// App 端用 AuthenticationServices 拿到 identityToken(苹果签发的 RS256 JWT),POST /api/auth/apple 交给这里验:
//   签名 —— 用 https://appleid.apple.com/auth/keys 的公钥(按 kid 缓存),WebCrypto RSASSA-PKCS1-v1_5 + SHA-256
//   iss === https://appleid.apple.com、aud ∈ APPLE_AUDIENCES(默认 pub.gavin.hexa.desk)、exp 未过
// 纯函数 + 可注入的取公钥函数,便于单测;读写 D1 的账号解析也在这里(仿 google-auth.js 的 resolveGoogleAccount)。

export const APPLE_ISSUER = 'https://appleid.apple.com'
export const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
export const DEFAULT_APPLE_AUDIENCES = ['pub.gavin.hexa.desk']
const KEY_CACHE_TTL_MS = 6 * 60 * 60 * 1000
// 遇到缓存里没有的 kid 会立即重取一次;两次重取至少隔这么久,免得伪造 kid 的请求把苹果接口刷爆
const KEY_REFETCH_MIN_MS = 60 * 1000
const CLOCK_SKEW_MS = 60 * 1000

export class AppleIdTokenError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function parseAudiences(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [...DEFAULT_APPLE_AUDIENCES]
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list : [...DEFAULT_APPLE_AUDIENCES]
}

function base64UrlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('invalid base64url')
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0))
}

function decodeJsonPart(value) {
  const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid JSON part')
  return parsed
}

async function defaultFetchKeys() {
  const res = await fetch(APPLE_KEYS_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Apple keys HTTP ${res.status}`)
  const body = await res.json()
  return Array.isArray(body?.keys) ? body.keys : []
}

// kid → { key: CryptoKey, expiresAt }。模块级缓存:同一 isolate 内复用,冷启动重取
const keyCache = new Map()
let lastFetchAt = 0

export function resetAppleKeyCache() {
  keyCache.clear()
  lastFetchAt = 0
}

async function importRsaKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

async function refreshKeys(fetchKeys, now) {
  lastFetchAt = now
  const keys = await fetchKeys()
  const next = new Map()
  for (const jwk of keys) {
    if (!jwk || jwk.kty !== 'RSA' || typeof jwk.kid !== 'string' || typeof jwk.n !== 'string' || typeof jwk.e !== 'string') continue
    if (jwk.alg && jwk.alg !== 'RS256') continue
    if (jwk.use && jwk.use !== 'sig') continue
    try {
      next.set(jwk.kid, { key: await importRsaKey(jwk), expiresAt: now + KEY_CACHE_TTL_MS })
    } catch {
      // 坏的那一把跳过,不影响其余
    }
  }
  // 整份替换:苹果撤下的钥不再认
  keyCache.clear()
  for (const [kid, entry] of next) keyCache.set(kid, entry)
}

async function getKey(kid, fetchKeys, now) {
  const cached = keyCache.get(kid)
  if (cached && cached.expiresAt > now) return cached.key
  // 缓存过期,或遇到新 kid(苹果轮换密钥):重取。为防伪造 kid 的请求把苹果接口刷爆,两次重取至少隔 KEY_REFETCH_MIN_MS
  if (lastFetchAt === 0 || now - lastFetchAt >= KEY_REFETCH_MIN_MS) {
    try {
      await refreshKeys(fetchKeys, now)
    } catch {
      // 取不到新钥时,过期缓存仍可兜底(苹果的钥很少轮换)
      if (cached) return cached.key
      throw new AppleIdTokenError(503, '暂时无法连接 Apple 登录服务,请稍后重试')
    }
    const fresh = keyCache.get(kid)
    return fresh ? fresh.key : null
  }
  return cached ? cached.key : null
}

// 校验通过返回 payload;失败抛 AppleIdTokenError(401 凭证无效 / 503 取不到公钥)
export async function verifyAppleIdentityToken(token, { audiences = DEFAULT_APPLE_AUDIENCES, now = Date.now(), fetchKeys = defaultFetchKeys } = {}) {
  const invalid = () => new AppleIdTokenError(401, 'Apple 身份凭证校验失败,请重新登录')
  const parts = typeof token === 'string' && token.length < 8192 ? token.split('.') : []
  if (parts.length !== 3) throw invalid()

  let header
  let payload
  let signature
  try {
    header = decodeJsonPart(parts[0])
    payload = decodeJsonPart(parts[1])
    signature = base64UrlToBytes(parts[2])
  } catch {
    throw invalid()
  }
  // 只认 RS256:不让 alg=none / HS256 之类混进来
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw invalid()

  const key = await getKey(header.kid, fetchKeys, now)
  if (!key) throw invalid()
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!ok) throw invalid()

  const expiresAt = Number(payload.exp) * 1000
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (
    payload.iss !== APPLE_ISSUER
    || !auds.some((aud) => typeof aud === 'string' && audiences.includes(aud))
    || !Number.isFinite(expiresAt)
    || expiresAt + CLOCK_SKEW_MS <= now
    || typeof payload.sub !== 'string'
    || payload.sub.length < 1
    || payload.sub.length > 255
  ) throw invalid()

  return payload
}

// 苹果把布尔放成字符串 "true"/"false" 的情形都见过
export function appleBool(value) {
  return value === true || value === 'true'
}

export function appleEmail(payload) {
  if (typeof payload?.email !== 'string') return null
  const email = payload.email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null
}

const USER_COLUMNS = 'u.id, u.display_name, u.avatar_seed, u.email, u.is_owner, u.email_verified_at'

// 账号解析:按 sub 找 → (邮箱已验证时)按邮箱并入已有账号 → 新建。
// 返回 { user, created, linked }。新建时 email 可能是苹果中转邮箱或为空;
// 邮箱未验证、但别的账号已占用该邮箱时,新账号不写邮箱(users.email 唯一),免得冒领。
export async function resolveAppleAccount(db, { sub, email, emailVerified, displayName }, randomUUID = () => crypto.randomUUID()) {
  let user = await db.prepare(`
    SELECT ${USER_COLUMNS}
    FROM identities i
    JOIN users u ON u.id = i.user_id
    WHERE i.provider = 'apple' AND i.provider_uid = ?
    LIMIT 1
  `).bind(sub).first()
  if (user) return { user, created: false, linked: false }

  let emailOwner = null
  if (email) {
    emailOwner = await db.prepare(`SELECT ${USER_COLUMNS.replace(/u\./g, '')} FROM users WHERE email = ? LIMIT 1`).bind(email).first()
  }

  if (emailOwner && emailVerified) {
    const existingApple = await db
      .prepare("SELECT 1 AS found FROM identities WHERE user_id = ? AND provider = 'apple' LIMIT 1")
      .bind(emailOwner.id)
      .first()
    if (existingApple) {
      // identities 有 UNIQUE(user_id, provider):一个账号只挂一个 Apple ID
      const error = new AppleIdTokenError(409, '该邮箱的账号已绑定另一个 Apple ID')
      throw error
    }
    await db.prepare(`
      INSERT INTO identities (user_id, provider, provider_uid, secret)
      VALUES (?, 'apple', ?, NULL)
    `).bind(emailOwner.id, sub).run()
    return { user: emailOwner, created: false, linked: true }
  }

  const id = randomUUID()
  const storedEmail = email && !emailOwner ? email : null
  const isRelay = typeof storedEmail === 'string' && storedEmail.endsWith('@privaterelay.appleid.com')
  const fallbackName = storedEmail && !isRelay ? storedEmail.split('@')[0].slice(0, 80) : ''
  const name = displayName || fallbackName || '读者'
  const avatarSeed = randomUUID()
  const verifiedAt = storedEmail && emailVerified ? Date.now() : null
  await db.batch([
    db.prepare(`
      INSERT INTO users (id, display_name, avatar_seed, email, email_verified_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, name, avatarSeed, storedEmail, verifiedAt),
    db.prepare(`
      INSERT INTO identities (user_id, provider, provider_uid, secret)
      VALUES (?, 'apple', ?, NULL)
    `).bind(id, sub),
  ])
  return {
    user: {
      id,
      display_name: name,
      avatar_seed: avatarSeed,
      email: storedEmail,
      is_owner: 0,
      email_verified_at: verifiedAt,
    },
    created: true,
    linked: false,
  }
}
