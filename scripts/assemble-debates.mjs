// 装配 workflow 产出的《百家争鸣》辩论(v21 批量)。
// 用法:node scripts/assemble-debates.mjs <workflow-output.json>
// 做:读 .result → 每辩(① turn.school/rebut 家名→key 归一 ② stance 截首短语 ③ cite.quote
//   node 自校是原文子串)→ 写 src/data/debates/<id>.json。最后打印汇总 + 坏 cite 清单(供人工补)。
// 不动 index.json(由调用者按成功 id 补 topic / 删 planned,避免误删失败题的 roadmap)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = process.argv[2]
if (!outPath) { console.error('用法: node scripts/assemble-debates.mjs <workflow-output.json>'); process.exit(1) }

const o = JSON.parse(fs.readFileSync(outPath, 'utf8'))
const arr = Array.isArray(o) ? o : o.result
if (!Array.isArray(arr)) { console.error('未找到结果数组(.result)'); process.exit(1) }

const chCache = {}
function chapterText(corpus, slug, ch) {
  const k = `${corpus}/${slug}`
  if (!(k in chCache)) {
    const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
    chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
  }
  const b = chCache[k]; if (!b) return null
  const c = b.chapters.find((x) => x.no === ch)
  return c ? c.paragraphs.map((p) => p.original).join('') : null
}
const shortStance = (s) => { const x = String(s).split(/[：:，,。；;]/)[0].trim(); return x.length > 10 ? x.slice(0, 9) + '…' : x }

const built = []
const badCites = []
for (const d of arr) {
  const keys = new Set(d.schools.map((s) => s.key))
  const byLabel = Object.fromEntries(d.schools.map((s) => [s.label, s.key]))
  d.schools.forEach((s) => { s.stance = shortStance(s.stance) })
  for (const r of d.rounds) for (const t of r.turns) {
    if (!keys.has(t.school) && byLabel[t.school]) t.school = byLabel[t.school]
    if (t.rebut && !keys.has(t.rebut) && byLabel[t.rebut]) t.rebut = byLabel[t.rebut]
    const c = t.cite, txt = chapterText(c.corpus, c.slug, c.ch)
    if (txt === null) badCites.push(`${d.id}: 章缺 ${c.corpus}/${c.slug}#${c.ch}`)
    else if (!txt.includes(c.quote)) badCites.push(`${d.id}: 非子串 ${c.corpus}/${c.slug}#${c.ch} 「${c.quote}」`)
  }
  fs.writeFileSync(path.join(ROOT, `src/data/debates/${d.id}.json`), JSON.stringify(d, null, 2) + '\n')
  built.push({ id: d.id, title: d.title, concept: d.concept, turns: d.rounds.reduce((n, r) => n + r.turns.length, 0) })
}

console.log(`写入 ${built.length} 辩:`)
for (const b of built) console.log(`  ${b.id} 「${b.title}」 ${b.turns}轮`)
console.log(`\n坏 cite: ${badCites.length}`)
for (const x of badCites) console.log('  ✗ ' + x)
fs.writeFileSync(path.join(ROOT, 'scripts/.cache/last-debate-build.json'), JSON.stringify({ builtIds: built.map((b) => b.id), titles: built.map((b) => b.title) }), 'utf8')
