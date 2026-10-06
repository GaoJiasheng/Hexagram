// 邮箱验证码(续跑 ⑥ 大陆账号体验,2026-10-01;verify 2026-10-06):三种用途——
//   reset   找回密码:邮箱 → 验证码 → 设新密码(此前只有「注销」没有「找回」)
//   comment 评论时 Cloudflare Turnstile 加载不了(大陆网络常见)的降级:发一枚码到登录邮箱,凭码发评论
//   verify  验证邮箱:注册后自动发一枚,或在设置里补验;验过的账号发评论免人机验证
// 码 6 位数字、10 分钟有效、错 5 次作废、60 秒内不重发;表 auth_codes(target 主键,存哈希不存明文)。
// 纯函数部分在这里(可单测),读写 D1 在 functions/api 里;发信走 server/mailer.js(Cloudflare → Resend)。
export const CODE_TTL_MS = 10 * 60 * 1000
export const CODE_RESEND_MS = 60 * 1000
export const CODE_MAX_ATTEMPTS = 5
export const CODE_PURPOSES = new Set(['reset', 'comment', 'verify'])

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

const PURPOSE = {
  reset: { subject: '重设密码验证码', lead: '你在观象(hexa.gavin.pub)申请重设密码。', use: '在找回密码页面输入这串数字,即可设置新密码。' },
  comment: { subject: '评论验证码', lead: '你在观象(hexa.gavin.pub)发评论时人机验证加载不了,改用邮箱验证码。', use: '在评论框下方输入这串数字,即可发出评论。' },
  verify: { subject: '邮箱验证码', lead: '欢迎来到观象(hexa.gavin.pub)。请验证这个邮箱,确认它属于你。', use: '在登录浮层或「设置 · 账号」里输入这串数字。验证后,发评论不再需要人机验证。' },
}
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function buildCodeEmail(to, purpose, code) {
  const minutes = Math.round(CODE_TTL_MS / 60000)
  const p = PURPOSE[purpose] || PURPOSE.verify
  const subject = `观象 · ${p.subject} ${code}`
  const text = [
    p.lead, '', `验证码:${code}`, p.use, `${minutes} 分钟内有效,输错 ${CODE_MAX_ATTEMPTS} 次作废。`, '',
    '如果不是你本人操作,忽略这封邮件即可,不会有任何改动。', '', '观象 · 古籍研读站 · hexa.gavin.pub',
  ].join('\n')
  // 邮件 HTML 只用最朴素的内联样式(各家客户端对 CSS 支持参差),朱印 + 大号验证码 + 两行说明
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f7f1e3;font-family:'Songti SC','STSong','Noto Serif SC',serif;color:#2b2620">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:460px;background:#faf6ec;border:1px solid #e4ddce;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px 28px 22px">
<div style="display:inline-block;background:#c3272b;color:#fdfbf6;font-size:14px;padding:6px 8px;border-radius:3px;letter-spacing:2px">观象</div>
<p style="margin:20px 0 6px;font-size:15px;line-height:1.7">${escHtml(p.lead)}</p>
<p style="margin:18px 0 6px;font-size:13px;color:#6b6157">验证码</p>
<div style="font-family:Menlo,Consolas,monospace;font-size:34px;letter-spacing:10px;color:#c3272b;font-weight:600">${escHtml(code)}</div>
<p style="margin:16px 0 4px;font-size:14px;line-height:1.7">${escHtml(p.use)}</p>
<p style="margin:0;font-size:13px;color:#6b6157">${minutes} 分钟内有效,输错 ${CODE_MAX_ATTEMPTS} 次作废。</p>
<hr style="border:none;border-top:1px dashed #e4ddce;margin:22px 0 14px">
<p style="margin:0;font-size:12px;color:#a89f93;line-height:1.7">如果不是你本人操作,忽略这封邮件即可,不会有任何改动。<br>观象 · 古籍研读站 · hexa.gavin.pub</p>
</td></tr></table></td></tr></table></body></html>`
  return { to, subject, text, html }
}
