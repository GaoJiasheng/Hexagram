// 邮箱验证码(续跑 ⑥ 大陆账号体验,2026-10-01):两种用途——
//   reset   找回密码:邮箱 → 验证码 → 设新密码(此前只有「注销」没有「找回」)
//   comment 评论时 Cloudflare Turnstile 加载不了(大陆网络常见)的降级:发一枚码到登录邮箱,凭码发评论
// 码 6 位数字、10 分钟有效、错 5 次作废、60 秒内不重发;表 auth_codes(target 主键,存哈希不存明文)。
// 纯函数部分在这里(可单测),读写 D1 与发信在 functions/api 里。邮件走 Resend,发件域与评论通知同一个(send.gavin.pub)。
export const CODE_TTL_MS = 10 * 60 * 1000
export const CODE_RESEND_MS = 60 * 1000
export const CODE_MAX_ATTEMPTS = 5
export const CODE_FROM = '观象 <notify@send.gavin.pub>'
const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
export const CODE_PURPOSES = new Set(['reset', 'comment'])

export function generateCode(random = (a) => crypto.getRandomValues(a)) {
  const a = new Uint32Array(1)
  random(a)
  return String(a[0] % 1_000_000).padStart(6, '0')
}

export const codeTarget = (purpose, id) => `${purpose}:${id}`
export const isCodeShape = (code) => typeof code === 'string' && /^\d{6}$/.test(code)

export async function hashCode(target, code) {
  const data = new TextEncoder().encode(`${target}:${code}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 一行 auth_codes 对上一枚码的状态
export function verifyCodeRow(row, hash, now) {
  if (!row) return 'missing'
  if (Number(row.expires_at) <= now) return 'expired'
  if (Number(row.attempts) >= CODE_MAX_ATTEMPTS) return 'locked'
  return row.code_hash === hash ? 'ok' : 'mismatch'
}

// 60 秒内已发过(expires_at 是发出时刻 + TTL)
export function sentRecently(row, now) {
  return !!row && Number(row.expires_at) - CODE_TTL_MS + CODE_RESEND_MS > now
}

export function buildCodeEmail(to, purpose, code) {
  const minutes = Math.round(CODE_TTL_MS / 60000)
  const subject = purpose === 'reset' ? `观象 · 重设密码验证码 ${code}` : `观象 · 评论验证码 ${code}`
  const lead = purpose === 'reset'
    ? '你在观象(hexa.gavin.pub)申请重设密码。'
    : '你在观象(hexa.gavin.pub)发评论时人机验证加载不了,改用邮箱验证码。'
  const text = [
    lead,
    '',
    `验证码:${code}`,
    `${minutes} 分钟内有效,输错 ${CODE_MAX_ATTEMPTS} 次作废。`,
    '',
    '如果不是你本人操作,忽略这封邮件即可,不会有任何改动。',
    '',
    '观象 · 个人学习站',
  ].join('\n')
  return { from: CODE_FROM, to, subject, text }
}

export function codeSendRequest(env, to, purpose, code) {
  const apiKey = typeof env?.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : ''
  if (!apiKey) return null
  return {
    url: RESEND_EMAILS_URL,
    init: {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCodeEmail(to, purpose, code)),
    },
  }
}
