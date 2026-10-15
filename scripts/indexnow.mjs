#!/usr/bin/env node
// IndexNow 推送(2026-10-15 推广第一档):发完生产后跑一次,把**新增或内容有变**的页面告诉搜索引擎。
// IndexNow 是 Bing / Yandex / Naver / Seznam 等共用的协议,推给 api.indexnow.org 一处即分发各家;
// 不需要任何账号,凭站点根目录下的密钥文件(public/<key>.txt)证明站点归属。
//
// 增量怎么算:构建期 build-content-assets.mjs 出 public/sitemaps/urls.txt(全量 URL)与 og 索引
// (每页的标题 / 摘要 / 正文摘录);这里给每页算一个内容指纹,和上次推送成功后存下的指纹比,
// 新页与指纹变了的页才推。状态存 scripts/.cache/indexnow-state.json(丢了无妨,至多全量重推一次)。
//
// 用法:npm run build → wrangler pages deploy → 核入口哈希 → **npm run indexnow**
//   --dry-run   只算增量、不推
//   --all       忽略状态,全量推
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'hexa.gavin.pub'
const ORIGIN = `https://${HOST}`
const STATE = path.join(ROOT, 'scripts/.cache/indexnow-state.json')
const BATCH = 10000   // 协议上限:一次 10,000 条

const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const all = args.includes('--all')

const keyFile = fs.readdirSync(path.join(ROOT, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
if (!keyFile) { console.error('❌ public/ 下找不到 IndexNow 密钥文件(<32 位十六进制>.txt)'); process.exit(1) }
const key = fs.readFileSync(path.join(ROOT, 'public', keyFile), 'utf8').trim()

const urlsFile = path.join(ROOT, 'public/sitemaps/urls.txt')
if (!fs.existsSync(urlsFile)) { console.error('❌ 缺 public/sitemaps/urls.txt —— 先 npm run build'); process.exit(1) }
const urls = fs.readFileSync(urlsFile, 'utf8').split('\n').filter(Boolean)

// 内容指纹:og 索引里该页那一条(标题 + 摘要 + 正文摘录);索引里没有的页只按「是否出现过」算
const og = {}
const ogDir = path.join(ROOT, 'public/content/og')
for (const f of fs.readdirSync(ogDir)) Object.assign(og, JSON.parse(fs.readFileSync(path.join(ogDir, f), 'utf8')))
const fp = (u) => {
  const entry = og[new URL(u).pathname]
  return crypto.createHash('sha1').update(entry ? JSON.stringify(entry.slice(0, 3)) : 'present').digest('hex').slice(0, 16)
}

const prev = !all && fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}
const next = Object.fromEntries(urls.map((u) => [u, fp(u)]))
const changed = urls.filter((u) => prev[u] !== next[u])
console.log(`IndexNow: 全量 ${urls.length} 条 · 待推 ${changed.length} 条${all ? '(--all)' : ''}`)
if (!changed.length) process.exit(0)
if (dry) { console.log(changed.slice(0, 10).join('\n') + (changed.length > 10 ? '\n…' : '')); process.exit(0) }

// 密钥文件必须已经在线上(说明这次部署已生效),否则搜索引擎验证不了归属,推了也白推
const live = await fetch(`${ORIGIN}/${keyFile}`).then((r) => (r.ok ? r.text() : '')).catch(() => '')
if (live.trim() !== key) { console.error(`❌ 线上 ${ORIGIN}/${keyFile} 还取不到密钥 —— 部署生效后再跑`); process.exit(1) }

let ok = 0
for (let i = 0; i < changed.length; i += BATCH) {
  const urlList = changed.slice(i, i + BATCH)
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: `${ORIGIN}/${keyFile}`, urlList }),
  })
  // 200 已收、202 已收待验证;其余(400 格式 / 403 密钥 / 422 URL 不属此站 / 429 太频)都算失败
  if (res.status === 200 || res.status === 202) { ok += urlList.length; console.log(`  ✓ ${urlList.length} 条 → ${res.status}`) }
  else { console.error(`  ❌ ${res.status} ${await res.text().catch(() => '')}`); process.exitCode = 1; break }
}

if (ok === changed.length) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  fs.writeFileSync(STATE, JSON.stringify(next))
  console.log(`IndexNow: 已推 ${ok} 条,状态已存`)
}
