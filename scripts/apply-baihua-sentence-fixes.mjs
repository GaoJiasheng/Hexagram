// 应用「版本/读法句」修订(古文课文改依课本后的收尾,owner 2026-10-05):
//   node scripts/apply-baihua-sentence-fixes.mjs <目录> [--write]
// 目录下 <book>-<ch>.json = {id, fixes:[{s, old, new}]};old 须在该章白话的文字字段里逐字出现(引文 quote.original/translation、svg 不动),
// 每条恰好替换;找不到的列出来,不硬改。
import fs from 'node:fs'
import path from 'node:path'
const dir = process.argv[2]
const WRITE = process.argv.includes('--write')
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const books = {}
const load = (b) => (books[b] ||= JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/guwen/baihua/${b}.json`), 'utf8')))
let ok = 0, miss = 0
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  const [b, ch] = r.id.split('-')
  const art = load(b)[ch]
  for (const fx of r.fixes || []) {
    let hit = 0
    const walk = (v, k) => Array.isArray(v) ? v.map((x) => walk(x)) : v && typeof v === 'object' ? (v.type === 'quote' || v.type === 'widget' || v.type === 'figure' ? v : Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, kk === 'svg' || kk === 'original' || kk === 'translation' ? x : walk(x, kk)]))) : typeof v === 'string' && v.includes(fx.old) ? (hit++, v.split(fx.old).join(fx.new)) : v
    const out = walk(art)
    if (hit) { Object.assign(art, out); ok++ } else { miss++; console.log(`  ✗ ${r.id} ${fx.s} 找不到:${fx.old.slice(0, 30)}`) }
  }
}
if (WRITE) for (const [b, d] of Object.entries(books)) fs.writeFileSync(path.join(ROOT, `src/data/guwen/baihua/${b}.json`), JSON.stringify(d, null, 2) + '\n')
console.log(`版本句修订:应用 ${ok} 条,找不到 ${miss} 条${WRITE ? '' : ' [试跑]'}`)
