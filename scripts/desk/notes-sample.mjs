#!/usr/bin/env node
// 详注 · Opus 复核的备料与结算(docs/xiangzhu-spec.md §4「核查分两档」)。
// Codex 起草 + Codex 核查并入库之后,主会话再用 Opus 复核一部分单元(红线组整本):
//   node scripts/desk/notes-sample.mjs <corpus>/<slug> [--frac 0.1 | --all]   # 选单元,把现稿备份到 pre-opus/,打印 Workflow 的 jobs
//   → Workflow({scriptPath: 'scripts/desk/notes-wf.js', args: {jobs: [...几本书打印的数组拼起来], verifyOnly: true}})
//   node scripts/desk/notes-sample.mjs <corpus>/<slug> --report               # 结算:Opus 改了多少条;随后重跑 notes-apply 并入
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const book = argv.find((a) => !a.startsWith('--'))
if (!book || !book.includes('/')) { console.error('用法:node scripts/desk/notes-sample.mjs <corpus>/<slug> [--frac 0.1 | --all | --report]'); process.exit(1) }
const dir = path.join(ROOT, 'scripts/.desk-notes', book.replace('/', '--'))
const out = path.join(dir, 'out'), pre = path.join(dir, 'pre-opus')
const args = JSON.parse(fs.readFileSync(path.join(dir, 'args.json'), 'utf8'))
const units = args.ids.filter((id) => fs.existsSync(path.join(out, `${id}.json`)))
const flat = (f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); const m = new Map(); for (const [ch, segs] of Object.entries(j)) for (const [seg, list] of Object.entries(segs)) for (const n of list || []) m.set(`${ch}|${seg}|${n.k}`, JSON.stringify([n.d, n.x, n.r || ''])); return m }

if (argv.includes('--report')) {
  let total = 0, changed = 0
  for (const f of fs.existsSync(pre) ? fs.readdirSync(pre) : []) {
    const a = flat(path.join(pre, f)), b = flat(path.join(out, f))
    total += a.size
    for (const [k, v] of a) if (b.get(k) !== v) changed++
    for (const k of b.keys()) if (!a.has(k)) changed++
  }
  console.log(`${book}:Opus 复核 ${fs.existsSync(pre) ? fs.readdirSync(pre).length : 0} 个单元 · ${total} 条 · 改动 ${changed} 条(${total ? (changed / total * 100).toFixed(1) : 0}%)`)
  process.exit(0)
}

const frac = argv.includes('--all') ? 1 : Number(argv[argv.indexOf('--frac') + 1] || 0.1)
const want = Math.max(1, Math.round(units.length * frac))
// 均匀取:每隔 units.length / want 个取一个
const pick = frac >= 1 ? units : Array.from({ length: want }, (_, i) => units[Math.min(units.length - 1, Math.floor((i + 0.5) * units.length / want))])
const ids = [...new Set(pick)]
fs.mkdirSync(pre, { recursive: true })
for (const id of ids) if (!fs.existsSync(path.join(pre, `${id}.json`))) fs.copyFileSync(path.join(out, `${id}.json`), path.join(pre, `${id}.json`))
console.log(JSON.stringify(ids.map((id) => ({ dir, book: args.book, id }))))   // 一本书的 jobs;几本书的数组拼起来,作为 Workflow args 的 jobs
console.error(`${book}:共 ${units.length} 个单元,取 ${ids.length} 个`)
