import { describe, expect, it } from 'vitest'
import { generateCode, hashCode, verifyCodeRow, sentRecently, buildCodeEmail, codeSendRequest, codeTarget, isCodeShape, CODE_TTL_MS, CODE_MAX_ATTEMPTS } from './auth-code.js'

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
  it('邮件与请求', () => {
    const mail = buildCodeEmail('u@example.com', 'reset', '111222')
    expect(mail.subject).toContain('111222')
    expect(mail.text).toContain('重设密码')
    expect(mail.from).toContain('send.gavin.pub')
    expect(codeSendRequest({}, 'u@example.com', 'reset', '111222')).toBeNull()
    const req = codeSendRequest({ RESEND_API_KEY: 'k' }, 'u@example.com', 'comment', '111222')
    expect(req.url).toBe('https://api.resend.com/emails')
    expect(JSON.parse(req.init.body).subject).toContain('评论验证码')
  })
})
