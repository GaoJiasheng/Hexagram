// 给「课文按课本」重跑译注延的 workflow 脚本注入每篇的异文清单(owner 2026-10-05)。
//   node scripts/patch-wf-textbook-variants.mjs <wf脚本> <book>
// 异文从 scripts/sources/guwen/textbook-diffs/ 的对校记录机械算出(只列去标点后仍不同的改动 + 节选增删),
// 写进 UNITS[i].variants;提示语的 yanyi 条要求用一段如实标出,不判高下。
import fs from 'node:fs'
import path from 'node:path'
const [file, book] = process.argv.slice(2)
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PUN = /[\s\p{P}\p{S}]/gu
const strip = (s) => s.replace(PUN, '')
const BASE = book === 'guwenguanzhi' ? '《古文观止》(吴楚材本)' : '本站原据的维基文库底本'
let src = fs.readFileSync(file, 'utf8')
const m = src.match(/const UNITS = (\[.*?\])\n/s)
const units = JSON.parse(m[1])
for (const u of units) {
  const f = path.join(ROOT, `scripts/sources/guwen/textbook-diffs/diff-${u.book}-${u.no}.json`)
  if (!fs.existsSync(f)) continue
  const d = JSON.parse(fs.readFileSync(f, 'utf8'))
  const items = (d.edits || []).filter((e) => strip(e.base) !== strip(e.textbook))
    .map((e) => `${BASE}作「${e.base}」,课本作「${e.textbook}」`)
  const vol = { '7a': '七年级上册', '7b': '七年级下册', '8a': '八年级上册', '8b': '八年级下册', '9a': '九年级上册', '9b': '九年级下册', h1a: '高中必修上册', h1b: '高中必修下册', h2m: '高中选择性必修中册', h2b: '高中选择性必修下册' }[d.volume] || d.volume
  u.variants = `本篇原文依统编版语文${vol}《${d.textbookTitle}》(${d.sourceNote || ''})。与${BASE}的文字异同:` +
    (items.length ? items.slice(0, 16).join(';') + (items.length > 16 ? `;等共 ${items.length} 处` : '') : '除标点外无字句差异') +
    (/节选|有删/.test(d.textbookTitle + (d.sourceNote || '')) ? ';课本为节选/有删节' : '')
}
src = src.replace(m[1], JSON.stringify(units))
const tail = " + (u.variants ? '\\n   **另:' + u.variants + '。延伸中须有一段(可并入上述段落)如实交代本篇课本文字与旧底本的主要异同——只陈事实、不判高下,标点差异不必提。**' : '')"
let n = 0
for (const end of ["每段 80–160 字。')", "确保实质、出处可靠。')"]) {
  const at = src.indexOf(end)
  if (at !== -1 && !src.slice(at, at + end.length + 40).includes('u.variants')) { src = src.slice(0, at + end.length) + tail + src.slice(at + end.length); n++ }
}
fs.writeFileSync(file, src)
console.log(`注入异文:${units.filter((u) => u.variants).length}/${units.length} 单元,提示语挂点 ${n}/2`)
