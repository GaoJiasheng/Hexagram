#!/usr/bin/env node
// 图解结构化 · 单元自查:给转换的代理(或人)用。读 scripts/.desk-figs/<书>/in/<单元>.json 与 out/<单元>.json,逐张过闸,
// 列出没过的图与原因(漏字 / 多字 / 结构);全过则打印「全部通过」。退出码:0 全过,1 有没过或缺的。
//   node scripts/desk/figs-check.mjs <书> <单元>
import fs from 'node:fs'
import path from 'node:path'
import { checkFig, svgTexts } from './fig-gate.mjs'
import { workDir } from './fig-sources.mjs'

const [book, unit] = process.argv.slice(2)
if (!book || !unit) { console.error('用法:node scripts/desk/figs-check.mjs <书> <单元,如 u001>'); process.exit(2) }
const dir = workDir(book)
const inp = JSON.parse(fs.readFileSync(path.join(dir, 'in', `${unit}.json`), 'utf8'))
const outFile = path.join(dir, 'out', `${unit}.json`)
if (!fs.existsSync(outFile)) { console.log(`还没有 ${outFile}`); process.exit(1) }
let out
try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')) } catch (e) { console.log(`out 文件不是合法 JSON:${e.message}`); process.exit(1) }
let bad = 0
for (const it of inp.items) {
  const fig = out[it.key]
  if (!fig) { bad++; console.log(`✗ ${it.key}:out 里没有这张图`); continue }
  const p = checkFig(fig, it.svg)
  if (p.length) { bad++; console.log(`✗ ${it.key}:${p.join(';')}\n   原图的字:${svgTexts(it.svg).join(' | ').slice(0, 400)}`) }
}
const extra = Object.keys(out).filter((k) => !inp.items.some((it) => it.key === k))
if (extra.length) console.log(`out 里多出不属于本单元的键:${extra.join(' ')}(删掉)`)
console.log(bad ? `${inp.items.length} 张里 ${bad} 张没过` : `全部通过(${inp.items.length} 张)`)
process.exit(bad ? 1 : 0)
