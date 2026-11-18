#!/usr/bin/env node
// 百度普通收录 · API 主动推送(2026-11-18,推广第二档 ⑦)。IndexNow 不含百度,百度要单独推。
// 前置(owner 做一次):百度搜索资源平台(ziyuan.baidu.com)添加站点 https://hexa.gavin.pub 并完成验证 →
//   「普通收录 → API 提交」页拿到推送 token → 写进仓库根目录 `.baidu.env`(已 gitignore):BAIDU_PUSH_TOKEN=<token>
// 百度给新站的每日配额很小(常见 10 条起,按站点质量调),所以这里**按页面层级排先后、每天推到配额用完为止**:
//   首页 → 各组首页 → 各书目录页 → 各章;推成功的记进 scripts/.cache/baidu-push-state.json,下次从没推过的接着推。
//   内容有变的页不重推(配额太紧,先让每一页都被知道一次)。
// 用法:npm run baidu-push          发完生产后跑,和 npm run indexnow 一起
//       npm run baidu-push -- --dry-run   只看会推哪些
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://hexa.gavin.pub'
const STATE = path.join(ROOT, 'scripts/.cache/baidu-push-state.json')
const dry = process.argv.includes('--dry-run')

const envFile = path.join(ROOT, '.baidu.env')
const token = fs.existsSync(envFile) ? (/^BAIDU_PUSH_TOKEN=(.+)$/m.exec(fs.readFileSync(envFile, 'utf8'))?.[1] || '').trim() : ''
if (!token && !dry) { console.log('百度推送:没有 .baidu.env(BAIDU_PUSH_TOKEN),跳过。站点在百度搜索资源平台验证后把 token 写进去即可。'); process.exit(0) }

const urlsFile = path.join(ROOT, 'public/sitemaps/urls.txt')
if (!fs.existsSync(urlsFile)) { console.error('❌ 缺 public/sitemaps/urls.txt —— 先 npm run build'); process.exit(1) }
const depth = (u) => new URL(u).pathname.split('/').filter(Boolean).length
const urls = [SITE + '/', ...fs.readFileSync(urlsFile, 'utf8').split('\n').filter(Boolean)]
  .filter((u, i, a) => a.indexOf(u) === i)
  .map((u, i) => ({ u, d: depth(u), i }))
  .sort((a, b) => a.d - b.d || a.i - b.i)
  .map((x) => x.u)

const done = fs.existsSync(STATE) ? new Set(JSON.parse(fs.readFileSync(STATE, 'utf8'))) : new Set()
const todo = urls.filter((u) => !done.has(u))
console.log(`百度推送:全量 ${urls.length} 条 · 已推过 ${done.size} · 未推 ${todo.length}`)
if (dry) { console.log(todo.slice(0, 15).join('\n') + (todo.length > 15 ? '\n…' : '')); process.exit(0) }
if (!todo.length) process.exit(0)

const push = async (list) => {
  const res = await fetch(`http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: list.join('\n'),
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

// 先推 5 条探出今天还剩多少配额,再按剩余量推
let i = 0, ok = 0
let size = 5
while (i < todo.length && size > 0) {
  const list = todo.slice(i, i + size)
  const { status, body } = await push(list)
  if (status !== 200) {
    // 400 over quota = 今天配额用完;401 token 错;其余照实打印
    console.log(`  ${body.message === 'over quota' ? '今天的配额已用完' : `❌ ${status} ${JSON.stringify(body)}`}`)
    if (status === 401) process.exitCode = 1
    break
  }
  const n = Number(body.success) || 0
  for (const u of list.slice(0, n)) done.add(u)
  ok += n; i += list.length
  if (Array.isArray(body.not_same_site) && body.not_same_site.length) console.log('  ⚠ 不属本站:', body.not_same_site.slice(0, 3))
  size = Math.min(Number(body.remain) || 0, 2000)
  console.log(`  ✓ ${n} 条 · 今天还剩 ${body.remain ?? '?'} 条配额`)
}
fs.mkdirSync(path.dirname(STATE), { recursive: true })
fs.writeFileSync(STATE, JSON.stringify([...done]))
console.log(`百度推送:本次 ${ok} 条,累计 ${done.size}/${urls.length}`)
