import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { getCookie, setCookie } from 'hono/cookie'
import {
  GoogleIdTokenError,
  normalizeOAuthReturnTo,
  resolveGoogleAccount,
  validateGoogleIdToken,
} from '../../server/google-auth.js'
import { sendCommentNotification } from '../../server/comment-notification.js'
import { isAdminUser } from '../../server/admin.js'
import { AUTO_HIDE_REPORTS, screenComment } from '../../server/content-filter.js'
import {
  mergeCollectionEntry,
  mergeDivinations,
  mergeProgress,
  mergeRecordMaps,
  mergeScalar,
} from '../../server/sync-merge.js'

const MAX_BODY_BYTES = 4096
const COMMENTS_MAX_BODY_BYTES = 8192
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

// 原生壳拿不到 Cookie,只能把 token 存进设备。但**网页端绝不能拿到它** —— 那等于把 httpOnly
// 白设了(一旦 XSS 就能读走长期凭证)。所以只在客户端显式声明自己是原生壳时才回传,
// 网页那条路上 token 永远只存在于 Set-Cookie 里、JS 摸不到。
function wantsToken(c) {
  return (c.req.header('X-Client') || '').toLowerCase() === 'native'
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

// env 可选:不传则不下发 isAdmin(旧调用点不至于报错,只是拿不到该字段)。
// 前端用 isAdmin 决定观书入口给不给看 —— 见 functions/_middleware.js 的同款判据。
function publicUser(row, env) {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    avatarUrl: null,
    email: row.email,
    isOwner: !!row.is_owner,
    isAdmin: env ? isAdminUser(row, env) : !!row.is_owner,
  }
}

