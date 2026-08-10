// 边缘中间件(逐页 meta / 正文注入 / canonical)的行为测试。
//
// 这个文件值得有测试,因为它有两条**静默失败**的特性:
// ① 整段裹在 try/catch 里,出错就当无事发生 —— 坏了不会报错,只是分享卡和收录悄悄没了;
// ② 只对爬虫 UA 生效 —— 普通浏览器里怎么看都是对的,肉眼验不出来。
// 再加上分片哈希与 build-content-assets.mjs 是**两份独立实现**,一处改了另一处没改,
// 表现同样是「静默查不到」。所以这里用真实产物(public/content/og/*)跑一遍。

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { onRequest } from './_middleware.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const OG_DIR = path.join(ROOT, 'public/content/og')

const SHELL = `<!doctype html><html><head>
<title>观象 · 易经研习</title>
<meta name="description" content="站点级" />
<meta property="og:title" content="观象 · 个人古籍学习站" />
<meta property="og:description" content="站点级" />
<meta name="twitter:title" content="观象" />
<meta name="twitter:description" content="站点级" />
</head><body><div id="root"></div></body></html>`

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

// 把 ASSETS 绑定接到磁盘上的真实产物,避免用手写的假索引验出「假的通过」
const env = {
  ASSETS: {
    fetch: async (url) => {
      const file = path.join(ROOT, 'public', new URL(url).pathname)
      if (!fs.existsSync(file)) return new Response('', { status: 404 })
      return new Response(fs.readFileSync(file, 'utf8'), { status: 200 })
    },
  },
}
const run = (pathname, ua = GOOGLEBOT, method = 'GET') =>
  onRequest({
    request: new Request(`https://hexa.gavin.pub${pathname}`, { method, headers: { 'user-agent': ua } }),
    env,
    next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html' } }),
  })

describe('边缘中间件', () => {
  beforeAll(() => {
    if (!fs.existsSync(OG_DIR)) throw new Error('先跑 npm run content:build 生成 public/content/og')
  })

  it('爬虫拿到逐页标题与摘要,不再是站点级那一套', async () => {
    const html = await (await run('/ru/lunyu/1')).text()
    expect(html).toMatch(/<title>论语[^<]*<\/title>/)
    expect(html).not.toContain('观象 · 易经研习')
    // 站点级的几条必须被换掉而不是并存 —— 留着抓取方取哪条不定
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html.match(/name="description"/g)).toHaveLength(1)
  })

  it('正文摘录写进 #root —— 不执行 JS 的爬虫(百度)也读得到这一章', async () => {
    const html = await (await run('/ru/lunyu/1')).text()
    expect(html).not.toContain('<div id="root"></div>')
    expect(html).toContain('学而时习之')
  })

  it('带上 canonical,且指向去掉查询参数的规范路径', async () => {
    const html = await (await run('/songci/songci300/6?p=2')).text()
    expect(html).toContain('<link rel="canonical" href="https://hexa.gavin.pub/songci/songci300/6" />')
  })

  it('路径末尾多一个斜杠也要命中(否则同一页出两种卡)', async () => {
    const a = await (await run('/dao/daodejing/1')).text()
    const b = await (await run('/dao/daodejing/1/')).text()
    expect(b).toContain('道德经')
    expect(b.match(/<title>[^<]*/)[0]).toBe(a.match(/<title>[^<]*/)[0])
  })

  it('普通浏览器一律原样放行 —— 页面观感不受任何影响', async () => {
    const html = await (await run('/ru/lunyu/1', CHROME)).text()
    expect(html).toBe(SHELL)
  })

  it('观书是隐藏书房:即便爬虫来问也不给卡', async () => {
    const html = await (await run('/books/zhangkong-tanpan', GOOGLEBOT)).text()
    expect(html).toBe(SHELL)
  })

  it('查不到、非 GET、静态资源、接口 —— 一律安静放行,不拖累正常访问', async () => {
    for (const [p, ua, m] of [
      ['/ru/lunyu/99999', GOOGLEBOT, 'GET'],   // 不存在的章
      ['/ru/lunyu/1', GOOGLEBOT, 'POST'],      // 非 GET
      ['/assets/index-abc.js', GOOGLEBOT, 'GET'],
      ['/api/me', GOOGLEBOT, 'GET'],
      ['/', GOOGLEBOT, 'GET'],                 // 首页用自带的站点级卡
    ]) {
      expect(await (await run(p, ua, m)).text()).toBe(SHELL)
    }
  })

  it('索引取不到时不抛错(边缘偶发失败不能变成 500)', async () => {
    const res = await onRequest({
      request: new Request('https://hexa.gavin.pub/ru/lunyu/1', { headers: { 'user-agent': GOOGLEBOT } }),
      env: { ASSETS: { fetch: async () => { throw new Error('boom') } } },
      next: async () => new Response(SHELL, { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(SHELL)
  })
})
