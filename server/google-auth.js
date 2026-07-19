const GOOGLE_ISSUERS = new Set([
  'https://accounts.google.com',
  'accounts.google.com',
])

export class GoogleIdTokenError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function normalizeOAuthReturnTo(value) {
  if (
    typeof value !== 'string'
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.startsWith('/\\')
    || /[\u0000-\u001f\u007f]/.test(value)
  ) return '/'
  return value
}

function decodeBase64UrlJson(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('invalid base64url payload')
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function validateGoogleIdToken(idToken, clientId, now = Date.now()) {
  let payload
  try {
    const parts = typeof idToken === 'string' ? idToken.split('.') : []
    if (parts.length !== 3) throw new Error('invalid JWT')
    payload = decodeBase64UrlJson(parts[1])
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('invalid JWT payload')
    }
  } catch {
    throw new GoogleIdTokenError(502, 'Google 返回的身份凭证无法解析,请稍后重试')
  }

  const expiresAt = Number(payload.exp) * 1000
  if (
    !GOOGLE_ISSUERS.has(payload.iss)
    || typeof clientId !== 'string'
    || clientId.length < 1
    || payload.aud !== clientId
    || !Number.isFinite(expiresAt)
    || expiresAt <= now
  ) {
    throw new GoogleIdTokenError(403, 'Google 身份凭证校验失败,请重新登录')
  }

  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw new GoogleIdTokenError(403, 'Google 邮箱尚未通过验证,无法登录')
  }

  if (
    typeof payload.sub !== 'string'
    || payload.sub.length < 1
    || typeof payload.email !== 'string'
    || payload.email.length < 1
  ) {
    throw new GoogleIdTokenError(403, 'Google 身份信息不完整,无法登录')
  }

  return payload
}

export async function resolveGoogleAccount(db, { sub, email }, randomUUID = () => crypto.randomUUID()) {
  let user = await db.prepare(`
    SELECT u.id, u.display_name, u.avatar_seed, u.email, u.is_owner
    FROM identities i
    JOIN users u ON u.id = i.user_id
    WHERE i.provider = 'google' AND i.provider_uid = ?
    LIMIT 1
  `).bind(sub).first()
  if (user) return user

  user = await db.prepare(`
    SELECT id, display_name, avatar_seed, email, is_owner
    FROM users
    WHERE email = ?
    LIMIT 1
  `).bind(email).first()
  if (user) {
    await db.prepare(`
      INSERT INTO identities (user_id, provider, provider_uid, secret)
      VALUES (?, 'google', ?, NULL)
    `).bind(user.id, sub).run()
    return user
  }

  const id = randomUUID()
  const displayName = email.split('@')[0].slice(0, 80) || '读者'
  const avatarSeed = randomUUID()
  await db.batch([
    db.prepare(`
      INSERT INTO users (id, display_name, avatar_seed, email)
      VALUES (?, ?, ?, ?)
    `).bind(id, displayName, avatarSeed, email),
    db.prepare(`
      INSERT INTO identities (user_id, provider, provider_uid, secret)
      VALUES (?, 'google', ?, NULL)
    `).bind(id, sub),
  ])

  return {
    id,
    display_name: displayName,
    avatar_seed: avatarSeed,
    email,
    is_owner: 0,
  }
}
