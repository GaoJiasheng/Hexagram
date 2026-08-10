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

const BOTS = /(facebookexternalhit|Twitterbot|Slackbot|Discordbot|WhatsApp|LinkedInBot|TelegramBot|Pinterest|redditbot|Applebot|bingbot|Googlebot|DuckDuckBot|Baiduspider|YisouSpider|Sogou|360Spider|embedly|quora link preview|vkShare|W3C_Validator)/i

const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ⚠️ 与 scripts/build-content-assets.mjs 的 ogShardKey / OG_SHARDS / normHref 必须逐字一致
const OG_SHARDS = 256
const ogShardKey = (p) => {
  let h = 2166136261
  for (const ch of p) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0) % OG_SHARDS
}
const normPath = (p) => (p.length > 1 ? p.replace(/\/$/, '') : p)

export async function onRequest(context) {
  const { request, next } = context
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
