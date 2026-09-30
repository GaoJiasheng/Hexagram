#!/usr/bin/env node
// 韵书未收字清单(M8 · /rhyme 页的数据)。用法:node scripts/gen-rhyme-unlisted.mjs
// 产出:src/data/rhyme/unlisted.json
//   books:三部韵书概况(部数、收字数、异体退查条数)
//   groups:唐诗(平水韵)/ 宋词(词林正韵)/ 元曲(中原音韵)各自的未收字
//           { char, count 出现次数, endCount 句末次数, examples ≤3 [{slug, ch, title, line, para, part?, end}] }
//
// **只统计,不补字**:韵书字表来自维基文库页面(scripts/fetch-rhyme.mjs),页面有缺(如平水韵漏「啼」)照缺。
// 查法与阅读器「格律」开关同一套(算法在 scripts/lib/rhyme-unlisted.mjs,check-rhyme 闸据它重算比对)。
// 韵书或诗词原文变了之后重跑本脚本;不重跑,check-data 会报 unlisted.json 过期。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeUnlisted } from './lib/rhyme-unlisted.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'src/data/rhyme/unlisted.json')

const data = computeUnlisted({ ROOT })

// 一字一行:体量小、diff 好读(改一部韵书 / 一首诗,只动相关几行)
function format(d) {
  const out = ['{', ` "note": ${JSON.stringify(d.note)},`, ` "books": ${JSON.stringify(d.books)},`, ' "groups": [']
  d.groups.forEach((g, gi) => {
    const { items, ...head } = g
    out.push(`  ${JSON.stringify(head).slice(0, -1)}, "items": [`)
    items.forEach((it, i) => out.push(`   ${JSON.stringify(it)}${i < items.length - 1 ? ',' : ''}`))
    out.push(`  ]}${gi < d.groups.length - 1 ? ',' : ''}`)
  })
  out.push(' ]', '}')
  return out.join('\n') + '\n'
}
const text = format(data)
if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(data)) throw new Error('unlisted.json 排版后与数据不一致')
fs.writeFileSync(OUT, text)

const pct = (x) => `${(x * 100).toFixed(2)}%`
console.log(`✓ ${path.relative(ROOT, OUT)}  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`)
for (const [k, b] of Object.entries(data.books)) {
  console.log(`  《${b.title}》 ${b.parts} 部 · ${b.chars} 字${b.ciChars ? `(另【詞】增补 ${b.ciChars})` : ''} · 异体退查 ${b.variants} 条  [${k}]`)
}
for (const g of data.groups) {
  const s = g.stats
  console.log(
    `  ${g.label}(${g.scheme}):韵文 ${s.chars} 字 / ${s.lines} 句 · 未收 ${s.unlisted} 次 ${pct(s.rate)} · ${s.distinct} 个字`
    + ` · 句末未收 ${s.endUnlisted} 句(${s.endDistinct} 字)· 经异体表查到 ${s.viaVariant}${'viaCi' in s ? ` · 经【詞】增补查到 ${s.viaCi}` : ''}`,
  )
  console.log(`    前列:${g.items.slice(0, 12).map((x) => `${x.char}${x.count}${x.endCount ? `/末${x.endCount}` : ''}`).join(' ')}`)
}
