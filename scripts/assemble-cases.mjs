#!/usr/bin/env node
// 把策展代理产出的命例走读合并落盘:node scripts/assemble-cases.mjs <a.json> <b.json> …
// 不过校验的例整例丢弃并报出;同一命例(章·段)重复取先到者。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCase } from './lib/mingli-cases.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/classics/ditiansui.json'), 'utf8'))
const files = process.argv.slice(2)
if (!files.length) { console.error('用法: node scripts/assemble-cases.mjs <结果文件…>'); process.exit(1) }

const cases = [], seen = new Set(), dropped = []
for (const f of files) {
  for (const rec of JSON.parse(fs.readFileSync(f, 'utf8')).cases || []) {
    const id = `${rec.ch}-${rec.para}`
    const errs = validateCase(rec, book)
    if (errs.length) { dropped.push({ id, errs }); continue }
    if (seen.has(id)) continue
    seen.add(id)
    const { ch, para, commentPara, title, concept, why, steps } = rec
    cases.push({ id, ch, para, commentPara, title, concept, why, steps: steps.map(({ kind, focus, quote, say }) => (kind === 'record' ? { kind, quote } : { focus, quote, say })) })
  }
}
cases.sort((a, b) => a.ch - b.ch || a.para - b.para)
fs.mkdirSync(path.join(ROOT, 'src/data/mingli/cases'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'src/data/mingli/cases/ditiansui.json'), JSON.stringify({ book: 'ditiansui', cases }, null, 1) + '\n')
console.log(`落盘 ${cases.length} 例 · 丢弃 ${dropped.length}`)
for (const d of dropped) console.log(`  ✗ ${d.id}: ${d.errs.join(';')}`)
