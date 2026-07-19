import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { getCookie, setCookie } from 'hono/cookie'
import {
  GoogleIdTokenError,
  normalizeOAuthReturnTo,
  resolveGoogleAccount,
  validateGoogleIdToken,
} from '../../server/google-auth.js'
import {
  mergeCollectionEntry,
  mergeDivinations,
  mergeProgress,
  mergeRecordMaps,
  mergeScalar,
} from '../../server/sync-merge.js'

const MAX_BODY_BYTES = 4096
const SYNC_MAX_BODY_BYTES = 1_000_000
const SYNC_MAX_VALUE_BYTES = 200_000
const ADMIN_PASSPHRASE_HEADER = 'X-Admin-Passphrase'
const DAY_MS = 24 * 60 * 60 * 1000
const SESSION_COOKIE = 'gx_session'
const OAUTH_COOKIE = 'gx_oauth'
const SESSION_TTL_MS = 30 * DAY_MS
const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000
const PBKDF2_ITERATIONS = 100_000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Keep this backend allow-list in sync with DATA_KEYS in
// src/features/yijing/storage.js. It is intentionally duplicated so the API
// never trusts a client-provided key as a D1 row key.
const DATA_KEYS = ['settings', 'quoteTheme', 'bookmarks', 'notes', 'divinations', 'reading', 'recentHexagrams', 'progress', 'corpusMarks', 'corpusNotes']
const DATA_KEY_SET = new Set(DATA_KEYS)
const SCALAR_DATA_KEYS = new Set(['settings', 'quoteTheme', 'reading', 'recentHexagrams', 'notes'])
const MAP_DATA_KEYS = new Set(['corpusMarks', 'corpusNotes', 'bookmarks'])
const SYNC_DEFAULTS = {
  settings: null,
  quoteTheme: null,
  bookmarks: {},
  notes: null,
  divinations: [],
  reading: null,
  recentHexagrams: [],
  progress: {},
  corpusMarks: {},
  corpusNotes: {},
}

// Pages Functions receives the original /api/* URL, so keep the public prefix
// here and define the individual endpoints relative to it.
const app = new Hono().basePath('/api')

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function getDb(c) {
  const db = c.env?.DB
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('D1 binding "DB" is unavailable')
  }
  return db
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false

  const length = Math.max(left.length, right.length)
  let mismatch = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return mismatch === 0
}

function bytesToBase64Url(bytes) {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derived = await derivePassword(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bytesToBase64Url(salt)}:${bytesToBase64Url(derived)}`
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const [algorithm, rawIterations, saltValue, derivedValue, extra] = stored.split(':')
  const iterations = Number(rawIterations)
  if (
    algorithm !== 'pbkdf2'
    || extra !== undefined
    || !Number.isInteger(iterations)
    || iterations < 1
    || iterations > 1_000_000
    || !/^[A-Za-z0-9_-]+$/.test(saltValue || '')
    || !/^[A-Za-z0-9_-]+$/.test(derivedValue || '')
  ) return false

  try {
    const derived = await derivePassword(password, base64UrlToBytes(saltValue), iterations)
    return constantTimeEqual(bytesToBase64Url(derived), derivedValue)
  } catch {
    return false
  }
}

async function createSession(db, userId) {
  const raw = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  await db
    .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(raw), userId, Date.now() + SESSION_TTL_MS)
    .run()
  return raw
}

function setSessionCookie(c, raw) {
  setCookie(c, SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

function clearSessionCookie(c) {
  setCookie(c, SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  })
}

function clearOAuthCookie(c) {
  setCookie(c, OAUTH_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0,
  })
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function googleAuthErrorPage(c, status, message, requestedReturnTo = '/') {
  const returnTo = normalizeOAuthReturnTo(requestedReturnTo)
  return c.html(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google 登录未完成 · 观象</title>
</head>
<body style="margin:0;background:#faf6ec;color:#2b2620;font-family:system-ui,sans-serif">
  <main style="box-sizing:border-box;max-width:34rem;margin:12vh auto;padding:2rem">
    <h1 style="font-size:1.25rem">Google 登录未完成</h1>
    <p style="line-height:1.8">${escapeHtml(message)}</p>
    <a href="${escapeHtml(returnTo)}" style="color:#a52a2a">返回观象</a>
  </main>
</body>
</html>`, status)
}

