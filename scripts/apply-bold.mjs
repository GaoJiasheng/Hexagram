// 把 bold workflow 返回的「要加粗子串」确定性地包上 **…**。
// 用法:node scripts/apply-bold.mjs <workflow-result.json>
// 校验:只动 lead/p 块、span 必须是块内精确子串、块内不重复、不碰已加粗段、每块≤2、每处≤40字。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const resultPath = process.argv[2]
if (!resultPath || !fs.existsSync(resultPath)) { console.error('用法: node scripts/apply-bold.mjs <result.json>'); process.exit(1) }
const raw = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
const units = Array.isArray(raw) ? raw : raw.result || []

const byFile = {}
let applied = 0, rejected = 0, chaptersTouched = 0
const rej = []
for (const u of units) {
  if (!u || !u.bolds) continue
  const f = `src/data/${u.corpus}/baihua/${u.slug}.json`
  byFile[f] ??= JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  const ch = byFile[f][u.ch]
  if (!ch) continue
  let chTouched = false
  for (const item of u.bolds) {
    const b = ch.blocks?.[item.i]
    if (!b || (b.type !== 'lead' && b.type !== 'p') || typeof b.text !== 'string') { rejected += (item.spans || []).length; continue }
    let n = 0
    for (const span of item.spans || []) {
      if (n >= 2) { rejected++; rej.push(`${u.slug}#${u.ch} 块${item.i} 超2处`); continue }
      if (typeof span !== 'string' || !span.trim() || span.length > 40) { rejected++; rej.push(`${u.slug}#${u.ch} 块${item.i} 空/超40字`); continue }
      if (span.includes('**')) { rejected++; rej.push(`${u.slug}#${u.ch} span 自带**`); continue }
      const idx = b.text.indexOf(span)
      if (idx < 0) { rejected++; rej.push(`${u.slug}#${u.ch} 块${item.i} 非子串: ${span.slice(0, 16)}`); continue }
      // 不碰已被 ** 包裹的区间(避免重复/嵌套)
      const before = b.text.slice(0, idx)
      if (((before.match(/\*\*/g) || []).length % 2) !== 0) { rejected++; rej.push(`${u.slug}#${u.ch} 块${item.i} 落在已加粗区`); continue }
      b.text = before + '**' + span + '**' + b.text.slice(idx + span.length)
      applied++; n++; chTouched = true
    }
  }
  if (chTouched) chaptersTouched++
}
for (const [f, o] of Object.entries(byFile)) fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, 1) + '\n')
console.error(`加粗 ${applied} 处 · 拒收 ${rejected} · 涉及 ${chaptersTouched} 章`)
if (rej.length) console.error('拒收明细(前20):\n  ' + rej.slice(0, 20).join('\n  '))
