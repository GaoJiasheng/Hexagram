import { describe, expect, it } from 'vitest'
import { generateCode, hashCode, verifyCodeRow, sentRecently, buildCodeEmail, codeTarget, isCodeShape, CODE_TTL_MS, CODE_MAX_ATTEMPTS, CODE_PURPOSES } from './auth-code.js'
import { mailProviders, sendMail } from './mailer.js'

describe('邮箱验证码', () => {
  it('六位数字、哈希与目标绑定', async () => {
    expect(generateCode()).toMatch(/^\d{6}$/)
    expect(generateCode((a) => { a[0] = 7 })).toBe('000007')
    expect(isCodeShape('123456')).toBe(true)
    expect(isCodeShape('12345')).toBe(false)
    const h1 = await hashCode(codeTarget('reset', 'a@b.c'), '123456')
    const h2 = await hashCode(codeTarget('comment', 'a@b.c'), '123456')
    expect(h1).toHaveLength(64)
    expect(h1).not.toBe(h2)
  })
  it('校验状态:缺 / 过期 / 锁定 / 不符 / 通过', async () => {
    const now = 1_000_000
    const target = 'reset:x@y.z'
    const hash = await hashCode(target, '654321')
    expect(verifyCodeRow(null, hash, now)).toBe('missing')
    expect(verifyCodeRow({ code_hash: hash, expires_at: now - 1, attempts: 0 }, hash, now)).toBe('expired')
    expect(verifyCodeRow({ code_hash: hash, expires_at: now + 1, attempts: CODE_MAX_ATTEMPTS }, hash, now)).toBe('locked')
    expect(verifyCodeRow({ code_hash: 'nope', expires_at: now + 1, attempts: 0 }, hash, now)).toBe('mismatch')
    expect(verifyCodeRow({ code_hash: hash, expires_at: now + 1, attempts: 4 }, hash, now)).toBe('ok')
  })
  it('60 秒内不重发', () => {
    const now = 5_000_000
    expect(sentRecently({ expires_at: now + CODE_TTL_MS }, now)).toBe(true)          // 刚发
    expect(sentRecently({ expires_at: now + CODE_TTL_MS - 61_000 }, now)).toBe(false) // 61 秒前发的
    expect(sentRecently(null, now)).toBe(false)
  })
  it('三种用途的邮件:主题带码、正文与 HTML 都有码', () => {
    expect([...CODE_PURPOSES]).toEqual(['reset', 'comment', 'verify'])
    for (const [p, word] of [['reset', '重设密码'], ['comment', '评论验证码'], ['verify', '邮箱验证码']]) {
      const mail = buildCodeEmail('u@example.com', p, '111222')
      expect(mail.subject).toContain('111222')
      expect(mail.subject).toContain(word)
      expect(mail.text).toContain('111222')
      expect(mail.html).toContain('111222')
    }
  })
})

describe('发信通道', () => {
  const mail = { to: 'u@example.com', subject: 's', text: 't' }
  it('Cloudflare 优先,其次 Resend;都没配为空;DEV_MAIL_LOG 只在都没配时生效', () => {
    expect(mailProviders({}).map((p) => p.name)).toEqual([])
    expect(mailProviders({ RESEND_API_KEY: 'k' }).map((p) => p.name)).toEqual(['resend'])
    expect(mailProviders({ RESEND_API_KEY: 'k', CF_EMAIL_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' }).map((p) => p.name)).toEqual(['cloudflare', 'resend'])
    expect(mailProviders({ DEV_MAIL_LOG: '1' }).map((p) => p.name)).toEqual(['dev-log'])
    expect(mailProviders({ DEV_MAIL_LOG: '1', RESEND_API_KEY: 'k' }).map((p) => p.name)).toEqual(['dev-log'])   // 本地显式要日志就只打日志
    expect(mailProviders({ EMAIL: { send() {} }, RESEND_API_KEY: 'k' }).map((p) => p.name)).toEqual(['cloudflare-binding', 'resend'])
    expect(mailProviders({ MAILER: { fetch() {} }, RESEND_API_KEY: 'k' }).map((p) => p.name)).toEqual(['cloudflare-worker', 'resend'])
  })
  it('服务绑定发件:Worker 回 502(域名未激活等)退 Resend;回 200 即成', async () => {
    const mail = { to: 'u@example.com', subject: 's', text: 't', html: '<b>h</b>' }
    let body
    const bad = { fetch: async () => Response.json({ ok: false, code: 'E_SENDER_NOT_VERIFIED' }, { status: 502 }) }
    expect(await sendMail({ MAILER: bad, RESEND_API_KEY: 'k' }, mail, async () => new Response('{}'))).toEqual({ ok: true, provider: 'resend' })
    const good = { fetch: async (_u, init) => { body = JSON.parse(init.body); return Response.json({ ok: true }) } }
    expect(await sendMail({ MAILER: good, RESEND_API_KEY: 'k' }, mail, async () => { throw new Error('no resend') })).toEqual({ ok: true, provider: 'cloudflare-worker' })
    expect(body).toEqual({ to: 'u@example.com', subject: 's', text: 't', html: '<b>h</b>' })
  })
  it('绑定发件:域名未激活(抛 E_SENDER_NOT_VERIFIED)时退到 Resend;激活后走绑定、发件人为 mail.gavin.pub', async () => {
    const mail = { to: 'u@example.com', subject: 's', text: 't' }
    const fail = { send: async () => { const e = new Error('sender not verified'); e.code = 'E_SENDER_NOT_VERIFIED'; throw e } }
    const r1 = await sendMail({ EMAIL: fail, RESEND_API_KEY: 'k' }, mail, async () => new Response('{}'))
    expect(r1).toEqual({ ok: true, provider: 'resend' })
    let sent
    const ok = { send: async (m) => { sent = m; return { messageId: 'x' } } }
    const r2 = await sendMail({ EMAIL: ok, RESEND_API_KEY: 'k' }, mail, async () => { throw new Error('should not call resend') })
    expect(r2).toEqual({ ok: true, provider: 'cloudflare-binding' })
    expect(sent.from).toEqual({ email: 'notify@mail.gavin.pub', name: '观象' })
  })
  it('Cloudflare 失败自动退到 Resend', async () => {
    const calls = []
    const fake = async (url) => { calls.push(url); return url.includes('cloudflare') ? new Response(JSON.stringify({ success: false }), { status: 403 }) : new Response('{}', { status: 200 }) }
    const r = await sendMail({ RESEND_API_KEY: 'k', CF_EMAIL_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' }, mail, fake)
    expect(r).toEqual({ ok: true, provider: 'resend' })
    expect(calls[0]).toContain('/accounts/a/email/sending/send')
    expect(calls[1]).toBe('https://api.resend.com/emails')
  })
  it('请求体带发件人与 HTML', async () => {
    let body
    await sendMail({ RESEND_API_KEY: 'k' }, { ...mail, html: '<b>h</b>' }, async (_u, init) => { body = JSON.parse(init.body); return new Response('{}') })
    expect(body.from).toContain('send.gavin.pub')
    expect(body.html).toBe('<b>h</b>')
  })
})
