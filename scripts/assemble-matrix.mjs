// 装配《穷通宝鉴》调候矩阵(design-v23 §7):把提取代理交来的逐格记录校验后落盘。
//   node scripts/assemble-matrix.mjs <记录文件.json> [更多记录文件…]
// 产出 src/data/mingli/matrix/qiongtong.json。
//
// **每格必须有原文子串为证**(同争鸣 cite 校验)——不凭记忆填。校验不过的格**整格丢弃并报出**,
// 宁可矩阵上空一格,也不落一条对不上原文的数据。check-data 里有同一套校验守着落盘后的文件。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMatrixCell, MATRIX_MONTHS } from './lib/mingli-matrix.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const book = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/classics/qiongtong.json'), 'utf8'))

const files = process.argv.slice(2)
if (!files.length) { console.error('用法: node scripts/assemble-matrix.mjs <记录文件.json> …'); process.exit(1) }

const seen = new Map()
const dropped = []
for (const f of files) {
  for (const rec of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const errs = validateMatrixCell(rec, book)
    const key = `${rec.gan}|${rec.month}`
    if (seen.has(key)) errs.push('重复的格')
    if (errs.length) { dropped.push({ key, errs }); continue }
    seen.set(key, rec)
  }
}

const cells = []
const missing = []
for (const g of GAN) for (const m of MATRIX_MONTHS) {
  const rec = seen.get(`${g}|${m}`)
  if (!rec) { missing.push(`${g}|${m}`); continue }
  const { gan, month, para, shared, yong, quote, quotePara, gist, unsure } = rec
  cells.push({ gan, month, para, ...(shared ? { shared } : {}), yong, quote, quotePara, gist, ...(unsure ? { unsure } : {}) })
}

fs.mkdirSync(path.join(ROOT, 'src/data/mingli/matrix'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'src/data/mingli/matrix/qiongtong.json'), JSON.stringify({ book: 'qiongtong', cells }, null, 1) + '\n')
console.log(`落盘 ${cells.length}/120 格 · 丢弃 ${dropped.length} · 缺 ${missing.length} · 标 unsure ${cells.filter((c) => c.unsure).length}`)
for (const d of dropped) console.log('  ✗ 丢弃', d.key, '—', d.errs.join(';'))
if (missing.length) console.log('  缺格:', missing.join(' '))
