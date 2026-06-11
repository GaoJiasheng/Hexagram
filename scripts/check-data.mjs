// 数据校验:独立于抓取逻辑,从磁盘读取生成的数据文件做三层校验。
// 1) 结构:64 卦齐全、字段完整、binary 与上下卦一致、爻题与卦画阴阳互证
// 2) 内容抽查:若干已知原文片段必须存在(防解析错位/繁简事故)
// 3) 卦变自检:互/错/综的推演结果必须命中已知事实(如屯互剥、屯错鼎、屯综蒙)
// 错误 → 退出码 1;译文缺失等只作为信息项报告。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRIGRAMS, buildHexagramIndex, lineTitle } from './lib/hexagram-table.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const infos = []

function err(msg) {
  errors.push(msg)
}

// ---------- 读取 ----------
const hexagrams = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
const trigrams = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/trigrams.json'), 'utf8'))

// ---------- 1. 结构校验 ----------
if (hexagrams.length !== 64) err(`卦数应为 64,实为 ${hexagrams.length}`)

const index = buildHexagramIndex()
const byBinary = new Map()
const byId = new Map()

for (const h of hexagrams) {
  const ref = index.find((r) => r.id === h.id)
  if (!ref) {
    err(`未知卦序: ${h.id}`)
    continue
  }
  if (byId.has(h.id)) err(`卦序重复: ${h.id}`)
  byId.set(h.id, h)
  if (byBinary.has(h.binary)) err(`binary 重复: ${h.binary}`)
  byBinary.set(h.binary, h)

  if (h.name !== ref.name) err(`#${h.id} 卦名 ${h.name} 与基准表 ${ref.name} 不符`)
  if (h.binary !== ref.binary) err(`#${h.id} ${h.name} binary ${h.binary} 与基准表 ${ref.binary} 不符`)
  if (!/^[01]{6}$/.test(h.binary)) err(`#${h.id} binary 非法: ${h.binary}`)

  const lower = TRIGRAMS[h.lowerTrigram]
  const upper = TRIGRAMS[h.upperTrigram]
  if (!lower || !upper) err(`#${h.id} 上下卦 key 非法`)
  else if (lower.binary + upper.binary !== h.binary) err(`#${h.id} binary 与上下卦组成不一致`)

  for (const field of ['fullName', 'pinyin', 'summary', 'imagery']) {
    if (!h[field]) err(`#${h.id} ${h.name} 缺 ${field}`)
  }
  for (const field of ['judgment', 'tuan', 'daxiang']) {
    if (!h[field]?.original) err(`#${h.id} ${h.name} 缺 ${field}.original`)
  }
  if (h.summary && h.summary.length > 14) err(`#${h.id} summary 超过 14 字: ${h.summary}`)

  if (!Array.isArray(h.lines) || h.lines.length !== 6) {
    err(`#${h.id} ${h.name} 爻数应为 6`)
    continue
  }
  h.lines.forEach((line, i) => {
    const expected = lineTitle(i + 1, h.binary[i] === '1')
    if (line.title !== expected) err(`#${h.id} ${h.name} 第 ${i + 1} 爻题 ${line.title},按卦画应为 ${expected}`)
    if (!line.original) err(`#${h.id} ${h.name} ${line.title} 缺爻辞`)
    if (!line.xiaoxiang?.original) err(`#${h.id} ${h.name} ${line.title} 缺小象`)
  })

  if (h.id === 1 || h.id === 2) {
    if (!h.extra?.use?.original) err(`#${h.id} ${h.name} 缺用九/用六`)
    if (!h.extra?.wenyan?.length) err(`#${h.id} ${h.name} 缺文言`)
    const expectUse = h.id === 1 ? '用九' : '用六'
    if (h.extra?.use?.title !== expectUse) err(`#${h.id} use.title 应为 ${expectUse}`)
  } else if (h.extra !== null) {
    err(`#${h.id} ${h.name} 不应有 extra`)
  }
}