function publicUser(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    avatarUrl: null,
    email: row.email,
    isOwner: !!row.is_owner,
  }
}

async function getSessionUser(c) {
  const raw = getCookie(c, SESSION_COOKIE)
  if (!raw) return null

  const db = getDb(c)
  const sessionId = await sha256Hex(raw)
  const row = await db.prepare(`
    SELECT s.expires_at, u.id, u.display_name, u.avatar_seed, u.email, u.is_owner
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).bind(sessionId).first()
  if (!row) return null
  if (Number(row.expires_at) <= Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run()
    return null
  }
  return row
}

async function requireUser(c) {
  const user = await getSessionUser(c)
  if (!user) throw new RequestError(401, 'login required')
  return user
}

function resultRows(result) {
  return Array.isArray(result?.results) ? result.results : []
}

function countValue(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}

function utcDayStart(timestamp) {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

async function readJsonBody(c, maxBytes = MAX_BODY_BYTES) {
  const declaredLength = Number(c.req.header('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestError(413, 'request body too large')
  }

  const raw = await c.req.text()
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new RequestError(413, 'request body too large')
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('body must be an object')
    }
    return parsed
  } catch {
    throw new RequestError(400, 'invalid JSON body')
  }
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    throw new RequestError(400, `invalid ${name}`)
  }
  return value
}

function normalizeEmail(value) {
  if (typeof value !== 'string') throw new RequestError(400, '邮箱格式不正确')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new RequestError(400, '邮箱格式不正确')
  }
  return email
}

function validateRegister(body) {
  const email = normalizeEmail(body.email)
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 72) {
    throw new RequestError(400, '密码长度须为 8–72 位')
  }
  if (body.password2 !== body.password) {
    throw new RequestError(400, '两次输入的密码不一致')
  }
  return { email, password: body.password }
}

function validateLogin(body) {
  const email = normalizeEmail(body.email)
  if (typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 72) {
    throw new RequestError(401, '邮箱或密码不正确')
  }
  return { email, password: body.password }
}

function validateSync(body) {
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    throw new RequestError(400, 'invalid sync data')
  }

  const entries = new Map()
  for (const [dataKey, entry] of Object.entries(body.data)) {
    if (!DATA_KEY_SET.has(dataKey)) {
      throw new RequestError(400, `unknown sync key: ${dataKey}`)
    }
    if (
      !entry
      || typeof entry !== 'object'
      || Array.isArray(entry)
      || !Object.hasOwn(entry, 'value')
      || typeof entry.at !== 'number'
      || !Number.isFinite(entry.at)
    ) {
      throw new RequestError(400, `invalid sync entry: ${dataKey}`)
    }

    let serialized
    try {
      serialized = JSON.stringify(entry.value)
    } catch {
      throw new RequestError(400, `invalid sync value: ${dataKey}`)
    }
    if (serialized === undefined) {
      throw new RequestError(400, `invalid sync value: ${dataKey}`)
    }
    if (new TextEncoder().encode(serialized).byteLength > SYNC_MAX_VALUE_BYTES) {
      throw new RequestError(400, `sync value too large: ${dataKey}`)
    }
    entries.set(dataKey, { value: entry.value, at: entry.at })
  }
  return entries
}

function validateBeat(body) {
  if (typeof body.cid !== 'string' || body.cid !== body.cid.trim() || body.cid.length < 8 || body.cid.length > 64) {
    throw new RequestError(400, 'invalid cid')
  }

  if (
    typeof body.path !== 'string'
    || !body.path.startsWith('/')
    || body.path.length > 500
    || /[\u0000-\u001f\u007f]/.test(body.path)
  ) {
    throw new RequestError(400, 'invalid path')
  }

  const dwell = body.dwell_ms ?? 0
  if (typeof dwell !== 'number' || !Number.isFinite(dwell) || dwell < 0 || dwell > Number.MAX_SAFE_INTEGER) {
    throw new RequestError(400, 'invalid dwell_ms')
  }

  const corpus = optionalText(body.corpus, 'corpus', 32)
  if (corpus !== null && !/^[a-z0-9_-]+$/i.test(corpus)) {
    throw new RequestError(400, 'invalid corpus')
  }

  return {
    clientId: body.cid,
    path: body.path,
    corpus,
    slug: optionalText(body.slug, 'slug', 160),
    chapter: optionalText(body.chapter, 'chapter', 160),
    dwellMs: Math.round(dwell),
  }
}

// The frontend and API are same-origin on Pages, so no CORS middleware is
// needed. If a second trusted origin is added later, configure an explicit
// allow-list rather than reflecting arbitrary origins.
app.use('*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-store')
})

app.use('/admin/*', async (c, next) => {
  let sessionUser
  try {
    sessionUser = await getSessionUser(c)
  } catch (error) {
    console.error('Admin session authorization failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }

  if (sessionUser?.is_owner) {
    await next()
    return
  }

  let owner
  try {
    owner = await getDb(c)
      .prepare('SELECT 1 AS owner FROM users WHERE is_owner = 1 LIMIT 1')
      .first()
  } catch (error) {
    console.error('Admin authorization lookup failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }

  // The passphrase is deliberately transitional: once a formal owner account
  // exists, only that account's authenticated session may use admin routes.
  if (owner) {
    return c.json({ ok: false, error: 'owner login required' }, 401)
  }

  const expected = c.env?.ADMIN_PASSPHRASE
  const provided = c.req.header(ADMIN_PASSPHRASE_HEADER)
  if (!expected || !constantTimeEqual(provided, expected)) {
    return c.json({ ok: false, error: 'access denied' }, 401)
  }

  await next()
})

app.get('/auth/google/start', (c) => {
  const returnTo = normalizeOAuthReturnTo(c.req.query('return_to'))
  const state = crypto.randomUUID()
  setCookie(c, OAUTH_COOKIE, JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  })

  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizationUrl.search = new URLSearchParams({
    client_id: c.env?.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    state,
    prompt: 'select_account',
  }).toString()
  return c.redirect(authorizationUrl.toString(), 302)
})

app.get('/auth/google/callback', async (c) => {
  const rawAttempt = getCookie(c, OAUTH_COOKIE)
  clearOAuthCookie(c)

  let attempt = null
  if (rawAttempt) {
    try {
      const parsed = JSON.parse(rawAttempt)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        attempt = {
          state: typeof parsed.state === 'string' ? parsed.state : '',
          returnTo: normalizeOAuthReturnTo(parsed.returnTo),
        }
      }
    } catch {
      // The one-time cookie is untrusted input; malformed data is handled like
      // a missing/mismatched OAuth attempt below.
    }
  }

  const returnTo = attempt?.returnTo || '/'
  const state = c.req.query('state')
  if (!attempt?.state || !state || attempt.state !== state) {
    return googleAuthErrorPage(c, 400, '登录请求已失效或校验失败,请返回后重试。', returnTo)
  }

  const code = c.req.query('code')
  if (!code) {
    return googleAuthErrorPage(c, 400, 'Google 没有返回授权码,请返回后重试。', returnTo)
  }

  try {
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`
    let tokenResponse
    try {
      tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: c.env?.GOOGLE_CLIENT_ID,
          client_secret: c.env?.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })
    } catch {
      throw new RequestError(502, '暂时无法连接 Google 登录服务,请稍后重试')
    }

    if (!tokenResponse.ok) {
      throw new RequestError(502, 'Google 授权码换取失败,请返回后重试')
    }
    const tokenData = await tokenResponse.json().catch(() => null)
    if (!tokenData?.id_token) {
      throw new RequestError(502, 'Google 未返回身份凭证,请返回后重试')
    }

    const payload = validateGoogleIdToken(tokenData.id_token, c.env?.GOOGLE_CLIENT_ID)
    const sub = payload.sub
    const email = normalizeEmail(payload.email)
    const db = getDb(c)
    const user = await resolveGoogleAccount(db, { sub, email })

    await db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?')
      .bind(user.id, Date.now())
      .run()
    const rawSession = await createSession(db, user.id)
    setSessionCookie(c, rawSession)
    return c.redirect(returnTo, 302)
  } catch (error) {
    if (error instanceof RequestError || error instanceof GoogleIdTokenError) {
      return googleAuthErrorPage(c, error.status, error.message, returnTo)
    }
    console.error('Google OAuth callback failed', error)
    return googleAuthErrorPage(c, 503, '登录服务暂时不可用,请稍后重试。', returnTo)
  }
})

