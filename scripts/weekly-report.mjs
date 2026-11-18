#!/usr/bin/env node
// 每周流量周报(2026-11-18,推广第二档 ⑧)。三块数据,哪块取不到就跳过哪块、照样出报告:
//   ① 谷歌 Search Console:近 7 天 vs 前 7 天的点击 / 展示 / 平均排名,热门查询与页面,站点地图状态,首页与几张书页的编入索引状态。
//      前置(owner 做一次):Google Cloud 建服务账号并启用 Search Console API → 下载 JSON 密钥存为仓库根目录 `.search-console.json`(已 gitignore)
//      → Search Console「设置 → 用户和权限」把该服务账号的邮箱加为「受限」用户。只读,不能改任何设置。
//   ② 站内匿名研读(D1 reading_events,只读查询,走 wrangler d1 --remote):近 7 天 vs 前 7 天的读者数(匿名编号去重)、阅读时长、常读页、地区。
//   ③ 推送状态:IndexNow 与百度各推过多少条。
// 输出 `reports/weekly-<日期>.md`(reports/ 已 gitignore —— 仓库是公开的,流量与地区数据不入库)。
// 用法:npm run weekly-report
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://hexa.gavin.pub/'
const SC_SITES = ['sc-domain:hexa.gavin.pub', 'sc-domain:gavin.pub', SITE]   // 资源可能按网域或按网址前缀添加,依次试
const day = (d) => d.toISOString().slice(0, 10)
const now = new Date()
const ago = (n) => new Date(now.getTime() - n * 86400000)
const out = [`# 观象 · 流量周报 · ${day(now)}`, '']
const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%` : '—')

// ── ① Search Console ───────────────────────────────────────────────
async function gscToken(key) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const t = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 })}`
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` })
  const j = await res.json()
  if (!j.access_token) throw new Error(`取 token 失败:${JSON.stringify(j).slice(0, 200)}`)
  return j.access_token
}

async function searchConsole() {
  const f = path.join(ROOT, '.search-console.json')
  if (!fs.existsSync(f)) { out.push('## 谷歌 Search Console', '', '没有 `.search-console.json`,跳过(前置见脚本头注释)。', ''); return }
  const key = JSON.parse(fs.readFileSync(f, 'utf8'))
  const token = await gscToken(key)
  const api = async (url, body) => {
    const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(j.error?.message || String(res.status)), { status: res.status })
    return j
  }
  let site = null
  for (const s of SC_SITES) {
    try { await api(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(s)}`); site = s; break } catch { /* 试下一个 */ }
  }
  if (!site) { out.push('## 谷歌 Search Console', '', `服务账号(${key.client_email})看不到本站资源:请在 Search Console「用户和权限」里把它加为用户。`, ''); return }
  const q = (start, end, dims, rowLimit = 10) => api(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { startDate: day(start), endDate: day(end), dimensions: dims, rowLimit })
  // Search Console 数据滞后约 2–3 天:本周 = 第 3–9 天前,上周 = 第 10–16 天前
  const [cur, prev, queries, pages] = await Promise.all([q(ago(9), ago(3), []), q(ago(16), ago(10), []), q(ago(9), ago(3), ['query']), q(ago(9), ago(3), ['page'])])
  const tot = (r) => r.rows?.[0] || { clicks: 0, impressions: 0, position: 0 }
  const c = tot(cur), p = tot(prev)
  out.push(`## 谷歌 Search Console(${day(ago(9))} 至 ${day(ago(3))},资源 \`${site}\`)`, '',
    '| | 本周 | 前一周 | 变化 |', '|---|---|---|---|',
    `| 点击 | ${c.clicks} | ${p.clicks} | ${pct(c.clicks, p.clicks)} |`,
    `| 展示 | ${c.impressions} | ${p.impressions} | ${pct(c.impressions, p.impressions)} |`,
    `| 平均排名 | ${c.position ? c.position.toFixed(1) : '—'} | ${p.position ? p.position.toFixed(1) : '—'} | |`, '')
  if (queries.rows?.length) { out.push('**热门查询**', '', ...queries.rows.map((r) => `- ${r.keys[0]} · 展示 ${r.impressions} · 点击 ${r.clicks} · 排名 ${r.position.toFixed(1)}`), '') }
  if (pages.rows?.length) { out.push('**热门页面**', '', ...pages.rows.map((r) => `- ${r.keys[0].replace(SITE, '/')} · 展示 ${r.impressions} · 点击 ${r.clicks}`), '') }
  try {
    const sm = await api(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`)
    out.push('**站点地图**', '', ...(sm.sitemap || []).map((s) => `- ${s.path.replace(SITE, '/')} · 上次读取 ${s.lastDownloaded?.slice(0, 10) || '—'} · ${s.isPending ? '处理中' : '已处理'} · 错误 ${s.errors || 0} · 提交网址 ${(s.contents || []).reduce((n, x) => n + Number(x.submitted || 0), 0)}`), '')
    if (!sm.sitemap?.length) out.push('- 还没有提交过站点地图(在 Search Console 提交 `sitemap.xml`)', '')
  } catch (e) { out.push(`站点地图读取失败:${e.message}`, '') }
  // 抽几页看编入索引状态(URL 检查 API 每天 2000 次,这里只用 6 次)
  const sample = ['', 'dao', 'dao/daodejing', 'dao/daodejing/1', 'ru/lunyu', 'yijing']
  const rows = []
  for (const s of sample) {
    try {
      const r = await api('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: SITE + s, siteUrl: site })
      const x = r.inspectionResult?.indexStatusResult || {}
      rows.push(`- /${s} · ${x.coverageState || x.verdict || '—'}${x.lastCrawlTime ? ` · 上次抓取 ${x.lastCrawlTime.slice(0, 10)}` : ''}`)
    } catch (e) { rows.push(`- /${s} · 检查失败(${e.message.slice(0, 60)})`) }
  }
  out.push('**抽查编入索引状态**', '', ...rows, '')
}

// ── ② 站内匿名研读 ─────────────────────────────────────────────────
function d1(sql) {
  const raw = execFileSync('npx', ['--yes', 'wrangler', 'd1', 'execute', 'hexagram-db', '--remote', '--json', '--command', sql], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return JSON.parse(raw)[0]?.results || []
}
function readers() {
  const t0 = ago(7).getTime(), t1 = ago(14).getTime()
  try {
    const [cur] = d1(`SELECT COUNT(DISTINCT client_id) AS readers, COUNT(*) AS events, COALESCE(SUM(dwell_ms),0) AS dwell FROM reading_events WHERE ts >= ${t0}`)
    const [prev] = d1(`SELECT COUNT(DISTINCT client_id) AS readers, COUNT(*) AS events, COALESCE(SUM(dwell_ms),0) AS dwell FROM reading_events WHERE ts >= ${t1} AND ts < ${t0}`)
    const real = (from, to) => d1(`SELECT COUNT(*) AS n FROM (SELECT client_id FROM reading_events WHERE ts >= ${from}${to ? ` AND ts < ${to}` : ''} GROUP BY client_id HAVING SUM(dwell_ms) >= 30000)`)[0]?.n || 0
    const rc = real(t0), rp = real(t1, t0)
    const top = d1(`SELECT path, COUNT(DISTINCT client_id) AS n, SUM(dwell_ms) AS dwell FROM reading_events WHERE ts >= ${t0} GROUP BY path ORDER BY n DESC, dwell DESC LIMIT 10`)
    const geo = d1(`SELECT COALESCE(country,'?') AS c, COUNT(DISTINCT client_id) AS n FROM reading_events WHERE ts >= ${t0} GROUP BY c ORDER BY n DESC LIMIT 8`)
    const h = (ms) => `${(ms / 3600000).toFixed(1)} 小时`
    out.push('## 站内匿名研读(近 7 天 vs 前 7 天)', '',
      '| | 本周 | 前一周 | 变化 |', '|---|---|---|---|',
      `| 读者(匿名编号去重) | ${cur.readers} | ${prev.readers} | ${pct(cur.readers, prev.readers)} |`,
      `| 其中累计读满 30 秒的 | ${rc} | ${rp} | ${pct(rc, rp)} |`,
      `| 阅读记录 | ${cur.events} | ${prev.events} | ${pct(cur.events, prev.events)} |`,
      `| 阅读时长 | ${h(cur.dwell)} | ${h(prev.dwell)} | ${pct(cur.dwell, prev.dwell)} |`, '',
      '> 「读者」按匿名编号去重,会执行脚本的爬虫也算在内(一次一条、几乎没有时长);看真人看「读满 30 秒」那一行。', '',
      '**常读页**', '', ...top.map((r) => `- ${r.path} · ${r.n} 人 · ${h(r.dwell)}`), '',
      '**地区**', '', geo.map((r) => `${r.c} ${r.n}`).join(' · '), '')
  } catch (e) { out.push('## 站内匿名研读', '', `读 D1 失败(wrangler 未登录或网络问题):${String(e.stderr || e.message).trim().split('\n').slice(-1)[0].slice(0, 160)}`, '') }
}

// ── ③ 推送状态 ────────────────────────────────────────────────────
function pushes() {
  const n = (f) => { try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/.cache', f), 'utf8')); return Array.isArray(j) ? j.length : Object.keys(j).length } catch { return null } }
  const urls = fs.existsSync(path.join(ROOT, 'public/sitemaps/urls.txt')) ? fs.readFileSync(path.join(ROOT, 'public/sitemaps/urls.txt'), 'utf8').split('\n').filter(Boolean).length : '?'
  out.push('## 推送', '', `- 全站页面 ${urls}`, `- IndexNow(Bing 等)已推 ${n('indexnow-state.json') ?? '—'}`, `- 百度已推 ${n('baidu-push-state.json') ?? '—(尚未接入)'}`, '')
}

await searchConsole().catch((e) => out.push('## 谷歌 Search Console', '', `出错:${e.message}`, ''))
readers()
pushes()
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true })
const file = path.join(ROOT, `reports/weekly-${day(now)}.md`)
fs.writeFileSync(file, out.join('\n'))
console.log(out.join('\n'))
console.log(`\n→ ${path.relative(ROOT, file)}`)
