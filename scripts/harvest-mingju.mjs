#!/usr/bin/env node
// 名句集候选料台(为 build-mingju 的第三源做准备)。用法: node scripts/harvest-mingju.mjs <corpus>
//
// 名句集原本只有两个源:争鸣 cite + concepts loci。中医/谋略**按设计不入争鸣**,
// 诗词曲是后加的三组、也没有辩题,于是这五组在 /mingju 里一句都没有。
//
// 这里给它们开第三条源:**白话层的 quote 块**。那些引文是 check-data 逐条校过的
// 原文精确子串,与争鸣 cite 同级可信,且本就是写文章时被挑出来的句子。
// 本脚本**只出候选、不落库**——挑哪几句是人的事(见 scripts/authored/mingju-extra/)。
//
// 输出 JSON 到 stdout:每条带 q/label/corpus/slug/ch/seg,以及供人判断的 srcTitle。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const corpus = process.argv[2]
if (!corpus) { console.error('用法: node scripts/harvest-mingju.mjs <corpus>'); process.exit(1) }

const MIN = 6, MAX = 22
const norm = (s) => s.replace(/[\s，。、；：！？「」『』（）()·]/g, '')

const dir = path.join(ROOT, `src/data/${corpus}/baihua`)
if (!fs.existsSync(dir)) { console.error(`无 ${corpus} 白话目录`); process.exit(1) }

const out = []
const seen = new Set()

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const slug = f.replace(/\.json$/, '')
  const cf = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
  if (!fs.existsSync(cf)) continue
  const book = JSON.parse(fs.readFileSync(cf, 'utf8'))
  const bh = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))

  for (const [key, art] of Object.entries(bh)) {
    // 白话键有两种:纯章号(一首即一章)与「章-序」(一章含多首,诗经/唐诗那套)
    const ch = Number(String(key).split('-')[0])
    const chap = book.chapters.find((c) => c.no === ch)
    if (!chap) continue
    const paras = chap.paragraphs
    // 段偏移:用于把名句深链到那一首/那一段,而不是整卷
    const offset = (() => {
      const parts = String(key).split('-')
      if (parts.length < 2) return 0
      const heads = paras.map((p, i) => (/^《[^》]+》$/.test(p.original.trim()) ? i : -1)).filter((i) => i >= 0)
      return heads[Number(parts[1]) - 1] ?? 0
    })()
    const poemTitle = /^《[^》]+》$/.test(paras[offset]?.original.trim() || '')
      ? paras[offset].original.trim().replace(/^《|》$/g, '') : null

    for (const b of art.blocks || []) {
      if (b.type !== 'quote') continue
      const q = String(b.original || '').trim()
      const n = norm(q)
      if (n.length < MIN || n.length > MAX) continue
      if (seen.has(n)) continue
      // 逐字复核:必须仍是本章原文的精确子串(白话数据后来被改过也能逮住)
      const whole = paras.map((p) => p.original).join('')
      if (!whole.includes(q)) continue
      // 定位到具体哪一段,供深链
      const seg = paras.findIndex((p, i) => i >= offset && p.original.includes(q))
      seen.add(n)
      out.push({
        q,
        corpus,
        slug,
        ch,
        seg: seg >= 0 ? seg : offset,
        srcTitle: poemTitle || chap.title || `第${ch}章`,
        artTitle: art.title || '',   // 白话篇题(诗词曲的作者名多在这里)
        gloss: b.translation || '',
      })
    }
  }
}

out.sort((a, b) => a.ch - b.ch || a.seg - b.seg)
console.log(JSON.stringify(out, null, 1))
console.error(`${corpus}: 候选 ${out.length} 条`)