// 会话凭证有两条来路:
//   网页 —— httpOnly Cookie(最安全,JS 碰不到)
//   iOS  —— Authorization: Bearer(壳里页面从 capacitor://localhost 加载,跨源请求带不上
//           SameSite=Lax 的 Cookie,WKWebView 的 ITP 也会拦第三方 Cookie)
// 两者是**同一张 sessions 表、同一个 token**,只是搬运方式不同,后端逻辑完全一致。
function readSessionToken(c) {
  const cookie = getCookie(c, SESSION_COOKIE)
  if (cookie) return cookie
  const header = c.req.header('Authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

async function getSessionUser(c) {
  const raw = readSessionToken(c)
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

function validateAnchor(query) {
  if (typeof query.corpus !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(query.corpus)) {
    throw new RequestError(400, 'invalid corpus')
  }

  for (const name of ['slug', 'chapter']) {
    const value = query[name]
    if (
      typeof value !== 'string'
      || value.length < 1
      || value.length > 160
      || /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new RequestError(400, `invalid ${name}`)
    }
  }

  return {
    corpus: query.corpus,
    slug: query.slug,
    chapter: query.chapter,
  }
}

function commentItem(row, sessionUser, includeStatus = false) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    mine: !!sessionUser && row.user_id === sessionUser.id,
    user: {
      displayName: row.display_name,
      avatarSeed: row.avatar_seed,
    },
    ...(includeStatus ? { status: row.status } : {}),
  }
}

// 返回 null 表示通过;不通过则返回**一句给人看的话**。
// 原先只返回 true/false、错误一律回「人机验证未通过,请重试」——
// 而最常见的真因是 token 过期(约 5 分钟),此时「请重试」是最没用的指引:
// 用户看着绿色的「成功!」,再点多少次都是同一个废 token。
async function verifyTurnstile(c, token) {
  const secret = c.env?.TURNSTILE_SECRET_KEY
  if (typeof secret !== 'string' || secret.length < 1) {
    console.error('Turnstile: 未配置 TURNSTILE_SECRET_KEY')
    return '服务端未配置人机验证,请联系站长'
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    const result = await response.json().catch(() => null)
    if (result?.success === true) return null

    const codes = result?.['error-codes'] || []
    console.error('Turnstile 校验未通过:', JSON.stringify(codes))
    // 这两种是**站长要修的配置问题**,不是访客能「重试」好的,得说实话
    if (codes.includes('invalid-input-secret') || codes.includes('bad-request')) {
      return '人机验证配置有误,请联系站长(secret 与 site key 不匹配)'
    }
    if (codes.includes('timeout-or-duplicate')) {
      return '人机验证已过期,已重新验证,请再点一次发布'
    }
    return '人机验证未通过,请重新验证后再试'
  } catch {
    return '人机验证服务连接失败,请稍后重试'
  }
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

// ── CORS:只为原生壳开,且只开给固定的几个 origin ──────────────────────────
//
// 这里原本写着「前端与 API 同源,不需要 CORS」—— 那句话对**网页**成立,
// 却漏了 **iOS/安卓壳是第二个 origin** 这件事:壳里的页面从本地包加载,
// origin 是 `capacitor://localhost`,调 `https://hexa.gavin.pub/api/*` 是**跨源**。
//
// 后果是 2026-08-11 被 App Store 以 **2.1.0 App Completeness** 拒了:
// 审核员在 App 里注册,界面报「Load failed」。根因不是注册逻辑,而是
// **浏览器发的 OPTIONS 预检打到这里是 404**(带了 X-Client 与 JSON body 必触发预检),
// 预检一失败,真正的 POST 根本不会发出去。
// 也就是说:**App 里的登录/注册/评论/同步从上线起就没通过**,
// 只有阅读能用(内容打包在本地、不走网络),所以一直没被发现。
//
// 分寸:
// · **白名单固定几个 origin,绝不反射任意 Origin**(反射等于对全网开放)。
// · **不发 `Access-Control-Allow-Credentials`** —— 原生端用 Bearer token、
//   请求本就 `credentials:'omit'`;不开这个,浏览器就永远不会把带 Cookie 的响应
//   跨源交出去,网页那条 httpOnly Cookie 的路一点没被削弱。
// · 允许的请求头只列原生端真会发的三个,不含 X-Admin-Passphrase(后台是网页专用)。
const NATIVE_ORIGINS = new Set([
  'capacitor://localhost',  // iOS(Capacitor 默认 scheme)
  'http://localhost',       // 安卓(Capacitor 默认)
])
const CORS_HEADERS = 'Content-Type, Authorization, X-Client'

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin')
  const allowed = !!origin && NATIVE_ORIGINS.has(origin)

  // 预检必须在路由匹配之前答掉 —— 没有任何路由注册 OPTIONS,落到路由层就是 404。
  if (c.req.method === 'OPTIONS') {
    if (!allowed) return c.body(null, 404)
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': CORS_HEADERS,
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    })
  }

  await next()
  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Vary', 'Origin')   // 免得中间层把某个 origin 的响应喂给另一个
  }
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

  if (isAdminUser(sessionUser, c.env)) {
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
    // 回跳带 ?auth=google:前端挂载时只在本地有「登录痕迹」标记才会去问 /api/me
    // (匿名访客不该白发一次请求)。而 Google 登录是**服务端整页重定向**,cookie 由服务端种下、
    // 前端代码从没跑过 saveAuthHint(),没有这个标记就永远显示未登录 —— 后端已登录、界面却是游客。
    // 邮箱登录走前端表单会写标记,所以只有这一条路会中招。
    const dest = new URL(returnTo, new URL(c.req.url).origin)
    dest.searchParams.set('auth', 'google')
    return c.redirect(`${dest.pathname}${dest.search}${dest.hash}`, 302)
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
      }, c.env),
      ...(wantsToken(c) ? { token: rawSession } : {}),
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
    return c.json({ ok: true, user: publicUser(row, c.env), ...(wantsToken(c) ? { token: rawSession } : {}) })
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Email login failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

