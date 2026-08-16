// 逐页分享卡(OG meta)。
//
// 站点是纯前端 SPA,index.html 里只有一套**站点级**的 og:* —— 分享任何一章出去,
// 卡片都长一个样。这里在边缘拦一手:**只对爬虫 UA**,把该页的标题/摘要注进 <head>。
//
// 三条自我约束(改这个文件前先读):
// 1. **普通访客一律原样放行**。判定不中、查不到、抛异常 —— 任何一种情况都直接 next(),
//    绝不因为分享卡这种锦上添花的功能影响正常访问。整段裹在 try/catch 里。
// 2. **只认 GET + 期望 HTML 的请求**。资源、API、预检一概不碰。
// 3. 索引**按整条路径哈希**分成 256 片(`/content/og/<n>.json`,构建期由
//    build-content-assets.mjs 生成),一次请求只取它需要的那一片(约 25KB)。
//    ⚠️ 哈希函数与片数必须与那个脚本里的 `ogShardKey` / `OG_SHARDS` **逐字一致**。
//
// 注:观书 `/books/*` **不在索引里**,这是有意的 —— 它是隐藏入口、不入公共搜索,
// 自然也不该被抓出分享卡。索引与搜索共用同一批 records,这条一致性是白来的。
//
// 2026-08-08 加了两件(都只对爬虫):
// · **把正文摘录写进 <body>** —— SPA 给爬虫的 body 只有一个空 <div id="root">,
//   正文要执行 JS 才出得来。Google 会渲染 JS,**百度基本不渲染**,
//   一个中文古籍站放弃百度不合算。普通访客走不到这条路径,页面观感不受任何影响。
// · **canonical** —— 同一章可能被带上 ?p=、?from= 等参数分享出去,
//   不指 canonical 会被当成多个重复页,权重分散。

// ── 观书鉴权(2026-08-13)────────────────────────────────────────────────
// owner 定:观书只给管理员看。此前它是**假隐藏** —— 书目静态打进 JS 包、
// 每篇文章都是可按 URL 直取的 chunk,光不给链接等于掩耳盗铃。
// 数据已搬到 /content/books/,这里是**真正起作用的那道闸**。
//
// 三条分寸:
// ① **回 404 不回 403** —— 403 等于告诉对方「这儿有东西,只是你没权限」;
//    404 什么都不说。隐藏书房就该像不存在。
// ② **页面与数据都要挡**:只挡 /books 页面而放行 /content/books/*,
//    等于把门锁了窗户开着。
// ③ 判据与 server/admin.js 的 isAdminUser 一致(is_owner 或 ADMIN_EMAILS)。
//    ⚠️ 那边改了这边要跟 —— 边缘中间件跑在 Worker 里,不便直接 import D1 逻辑,
//    故会话查询在此重写了一遍;字段与 SQL 必须与 API 侧保持一致。
import { ogShardKey, normPath } from '../server/og-index.js'

const BOOKS_PATH = /^\/books(\/|$)/
const BOOKS_DATA = /^\/content\/books\//

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

function sessionToken(request) {
  const cookie = request.headers.get('Cookie') || ''
  const m = /(?:^|;\s*)gx_session=([^;]+)/.exec(cookie)
  if (m) return decodeURIComponent(m[1])
  const auth = request.headers.get('Authorization') || ''
  const b = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return b ? b[1].trim() : null
}

async function isAdminRequest(context) {
  const raw = sessionToken(context.request)
  if (!raw) return false
  const db = context.env?.DB
  if (!db?.prepare) return false
  const row = await db.prepare(`
    SELECT s.expires_at, u.email, u.is_owner
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).bind(await sha256Hex(raw)).first()
  if (!row || Number(row.expires_at) <= Date.now()) return false
  if (row.is_owner) return true
  const list = String(context.env?.ADMIN_EMAILS || '')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
  const email = String(row.email || '').trim().toLowerCase()
  return !!email && list.includes(email)
}

const BOTS = /(facebookexternalhit|Twitterbot|Slackbot|Discordbot|WhatsApp|LinkedInBot|TelegramBot|Pinterest|redditbot|Applebot|bingbot|Googlebot|DuckDuckBot|Baiduspider|YisouSpider|Sogou|360Spider|embedly|quora link preview|vkShare|W3C_Validator)/i

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 分片规则收敛在 server/og-index.js 一处(此前这里与构建脚本各抄一份,
// 不一致的表现是**静默查不到**,没有任何报错)

export async function onRequest(context) {
  const { request, next } = context

  // ⚠️ 观书这道闸**必须在下面那个 try 之外** —— 那个 try 的 catch 是 `return next()`
  //(分享卡失败不该拖累访问,那是对的),但安全闸套进去就成了**失败即放行**。
  // 这里反过来:任何异常都 404,失败关闭。
  let gatePath = '/'
  try { gatePath = new URL(request.url).pathname } catch { return new Response('Not Found', { status: 404 }) }
  if (BOOKS_PATH.test(gatePath) || BOOKS_DATA.test(gatePath)) {
    let ok = false
    try { ok = await isAdminRequest(context) } catch { ok = false }
    if (!ok) return new Response('Not Found', { status: 404 })
    return next()
  }

  try {
    if (request.method !== 'GET') return next()

    const ua = request.headers.get('user-agent') || ''
    if (!BOTS.test(ua)) return next()

    const url = new URL(request.url)
    const p = url.pathname
    // 只处理页面路由:有扩展名的是静态资源,/api 是接口
    if (p.startsWith('/api/') || /\.[a-z0-9]+$/i.test(p)) return next()

    if (p === '/') return next()   // 首页用 index.html 自带的站点级卡即可

    const key = normPath(p)
    const idx = await context.env.ASSETS.fetch(new URL(`/content/og/${ogShardKey(key)}.json`, url))
    if (!idx.ok) return next()
    const map = await idx.json()
    const hit = map[key]
    if (!hit) return next()

    const res = await next()
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return res

    const [title, desc, body] = hit
    let html = await res.text()
    // 覆盖站点级那几条(留着会与新注入的重复,抓取方取哪条不定)
    html = html
      .replace(/\s*<meta property="og:title"[^>]*>/g, '')
      .replace(/\s*<meta property="og:description"[^>]*>/g, '')
      .replace(/\s*<meta name="twitter:title"[^>]*>/g, '')
      .replace(/\s*<meta name="twitter:description"[^>]*>/g, '')
      .replace(/\s*<meta name="description"[^>]*>/g, '')
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)

    const tags = [
      `<meta name="description" content="${esc(desc)}" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(desc)}" />`,
      `<meta property="og:url" content="${esc(url.href)}" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(desc)}" />`,
      // 同一章带 ?p=/?from= 分享出去不指 canonical 会被当成多个重复页,权重分散
      `<link rel="canonical" href="${esc(url.origin + key)}" />`,
    ].join('\n    ')
    html = html.replace('</head>', `  ${tags}\n  </head>`)

    // 正文摘录写进 #root:不执行 JS 的爬虫(百度)也能读到这一章讲什么。
    // React 挂载时会把 #root 清空重绘,而这条路径只有爬虫走得到,访客看不见。
    if (body) {
      html = html.replace(
        '<div id="root"></div>',
        `<div id="root"><article><h1>${esc(title)}</h1><p>${esc(body)}</p></article></div>`,
      )
    }

    return new Response(html, { status: res.status, headers: res.headers })
  } catch {
    // 分享卡失败绝不能拖累正常访问
    return next()
  }
}
