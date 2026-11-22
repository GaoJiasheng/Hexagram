// 原生 App「观象 · 书桌」共用账号与云同步的服务端改动(2026-11-22):
// Bearer 登出 · 同步新键 highlights / finished · 放宽值形状 · Apple 登录 · Google 回 App 短码 · 迁移 0007。
// 接口测试跑在 node:sqlite 上的真 schema(server/test-d1.js),CHECK / UNIQUE / 外键都生效。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[route]].js'
import { createTestD1, readRepoFile, schemaBefore0007 } from './test-d1.js'
import { APPLE_KEYS_URL, resetAppleKeyCache, sha256Hex, verifyAppleIdentityToken } from './apple-auth.js'
import { APPLE_REVOKE_URL, APPLE_TOKEN_URL } from './apple-token.js'
import { challengeFromVerifier } from './native-auth.js'

const ORIGIN = 'https://hexa.gavin.pub'
let db
let env

function call(path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }
  return onRequest({ request: new Request(`${ORIGIN}${path}`, init), env })
}

const NATIVE = { 'X-Client': 'native' }
const bearer = (token) => ({ Authorization: `Bearer ${token}`, ...NATIVE })

async function registerNative(email = 'reader@example.com') {
  const res = await call('/api/auth/register', { method: 'POST', body: { email, password: 'correct-horse', password2: 'correct-horse' }, headers: NATIVE })
  expect(res.status).toBe(201)
  return (await res.json()).token
}

function sessionCookieFrom(res) {
  const raw = res.headers.get('Set-Cookie') || ''
  const match = /gx_session=([^;]*)/.exec(raw)
  return match ? match[1] : null
}

const count = (sql, ...args) => db.sqlite.prepare(sql).get(...args).n

