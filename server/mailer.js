// 发信统一出口(owner 2026-10-06:Cloudflare 已开 Workers 付费,含每月 3000 封 Email Service)。
// 顺序:① Cloudflare Email Service 绑定 env.EMAIL(wrangler.toml 的 send_email,不需要任何 API 密钥)
//      ② Cloudflare REST(配了 CF_EMAIL_API_TOKEN + CF_ACCOUNT_ID 才用,备用)③ Resend(RESEND_API_KEY)。
// 前面的失败(域名未激活 E_SENDER_NOT_VERIFIED / 限额 / 网络)自动退到后面;都没有 → 调用方报「邮件服务未配置」。
// 本地开发设 DEV_MAIL_LOG=1:不真发,把整封信打到控制台(wrangler pages dev 的日志里看验证码)。
// 发件域:Cloudflare 用 mail.gavin.pub(Email Service 里单独接入,DNS 记录全在该子域下,不碰根域的 ImprovMX 收信、
// 也不碰 Resend 的 send.gavin.pub);Resend 仍用 send.gavin.pub。
export const MAIL_FROM = '观象 <notify@send.gavin.pub>'
export const CF_MAIL_FROM = { email: 'notify@mail.gavin.pub', name: '观象' }
const RESEND_URL = 'https://api.resend.com/emails'
const str = (v) => (typeof v === 'string' ? v.trim() : '')

export function mailProviders(env) {
  if (str(env?.DEV_MAIL_LOG) === '1') return [{ name: 'dev-log', dev: true }]
  const list = []
  if (typeof env?.EMAIL?.send === 'function') list.push({ name: 'cloudflare-binding', binding: env.EMAIL })
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
  return list
}

export const mailConfigured = (env) => mailProviders(env).length > 0

// 依次尝试各通道;返回 { ok, provider }。不抛异常(调用方决定怎么报给用户)。
export async function sendMail(env, mail, fetchImpl = fetch) {
  const full = { from: MAIL_FROM, ...mail }
  for (const p of mailProviders(env)) {
    if (p.dev) { console.log(`[dev-mail] to=${full.to} subject=${full.subject}\n${full.text}`); return { ok: true, provider: p.name } }
    if (p.binding) {
      try {
        await p.binding.send({ from: CF_MAIL_FROM, to: full.to, subject: full.subject, text: full.text, ...(full.html ? { html: full.html } : {}) })
        return { ok: true, provider: p.name }
      } catch (error) {
        console.error('Mail provider failed', { provider: p.name, code: error?.code, message: String(error?.message || error) })
        continue
      }
    }
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
