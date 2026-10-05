// 古文课文改依课本(owner 2026-10-05:「白话不用从头做,关键字改一下就好」)——把既有白话对到新原文上,不重写:
//   node scripts/realign-baihua-textbook.mjs <slug> [--write]
// 1) 引文:旧原文(git HEAD 的 classics)与新原文逐字对齐(LCS),每条 quote.original 在旧文里的位置映到新文,
//    换成新文对应那一段(课本的字与标点);整句落在课本删去的部分 → 该引文块删掉(列出)。
// 2) 正文关键字:从对校记录(textbook-diffs)取「去标点后仍不同」的改动,截出差异核心(≥2 字,不足补一字上下文),
//    在该章白话的文字字段里(含 svg 文字)逐一替换:澹泊→淡泊、志与岁去→意与日去 一类。
// 只碰 textbook.json 里那些章;其余章一字不动。
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
const slug = process.argv[2]
const WRITE = process.argv.includes('--write')
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const PUN = /[\s\p{P}\p{S}]/u
const tb = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/sources/guwen/textbook.json'), 'utf8'))[slug] || {}
const oldBook = JSON.parse(execSync(`git show HEAD:src/data/guwen/classics/${slug}.json`, { cwd: ROOT, maxBuffer: 1e9 }))
const newBook = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/guwen/classics/${slug}.json`), 'utf8'))
const bf = path.join(ROOT, `src/data/guwen/baihua/${slug}.json`)
const bh = JSON.parse(fs.readFileSync(bf, 'utf8'))

// 旧文边界 i → 新文边界(LCS 对齐;替换段按「先删后插」记,边界落在插入段之前)
function align(a, b) {
  const n = a.length, m = b.length
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const f = new Int32Array(n + 1), kept = new Uint8Array(n)
  let i = 0, j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { f[i] = j; kept[i] = 1; i++; j++ }
    else if (i < n && (j >= m || L[i + 1][j] >= L[i][j + 1])) { f[i] = j; i++ }
    else j++
  }
  f[n] = m
  return { f, kept }
}
const core = (o, t) => {   // 去标点后的差异核心,≥2 字
  const a = [...o].filter((x) => !PUN.test(x)), b = [...t].filter((x) => !PUN.test(x))
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++
  let lo = p, hiA = a.length - s, hiB = b.length - s
  while (hiA - lo < 2 || hiB - lo < 2) { if (lo > 0) lo--; else if (hiA < a.length && hiB < b.length) { hiA++; hiB++ } else break }
  return [a.slice(lo, hiA).join(''), b.slice(lo, hiB).join('')]
}
const walk = (v, fn) => Array.isArray(v) ? v.map((x) => walk(x, fn)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'original' || k === 'translation' ? x : walk(x, fn)])) : typeof v === 'string' ? fn(v) : v

let nQ = 0, nDrop = 0, nKw = 0
for (const ch of Object.keys(tb)) {
  const art = bh[ch]; if (!art) continue
  const oc = oldBook.chapters.find((x) => String(x.no) === ch), nc = newBook.chapters.find((x) => String(x.no) === ch)
  const a = [...oc.paragraphs.map((p) => p.original).join('')], b = [...nc.paragraphs.map((p) => p.original).join('')]
  const newText = b.join('')
  const { f, kept } = align(a, b)
  const oldText = a.join('')
  const dropped = []
  art.blocks = (art.blocks || []).filter((blk) => {
    if (blk.type !== 'quote' || !blk.original || newText.includes(blk.original)) return true
    const at = oldText.indexOf(blk.original)
    if (at === -1) return true          // 旧文里本就不是子串(不是本轮造成的),不动,让 check-data 报
    const s0 = [...oldText.slice(0, at)].length, e0 = s0 + [...blk.original].length
    let keptN = 0; for (let k = s0; k < e0; k++) if (kept[k] && !PUN.test(a[k])) keptN++
    const sig = [...blk.original].filter((x) => !PUN.test(x)).length
    if (keptN < Math.max(2, sig * 0.4)) {   // 大半落在课本删去的部分:不删(后面的讲解还在讲它),改成一段说明,原句照旧底本引出
      dropped.push(blk.original.slice(0, 16)); nDrop++
      const BASE = slug === 'guwenguanzhi' ? '《古文观止》本' : '旧底本'
      for (const k of Object.keys(blk)) delete blk[k]
      Object.assign(blk, { type: 'p', text: `（${BASE}此处还有一段，统编版课本未选：「${dropped.at(-1).length < 16 ? '' : ''}${a.slice(s0, e0).join('')}」${''}）` })
      return true
    }
    let s = f[s0], e = f[e0]
    while (s < e && PUN.test(b[s])) s++
    blk.original = b.slice(s, e).join('')
    nQ++
    return true
  })
  // 关键字
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, `scripts/sources/guwen/textbook-diffs/diff-${slug}-${ch}.json`), 'utf8'))
  const pairs = (d.edits || []).map((e) => core(e.base, e.textbook)).filter(([o, t]) => o && t && o !== t)
  const before = JSON.stringify(art)
  const fixed = walk(art, (str) => pairs.reduce((acc, [o, t]) => acc.split(o).join(t), str))
  if (JSON.stringify(fixed) !== before) { nKw += pairs.filter(([o]) => before.includes(o)).length; Object.assign(art, fixed) }
  if (dropped.length) console.log(`  第 ${ch} 章 ${nc.title}:改说明段 ${dropped.length} 条(课本删去的部分)— ${dropped.join(' / ')}`)
}
let still = 0
for (const ch of Object.keys(tb)) {
  const nc = newBook.chapters.find((x) => String(x.no) === ch), t = nc.paragraphs.map((p) => p.original).join('')
  for (const blk of bh[ch]?.blocks || []) if (blk.type === 'quote' && blk.original && !t.includes(blk.original)) { still++; console.log(`  仍对不上 第 ${ch} 章:${blk.original.slice(0, 20)}`) }
}
if (WRITE) fs.writeFileSync(bf, JSON.stringify(bh, null, 2) + '\n')
console.log(`${slug}:引文对到新文 ${nQ} 条 · 改说明段 ${nDrop} 条 · 正文关键字替换 ${nKw} 组 · 仍对不上 ${still}${WRITE ? '' : ' [试跑]'}`)
