#!/usr/bin/env node
// 详注 · 单元自查:给起草 / 核查的代理(或人)用。读 scripts/.desk-notes/<corpus>--<slug>/in/<单元>.json 与 out/<单元>.json,
// 按入库同一套规则逐条核(k 是该段原文子串、同段不重叠不重复、d ≤ 40 字、x 40–150 字、只许 k d x r 四个字段),并报密度。
// 退出码:0 全过且密度达标,1 有问题。
//   node scripts/desk/notes-check.mjs <corpus>/<slug> <单元> [--min 12]
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, checkPlace, len } from '../lib/xiangzhu.mjs'

const argv = process.argv.slice(2)
const [book, unit] = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--min')
const MIN = Number(argv[argv.indexOf('--min') + 1]) || 12
if (!book || !unit) { console.error('用法:node scripts/desk/notes-check.mjs <corpus>/<slug> <单元> [--min 12]'); process.exit(2) }
const dir = path.join(ROOT, 'scripts/.desk-notes', book.replace('/', '--'))
const inp = JSON.parse(fs.readFileSync(path.join(dir, 'in', `${unit}.json`), 'utf8'))
const outFile = path.join(dir, 'out', `${unit}.json`)
if (!fs.existsSync(outFile)) { console.log(`还没有 ${outFile}`); process.exit(1) }
let out
try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')) } catch (e) { console.log(`out 文件不是合法 JSON:${e.message}(修好它:最常见是末尾多了或少了括号)`); process.exit(1) }
const want = new Map(inp.items.map((it) => [`${it.ch}|${it.seg}`, it]))
let chars = 0, good = 0, bad = 0
for (const it of inp.items) chars += len(it.o)
const lines = []
for (const [ch, segs] of Object.entries(out)) {
  if (!segs || typeof segs !== 'object' || Array.isArray(segs)) { bad++; lines.push(`✗ 第 ${ch} 章:值应为 {段下标: [注…]}`); continue }
  for (const [seg, list] of Object.entries(segs)) {
    const it = want.get(`${ch}|${seg}`)
    if (!it) { bad += Array.isArray(list) ? list.length : 1; lines.push(`✗ 第 ${ch} 章 段 ${seg}:本单元输入里没有这一处(章号、段下标要照 in 文件的 ch / seg 写)`); continue }
    const r = checkPlace(it.o, list, { strict: true })
    good += r.good.length; bad += r.bad.length
    for (const b of r.bad) lines.push(`✗ 第 ${ch} 章 段 ${seg}「${b.n?.k ?? '?'}」:${b.why}${b.why.includes('x ') ? `(现 ${len(b.n?.x)} 字,要 40–150)` : ''}${b.why.includes('d ') ? `(现 ${len(b.n?.d)} 字,要 1–40)` : ''}`)
  }
}
const density = chars ? good / chars * 100 : 0
for (const l of lines.slice(0, 60)) console.log(l)
if (lines.length > 60) console.log(`…还有 ${lines.length - 60} 处`)
// 很短的段可以没有注,但整单元的密度要够;极短单元(< 200 字)不卡密度
const thin = chars >= 200 && density < MIN
const empty = inp.items.filter((it) => len(it.o) >= 30 && !(out[String(it.ch)]?.[String(it.seg)]?.length))
if (empty.length) console.log(`还有 ${empty.length} 段(30 字以上)一条注都没有:${empty.slice(0, 8).map((it) => `第 ${it.ch} 章段 ${it.seg}`).join('、')}${empty.length > 8 ? '…' : ''}`)
console.log(`原文 ${chars} 字 · 合格 ${good} 条 · 不合格 ${bad} 条 · 每百字 ${density.toFixed(1)} 条(要求 ≥ ${MIN})${thin ? ` —— 密度不够,至少还要补 ${Math.ceil(chars * MIN / 100 - good)} 条` : ''}`)
const ok = !bad && !thin && !empty.length
console.log(ok ? '通过' : '未通过')
process.exit(ok ? 0 : 1)
