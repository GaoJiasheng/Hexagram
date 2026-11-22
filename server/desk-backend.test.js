// 原生 App「观象 · 书桌」共用账号与云同步的服务端改动(2026-11-22):
// Bearer 登出 · 同步新键 highlights / finished · 放宽值形状 · Apple 登录 · Google 回 App 短码 · 迁移 0007。
// 接口测试跑在 node:sqlite 上的真 schema(server/test-d1.js),CHECK / UNIQUE / 外键都生效。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[route]].js'
import { createTestD1, readRepoFile } from './test-d1.js'
import { APPLE_KEYS_URL, resetAppleKeyCache, verifyAppleIdentityToken } from './apple-auth.js'
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

async function appleToken(payload = {}, { keys = appleKeys, header = {} } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const body = { iss: 'https://appleid.apple.com', aud: 'pub.gavin.hexa.desk', exp: now + 600, iat: now, sub: 'apple-sub-1', ...payload }
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

const appleLogin = (identityToken, { headers = NATIVE, displayName } = {}) =>
  call('/api/auth/apple', { method: 'POST', body: { identityToken, ...(displayName ? { displayName } : {}) }, headers })

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
    const { attempt, cb } = await googleRoundTrip('native=1')
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

    const first = await exchange({ code })
    expect(first.status).toBe(200)
    const body = await first.json()
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(body.user.email).toBe('g@example.com')
    expect((await (await call('/api/me', { headers: bearer(body.token) })).json()).user.id).toBe(body.user.id)

    expect((await exchange({ code })).status).toBe(400)
  })

  it('短码 2 分钟后失效', async () => {
    const { cb } = await googleRoundTrip('native=1')
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 121_000)
    expect((await exchange({ code })).status).toBe(400)
  })

  it('伪造 / 篡改的短码换不出会话', async () => {
    const { cb } = await googleRoundTrip('native=1')
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    const [uid, secret] = code.split('.')
    const flipped = `${uid}.${secret.slice(0, -1)}${secret.endsWith('A') ? 'B' : 'A'}`
    expect((await exchange({ code: flipped })).status).toBe(400)
    expect((await exchange({ code: 'garbage' })).status).toBe(400)
    expect((await exchange({})).status).toBe(400)
    expect(count('SELECT count(*) AS n FROM sessions')).toBe(0)
  })

  it('带 code_challenge 时必须交出对应 verifier', async () => {
    const verifier = 'v'.repeat(20) + '-._~' + 'w'.repeat(30)
    const challenge = await challengeFromVerifier(verifier)
    const { cb } = await googleRoundTrip(`native=1&code_challenge=${challenge}`)
    const code = new URL(cb.headers.get('Location')).searchParams.get('code')
    expect((await exchange({ code })).status).toBe(400)
    expect((await exchange({ code, verifier: 'x'.repeat(50) })).status).toBe(400)
    const ok = await exchange({ code, verifier })
    expect(ok.status).toBe(200)
  })

  it('原生模式下用户在 Google 取消 → 跳回 App 带 error', async () => {
    const start = await call('/api/auth/google/start?native=1')
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
    const current = readRepoFile('schema.sql')
    const old = current.replace(", 'apple')", ')')
    expect(old).not.toBe(current)
    const legacy = createTestD1(old)
    const sq = legacy.sqlite
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
    // 重建后表结构与 schema.sql 一致
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