beforeEach(() => {
  db = createTestD1()
  env = { DB: db, GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret' }
  resetAppleKeyCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── 1. 登出 ──────────────────────────────────────────────
describe('/auth/logout', () => {
  it('Bearer 客户端登出也删掉服务端会话', async () => {
    const token = await registerNative()
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(1)
    expect((await (await call('/api/me', { headers: bearer(token) })).json()).user).not.toBeNull()

    const res = await call('/api/auth/logout', { method: 'POST', headers: bearer(token) })
    expect(res.status).toBe(204)
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(0)
    expect((await (await call('/api/me', { headers: bearer(token) })).json()).user).toBeNull()
  })

  it('cookie 登出照旧', async () => {
    const reg = await call('/api/auth/register', { method: 'POST', body: { email: 'web@example.com', password: 'correct-horse', password2: 'correct-horse' } })
    const cookie = sessionCookieFrom(reg)
    expect((await reg.json()).token).toBeUndefined()   // 网页端拿不到 token
    const res = await call('/api/auth/logout', { method: 'POST', headers: { Cookie: `gx_session=${cookie}` } })
    expect(res.status).toBe(204)
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(0)
  })
})

// ── 2. 同步新键 ──────────────────────────────────────────
describe('/sync 新键与形状', () => {
  const sync = (token, data) => call('/api/sync', { method: 'POST', body: { data }, headers: bearer(token) })

  it('highlights 逐条按 at 新者胜,墓碑生效,未提交的条目保留', async () => {
    const token = await registerNative()
    const h = (over = {}) => ({ book: '道德经', corpus: 'dao', slug: 'daodejing', ch: 1, no: 2, layer: 'original', seg: 0, start: 3, end: 9, text: '道可道', color: 'yellow', at: '2026-11-01T00:00:00.000Z', ...over })
    let res = await sync(token, { highlights: { value: { a: h(), b: h({ note: '批注' }) }, at: 1 } })
    expect(res.status).toBe(200)

    res = await sync(token, {
      highlights: {
        value: {
          a: { deleted: true, at: '2026-11-02T00:00:00.000Z' },            // 新墓碑 → 删
          b: h({ note: '旧批注', at: '2026-10-01T00:00:00.000Z' }),          // 更旧 → 云端那条留着
          c: h({ text: '非常道', at: '2026-11-03T00:00:00.000Z' }),
        },
        at: 2,
      },
    })
    const merged = (await res.json()).data.highlights.value
    expect(merged.a).toEqual({ deleted: true, at: '2026-11-02T00:00:00.000Z' })
    expect(merged.b.note).toBe('批注')
    expect(merged.c.text).toBe('非常道')

    // 网页端发空 {}(它不用这个键)不会抹掉 App 的划线
    res = await sync(token, { highlights: { value: {}, at: 0 } })
    expect(Object.keys((await res.json()).data.highlights.value).sort()).toEqual(['a', 'b', 'c'])
  })

  it('finished 逐条合并,默认值为 {}', async () => {
    const token = await registerNative()
    let res = await sync(token, {})
    let data = (await res.json()).data
    expect(data.finished).toEqual({ value: {}, at: 0 })
    expect(data.highlights).toEqual({ value: {}, at: 0 })

    await sync(token, { finished: { value: { 'dao:daodejing': { at: '2026-11-01T00:00:00.000Z' } }, at: 1 } })
    res = await sync(token, { finished: { value: { 'dao:daodejing': { deleted: true, at: '2026-11-05T00:00:00.000Z' }, 'ru:lunyu': { at: '2026-11-04T00:00:00.000Z' } }, at: 2 } })
    data = (await res.json()).data
    expect(data.finished.value).toEqual({
      'dao:daodejing': { deleted: true, at: '2026-11-05T00:00:00.000Z' },
      'ru:lunyu': { at: '2026-11-04T00:00:00.000Z' },
    })
  })

  it('readPos / readDays 值里多带字段不被拒、原样存回', async () => {
    const token = await registerNative()
    const readPos = { 'dao:daodejing': { ch: 3, seg: 2, off: 0.42, dev: 'ipad-1' } }
    const readDays = { '2026-11-20|dao|daodejing|3|ipad-1': { sec: 120, n: 2, c: 860, at: '2026-11-20T08:00:00.000Z' } }
    const res = await sync(token, { readPos: { value: readPos, at: 100 }, readDays: { value: readDays, at: 100 } })
    expect(res.status).toBe(200)
    const data = (await res.json()).data
    expect(data.readPos.value).toEqual(readPos)
    expect(data.readDays.value).toEqual(readDays)
  })

  it('未知键仍整包 400', async () => {
    const token = await registerNative()
    const res = await sync(token, { highlights: { value: {}, at: 1 }, nope: { value: 1, at: 1 } })
    expect(res.status).toBe(400)
  })

  it('highlights 单键上限 1MB,别的键仍 200KB', async () => {
    const token = await registerNative()
    const big = (bytes) => ({ x: { text: 'a'.repeat(bytes), at: '2026-11-01T00:00:00.000Z' } })
    expect((await sync(token, { highlights: { value: big(900_000), at: 1 } })).status).toBe(200)
    expect((await sync(token, { highlights: { value: big(1_000_100), at: 1 } })).status).toBe(400)
    expect((await sync(token, { corpusNotes: { value: big(300_000), at: 1 } })).status).toBe(400)
    expect((await sync(token, { corpusNotes: { value: big(190_000), at: 1 } })).status).toBe(200)
    // 整包:highlights 900KB + 两个 190KB 键一起发也够
    const res = await sync(token, {
      highlights: { value: big(900_000), at: 2 },
      corpusNotes: { value: big(190_000), at: 2 },
      corpusMarks: { value: big(190_000), at: 2 },
    })
    expect(res.status).toBe(200)
  })
})

// ── 3. Apple 登录 ────────────────────────────────────────
const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
let appleKeys

async function makeAppleKeys(kid = 'test-kid') {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { kid, privateKey: pair.privateKey, jwk: { kty: 'RSA', kid, use: 'sig', alg: 'RS256', n: jwk.n, e: jwk.e } }
}

// App 每次登录现生成的原始 nonce;令牌里的 nonce 声明是它的 SHA-256 十六进制
const NONCE = 'Zq3x-raw-nonce_0123456789abcdefghijklmnopq'

async function appleToken(payload = {}, { keys = appleKeys, header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const body = { iss: 'https://appleid.apple.com', aud: 'pub.gavin.hexa.desk', exp: now + 600, iat: now, sub: 'apple-sub-1', nonce: await sha256Hex(NONCE), ...payload }
  if (body.nonce === undefined) delete body.nonce
  const head = b64u({ alg: 'RS256', kid: keys.kid, ...header })
  const data = `${head}.${b64u(body)}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(data))
  return `${data}.${Buffer.from(sig).toString('base64url')}`
}

function stubAppleKeys(...keySets) {
  const fetchMock = vi.fn(async (url) => {
    expect(String(url)).toBe(APPLE_KEYS_URL)
    return new Response(JSON.stringify({ keys: keySets.map((k) => k.jwk) }), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const appleLogin = (identityToken, { headers = NATIVE, displayName, nonce = NONCE, authorizationCode } = {}) =>
  call('/api/auth/apple', {
    method: 'POST',
    body: {
      identityToken,
      ...(nonce !== null ? { nonce } : {}),   // 传 null = 请求体不带 nonce
      ...(authorizationCode ? { authorizationCode } : {}),
      ...(displayName ? { displayName } : {}),
    },
    headers,
  })

describe('/auth/apple', () => {
  beforeEach(async () => {
    appleKeys ||= await makeAppleKeys()
  })

  it('验签通过即建号、回 token;再登同一 sub 是同一账号;公钥只取一次', async () => {
    const fetchMock = stubAppleKeys(appleKeys)
    const res = await appleLogin(await appleToken({ email: 'x1@privaterelay.appleid.com', email_verified: 'true', is_private_email: 'true' }), { displayName: '读书人' })
    expect(res.status).toBe(200)
    const first = await res.json()
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(first.user.displayName).toBe('读书人')
    expect(first.user.email).toBe('x1@privaterelay.appleid.com')
    expect(first.user.emailVerified).toBe(true)
    expect(sessionCookieFrom(res)).toBeNull()

    const again = await (await appleLogin(await appleToken())).json()   // 第二次苹果不再给邮箱
    expect(again.user.id).toBe(first.user.id)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(count("SELECT count(*) AS n FROM identities WHERE provider = 'apple'")).toBe(1)
  })

  it('不带 X-Client: native 时种 cookie、不回 token', async () => {
    stubAppleKeys(appleKeys)
    const res = await appleLogin(await appleToken(), { headers: {} })
    expect(res.status).toBe(200)
    expect((await res.json()).token).toBeUndefined()
    expect(sessionCookieFrom(res)).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('缺邮箱也能建号,昵称退回「读者」', async () => {
    stubAppleKeys(appleKeys)
    const body = await (await appleLogin(await appleToken({ sub: 'no-email' }))).json()
    expect(body.user.email).toBeNull()
    expect(body.user.displayName).toBe('读者')
  })

  it('邮箱已验证时并入已有账号;未验证时另建无邮箱账号', async () => {
    stubAppleKeys(appleKeys)
    const regToken = await registerNative('same@example.com')
    const me = await (await call('/api/me', { headers: bearer(regToken) })).json()

    const unverified = await (await appleLogin(await appleToken({ sub: 'sub-a', email: 'same@example.com', email_verified: false }))).json()
    expect(unverified.user.id).not.toBe(me.user.id)
    expect(unverified.user.email).toBeNull()

    const merged = await (await appleLogin(await appleToken({ sub: 'sub-b', email: 'SAME@example.com', email_verified: true }))).json()
    expect(merged.user.id).toBe(me.user.id)
    expect(merged.user.emailVerified).toBe(true)
    // 再来一个不同 Apple ID 想并同一个邮箱账号 → 409
    const third = await appleLogin(await appleToken({ sub: 'sub-c', email: 'same@example.com', email_verified: true }))
    expect(third.status).toBe(409)
  })

  it('签名、iss、aud、exp、alg 不对一律 401', async () => {
    const other = await makeAppleKeys('test-kid')   // 同 kid、不同私钥 → 签名不符
    stubAppleKeys(appleKeys)
    const now = Math.floor(Date.now() / 1000)
    const bad = [
      await appleToken({}, { keys: other }),
      await appleToken({ iss: 'https://evil.example' }),
      await appleToken({ aud: 'com.someone.else' }),
      await appleToken({ exp: now - 3600 }),
      await appleToken({}, { header: { alg: 'HS256' } }),
      await appleToken({}, { header: { kid: 'unknown' } }),
      'not.a.jwt',
    ]
    for (const token of bad) {
      expect((await appleLogin(token)).status).toBe(401)
    }
    expect((await call('/api/auth/apple', { method: 'POST', body: {}, headers: NATIVE })).status).toBe(400)
    expect(count('SELECT count(*) AS n FROM users')).toBe(0)
  })

  it('APPLE_AUDIENCES 环境变量决定允许的 aud', async () => {
    stubAppleKeys(appleKeys)
    env.APPLE_AUDIENCES = 'pub.gavin.hexa.desk.dev, pub.gavin.hexa'
    expect((await appleLogin(await appleToken())).status).toBe(401)
    expect((await appleLogin(await appleToken({ aud: 'pub.gavin.hexa' }))).status).toBe(200)
  })

  it('取不到苹果公钥时 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect((await appleLogin(await appleToken())).status).toBe(503)
  })

  it('苹果轮换密钥:缓存里没有的新 kid 会触发重取', async () => {
    const rotated = await makeAppleKeys('kid-2')
    const fetchKeys = vi.fn()
      .mockResolvedValueOnce([appleKeys.jwk])
      .mockResolvedValueOnce([appleKeys.jwk, rotated.jwk])
    const now = Date.now()
    await verifyAppleIdentityToken(await appleToken(), { fetchKeys, now })
    await verifyAppleIdentityToken(await appleToken({}, { keys: rotated }), { fetchKeys, now: now + 120_000 })
    expect(fetchKeys).toHaveBeenCalledTimes(2)
  })

  it('nonce:sha256_hex(请求体 nonce) 须等于令牌声明;缺哪边都拒', async () => {
    stubAppleKeys(appleKeys)
    const good = await appleToken()
    expect((await appleLogin(good)).status).toBe(200)
    // 截到令牌、不知道原始 nonce → 重放不了
    expect((await appleLogin(good, { nonce: 'guessed-nonce-0123456789' })).status).toBe(401)
    // 请求体不带 nonce → 400(先于验签)
    expect((await appleLogin(good, { nonce: null })).status).toBe(400)
    expect((await appleLogin(good, { nonce: 'short' })).status).toBe(400)
    // 令牌里没有 nonce 声明、请求体却带了 → 拒
    expect((await appleLogin(await appleToken({ nonce: undefined }))).status).toBe(401)
    // 声明直接放原始值(没哈希)也不认
    expect((await appleLogin(await appleToken({ nonce: NONCE }))).status).toBe(401)
    // 声明大写十六进制也认
    expect((await appleLogin(await appleToken({ nonce: (await sha256Hex(NONCE)).toUpperCase() }))).status).toBe(200)
  })
})

// ── 4. Google 登录回 App ─────────────────────────────────
function googleIdToken(payload = {}) {
  const body = { iss: 'https://accounts.google.com', aud: 'google-client', exp: Math.floor(Date.now() / 1000) + 600, email_verified: true, sub: 'g-1', email: 'g@example.com', ...payload }
  return `x.${b64u(body)}.sig`
}

function stubGoogleToken() {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    expect(String(url)).toBe('https://oauth2.googleapis.com/token')
    return new Response(JSON.stringify({ id_token: googleIdToken() }), { status: 200 })
  }))
}

async function googleRoundTrip(startQuery) {
  const start = await call(`/api/auth/google/start?${startQuery}`)
  expect(start.status).toBe(302)
  const oauth = /gx_oauth=([^;]*)/.exec(start.headers.get('Set-Cookie'))[1]
  const attempt = JSON.parse(decodeURIComponent(oauth))
  stubGoogleToken()
  const cb = await call(`/api/auth/google/callback?state=${attempt.state}&code=abc`, { headers: { Cookie: `gx_oauth=${oauth}` } })
  return { attempt, cb }
}

const exchange = (body) => call('/api/auth/native/exchange', { method: 'POST', body })
const VERIFIER = 'v'.repeat(20) + '-._~' + 'w'.repeat(30)
const nativeQuery = async (verifier = VERIFIER) => `native=1&code_challenge=${await challengeFromVerifier(verifier)}`

describe('Google 原生回跳 + /auth/native/exchange', () => {
  it('网页流程不变:种会话 cookie,302 回站内并带 auth=google', async () => {
    const { attempt, cb } = await googleRoundTrip('return_to=%2Fru%2Flunyu')
    expect(attempt.native).toBeUndefined()
    expect(cb.status).toBe(302)
    expect(cb.headers.get('Location')).toBe('/ru/lunyu?auth=google')
    expect(sessionCookieFrom(cb)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(count('SELECT count(*) AS n FROM auth_codes')).toBe(0)
  })

  it('native=1:不种 cookie,302 到 guanxiangdesk://auth?code=,短码只能换一次', async () => {
    const { attempt, cb } = await googleRoundTrip(await nativeQuery())
    expect(attempt.native).toBe(true)
    expect(cb.status).toBe(302)
    const location = new URL(cb.headers.get('Location'))
    expect(location.protocol).toBe('guanxiangdesk:')
    expect(location.host).toBe('auth')
    expect(sessionCookieFrom(cb)).toBeNull()
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(0)
    const code = location.searchParams.get('code')
    // 库里只存哈希
    const row = db.sqlite.prepare('SELECT * FROM auth_codes').get()
    expect(row.target.startsWith('native:')).toBe(true)
    expect(JSON.stringify(row)).not.toContain(code.split('.')[1])

    const first = await exchange({ code, verifier: VERIFIER })
    expect(first.status).toBe(200)
    const body = await first.json()
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.user.email).toBe('g@example.com')
    expect((await (await call('/api/me', { headers: bearer(body.token) })).json()).user.id).toBe(body.user.id)

    expect((await exchange({ code, verifier: VERIFIER })).status).toBe(400)
  })

  it('短码 2 分钟后失效', async () => {
    const { cb } = await googleRoundTrip(await nativeQuery())
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 121_000)
    expect((await exchange({ code, verifier: VERIFIER })).status).toBe(400)
  })

  it('伪造 / 篡改的短码换不出会话', async () => {
    const { cb } = await googleRoundTrip(await nativeQuery())
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    const [uid, secret] = code.split('.')
    const flipped = `${uid}.${secret.slice(0, -1)}${secret.endsWith('A') ? 'B' : 'A'}`
    expect((await exchange({ code: flipped, verifier: VERIFIER })).status).toBe(400)
    expect((await exchange({ code: 'garbage', verifier: VERIFIER })).status).toBe(400)
    expect((await exchange({})).status).toBe(400)
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(0)
  })

  it('exchange 必须交出与 challenge 配对的 verifier', async () => {
    const { cb } = await googleRoundTrip(await nativeQuery())
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    expect((await exchange({ code })).status).toBe(400)                         // 缺 verifier
    expect((await exchange({ code, verifier: 'short' })).status).toBe(400)      // 形状不对
    expect((await exchange({ code, verifier: 'x'.repeat(50) })).status).toBe(400) // 不配对
    const ok = await exchange({ code, verifier: VERIFIER })
    expect(ok.status).toBe(200)
  })

  it('native=1 不带 code_challenge 直接 400,不发 cookie', async () => {
    const res = await call('/api/auth/google/start?native=1')
    expect(res.status).toBe(400)
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('网页模式不要求 code_challenge', async () => {
    const res = await call('/api/auth/google/start?return_to=%2F')
    expect(res.status).toBe(302)
    expect(new URL(res.headers.get('Location')).host).toBe('accounts.google.com')
  })

  it('原生模式下用户在 Google 取消 → 跳回 App 带 error', async () => {
    const start = await call(`/api/auth/google/start?${await nativeQuery()}`)
    const oauth = /gx_oauth=([^;]*)/.exec(start.headers.get('Set-Cookie'))[1]
    const { state } = JSON.parse(decodeURIComponent(oauth))
    const cb = await call(`/api/auth/google/callback?state=${state}&error=access_denied`, { headers: { Cookie: `gx_oauth=${oauth}` } })
    expect(cb.status).toBe(302)
    expect(cb.headers.get('Location')).toBe('guanxiangdesk://auth?error=cancelled')
  })

  it('code_challenge 形状不对直接 400', async () => {
    expect((await call('/api/auth/google/start?native=1&code_challenge=short')).status).toBe(400)
  })
})

// ── 5. 迁移 0007 ─────────────────────────────────────────
describe('migrations/0007-apple-identity.sql', () => {
  it('旧库重建 identities 后数据不丢、apple 可插、CHECK 仍在', () => {
    const legacy = createTestD1(schemaBefore0007())
    const sq = legacy.sqlite
    // 起点确是线上的样子:五列、secret 在末尾、没有 refresh 两列
    expect(sq.prepare('PRAGMA table_info(identities)').all().map((r) => r.name))
      .toEqual(['user_id', 'provider', 'provider_uid', 'created_at', 'secret'])
    sq.prepare("INSERT INTO users (id, display_name, avatar_seed, email) VALUES ('u1', 'a', 's', 'a@example.com')").run()
    sq.prepare("INSERT INTO identities (user_id, provider, provider_uid, created_at, secret) VALUES ('u1', 'email', 'a@example.com', 123, 'pbkdf2:x')").run()
    sq.prepare("INSERT INTO identities (user_id, provider, provider_uid, created_at) VALUES ('u1', 'google', 'g-sub', 456)").run()
    expect(() => sq.prepare("INSERT INTO identities (user_id, provider, provider_uid) VALUES ('u1', 'apple', 'x')").run()).toThrow()

    sq.exec(readRepoFile('migrations/0007-apple-identity.sql'))

    expect(sq.prepare('SELECT user_id, provider, provider_uid, created_at, secret FROM identities ORDER BY provider').all().map((r) => ({ ...r }))).toEqual([
      { user_id: 'u1', provider: 'email', provider_uid: 'a@example.com', created_at: 123, secret: 'pbkdf2:x' },
      { user_id: 'u1', provider: 'google', provider_uid: 'g-sub', created_at: 456, secret: null },
    ])
    sq.prepare("INSERT INTO identities (user_id, provider, provider_uid) VALUES ('u1', 'apple', 'apple-sub')").run()
    expect(() => sq.prepare("INSERT INTO identities (user_id, provider, provider_uid) VALUES ('u1', 'myspace', 'x')").run()).toThrow()
    // 外键与级联仍在
    sq.prepare("DELETE FROM users WHERE id = 'u1'").run()
    expect(sq.prepare('SELECT count(*) AS n FROM identities').get().n).toBe(0)
    // 重建后表结构与 schema.sql 新建的一致(列、索引)
    const fresh = createTestD1().sqlite
    const shape = (db) => ({
      columns: db.prepare('PRAGMA table_info(identities)').all().map((r) => ({ ...r })),
      indexes: db.prepare("SELECT name FROM sqlite_master WHERE tbl_name = 'identities' AND type = 'index' ORDER BY name").all().map((r) => r.name),
      fks: db.prepare('PRAGMA foreign_key_list(identities)').all().map((r) => ({ ...r })),
    })
    expect(shape(sq)).toEqual(shape(fresh))
    expect(shape(sq).columns.map((c) => c.name)).toContain('refresh_token')
    const rebuilt = sq.prepare("SELECT sql FROM sqlite_master WHERE name = 'identities'").get().sql
    expect(rebuilt).toContain("'apple'")
  })
})

// ── 6. 无邮箱账号也能注销(App Store 5.1.1(v))────────────
describe('DELETE /me 无邮箱账号', () => {
  it('Apple 无邮箱账号输入「注销账号」即可注销', async () => {
    appleKeys ||= await makeAppleKeys()
    stubAppleKeys(appleKeys)
    const { token } = await (await appleLogin(await appleToken({ sub: 'del-me' }))).json()
    const del = (confirm) => call('/api/me', { method: 'DELETE', body: { confirm }, headers: bearer(token) })
    expect((await del('x@example.com')).status).toBe(400)
    expect((await del('注销账号')).status).toBe(200)
    expect(count('SELECT count(*) AS n FROM users')).toBe(0)
    expect(count('SELECT count(*) AS n FROM identities')).toBe(0)
  })
})

// ── 7. Apple 授权码换 refresh_token、注销时撤销 ─────────────
describe('Apple 授权:登录换 refresh_token,注销撤销', () => {
  const TEAM = 'TEAM123456'
  const KID = 'KEY1234567'
  const AUTH_CODE = 'c0ffee.0.abcd.authorization-code-from-apple'
  const REFRESH = 'r.refresh-token-from-apple.0123456789'
  let ecPair
  let pem

  beforeEach(async () => {
    appleKeys ||= await makeAppleKeys()
    ecPair ||= await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    if (!pem) {
      const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', ecPair.privateKey)).toString('base64')
      pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`
    }
  })

  const withSecrets = (privateKey = pem) => Object.assign(env, { APPLE_TEAM_ID: TEAM, APPLE_KEY_ID: KID, APPLE_PRIVATE_KEY: privateKey })

  // 按 URL 分派的 fetch 桩:公钥照给;token / revoke 由各测试决定怎么回,所有请求记下 {url, form}
  function stubApple({ token = () => Response.json({ access_token: 'a', refresh_token: REFRESH, id_token: 'x', token_type: 'Bearer', expires_in: 3600 }), revoke = () => new Response(null, { status: 200 }) } = {}) {
    const calls = []
    const fetchMock = vi.fn(async (url, init = {}) => {
      const href = String(url)
      const form = init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : null
      calls.push({ url: href, form })
      if (href === APPLE_KEYS_URL) return Response.json({ keys: [appleKeys.jwk] })
      if (href === APPLE_TOKEN_URL) return token(form)
      if (href === APPLE_REVOKE_URL) return revoke(form)
      throw new Error(`unexpected fetch ${href}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    return calls
  }

  // 用测试自己的 P-256 公钥验 client_secret JWT 的 ES256 签名,并核头与声明
  async function expectClientSecret(jwt) {
    const [h, p, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(h, 'base64url'))).toEqual({ alg: 'ES256', kid: KID })
    const claims = JSON.parse(Buffer.from(p, 'base64url'))
    expect(claims).toMatchObject({ iss: TEAM, aud: 'https://appleid.apple.com', sub: 'pub.gavin.hexa.desk' })
    expect(claims.exp - claims.iat).toBe(300)
    expect(Math.abs(claims.iat - Date.now() / 1000)).toBeLessThan(60)
    const signature = Buffer.from(sig, 'base64url')
    expect(signature.length).toBe(64)   // JWS 要的 r‖s,不是 DER
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, ecPair.publicKey, signature, new TextEncoder().encode(`${h}.${p}`))
    expect(ok).toBe(true)
  }

  const appleRow = (sub) => db.sqlite.prepare("SELECT refresh_token, refresh_aud FROM identities WHERE provider = 'apple' AND provider_uid = ?").get(sub)

  // 日志里不许出现任何凭证
  function expectNoSecretsLogged(spy) {
    const logged = JSON.stringify(spy.mock.calls.map((args) => args.map(String)))
    for (const secret of [AUTH_CODE, REFRESH, pem.split('\n')[1], 'BEGIN PRIVATE KEY']) expect(logged).not.toContain(secret)
  }

  it('登录时用授权码换 refresh_token 并存到 Apple identity 上', async () => {
    withSecrets()
    const calls = stubApple()
    const res = await appleLogin(await appleToken({ sub: 'grant-1' }), { authorizationCode: AUTH_CODE })
    expect(res.status).toBe(200)
    const tokenCall = calls.find((c) => c.url === APPLE_TOKEN_URL)
    expect(tokenCall.form).toMatchObject({ client_id: 'pub.gavin.hexa.desk', code: AUTH_CODE, grant_type: 'authorization_code' })
    expect(Object.keys(tokenCall.form).sort()).toEqual(['client_id', 'client_secret', 'code', 'grant_type'])
    await expectClientSecret(tokenCall.form.client_secret)
    expect(appleRow('grant-1')).toEqual({ refresh_token: REFRESH, refresh_aud: 'pub.gavin.hexa.desk' })
  })

  it('PEM 里的换行被存成字面量 \\n 也认', async () => {
    withSecrets(pem.replace(/\n/g, '\\n'))
    stubApple()
    expect((await appleLogin(await appleToken({ sub: 'grant-esc' }), { authorizationCode: AUTH_CODE })).status).toBe(200)
    expect(appleRow('grant-esc').refresh_token).toBe(REFRESH)
  })

  it('换码失败(苹果拒绝 / 连不上 / 坏私钥)照常登录,只记日志且不含凭证', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    withSecrets()
    stubApple({ token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) })
    let res = await appleLogin(await appleToken({ sub: 'grant-fail' }), { authorizationCode: AUTH_CODE })
    expect(res.status).toBe(200)
    expect((await res.json()).token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(appleRow('grant-fail').refresh_token).toBeNull()
    expect(errors).toHaveBeenCalledWith('Apple token exchange failed', 'Apple token HTTP 400 invalid_grant')

    stubApple({ token: () => { throw new TypeError('network down') } })
    res = await appleLogin(await appleToken({ sub: 'grant-fail' }), { authorizationCode: AUTH_CODE })
    expect(res.status).toBe(200)

    withSecrets('-----BEGIN PRIVATE KEY-----\nnot-a-key\n-----END PRIVATE KEY-----')
    stubApple()
    res = await appleLogin(await appleToken({ sub: 'grant-fail' }), { authorizationCode: AUTH_CODE })
    expect(res.status).toBe(200)
    expectNoSecretsLogged(errors)
  })

  it('注销:先用 refresh_token 调 revoke(字段与 client_secret 都对),再删账号', async () => {
    withSecrets()
    const calls = stubApple()
    const { token } = await (await appleLogin(await appleToken({ sub: 'grant-del' }), { authorizationCode: AUTH_CODE })).json()
    const del = await call('/api/me', { method: 'DELETE', body: { confirm: '注销账号' }, headers: bearer(token) })
    expect(del.status).toBe(200)
    const revokes = calls.filter((c) => c.url === APPLE_REVOKE_URL)
    expect(revokes).toHaveLength(1)
    expect(revokes[0].form).toMatchObject({ client_id: 'pub.gavin.hexa.desk', token: REFRESH, token_type_hint: 'refresh_token' })
    expect(Object.keys(revokes[0].form).sort()).toEqual(['client_id', 'client_secret', 'token', 'token_type_hint'])
    await expectClientSecret(revokes[0].form.client_secret)
    expect(count('SELECT count(*) AS n FROM users')).toBe(0)
    expect(count('SELECT count(*) AS n FROM identities')).toBe(0)
  })

  it('revoke 失败不挡注销,日志不含凭证', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    withSecrets()
    stubApple({ revoke: () => Response.json({ error: 'invalid_client' }, { status: 400 }) })
    const { token } = await (await appleLogin(await appleToken({ sub: 'grant-del2' }), { authorizationCode: AUTH_CODE })).json()
    const del = await call('/api/me', { method: 'DELETE', body: { confirm: '注销账号' }, headers: bearer(token) })
    expect(del.status).toBe(200)
    expect(count('SELECT count(*) AS n FROM users')).toBe(0)
    expect(errors).toHaveBeenCalledWith('Apple token revoke failed', 'Apple revoke HTTP 400 invalid_client')
    expectNoSecretsLogged(errors)
  })

  it('没存 refresh_token 的 Apple 账号、邮箱账号注销都不调 revoke', async () => {
    withSecrets()
    const calls = stubApple()
    const { token } = await (await appleLogin(await appleToken({ sub: 'grant-none' }))).json()   // 没带授权码
    expect(calls.some((c) => c.url === APPLE_TOKEN_URL)).toBe(false)
    expect((await call('/api/me', { method: 'DELETE', body: { confirm: '注销账号' }, headers: bearer(token) })).status).toBe(200)
    const emailToken = await registerNative('plain@example.com')
    expect((await call('/api/me', { method: 'DELETE', body: { confirm: 'plain@example.com' }, headers: bearer(emailToken) })).status).toBe(200)
    expect(calls.some((c) => c.url === APPLE_REVOKE_URL)).toBe(false)
  })

  it('没配密钥:带授权码登录、注销都不发任何苹果 token / revoke 请求', async () => {
    const calls = stubApple()
    env.APPLE_TEAM_ID = TEAM   // 只配一半也算没配
    const { token } = await (await appleLogin(await appleToken({ sub: 'no-secrets' }), { authorizationCode: AUTH_CODE })).json()
    expect(appleRow('no-secrets').refresh_token).toBeNull()
    // 假装库里有旧 token,也不该去撤销
    db.sqlite.prepare("UPDATE identities SET refresh_token = 'stale', refresh_aud = 'pub.gavin.hexa.desk' WHERE provider_uid = 'no-secrets'").run()
    expect((await call('/api/me', { method: 'DELETE', body: { confirm: '注销账号' }, headers: bearer(token) })).status).toBe(200)
    expect(calls.map((c) => c.url)).toEqual([APPLE_KEYS_URL])
  })
})