// 昵称改名。默认昵称是注册邮箱的 @ 前半段(见 register),等于把邮箱前缀公开在每条评论上 ——
// 有人不愿意,也有人就是想换个名字,所以给一个改名口。
// 约束照 users 表的 CHECK:trim 后 1–80 字。**不做全站唯一**:这是研读站不是社交平台,
// 强制唯一只会逼出「张三2」「张三_」这种名字,收益抵不上麻烦。
app.patch('/me', async (c) => {
  try {
    const user = await requireUser(c)
    const input = await readJsonBody(c)
    const raw = typeof input?.displayName === 'string' ? input.displayName : ''
    // 归一化:压掉连续空白、剔除零宽字符与换行 —— 否则可以用空白字符冒充别人的名字,
    // 或者用超长零宽串把评论区的版式撑坏。
    const name = raw
      .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (name.length < 1) throw new RequestError(400, '昵称不能为空')
    if ([...name].length > 24) throw new RequestError(400, '昵称最长 24 个字')

    const flagged = screenComment(name)
    if (flagged) throw new RequestError(400, `昵称${flagged.message},请换一个`)

    await getDb(c).prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name, user.id).run()
    return c.json({ ok: true, user: publicUser({ ...user, display_name: name }, c.env) })
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Rename failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

// 注销账号。**App Store 5.1.1(v):支持注册的 App 必须提供账号删除入口** ——
// 光有「退出登录」不算,必须能真删。也是隐私政策里「你的权利」那条的兑现。
// users 上挂的外键都是 ON DELETE CASCADE,删一行即连带清掉:
// identities(登录方式)/ sessions(会话)/ user_data(云同步足迹)/ comments(评论)
// / comment_reports(其发出的举报)/ user_blocks(其屏蔽名单)。
app.delete('/me', async (c) => {
  try {
    const user = await requireUser(c)
    const input = await readJsonBody(c)
    // 要求把自己的邮箱抄一遍再删 —— 不可撤销的操作不该一键完成
    if (typeof input?.confirm !== 'string' || normalizeEmail(input.confirm) !== normalizeEmail(user.email || '')) {
      throw new RequestError(400, '请输入本账号的邮箱以确认注销')
    }
    await getDb(c).prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    clearSessionCookie(c)
    return c.json({ ok: true })
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Account deletion failed', error)
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
    return c.json({ user: row ? publicUser(row, c.env) : null })
  } catch (error) {
    console.error('Session lookup failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/comments', async (c) => {
  try {
    const anchor = validateAnchor({
      corpus: c.req.query('corpus'),
      slug: c.req.query('slug'),
      chapter: c.req.query('chapter'),
    })
    const sessionUser = await getSessionUser(c)
    const result = await getDb(c).prepare(`
      SELECT c.id, c.body, c.created_at, c.user_id, c.status,
             u.display_name, u.avatar_seed
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.corpus = ? AND c.slug = ? AND c.chapter = ?
      ORDER BY c.created_at DESC
      LIMIT 100
    `).bind(anchor.corpus, anchor.slug, anchor.chapter).all()

    // 拉黑是**单向、仅对本人生效**的视图过滤:不删对方内容、不通知对方、别人照常看得见。
    // 所以在这里按请求者过滤,而不是在写入侧做任何事。
    let blocked = new Set()
    if (sessionUser) {
      const rows = await getDb(c)
        .prepare('SELECT blocked_id FROM user_blocks WHERE user_id = ?')
        .bind(sessionUser.id).all()
      blocked = new Set(resultRows(rows).map((r) => r.blocked_id))
    }

    const isOwner = !!sessionUser?.is_owner
    const comments = resultRows(result)
      .filter((row) => isOwner || row.status === 'visible')
      .filter((row) => !blocked.has(row.user_id))
      .map((row) => commentItem(row, sessionUser, isOwner))
    return c.json({ ok: true, comments })
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Comment list failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/comments', async (c) => {
  try {
    const user = await requireUser(c)
    const input = await readJsonBody(c, COMMENTS_MAX_BODY_BYTES)
    const anchor = validateAnchor(input)
    const body = typeof input.body === 'string' ? input.body.trim() : ''
    if (body.length < 1) {
      throw new RequestError(400, '评论不能为空')
    }
    if (body.length > 500) {
      throw new RequestError(400, '评论最长 500 字')
    }
    if (
      typeof input.turnstileToken !== 'string'
      || input.turnstileToken.length < 1
      || input.turnstileToken.length > 2048
    ) {
      throw new RequestError(400, '请完成人机验证')
    }

    const turnstileError = await verifyTurnstile(c, input.turnstileToken)
    if (turnstileError) {
      throw new RequestError(403, turnstileError)
    }

    // 内容过滤(App Store 1.2 四件套之一)。只拦最露骨的一层,其余靠举报 + owner 复核 ——
    // 详见 server/content-filter.js 顶部那三条约束(尤其「宁可漏过不可误伤」:
    // 这站的正文本来就有「杀」「淫」这类字)。
    const flagged = screenComment(body)
    if (flagged) {
      throw new RequestError(400, `${flagged.message},请修改后再发。若你认为这是误判,可在「关于」页联系我们。`)
    }

    const now = Date.now()
    const recent = await getDb(c)
      .prepare('SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?')
      .bind(user.id, now - 60_000)
      .first()
    if (Number(recent?.n) >= 3) {
      throw new RequestError(429, '发得太快,歇一歇')
    }

    const id = crypto.randomUUID()
    await getDb(c).prepare(`
      INSERT INTO comments (id, user_id, corpus, slug, chapter, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.id, anchor.corpus, anchor.slug, anchor.chapter, body, now).run()

    const comment = commentItem({
      id,
      body,
      created_at: now,
      user_id: user.id,
      display_name: user.display_name,
      avatar_seed: user.avatar_seed,
    }, user)
    c.executionCtx.waitUntil(sendCommentNotification(c.env, comment, user, anchor))

    return c.json({
      ok: true,
      comment,
    }, 201)
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Comment creation failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

// ── 举报 / 拉黑(App Store 1.2)──────────────────────────
// 这两条网页与 iOS 共用:**只要 App「展示」UGC 就落进 1.2**,不是只有能发才算,
// 所以原生端虽不开发帖,举报与拉黑仍必须可用。

const REPORT_REASONS = new Set(['abuse', 'porn', 'spam', 'illegal', 'other'])

app.post('/comments/:id/report', async (c) => {
  try {
    const user = await requireUser(c)
    const commentId = c.req.param('id')
    const input = await readJsonBody(c)
    const reason = REPORT_REASONS.has(input?.reason) ? input.reason : 'other'
    const note = typeof input?.note === 'string' ? input.note.trim().slice(0, 200) : ''
    const db = getDb(c)

    const comment = await db.prepare('SELECT id, user_id, status FROM comments WHERE id = ?')
      .bind(commentId).first()
    if (!comment) throw new RequestError(404, '该评论不存在或已被删除')
    if (comment.user_id === user.id) throw new RequestError(400, '不能举报自己的评论')

    // 一人对一条只记一次(UNIQUE),重复点当成功处理 —— 对用户没必要报错,
    // 也免得靠反复提交去刷高计数。
    await db.prepare(`
      INSERT INTO comment_reports (id, comment_id, reporter_id, reason)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (comment_id, reporter_id) DO NOTHING
    `).bind(crypto.randomUUID(), commentId, user.id, note ? `${reason}: ${note}` : reason).run()

    // 够 N 个**不同的人**举报就先隐藏、等 owner 复核。这是 1.2 里「及时响应」的机械兜底:
    // 人不在线时也能把内容先挡住,而不是等到有空才处理。
    const counted = await db
      .prepare('SELECT COUNT(*) AS n FROM comment_reports WHERE comment_id = ?')
      .bind(commentId).first()
    let hidden = comment.status === 'hidden'
    if (!hidden && Number(counted?.n || 0) >= AUTO_HIDE_REPORTS) {
      await db.prepare("UPDATE comments SET status = 'hidden' WHERE id = ?").bind(commentId).run()
      hidden = true
    }
    return c.json({ ok: true, hidden })
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Comment report failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/blocks', async (c) => {
  try {
    const user = await requireUser(c)
    const rows = await getDb(c).prepare(`
      SELECT b.blocked_id, b.created_at, u.display_name, u.avatar_seed
      FROM user_blocks b JOIN users u ON u.id = b.blocked_id
      WHERE b.user_id = ? ORDER BY b.created_at DESC
    `).bind(user.id).all()
    return c.json({
      ok: true,
      blocks: resultRows(rows).map((r) => ({
        userId: r.blocked_id, displayName: r.display_name,
        avatarSeed: r.avatar_seed, createdAt: r.created_at,
      })),
    })
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Block list failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.post('/blocks', async (c) => {
  try {
    const user = await requireUser(c)
    const input = await readJsonBody(c)
    // 前端只知道评论 id,不知道作者 id(commentItem 有意不返回 user_id —— 那是别人的标识符)。
    // 所以拉黑按评论走:服务端自己查出作者。
    const commentId = typeof input?.commentId === 'string' ? input.commentId : ''
    const db = getDb(c)
    const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?').bind(commentId).first()
    if (!comment) throw new RequestError(404, '该评论不存在或已被删除')
    if (comment.user_id === user.id) throw new RequestError(400, '不能屏蔽自己')

    await db.prepare(`
      INSERT INTO user_blocks (user_id, blocked_id) VALUES (?, ?)
      ON CONFLICT (user_id, blocked_id) DO NOTHING
    `).bind(user.id, comment.user_id).run()
    return c.json({ ok: true })
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Block failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.delete('/blocks/:userId', async (c) => {
  try {
    const user = await requireUser(c)
    await getDb(c).prepare('DELETE FROM user_blocks WHERE user_id = ? AND blocked_id = ?')
      .bind(user.id, c.req.param('userId')).run()
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof RequestError) return c.json({ ok: false, error: error.message }, error.status)
    console.error('Unblock failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.delete('/comments/:id', async (c) => {
  try {
    const user = await requireUser(c)
    const result = await getDb(c)
      .prepare('DELETE FROM comments WHERE id = ? AND user_id = ?')
      .bind(c.req.param('id'), user.id)
      .run()
    if (Number(result?.meta?.changes) === 0) {
      throw new RequestError(404, '评论不存在或无权删除')
    }
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Comment deletion failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/admin/comments', async (c) => {
  const rawLimit = Number(c.req.query('limit'))
  const limit = Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 200
    ? rawLimit
    : 50

  try {
    const result = await getDb(c).prepare(`
      SELECT c.id, c.corpus, c.slug, c.chapter, c.body, c.status, c.created_at,
             u.display_name
      FROM comments c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.created_at DESC
      LIMIT ?
    `).bind(limit).all()

    const comments = resultRows(result).map((row) => ({
      id: row.id,
      corpus: row.corpus,
      slug: row.slug,
      chapter: row.chapter,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      displayName: row.display_name,
    }))
    return c.json({ ok: true, comments })
  } catch (error) {
    console.error('Admin comment list failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.get('/admin/reports', async (c) => {
  try {
    const rows = await getDb(c).prepare(`
      SELECT r.id, r.comment_id, r.reason, r.created_at, r.handled_at,
             c.body, c.status, c.corpus, c.slug, c.chapter,
             u.display_name AS author_name
      FROM comment_reports r
      JOIN comments c ON c.id = r.comment_id
      JOIN users u ON u.id = c.user_id
      WHERE r.handled_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all()
    return c.json({
      ok: true,
      reports: resultRows(rows).map((r) => ({
        id: r.id, commentId: r.comment_id, reason: r.reason, createdAt: r.created_at,
        body: r.body, status: r.status, corpus: r.corpus, slug: r.slug,
        chapter: r.chapter, authorName: r.author_name,
      })),
    })
  } catch (error) {
    console.error('Report list failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

// 处理即标记 handled_at —— 该评论的**全部**待处理举报一起结掉,
// 不然同一条被 5 个人报过就要点 5 次。
app.patch('/admin/reports/:commentId', async (c) => {
  try {
    await getDb(c)
      .prepare('UPDATE comment_reports SET handled_at = ? WHERE comment_id = ? AND handled_at IS NULL')
      .bind(Date.now(), c.req.param('commentId')).run()
    return c.json({ ok: true })
  } catch (error) {
    console.error('Report resolve failed', error)
    return c.json({ ok: false, error: 'service unavailable' }, 503)
  }
})

app.patch('/admin/comments/:id', async (c) => {
  try {
    const input = await readJsonBody(c)
    if (input.status !== 'visible' && input.status !== 'hidden') {
      throw new RequestError(400, 'invalid status')
    }

    const result = await getDb(c)
      .prepare('UPDATE comments SET status = ? WHERE id = ?')
      .bind(input.status, c.req.param('id'))
      .run()
    if (Number(result?.meta?.changes) === 0) {
      throw new RequestError(404, '评论不存在')
    }
    return c.body(null, 204)
  } catch (error) {
    if (error instanceof RequestError) {
      return c.json({ ok: false, error: error.message }, error.status)
    }
    console.error('Admin comment update failed', error)
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
