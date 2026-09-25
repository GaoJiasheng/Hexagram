// 独立复核:照 fetch-corpus.mjs 的 typoFixes 语义(非命例段、全部替换、计命中数)逐条施加,核 expect
import fs from 'fs'
const d = JSON.parse(fs.readFileSync('/Users/gavin/work/hexagram/src/data/mingli/classics/ditiansui.json', 'utf8'))
const fixes = JSON.parse(fs.readFileSync('ditiansui-typofixes.json', 'utf8'))
const paras = d.chapters.flatMap((c) => c.paragraphs)
let bad = 0
for (const f of fixes) {
  let hit = 0
  for (const p of paras) {
    if (p.pillars || !p.original.includes(f.from)) continue
    hit += p.original.split(f.from).length - 1
    p.original = p.original.split(f.from).join(f.to)
  }
  if (hit !== f.expect) { bad++; console.log('MISMATCH', f.from, '→', f.to, 'expect', f.expect, 'hit', hit) }
  if (!f.reason || f.from === f.to) { bad++; console.log('BAD ENTRY', f) }
}
console.log('fixes', fixes.length, 'mismatch', bad)
// 残留检查:文言不当有的字
const left = paras.filter((p) => !p.pillars).map((p) => p.original).join('')
for (const ch of ['这', '笔型', '通行证', '正好', '很小', '任氏日']) console.log('残留', ch, left.split(ch).length - 1)
