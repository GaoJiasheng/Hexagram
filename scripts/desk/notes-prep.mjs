#!/usr/bin/env node
// 观象 · 书桌 —— 详注生产 · 备料(2026-11-22 owner 定:六本全量,密度与详略照《道德经》前十章试跑)。
//   node scripts/desk/notes-prep.mjs <书 id> [--size 1500]
// 读 public/desk/v1 里这本书的内容包(先 npm run desk:packs),按章凑成每单元约 1500 原文字的输入分片
// (一章太长就按段切),已在 scripts/authored/desk-notes/<书>.json 里有详注的章跳过(可续跑)。
// 产出 scripts/.desk-notes/<书>/in/<单元>.json 与 args.json({dir, ids} → 交给 Workflow scripts/desk/notes-wf.js)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { redlines } from '../lib/baihua-redlines.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [book, ...rest] = process.argv.slice(2)
const SIZE = Number(rest[rest.indexOf('--size') + 1]) || 1500
const CORPUS = { daodejing: 'dao', zhuangzi: 'dao', lunyu: 'ru', sunzi: 'bing', guiguzi: 'zong', yijing: 'yijing' }
if (!CORPUS[book]) { console.error('用法: node scripts/desk/notes-prep.mjs <daodejing|lunyu|sunzi|guiguzi|zhuangzi|yijing>'); process.exit(2) }
const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desk/v1/manifest.json'), 'utf8'))
const info = man.books.find((b) => b.id === book)
const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desk/v1', info.file), 'utf8'))
const doneFile = path.join(ROOT, `scripts/authored/desk-notes/${book}.json`)
const done = fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : {}
const WORK = path.join(ROOT, 'scripts/.desk-notes', book)
fs.rmSync(path.join(WORK, 'in'), { recursive: true, force: true })
fs.mkdirSync(path.join(WORK, 'in'), { recursive: true }); fs.mkdirSync(path.join(WORK, 'out'), { recursive: true })

const units = []
let cur = [], curChars = 0
const flush = () => { if (cur.length) { units.push(cur); cur = []; curChars = 0 } }
for (const c of pack.chapters) {
  if (done[String(c.no)]) continue
  const items = c.segs.map((s, i) => ({ ch: c.no, chTitle: c.title, seg: i, ...(s.label ? { label: s.label } : {}), o: s.o, ...(s.t ? { t: s.t } : {}),
    ...(s.n?.length ? { old: s.n.map((n) => ({ k: n.k, d: n.d })) } : {}) }))
  const n = items.reduce((a, x) => a + x.o.length, 0)
  if (n > SIZE * 1.6) {                       // 一章太长:按段切成几个单元
    flush()
    for (const it of items) { if (curChars > 0 && curChars + it.o.length > SIZE) flush(); cur.push(it); curChars += it.o.length }
    flush()
  } else {
    if (curChars > 0 && curChars + n > SIZE) flush()
    cur.push(...items); curChars += n
  }
}
flush()
const ids = units.map((u, i) => {
  const id = `u${String(i + 1).padStart(3, '0')}`
  fs.writeFileSync(path.join(WORK, 'in', `${id}.json`), JSON.stringify({ book: info.title, redline: redlines(book)[CORPUS[book]] || '', chars: u.reduce((a, x) => a + x.o.length, 0), items: u }, null, 1))
  return id
})
fs.writeFileSync(path.join(WORK, 'args.json'), JSON.stringify({ dir: WORK, book: info.title, ids }))
console.log(`${info.title}:${ids.length} 个单元 · 待注 ${units.flat().reduce((a, x) => a + x.o.length, 0)} 字 · 已有详注的章 ${Object.keys(done).length} → ${path.relative(ROOT, WORK)}/args.json`)