app.post('/auth/register', async (c) => {
  try {
    const { email, password } = validateRegister(await readJsonBody(c))
    const db = getDb(c)
    const existingIdentity = await db
      .prepare("SELECT 1 AS found FROM identities WHERE provider = 'email' AND provider_uid = ? LIMIT 1")
      .bind(email)
      .first()
    if (existingIdentity) {
      throw new RequestError(409, '该邮箱已注册,请直接登录')
    }

    const existingUser = await db
      .prepare('SELECT 1 AS found FROM users WHERE email = ? LIMIT 1')
      .bind(email)
      .first()
    if (existingUser) {
      throw new RequestError(409, '该邮箱已通过 Google 登录创建账号,请改用 Google 登录')
    }

    const id = crypto.randomUUID()
    const displayName = email.split('@')[0].slice(0, 80) || '读者'
    const avatarSeed = crypto.randomUUID()
    const secret = await hashPassword(password)
    await db.batch([
      db.prepare(`
        INSERT INTO users (id, display_name, avatar_seed, email)
        VALUES (?, ?, ?, ?)
      `).bind(id, displayName, avatarSeed, email),
      db.prepare(`
        INSERT INTO identities (user_id, provider, provider_uid, secret)
        VALUES (?, 'email', ?, ?)
      `).bind(id, email, secret),
    ])

    const rawSession = await createSession(db, id)
    setSessionCookie(c, rawSession)
    return c.json({
      ok: true,
      user: publicUser({
        id,
        display_name: displayName,
        avatar_seed: avatarSeed,
        email,
        is_owner: 0,
      }),
    }, 201)
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Email registration failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/auth/login', async (c) => {
  try {
    const { email, password } = validateLogin(await readJsonBody(c))
    const db = getDb(c)
    const row = await db.prepare(`
      SELECT i.secret, u.id, u.display_name, u.avatar_seed, u.email, u.is_owner
      FROM identities i
      JOIN users u ON u.id = i.user_id
      WHERE i.provider = 'email' AND i.provider_uid = ?
      LIMIT 1
    `).bind(email).first()

    if (!row) {
      const googleUser = await db
        .prepare('SELECT 1 AS found FROM users WHERE email = ? LIMIT 1')
        .bind(email)
        .first()
      if (googleUser) {
        throw new RequestError(401, '该邮箱账号通过 Google 创建,请用 Google 登录')
      }
      throw new RequestError(401, '邮箱或密码不正确')
    }

    if (!await verifyPassword(password, row.secret)) {
      throw new RequestError(401, '邮箱或密码不正确')
    }

    await db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?')
      .bind(row.id, Date.now())
      .run()
    const rawSession = await createSession(db, row.id)
    setSessionCookie(c, rawSession)
    return c.json({ ok: true, user: publicUser(row) })
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Email login failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/auth/logout', async (c) => {
  clearSessionCookie(c)
  try {
    const raw = getCookie(c, SESSION_COOKIE)
    if (raw) {
      await getDb(c)
        .prepare('DELETE FROM sessions WHERE id = ?')
        .bind(await sha256Hex(raw))
        .run()
    }
    return c.body(null, 204)
  } catch (error) {
    console.error('Session logout failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/me', async (c) => {
  try {
    const row = await getSessionUser(c)
    return c.json({ user: row ? publicUser(row) : null })
  } catch (error) {
    console.error('Session lookup failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/sync', async (c) => {
  try {
    const user = await requireUser(c)
    const clientEntries = validateSync(await readJsonBody(c, SYNC_MAX_BODY_BYTES))
    const db = getDb(c)
    const cloudResult = await db
      .prepare('SELECT key, value, updated_at FROM user_data WHERE user_id = ?')
      .bind(user.id)
      .all()
    const cloudEntries = new Map()
    for (const row of resultRows(cloudResult)) {
      if (!DATA_KEY_SET.has(row.key)) continue
      cloudEntries.set(row.key, {
        value: JSON.parse(row.value),
        at: Number(row.updated_at),
      })
    }

    const serverNow = Date.now()
    const responseData = {}
    const writes = []

    for (const dataKey of DATA_KEYS) {
      const cloudEntry = cloudEntries.get(dataKey)
      const clientEntry = clientEntries.get(dataKey)
      let mergedEntry

      if (SCALAR_DATA_KEYS.has(dataKey)) {
        mergedEntry = mergeScalar(cloudEntry, clientEntry, serverNow)
      } else if (MAP_DATA_KEYS.has(dataKey)) {
        mergedEntry = mergeCollectionEntry(cloudEntry, clientEntry, serverNow, mergeRecordMaps)
      } else if (dataKey === 'divinations') {
        mergedEntry = mergeCollectionEntry(cloudEntry, clientEntry, serverNow, mergeDivinations)
      } else if (dataKey === 'progress') {
        mergedEntry = mergeCollectionEntry(cloudEntry, clientEntry, serverNow, mergeProgress)
      }

      responseData[dataKey] = mergedEntry ?? { value: SYNC_DEFAULTS[dataKey], at: 0 }

      const scalarClientWon = SCALAR_DATA_KEYS.has(dataKey)
        && clientEntry !== undefined
        && mergedEntry !== cloudEntry
      const collectionWasSubmitted = !SCALAR_DATA_KEYS.has(dataKey) && clientEntry !== undefined
      if (!scalarClientWon && !collectionWasSubmitted) continue

      writes.push(db.prepare(`
        INSERT INTO user_data (user_id, key, value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `).bind(user.id, dataKey, JSON.stringify(mergedEntry.value), mergedEntry.at))
    }

    if (writes.length > 0) await db.batch(writes)
    return c.json({ ok: true, data: responseData })
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('User data sync failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/health', async (c) => {
  try {
    const result = await getDb(c).prepare('SELECT 1 AS ok').first()
    if (result?.ok !== 1) throw new Error('Unexpected D1 health-check result')
    return c.json({ ok: true, ts: Date.now() })
  } catch (error) {
    console.error('API health check failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/beat', async (c) => {
  let event
  try {
    event = validateBeat(await readJsonBody(c))
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    throw error
  }

  // Country/region come from Cloudflare's own edge geolocation of the
  // connecting IP (populated on the request's `cf` object). The raw IP
  // itself is never read, logged, or stored — only this coarse location.
  const cf = c.req.raw.cf || {}
  const country = typeof cf.country === 'string' && cf.country.length > 0 && cf.country.length <= 8 ? cf.country : null
  const region = typeof cf.region === 'string' && cf.region.length > 0 && cf.region.length <= 80 ? cf.region : null

  try {
    await getDb(c)
      .prepare(`
        INSERT INTO reading_events
          (client_id, path, corpus, slug, chapter, dwell_ms, ts, country, region)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        event.clientId,
        event.path,
        event.corpus,
        event.slug,
        event.chapter,
        event.dwellMs,
        Date.now(),
        country,
        region,
      )
      .run()
  } catch (error) {
    console.error('Reading event insert failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }

  // Abuse protection belongs in a Cloudflare Rate Limiting rule. Pages
  // Functions instances are stateless, so an in-memory counter is unreliable.
  return c.body(null, 204)
})

app.get('/admin/stats', async (c) => {
  const todayStart = utcDayStart(Date.now())
  const rangeStart = todayStart - (6 * DAY_MS)
  const rangeEnd = todayStart + DAY_MS

  try {
    const db = getDb(c)
    const [totalResult, dailyResult, corpusResult, chaptersResult, dwellResult, geoResult] = await db.batch([
      db.prepare('SELECT COUNT(*) AS count FROM reading_events'),
      db.prepare(`
        SELECT date(ts / 1000.0, 'unixepoch') AS date, COUNT(*) AS count
        FROM reading_events
        WHERE ts >= ? AND ts < ?
        GROUP BY date(ts / 1000.0, 'unixepoch')
        ORDER BY date ASC
      `).bind(rangeStart, rangeEnd),
      db.prepare(`
        SELECT corpus, COUNT(*) AS count
        FROM reading_events
        GROUP BY corpus
        ORDER BY count DESC
      `),
      db.prepare(`
        SELECT corpus, slug, chapter, COUNT(*) AS count
        FROM reading_events
        WHERE corpus IS NOT NULL
          AND slug IS NOT NULL
          AND chapter IS NOT NULL
        GROUP BY corpus, slug, chapter
        ORDER BY count DESC
        LIMIT 10
      `),
      db.prepare('SELECT AVG(dwell_ms) AS average FROM reading_events'),
      // Grouped by (country, region) so the response can be re-aggregated two
      // ways: country-only for the world ranking, region-level for China.
      db.prepare(`
        SELECT country, region, COUNT(*) AS count
        FROM reading_events
        WHERE country IS NOT NULL
        GROUP BY country, region
        ORDER BY count DESC
        LIMIT 500
      `),
    ])

    const dailyByDate = new Map(
      resultRows(dailyResult).map((row) => [row.date, countValue(row.count)]),
    )
    const dailyCounts = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(rangeStart + (index * DAY_MS)).toISOString().slice(0, 10)
      return { date, count: dailyByDate.get(date) ?? 0 }
    })

    const corpusCounts = new Map()
    for (const row of resultRows(corpusResult)) {
      const corpus = row.corpus == null ? 'other' : String(row.corpus)
      corpusCounts.set(corpus, (corpusCounts.get(corpus) ?? 0) + countValue(row.count))
    }
    const corpusHeat = Array.from(corpusCounts, ([corpus, count]) => ({ corpus, count }))
      .sort((left, right) => right.count - left.count || left.corpus.localeCompare(right.corpus))

    const topChapters = resultRows(chaptersResult).map((row) => ({
      corpus: row.corpus,
      slug: row.slug,
      chapter: row.chapter,
      count: countValue(row.count),
    }))

    const average = Number(resultRows(dwellResult)[0]?.average)

    // Country ranking collapses region (other countries only need country-
    // level, per owner's spec); China additionally gets a province ranking
    // from the same raw rows.
    const countryCounts = new Map()
    const chinaProvinceCounts = new Map()
    for (const row of resultRows(geoResult)) {
      const country = String(row.country)
      const count = countValue(row.count)
      countryCounts.set(country, (countryCounts.get(country) ?? 0) + count)
      if (country === 'CN') {
        const province = row.region == null ? '' : String(row.region)
        chinaProvinceCounts.set(province, (chinaProvinceCounts.get(province) ?? 0) + count)
      }
    }
    const countryHeat = Array.from(countryCounts, ([country, count]) => ({ country, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 30)
    const chinaProvinceHeat = Array.from(chinaProvinceCounts, ([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 40)

    return c.json({
      totalEvents: countValue(resultRows(totalResult)[0]?.count),
      dailyCounts,
      corpusHeat,
      topChapters,
      avgDwellMs: Number.isFinite(average) && average > 0 ? Math.round(average) : 0,
      countryHeat,
      chinaProvinceHeat,
    })
  } catch (error) {
    console.error('Reading statistics query failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.onError((error, c) => {
  console.error('Unhandled API error', error)
  return c.json({ ok: false, error: 'internal server error' }, 500)
})

export const onRequest = handle(app)
