// 用法补充:自查文件目录默认取本脚本所在目录,跨会话用时传 SCRATCH=<那次会话的 scratchpad> 环境变量。
// 白话 workflow 结果救援:校对代理只交说明(blocks<10)的单元,用它存的自查文件(scratchpad/*<slug>-<no>*.json,blocks>20)或 journal 里的起草稿替换
// 用法: node salvage-bh.mjs <task.output> <journal.jsonl> <slug> <out.result.json>
import fs from 'node:fs'
const [,, outPath, journalPath, slug, dest] = process.argv
const SP = new URL('.', import.meta.url).pathname
const R = JSON.parse(fs.readFileSync(outPath, 'utf8')); const arr = Array.isArray(R) ? R : R.result
const lines = fs.readFileSync(journalPath, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
const results = lines.filter((l) => l.type === 'result').map((r) => r.value || r.result).filter((v) => v && v.blocks)
let fixed = 0
for (const u of arr) {
  const n = u.data?.blocks?.length || 0
  if (n >= 10) continue
  console.log(`单元 ${u.no}(${u.title}) 只有 ${n} 块 → 救援`)
  let best = null
  for (const f of fs.readdirSync(SP)) {
    if (!f.endsWith('.json') || !f.includes(slug) || !f.includes(String(u.no))) continue
    try { const d = JSON.parse(fs.readFileSync(SP + f, 'utf8')); const b = d.blocks || d.data?.blocks; if (b && b.length > 20 && (!best || b.length > best.n)) best = { src: f, data: d.blocks ? d : d.data, n: b.length } } catch {}
  }
  if (!best) { const d = results.find((v) => v.title && u.title && v.title.includes(u.title.split(' · ').pop()) && v.blocks.length > 20); if (d) best = { src: 'journal 起草稿', data: d, n: d.blocks.length } }
  if (best) { u.data = best.data; fixed++; console.log(`  ← ${best.src}(${best.n} 块)`) } else console.log('  ✗ 无可用稿,该章将被丢弃待重生')
}
fs.writeFileSync(dest, JSON.stringify(arr))
console.log(`units ${arr.length} · 救援 ${fixed} · 写 ${dest}`)
