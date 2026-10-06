// 发信统一出口(owner 2026-10-06:Cloudflare 已开 Workers 付费,含每月 3000 封 Email Service)。
// 顺序:Cloudflare Email Service(配了 CF_EMAIL_API_TOKEN + CF_ACCOUNT_ID 才用)→ Resend(RESEND_API_KEY)。
// 前者失败(未开通 / 域名未接入 / 限额)自动退到后者;两者都没配 → null,调用方报「邮件服务未配置」。
// 本地开发可设 DEV_MAIL_LOG=1:不真发,把整封信打到控制台(wrangler pages dev 的日志里看验证码)。
// 发件人统一 send.gavin.pub(Resend 已验证的发件域;Cloudflare 侧须在 Email Service 里接入同一域)。
export const MAIL_FROM = '观象 <notify@send.gavin.pub>'
const RESEND_URL = 'https://api.resend.com/emails'
const str = (v) => (typeof v === 'string' ? v.trim() : '')

export function mailProviders(env) {
  const list = []
  const cfToken = str(env?.CF_EMAIL_API_TOKEN), cfAccount = str(env?.CF_ACCOUNT_ID)
  if (cfToken && cfAccount) list.push({
    name: 'cloudflare',
    request: (mail) => ({
      url: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/email/sending/send`,
      init: { method: 'POST', headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }) },
    }),
    ok: async (res) => res.ok && (await res.clone().json().catch(() => ({})))?.success !== false,
  })
  const resend = str(env?.RESEND_API_KEY)
  if (resend) list.push({
    name: 'resend',
    request: (mail) => ({
      url: RESEND_URL,
      init: { method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: mail.from, to: mail.to, subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }) },
    }),
    ok: async (res) => res.ok,
  })
  if (!list.length && str(env?.DEV_MAIL_LOG) === '1') list.push({ name: 'dev-log', dev: true })
  return list
}

export const mailConfigured = (env) => mailProviders(env).length > 0

// 依次尝试各通道;返回 { ok, provider }。不抛异常(调用方决定怎么报给用户)。
export async function sendMail(env, mail, fetchImpl = fetch) {
  const full = { from: MAIL_FROM, ...mail }
  for (const p of mailProviders(env)) {
    if (p.dev) { console.log(`[dev-mail] to=${full.to} subject=${full.subject}\n${full.text}`); return { ok: true, provider: p.name } }
    try {
      const { url, init } = p.request(full)
      const res = await fetchImpl(url, init)
      if (await p.ok(res)) return { ok: true, provider: p.name }
      console.error('Mail provider failed', { provider: p.name, status: res.status })
    } catch (error) {
      console.error('Mail provider error', { provider: p.name, message: String(error?.message || error) })
    }
  }
  return { ok: false, provider: null }
}
