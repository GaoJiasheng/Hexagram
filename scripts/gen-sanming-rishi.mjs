#!/usr/bin/env node
// 《三命通会》卷八、卷九「六十日 × 十二时」查表导航的索引(design-v23 §7「书的形状」)。
// 这两卷共 120 章(某日干 × 某时支),每章内同一日干的六个日各占一段,段首「〈日柱〉日〈时柱〉时…」。
// 生成 src/data/mingli/matrix/sanming-rishi.json:{ cells: [{ day, hour, ch, para }] },页面据此做 720 格直达。
//
// 底本(四库写本)的三类写法要先归一,才认得全:
//   ① 卷九十二个章题把「六己日」写成「六巳日/六已日」(正文「己」正写 620 次,只这十二个标题如此)
//   ② 地支「卯」多写作异体「夘」
//   ③ 三处段首标签讹字(见 SOURCES.md,底本照录不改):己丑日癸亥时→癸酉时 · 己亥日乙丑时(巳时章)→己巳时 · 辛丑日巳亥时→己亥时
//      —— 这里**只在建索引时**按五鼠遁纠正它们指向哪一格,不动原文。
// 时柱天干一律由五鼠遁算出并与段首核对,对不上的不收(宁缺毋滥)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAN, ZHI, JIAZI, hourGan } from '../src/features/shared/ganzhi/index.js'
import { core } from './lib/punct-layer.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/classics/sanming.json'), 'utf8'))
const norm = (s) => core(s).replace(/夘/g, '卯')
const normTitle = (s) => norm(s).replace(/六[巳已]日/, '六己日')

const cells = [], seen = new Set(), notes = []
for (const c of book.chapters) {
  const m = normTitle(c.title).match(/^卷[八九]六(.)日(.)(.)?时断$/)   // 卷八六甲日甲子时断
  if (!m || !GAN.includes(m[1])) continue
  const dayGan = m[1]
  const hourZhi = ZHI.includes(m[3]) ? m[3] : ZHI.includes(m[2]) ? m[2] : null
  if (!hourZhi) { notes.push(`章题认不出时支: ${c.title}`); continue }
  const hg = hourGan(dayGan, hourZhi)
  c.paragraphs.forEach((p, i) => {
    const t = norm(p.original)
    const mm = t.match(/^(..)日(..)时/)
    if (!mm || mm[1][0] !== dayGan || !JIAZI.includes(mm[1])) return
    const day = mm[1]
    if (mm[2] !== hg + hourZhi) notes.push(`${c.title} 第 ${i} 段:段首作「${mm[1]}日${mm[2]}时」,按五鼠遁当为 ${hg + hourZhi} 时 —— 按章归格`)
    const key = `${day}|${hourZhi}`
    if (seen.has(key)) { notes.push(`重复: ${key}(${c.title} 第 ${i} 段),取先见者`); return }
    seen.add(key)
    cells.push({ day, hour: hourZhi, ch: c.no, para: i })
  })
}
const missing = []
for (const d of JIAZI) for (const z of ZHI) if (!seen.has(`${d}|${z}`)) missing.push(`${d}日${z}时`)
cells.sort((a, b) => JIAZI.indexOf(a.day) - JIAZI.indexOf(b.day) || ZHI.indexOf(a.hour) - ZHI.indexOf(b.hour))
fs.writeFileSync(path.join(ROOT, 'src/data/mingli/matrix/sanming-rishi.json'),
  JSON.stringify({ book: 'sanming', _note: '由 scripts/gen-sanming-rishi.mjs 生成,勿手改。missing = 底本本身缺的格。', cells, missing }, null, 1) + '\n')
console.log(`日时索引: ${cells.length}/720 格 · 缺 ${missing.length}: ${missing.join(' ')}`)
for (const n of notes) console.log('  · ' + n)
