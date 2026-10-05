// 古文课文改依课本后,白话里「站内第 N 段」一类段号引用按新分段重编(owner 2026-10-05):
//   node scripts/remap-baihua-pararefs.mjs <slug> [--write]
// 旧段 k 的首个保留字 → 新文里所在的段;只改 scripts/lib/para-refs.mjs 认得的那几种写法里的数字(阿拉伯/汉字各按原样式),
// 只碰 textbook.json 里那些章。旧段整段落在课本删去部分的,不改、列出来人工看。
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
const CN = '零一二三四五六七八九'
const cnNum = (g) => { if (/^[0-9０-９]+$/.test(g)) return Number(g.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))); let n = 0, cur = 0; for (const ch of g) { const d = CN.indexOf(ch === '〇' ? '零' : ch === '两' ? '二' : ch); if (d >= 0) cur = d; else if (ch === '十') { n += (cur || 1) * 10; cur = 0 } else if (ch === '百') { n += (cur || 1) * 100; cur = 0 } } return n + cur }
const toCn = (n) => n < 10 ? CN[n] : n < 20 ? '十' + (n % 10 ? CN[n % 10] : '') : CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '')
function align(a, b) {
  const n = a.length, m = b.length
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const to = new Int32Array(n).fill(-1)
  let i = 0, j = 0
  while (i < n && j < m) { if (a[i] === b[j]) { to[i] = j; i++; j++ } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++ }
  return to
}
const RE = /(?:(?:站内|本站|原文|本章|见|系于|在)\s*(?:卷一\s*)?第\s*([0-9０-９]+|[零〇一二两三四五六七八九十百]+)(?:\s*[–—至-]\s*([0-9０-９]+|[零〇一二两三四五六七八九十百]+))?\s*段|(?:站内|本站|原文|本章|见)\s*段\s*([0-9０-９]+)(?:\s*[–—-]\s*([0-9０-９]+))?|（第\s*([0-9０-９]+)\s*段）)/g
let changed = 0
const flagged = []
for (const ch of Object.keys(tb)) {
  const art = bh[ch]; if (!art) continue
  const op = oldBook.chapters.find((x) => String(x.no) === ch).paragraphs.map((p) => [...p.original])
  const np = newBook.chapters.find((x) => String(x.no) === ch).paragraphs.map((p) => [...p.original])
  const a = op.flat(), b = np.flat()
  const to = align(a, b)
  const newParaOf = []; np.forEach((p, k) => p.forEach(() => newParaOf.push(k + 1)))
  const oldStart = []; let acc = 0; op.forEach((p) => { oldStart.push(acc); acc += p.length })
  const map = (k) => {   // 旧段号(1 起)→ 新段号;整段无保留字 → null
    if (k < 1 || k > op.length) return null
    for (let x = oldStart[k - 1]; x < oldStart[k - 1] + op[k - 1].length; x++) if (to[x] >= 0 && !PUN.test(a[x])) return newParaOf[to[x]]
    return null
  }
  const fix = (s) => s.replace(RE, (whole, ...g) => whole.replace(/[0-9０-９]+|[零〇一二两三四五六七八九十百]+/g, (num) => {
    const o = cnNum(num), nw = map(o)
    if (nw === null) { flagged.push(`第 ${ch} 章:「${whole}」旧第 ${o} 段在课本删去部分`); return num }
    if (nw !== o) changed++
    return /^[0-9０-９]+$/.test(num) ? String(nw) : toCn(nw)
  }))
  const walk = (v, k) => Array.isArray(v) ? v.map((x) => walk(x)) : v && typeof v === 'object' ? (v.type === 'quote' || v.type === 'widget' ? v : Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, kk === 'svg' ? x : walk(x, kk)]))) : typeof v === 'string' ? fix(v) : v
  bh[ch] = walk(art)
}
if (WRITE) fs.writeFileSync(bf, JSON.stringify(bh, null, 2) + '\n')
console.log(`${slug}:段号改写 ${changed} 处${WRITE ? '' : ' [试跑]'}`)
for (const f of flagged) console.log('  ⚠', f)