// ---------- 2. 内容抽查(已知原文片段) ----------
const SPOT_CHECKS = [
  [1, 'judgment', '元亨'],
  [1, 'daxiang', '天行健'],
  [2, 'daxiang', '厚德载物'],
  [2, 'judgment', '利牝马之贞'],
  [3, 'judgment', '利建侯'],
  [15, 'daxiang', '地中有山'],
  [63, 'daxiang', '水在火上'],
]
for (const [id, field, fragment] of SPOT_CHECKS) {
  const h = byId.get(id)
  if (h && !h[field]?.original?.includes(fragment)) {
    err(`抽查失败: #${id} ${h?.name} ${field} 应含「${fragment}」,实为: ${h?.[field]?.original?.slice(0, 30)}`)
  }
}
const h3 = byId.get(3)
if (h3 && !h3.lines[0].original.includes('磐桓')) err('抽查失败: 屯初九应含「磐桓」')
// 繁简转换事故哨兵(经传文件在下方读取后并入)
let corpus = JSON.stringify(hexagrams)

// ---------- 3. 卦变自检 ----------
const flip = (b) => [...b].map((c) => (c === '1' ? '0' : '1')).join('')
const hu = (b) => b.slice(1, 4) + b.slice(2, 5) // 互卦:2,3,4 爻为下卦,3,4,5 爻为上卦
const zong = (b) => [...b].reverse().join('')
const nameOf = (b) => byBinary.get(b)?.name ?? `?${b}`

const DERIVATION_CHECKS = [
  ['互卦', hu, 3, '剥'],
  ['互卦', hu, 1, '乾'],
  ['错卦', flip, 3, '鼎'],
  ['错卦', flip, 1, '坤'],
  ['综卦', zong, 3, '蒙'],
  ['综卦', zong, 11, '否'],
  ['综卦', zong, 1, '乾'],
]
for (const [kind, fn, id, expected] of DERIVATION_CHECKS) {
  const h = byId.get(id)
  if (!h) continue
  const got = nameOf(fn(h.binary))
  if (got !== expected) err(`卦变自检失败: ${h.name} 的${kind}应为 ${expected},实得 ${got}`)
}

// ---------- 4. 经传文件 ----------
const BOOKS = [
  ['xici-shang', 12],
  ['xici-xia', 9], // 维基文库底本按孔颖达九章分;若换底本需同步调整
  ['shuogua', 11],
  ['xugua', 1],
  ['zagua', 1],
]
for (const [key, minChapters] of BOOKS) {
  const file = path.join(ROOT, `src/data/yijing/classics/${key}.json`)
  if (!fs.existsSync(file)) {
    err(`缺经传文件: ${key}.json`)
    continue
  }
  const book = JSON.parse(fs.readFileSync(file, 'utf8'))
  corpus += JSON.stringify(book)
  if (!book.chapters?.length || book.chapters.length < minChapters) {
    err(`${key} 章数 ${book.chapters?.length ?? 0},应不少于 ${minChapters}`)
  }
  for (const c of book.chapters ?? []) {
    if (!c.paragraphs?.length) err(`${key} 第 ${c.no} 章无段落`)
    for (const p of c.paragraphs ?? []) if (!p.original) err(`${key} 第 ${c.no} 章有空段落`)
  }
}

// 繁简转换事故哨兵(覆盖 64 卦 + 经传全文)
for (const bad of ['干道', '干卦', '干元', '遯', '無', '當', '見', '龍']) {
  if (corpus.includes(bad)) err(`正文残留繁体/误转字: ${bad}`)
}

// ---------- 5. 信息项 ----------
const translated = hexagrams.filter((h) => h.judgment?.translation).length
infos.push(`译文覆盖: ${translated}/64 卦(其余待补,见 scripts/authored/translations.json)`)
if (trigrams.length !== 8) err(`经卦应为 8,实为 ${trigrams.length}`)

// ---------- 输出 ----------
for (const i of infos) console.log('ℹ', i)
if (errors.length) {
  console.error(`\n✗ 校验失败,${errors.length} 个错误:`)
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}
console.log(`✓ 校验通过:64 卦结构完整,内容抽查与卦变自检全部命中`)
