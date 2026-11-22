#!/usr/bin/env node
// 详注生产 · 合并(docs/xiangzhu-spec.md §4)。读 scripts/.desk-notes/<corpus>--<slug>/out/uNNN.json(不读 *.draft.json),
// 逐条按闸的同一套规则校验(scripts/lib/xiangzhu.mjs 的 checkPlace:坐标在本批输入里、k 是该处原文子串、同处不重叠不重复、
// d 1–40 字、x 40–150 字、r 有则非空;多余字段剥掉),合的并入 src/data/<corpus>/xiangzhu/<slug>.json(按处覆写),
// 不合的丢弃并按原因计数。原文以 src/data 为准,不信输入分片里的 o。
//   node scripts/desk/notes-apply.mjs <corpus>/<slug> [--dry]      --dry 只报数不写
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, parseBookId, originalIndex, checkPlace, readTruth, writeTruth, truthFile, len } from '../lib/xiangzhu.mjs'

const argv = process.argv.slice(2)
const id = parseBookId(argv.find((a) => !a.startsWith('--')))
const DRY = argv.includes('--dry')
if (!id) { console.error('用法: node scripts/desk/notes-apply.mjs <corpus>/<slug> [--dry]'); process.exit(2) }
const WORK = path.join(ROOT, 'scripts/.desk-notes', `${id.corpus}--${id.slug}`)
const idx = originalIndex(id.corpus, id.slug)
if (!idx) { console.error(`✗ ${id.id}:站内没有这本书的原文数据`); process.exit(2) }

// 本批输入里有哪些处(只认本批备料过的坐标,免得旧输出误写别处)
const inBatch = new Set()
let batchChars = 0
for (const f of fs.readdirSync(path.join(WORK, 'in')).filter((x) => x.endsWith('.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(WORK, 'in', f), 'utf8')).items) { inBatch.add(`${it.ch}|${it.seg}`); batchChars += len(it.o) }
}
const truth = readTruth(id.corpus, id.slug)
let kept = 0, dropped = 0, bad = 0, places = 0
const why = {}
const samples = {}
const drop = (r, what) => { dropped++; why[r] = (why[r] || 0) + 1; (samples[r] ||= []).length < 3 && samples[r].push(what) }
const outDir = path.join(WORK, 'out')
const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((x) => /^u\d+\.json$/.test(x)).sort() : []
for (const f of files) {
  let j
  try { j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')) } catch { bad++; console.error(`✗ ${f} 不是合法 JSON`); continue }
  if (!j || typeof j !== 'object' || Array.isArray(j)) { bad++; console.error(`✗ ${f} 顶层不是对象`); continue }
  for (const [ch, segs] of Object.entries(j)) for (const [seg, notes] of Object.entries(segs || {})) {
    const where = `${f} ${ch}/${seg}`
    const o = idx.get(String(ch))?.get(String(seg))
    const list = Array.isArray(notes) ? notes : []
    if (o === undefined || !inBatch.has(`${ch}|${seg}`)) { for (const n of list) drop('坐标不在本批输入里', `${where}「${n?.k}」`); continue }
    const { good, bad: no } = checkPlace(o, list, { strict: false })
    for (const b of no) drop(b.why, `${where}「${b.n?.k}」`)
    if (good.length) { (truth[String(ch)] ||= {})[String(seg)] = good; kept += good.length; places++ }
  }
}
if (!DRY) writeTruth(id.corpus, id.slug, truth)
console.log(`${id.id}:并入 ${kept} 条(${places} 处 · 本批原文 ${batchChars} 字 · 每百字 ${batchChars ? (kept * 100 / batchChars).toFixed(1) : '-'} 条)· 丢弃 ${dropped} 条 · 坏文件 ${bad}${DRY ? ' · [--dry 未写]' : ` → ${path.relative(ROOT, truthFile(id.corpus, id.slug))}`}`)
for (const [r, n] of Object.entries(why)) console.log(`  丢弃 · ${r} ${n} 条,如 ${samples[r].join(' / ')}`)
fs.writeFileSync(path.join(WORK, 'apply-stats.json'), JSON.stringify({ kept, places, dropped, why, bad, batchChars, density: batchChars ? +(kept * 100 / batchChars).toFixed(2) : 0, dry: DRY }, null, 1) + '\n')
if (bad) process.exitCode = 1
