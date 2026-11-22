#!/usr/bin/env node
// 观象 · 书桌 —— 图解结构化 · 备料。
//   node scripts/desk/figs-prep.mjs <书 id> [--size 8]
// 收这本书站内白话里的全部 SVG 图,跳过 scripts/authored/desk-figs/<书>.json 里已有的,按 key 去重,
// 约每 8 张一个单元(SVG 合计超 24k 字就提前截断)→ scripts/.desk-figs/<书>/in/uNNN.json 与 args.json。
import fs from 'node:fs'
import path from 'node:path'
import { FIG_SOURCES, ROOT, collectFigs, figsFile, workDir, readJson } from './fig-sources.mjs'

const argv = process.argv.slice(2)
const si = argv.indexOf('--size')
const book = argv.find((a, i) => !a.startsWith('--') && !(si >= 0 && i === si + 1))
const SIZE = (si >= 0 && Number(argv[si + 1])) || 8
const CAP_CHARS = 24000
if (!book || !FIG_SOURCES[book]) { console.error(`用法:node scripts/desk/figs-prep.mjs <${Object.keys(FIG_SOURCES).join('|')}> [--size 8]`); process.exit(2) }

const all = collectFigs(book)
const done = readJson(figsFile(book), {})
const seen = new Set()
const todo = []
for (const f of all) { if (done[f.key] || seen.has(f.key)) continue; seen.add(f.key); todo.push(f) }

const WORK = workDir(book)
fs.rmSync(path.join(WORK, 'in'), { recursive: true, force: true })
fs.mkdirSync(path.join(WORK, 'in'), { recursive: true }); fs.mkdirSync(path.join(WORK, 'out'), { recursive: true })

const units = []
let cur = [], chars = 0
for (const f of todo) {
  if (cur.length && (cur.length >= SIZE || chars + f.svg.length > CAP_CHARS)) { units.push(cur); cur = []; chars = 0 }
  cur.push(f); chars += f.svg.length
}
if (cur.length) units.push(cur)
const ids = units.map((u, i) => {
  const id = `u${String(i + 1).padStart(3, '0')}`
  fs.writeFileSync(path.join(WORK, 'in', `${id}.json`), JSON.stringify({ book, items: u.map((f) => ({ key: f.key, ftype: f.ftype, caption: f.caption, chapter: `${f.src}#${f.chapter}`, svg: f.svg })) }, null, 1))
  return id
})
fs.writeFileSync(path.join(WORK, 'args.json'), JSON.stringify({ dir: WORK, book, ids }))
console.log(`${book}:全书 ${all.length} 张图 · 去重后 ${new Set(all.map((f) => f.key)).size} 种 · 已转 ${Object.keys(done).length} · 待转 ${todo.length} 张 → ${ids.length} 个单元(${path.relative(ROOT, WORK)}/args.json)`)
