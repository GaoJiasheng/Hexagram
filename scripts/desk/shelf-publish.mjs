#!/usr/bin/env node
// 观象 · 书桌 —— 把书包批量放进「书房」(R2 桶 hexa-desk + D1 表 desk_shelf),不经网站上传页。
// 与 server/desk-shelf.js 上传接口落的东西同一口径(对象键、封面另存、目录行各列;重传不冲掉手改的分栏 / 隐藏 / 排序)。
// 用 wrangler 直写远端,需本机已 wrangler login。单本、零星的书用网站 /books/shelf 上传页更方便;这个脚本给成批的用。
//   node scripts/desk/shelf-publish.mjs <书包或目录…> [--dry] [--concurrency 6]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { unzip, validate, countChars, readImageInfo } from './deskbook-core.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BUCKET = 'hexa-desk', DB = 'hexagram-db'
const argv = process.argv.slice(2)
const DRY = argv.includes('--dry')
const CONC = Number(argv[argv.indexOf('--concurrency') + 1]) || 6
const inputs = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--concurrency')
if (!inputs.length) { console.error('用法:node scripts/desk/shelf-publish.mjs <书包或目录…> [--dry] [--concurrency 6]'); process.exit(1) }

const files = inputs.flatMap((p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => f.endsWith('.deskbook')).sort().map((f) => path.join(p, f)) : [p]))
const run = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }, (e, out, err) => (e ? reject(new Error((err || out || e.message).slice(-400))) : resolve(out))))
const wr = (args) => run('npx', ['--yes', 'wrangler', ...args])
const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const str = (v) => (typeof v === 'string' && v.trim() ? v : null)
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelf-publish-'))

// 先读一遍:校验、取书目信息
const books = []
for (const f of files) {
  const buf = fs.readFileSync(f)
  const entries = await unzip(new Uint8Array(buf))
  const v = validate(entries)
  if (!v.ok) { console.error(`✗ ${path.basename(f)} 校验不过:${v.errors[0]?.msg}(共 ${v.errors.length} 处)`); process.exit(1) }
  const book = JSON.parse(new TextDecoder().decode(entries.get('book.json')))
  const media = {}
  for (const which of ['cover', 'banner']) {
    if (!book[which]) continue
    const bytes = entries.get(book[which])
    media[which] = { bytes, type: TYPES[readImageInfo(bytes).type] }
  }
  books.push({ f, book, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex'), chars: countChars(entries).chars, media, key: `shelf/${book.id}/r${book.revision}.deskbook` })
}
console.log(`待发 ${books.length} 本 · 共 ${(books.reduce((n, b) => n + b.bytes, 0) / 1048576).toFixed(1)} MB${DRY ? ' · --dry 只看不写' : ''}`)

// 线上已有的行:判断是不是新版、旧对象要不要删
const existing = new Map()
if (!DRY) {
  const out = await wr(['d1', 'execute', DB, '--remote', '--json', '--command', 'SELECT id, revision, object_key, has_cover, has_banner FROM desk_shelf'])
  for (const r of JSON.parse(out)[0]?.results || []) existing.set(r.id, r)
}
const todo = books.filter((b) => { const e = existing.get(b.book.id); return !e || e.revision < b.book.revision || e.object_key !== b.key })
const skipped = books.length - todo.length
if (skipped) console.log(`已是同版、跳过 ${skipped} 本`)
if (DRY) { for (const b of todo) console.log(`  ${b.book.id} r${b.book.revision} · ${b.book.title} · ${b.book.category || '(无类别)'} · ${b.book.chapters.length} 章 · ${b.chars} 字`); process.exit(0) }

// 传对象(书包、封面、题图)
let done = 0
const queue = [...todo]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let b; (b = queue.shift());) {
    await wr(['r2', 'object', 'put', `${BUCKET}/${b.key}`, '--file', b.f, '--remote', '--content-type', 'application/zip'])
    for (const [which, m] of Object.entries(b.media)) {
      const p = path.join(tmp, `${b.book.id}-${which}`)
      fs.writeFileSync(p, m.bytes)
      await wr(['r2', 'object', 'put', `${BUCKET}/shelf/${b.book.id}/${which}.jpg`, '--file', p, '--remote', '--content-type', m.type])
    }
    if (++done % 20 === 0 || done === todo.length) console.log(`  对象 ${done}/${todo.length}`)
  }
}))

// 写目录:新行插入;已有的行只更新书包带来的列,category / hidden / sort / uploaded_at 不动
if (todo.length) {
  const now = Date.now()
  const stmts = todo.map((b) => {
    const k = b.book
    const cols = {
      id: k.id, revision: k.revision, kind: k.kind, title: k.title, subtitle: str(k.subtitle),
      authors: JSON.stringify((k.authors || []).filter((x) => typeof x === 'string')), summary: str(k.summary),
      category: str(k.category), tags: JSON.stringify((k.tags || []).filter((x) => typeof x === 'string')), unit: str(k.unit),
      chapters: k.chapters.length, chars: b.chars, bytes: b.bytes, sha256: b.sha256,
      has_cover: b.media.cover ? 1 : 0, has_banner: b.media.banner ? 1 : 0,
      theme: k.theme === undefined ? null : JSON.stringify(k.theme), disclaimer: k.disclaimer === undefined ? null : JSON.stringify(k.disclaimer),
      source: k.source === undefined ? null : JSON.stringify(k.source), object_key: b.key, uploaded_at: now, updated_at: now, hidden: 0, sort: 0,
    }
    const keep = new Set(['id', 'category', 'uploaded_at', 'hidden', 'sort'])
    const names = Object.keys(cols)
    return `INSERT INTO desk_shelf (${names.join(', ')}) VALUES (${names.map((n) => sql(cols[n])).join(', ')}) ON CONFLICT(id) DO UPDATE SET ${names.filter((n) => !keep.has(n)).map((n) => `${n} = excluded.${n}`).join(', ')};`
  })
  const f = path.join(tmp, 'shelf.sql')
  fs.writeFileSync(f, stmts.join('\n') + '\n')
  await wr(['d1', 'execute', DB, '--remote', '--file', f, '--yes'])
  console.log(`  目录写入 ${todo.length} 行`)
}

// 清旧:换了键的旧书包;新版没有的封面 / 题图
const stale = []
for (const b of todo) {
  const e = existing.get(b.book.id)
  if (!e) continue
  if (e.object_key && e.object_key !== b.key) stale.push(e.object_key)
  for (const which of ['cover', 'banner']) if (e[`has_${which}`] && !b.media[which]) stale.push(`shelf/${b.book.id}/${which}.jpg`)
}
for (const k of stale) await wr(['r2', 'object', 'delete', `${BUCKET}/${k}`, '--remote']).catch((e) => console.error(`  ! 旧对象 ${k} 没删掉:${e.message.slice(0, 120)}`))
if (stale.length) console.log(`  清旧对象 ${stale.length} 个`)

fs.rmSync(tmp, { recursive: true, force: true })
const n = JSON.parse(await wr(['d1', 'execute', DB, '--remote', '--json', '--command', 'SELECT COUNT(*) AS n, COUNT(DISTINCT category) AS c FROM desk_shelf']))[0]?.results?.[0]
console.log(`✓ 书房现有 ${n?.n} 本 · ${n?.c} 个类别`)
