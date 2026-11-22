#!/usr/bin/env node
// 观象 · 书桌 —— 图解结构化 · 合并。读 scripts/.desk-figs/<书>/out/*.json,逐张过闸(fig-gate.mjs),
// 过的并入 scripts/authored/desk-figs/<书>.json(已有条目保留),不过的连原因写进 scripts/.desk-figs/<书>/failed.json。
//   node scripts/desk/figs-apply.mjs <书 id>   → 之后 node scripts/build-desk-packs.mjs
import fs from 'node:fs'
import path from 'node:path'
import { FIG_SOURCES, ROOT, collectFigs, figsFile, workDir, readJson } from './fig-sources.mjs'
import { checkFig } from './fig-gate.mjs'

const book = process.argv[2]
if (!book || !FIG_SOURCES[book]) { console.error(`用法:node scripts/desk/figs-apply.mjs <${Object.keys(FIG_SOURCES).join('|')}>`); process.exit(2) }
const WORK = workDir(book)
const svgOf = new Map(collectFigs(book).map((f) => [f.key, f.svg]))
const all = readJson(figsFile(book), {})
const failed = {}
const kinds = {}
let kept = 0, bad = 0, unknown = 0
for (const f of fs.existsSync(path.join(WORK, 'out')) ? fs.readdirSync(path.join(WORK, 'out')).filter((x) => x.endsWith('.json')).sort() : []) {
  let j
  try { j = JSON.parse(fs.readFileSync(path.join(WORK, 'out', f), 'utf8')) } catch { console.error(`✗ ${f} 不是合法 JSON`); continue }
  for (const [key, fig] of Object.entries(j)) {
    const svg = svgOf.get(key)
    if (!svg) { unknown++; continue }
    const probs = checkFig(fig, svg)
    if (probs.length) { bad++; failed[key] = { unit: f, kind: fig?.kind, problems: probs, fig }; continue }
    all[key] = fig; kept++; kinds[fig.kind] = (kinds[fig.kind] || 0) + 1
  }
}
const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]))
fs.mkdirSync(path.dirname(figsFile(book)), { recursive: true })
fs.writeFileSync(figsFile(book), JSON.stringify(sorted, null, 1) + '\n')
fs.writeFileSync(path.join(WORK, 'failed.json'), JSON.stringify(failed, null, 1) + '\n')
const keys = new Set(svgOf.keys())
const covered = [...keys].filter((k) => sorted[k]).length
console.log(`${book}:本次并入 ${kept} 张 · 未过闸 ${bad} 张${unknown ? ` · 不在本书的 key ${unknown} 个` : ''} · 种类 ${JSON.stringify(kinds)}`)
console.log(`  本书共 ${keys.size} 种图,已覆盖 ${covered},还剩 ${keys.size - covered} → ${path.relative(ROOT, figsFile(book))}${bad ? `;失败原因见 ${path.relative(ROOT, path.join(WORK, 'failed.json'))}` : ''}`)
