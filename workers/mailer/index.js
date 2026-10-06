// hexa-mailer:只做一件事——用 Cloudflare Email Service 发信(2026-10-06)。
// 为什么单独一个 Worker:Pages 项目的配置不支持 send_email 绑定(部署校验直接拒),普通 Worker 支持;
// Pages Functions 通过服务绑定(wrangler.toml [[services]] MAILER)调它。
// workers_dev = false 且不挂任何路由 → 没有公网入口,只有绑定了它的 Pages 项目能调用。
// 请求:POST,JSON {to, subject, text, html?};发件人固定 观象 <notify@mail.gavin.pub>(Email Service 已接入并激活该子域)。
const FROM = { email: 'notify@mail.gavin.pub', name: '观象' }

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
    let mail
    try { mail = await request.json() } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }) }
    const to = typeof mail?.to === 'string' ? mail.to.trim() : ''
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || typeof mail.subject !== 'string' || typeof mail.text !== 'string') {
      return Response.json({ ok: false, error: 'bad mail' }, { status: 400 })
    }
    try {
      const r = await env.EMAIL.send({ from: FROM, to, subject: mail.subject.slice(0, 200), text: mail.text, ...(typeof mail.html === 'string' ? { html: mail.html } : {}) })
      return Response.json({ ok: true, messageId: r?.messageId || null })
    } catch (error) {
      return Response.json({ ok: false, code: error?.code || null, error: String(error?.message || error) }, { status: 502 })
    }
  },
}
