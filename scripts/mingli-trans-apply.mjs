// 观数译文层复核的合并器(与 mingli-trans-prep.mjs / .mingli-trans-wf.js 成对)。
//   node scripts/mingli-trans-apply.mjs <workflow .output>
// 把代理交回的 fixes 写进译文真源 scripts/authored/mingli-translations.json(slug → 章号 → 按段下标的译文数组),
// 只改 para 在范围内、译文非空且确有变化的段;列表长度与原文段数不符的章跳过(说明真源与原文已错位,须先查)。
// 之后要 `node scripts/fetch-corpus.mjs mingli` 把译文合回 classics,并核 classics 只有 translation 字段变化。
// 汇报写到 docs/mingli-translation-review-<日期>.md(每条:段号 · 原译 → 新译 · 依据),给 owner 抽看。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'scripts/authored/mingli-translations.json')
const VERDICT_RE = /你(的命|可据此|可以据此|应当|要注意)|据此可断|照此断/

const files = process.argv.slice(2)
if (!files.length) { console.log('用法: node scripts/mingli-trans-apply.mjs <workflow.output…>'); process.exit(2) }
const results = files.flatMap((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : (j.result || []) })
const trans = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const books = {}
const bookOf = (slug) => books[slug] ||= JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/mingli/classics/${slug}.json`), 'utf8'))
const texts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/texts.json'), 'utf8'))
const titleOf = (slug) => texts.find((t) => t.slug === slug)?.title || slug

const report = []
let applied = 0, skipped = 0, chaptersTouched = new Set()
for (const r of results) {
  const fixes = r?.result?.fixes
  if (!Array.isArray(fixes) || !fixes.length) continue
  const chNo = Number(r.chNo || String(r.key).split('-')[0])
  const ch = bookOf(r.slug).chapters.find((c) => c.no === chNo)
  const list = trans[r.slug]?.[String(chNo)]
  if (!ch || !Array.isArray(list)) { skipped += fixes.length; report.push({ label: r.label, skip: `真源无 ${r.slug}/${chNo}` }); continue }
  if (list.length !== ch.paragraphs.length) { skipped += fixes.length; report.push({ label: r.label, skip: `真源译文 ${list.length} 条 ≠ 原文 ${ch.paragraphs.length} 段,先查错位` }); continue }
  const items = []
  for (const f of fixes) {
    const i = Number(f.para) - 1
    const t = String(f.translation || '').trim()
    if (!(i >= 0 && i < list.length) || !t) { skipped++; continue }
    if (t === list[i]) continue
    if (VERDICT_RE.test(t)) { skipped++; items.push({ para: f.para, skip: '译文带套用口吻,未采', why: f.why }); continue }
    items.push({ para: f.para, old: list[i], neu: t, why: f.why || '' })
    list[i] = t
    applied++
  }
  if (items.length) { chaptersTouched.add(r.slug); report.push({ label: r.label, slug: r.slug, chNo, items, note: r.result?.note }) }
}
fs.writeFileSync(SRC, JSON.stringify(trans, null, 2) + '\n')

const day = new Date().toISOString().slice(0, 10)
const lines = [`# 观数译文层代理复核 · ${day}`, '',
  `> 白话复核时代理顺手指出的站内译文问题,这一轮每章一个 opus 代理逐段核;只改确有错的段,译文真源 \`scripts/authored/mingli-translations.json\`,再 \`fetch-corpus mingli\` 合回。`,
  `> 机器只保证「对位、非空、无套用口吻」,改得对不对请 owner 抽看。`, '',
  `- 采纳 ${applied} 段 · 未采 ${skipped} · 涉及 ${report.filter((x) => x.items).length} 章`, '']
for (const x of report) {
  if (x.skip) { lines.push(`- ⚠ ${x.label}:${x.skip}`); continue }
  lines.push(`## ${x.label} → \`/mingli/${x.slug}/${x.chNo}\``)
  for (const it of x.items) {
    if (it.skip) { lines.push(`- 第 ${it.para} 段:${it.skip}(${it.why || ''})`); continue }
    lines.push(`- **第 ${it.para} 段**:${it.old} → ${it.neu}(${it.why})`)
  }
  if (x.note) lines.push(`- 代理附注:${x.note}`)
  lines.push('')
}
const doc = path.join(ROOT, `docs/mingli-translation-review-${day}.md`)
fs.writeFileSync(doc, lines.join('\n'))
console.log(lines[5]); console.log(`汇报 → ${doc}`)
for (const x of report.filter((y) => y.skip)) console.log('  跳过', x.label, x.skip)
