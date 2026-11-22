#!/usr/bin/env node
// 观象 · 书桌 —— 详注生产 · 合并。读 scripts/.desk-notes/<书>/out/*.json,逐条机器校验
// (k 是该段原文子串 · 同段不重叠 · d ≤ 40 字 · x 40–150 字),不合的丢弃并计数,合的并入 scripts/authored/desk-notes/<书>.json。
//   node scripts/desk/notes-apply.mjs <书 id>   → 之后 npm run desk:packs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const book = process.argv[2]
const WORK = path.join(ROOT, 'scripts/.desk-notes', book)
const src = {}
for (const f of fs.readdirSync(path.join(WORK, 'in'))) for (const it of JSON.parse(fs.readFileSync(path.join(WORK, 'in', f), 'utf8')).items) src[`${it.ch}|${it.seg}`] = it.o
const outFile = path.join(ROOT, `scripts/authored/desk-notes/${book}.json`)
const all = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {}
const len = (s) => [...String(s || '')].length
let kept = 0, dropped = 0, bad = 0
const why = {}
const drop = (r) => { dropped++; why[r] = (why[r] || 0) + 1 }
for (const f of fs.readdirSync(path.join(WORK, 'out')).filter((x) => x.endsWith('.json')).sort()) {
  let j
  try { j = JSON.parse(fs.readFileSync(path.join(WORK, 'out', f), 'utf8')) } catch { bad++; console.error(`✗ ${f} 不是合法 JSON`); continue }
  for (const [ch, segs] of Object.entries(j)) for (const [seg, notes] of Object.entries(segs || {})) {
    const o = src[`${ch}|${seg}`]
    if (o === undefined || !Array.isArray(notes)) { drop('章段不在本批输入里'); continue }
    const spans = [], good = []
    for (const n of notes) {
      if (!n || typeof n.k !== 'string' || !n.k || typeof n.d !== 'string' || typeof n.x !== 'string') { drop('缺字段'); continue }
      const at = o.indexOf(n.k)
      if (at < 0) { drop('k 不是原文子串'); continue }
      if (spans.some(([a, b]) => at < b && a < at + n.k.length)) { drop('同段重叠'); continue }
      if (len(n.d) > 40) { drop('d 超长'); continue }
      if (len(n.x) < 40 || len(n.x) > 150) { drop('x 字数不合'); continue }
      spans.push([at, at + n.k.length])
      good.push({ k: n.k, ...(n.r ? { r: String(n.r) } : {}), d: n.d, x: n.x })
    }
    if (good.length) { (all[ch] ||= {})[seg] = good; kept += good.length }
  }
}
const sorted = Object.fromEntries(Object.keys(all).sort((a, b) => a - b).map((ch) => [ch, Object.fromEntries(Object.keys(all[ch]).sort((a, b) => a - b).map((s) => [s, all[ch][s]]))]))
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, JSON.stringify(sorted, null, 2) + '\n')
const chars = Object.values(src).reduce((a, s) => a + s.length, 0)
console.log(`${book}:并入 ${kept} 条(每百字 ${(kept * 100 / chars).toFixed(1)} 条)· 丢弃 ${dropped} 条 ${JSON.stringify(why)} · 坏文件 ${bad} → ${path.relative(ROOT, outFile)}`)
