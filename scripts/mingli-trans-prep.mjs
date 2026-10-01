// 观数译文层复核的备料(续跑 ⑤,owner 10-01 定做)。复核白话的代理顺手指出 125 章的**站内译文**(随原文显示的那一层,
// 真源 scripts/authored/mingli-translations.json)有可疑译错。这里把每一章的 原文(带段号)+ 现有译文 + 代理当时的附注与条目
// 装成一个输入文件,交给一个 opus 代理逐条核:只改确有错的段,按 schema 交回 {fixes:[{para, translation, why}]},不写文件。
//   node scripts/mingli-trans-prep.mjs <两份复核 .output…>  → scripts/.mingli-review/trans/in/*.json + trans-units.json
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORK = path.join(ROOT, 'scripts/.mingli-review/trans')
const IN = path.join(WORK, 'in')
const PAT = /站内(章)?译文|译文真源|一并核改|站内译作|译文也|译文(把|将|作|有误|译错|不准|没加|与原文)/

const files = process.argv.slice(2)
if (!files.length) { console.log('用法: node scripts/mingli-trans-prep.mjs <review.output…>'); process.exit(2) }
fs.mkdirSync(IN, { recursive: true })
const results = files.flatMap((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : (j.result || []) })
const texts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/texts.json'), 'utf8'))
const books = {}
const bookOf = (slug) => books[slug] ||= JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/mingli/classics/${slug}.json`), 'utf8'))

const units = []
for (const x of results) {
  const r = x?.result
  if (!r) continue
  const items = (r.findings || []).filter((f) => PAT.test(`${f.why || ''} ${f.wrong || ''} ${f.where || ''}`)).map((f) => `· [${f.where || ''}] ${f.wrong || ''} → ${f.fix || ''}(${f.why || ''})`)
  const noteHit = PAT.test(r.note || '')
  if (!items.length && !noteHit) continue
  const chNo = Number(String(x.key).split('-')[0])
  const ch = bookOf(x.slug).chapters.find((c) => c.no === chNo)
  if (!ch) continue
  const meta = texts.find((t) => t.slug === x.slug) || {}
  const input = {
    corpus: 'mingli', slug: x.slug, key: x.key, chNo, book: meta.title || x.slug, chapter: ch.title || '',
    paragraphs: ch.paragraphs.map((p, i) => ({ para: i + 1, original: p.original, translation: p.translation || '' })),
    hints: { note: r.note || '', items },
  }
  const inFile = path.join(IN, `${x.slug}-${x.key}.json`)
  fs.writeFileSync(inFile, JSON.stringify(input, null, 1))
  units.push({ slug: x.slug, key: x.key, chNo, label: `${meta.title || x.slug}·${x.key}`, inFile, paras: ch.paragraphs.length })
}
fs.writeFileSync(path.join(WORK, 'trans-units.json'), JSON.stringify(units))
console.log(`译文复核备料 ${units.length} 章 → ${WORK}`)
