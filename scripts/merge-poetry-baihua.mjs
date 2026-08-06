// 把 scratchpad 里逐首写好的诗级白话,合并进 src/data/<corpus>/baihua/<slug>.json。
//
// 为什么要这一步:agent 是一首一文件写的(撞额度只丢正在写的那首),而站内白话是
// 「一书一文件、键为章键」的形状。**scratchpad 是会话级临时目录,换 session 就没了**
// —— 所以每做完一批就要合进仓库,不能把成果留在 /tmp 里过夜。
//
// 用法: node scripts/merge-poetry-baihua.mjs <corpus> <slug> [scratch子目录名]
//   scratch 子目录默认 poetry-bh(唐诗);宋词/元曲各用 poetry-bh-songci / poetry-bh-yuanqu,
//   分开是因为唐诗的键是「组-序」、词曲是纯章号,混在一个目录里文件名会撞。
//   扫 /private/tmp/claude-501/<项目>/*/scratchpad/poetry-bh/<键>.json(多会话目录一起收,
//   同键取字数多的那份),校引文子串后合并进仓库,**保留已在库的其它键**。
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const [corpus, slug, dirName = 'poetry-bh'] = process.argv.slice(2)
if (!corpus || !slug) { console.error('用法: node scripts/merge-poetry-baihua.mjs <corpus> <slug>'); process.exit(1) }

const SCRATCH_GLOB = '/private/tmp/claude-501'
const dirs = []
for (const proj of fs.existsSync(SCRATCH_GLOB) ? fs.readdirSync(SCRATCH_GLOB) : []) {
  const base = path.join(SCRATCH_GLOB, proj)
  if (!fs.statSync(base).isDirectory()) continue
  for (const sess of fs.readdirSync(base)) {
    const d = path.join(base, sess, 'scratchpad', dirName)
    if (fs.existsSync(d)) dirs.push(d)
  }
}

const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
const isTitle = (s) => /^《[^》]+》$/.test(s.trim())
// 「组-序」键 → 那一首诗的原文(引文校验池,与 check-data 同一套判据)
function poemText(key) {
  // 纯章号(宋词/元曲:一首即一章)——整章即校验池
  if (/^\d+$/.test(key)) {
    const c = book.chapters.find((x) => x.no === Number(key))
    return c ? c.paragraphs.map((p) => p.original).join('') : null
  }
  const m = /^(\d+)-(\d+)$/.exec(key)
  if (!m) return null
  const c = book.chapters.find((x) => x.no === Number(m[1]))
  if (!c) return null
  const heads = c.paragraphs.map((p, i) => (isTitle(p.original) ? i : -1)).filter((i) => i >= 0)
  const s = heads[Number(m[2]) - 1]
  if (s === undefined) return null
  const e = heads[Number(m[2])] ?? c.paragraphs.length
  return c.paragraphs.slice(s, e).map((p) => p.original).join('')
}

const han = (s) => (s.match(/[一-鿿]/g) || []).length
const picked = new Map()
for (const d of dirs) {
  for (const f of fs.readdirSync(d).filter((x) => /^\d+(-\d+)?\.json$/.test(x))) {
    const key = f.replace(/\.json$/, '')
    let a
    try { a = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) } catch { console.warn(`⚠ ${f} 解析失败,跳过`); continue }
    const n = han(JSON.stringify(a))
    const prev = picked.get(key)
    if (!prev || prev.n < n) picked.set(key, { a, n, from: path.join(d, f) })
  }
}

// 逐篇独立判定:**有问题的那几篇跳过、其余照收**。
// 早先是全有全无(一篇不合格整批不写盘),批量作业里这会把几十篇合格的稿子一起挡在门外,
// 得不偿失 —— 跳过的键会打印出来,也会留在 TODO 的缺口清单里,不会被悄悄吞掉。
const errs = []
const skipped = []
const out = {}
for (const [key, { a, n }] of [...picked].sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))) {
  const bad = []
  const txt = poemText(key)
  if (txt == null) { bad.push(`${key}: 站内无此键(卷或序号越界)`); continue }
  if (a.key && a.key !== key) bad.push(`${key}: 文件内 key=${a.key} 与文件名不符`)
  if (n < 2000) bad.push(`${key}: 仅 ${n} 字`)
  const blocks = a.blocks || []
  const figs = blocks.filter((b) => b.type === 'figure')
  if (figs.length < 3) bad.push(`${key}: 图仅 ${figs.length} 张`)
  if (blocks.filter((b) => b.type === 'pull').length > 1) bad.push(`${key}: pull 超 1 处`)
  for (const b of figs) {
    if (/(fill|stroke)\s*=\s*['"]var\(/.test(b.svg || '')) bad.push(`${key}: SVG 用了 fill="var(…)" 属性写法`)
    if (/#[0-9a-fA-F]{6}/.test(b.svg || '')) bad.push(`${key}: SVG 写死了 #hex`)
  }
  for (const b of blocks) {
    if (b.type === 'quote' && !txt.includes(b.original)) bad.push(`${key}: 引文不在本诗内「${b.original.slice(0, 14)}…」`)
    // callout 的两条:check-data 也校,在这里先挡住,免得坏稿落库后再回头修
    // (**label 按原始长度算、含空格** —— 曾按「非空白字符数」判而漏掉「令 · 引 · 近 · 慢」)
    if (b.type === 'callout') {
      if (!Array.isArray(b.items) || !b.items.length) bad.push(`${key}: callout 无 items(正文别写在 text 字段)`)
      if (b.label && b.label.length > 8) bad.push(`${key}: callout.label 过长(${b.label.length} 字)「${b.label}」`)
    }
  }
  if (bad.length) { skipped.push(key); errs.push(...bad); continue }
  const { key: _k, ...rest } = a
  out[key] = rest
}

const dst = path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`)
const cur = fs.existsSync(dst) ? JSON.parse(fs.readFileSync(dst, 'utf8')) : {}
const merged = { ...cur, ...out }
// 按「组-序」数值序排,便于 diff
const sorted = {}
for (const k of Object.keys(merged).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) sorted[k] = merged[k]

if (errs.length) {
  console.log(`⚠ ${skipped.length} 篇未收(${skipped.join(', ')}),原因:`)
  errs.slice(0, 20).forEach((e) => console.log('   ' + e))
}
fs.mkdirSync(path.dirname(dst), { recursive: true })
fs.writeFileSync(dst, JSON.stringify(sorted, null, 2) + '\n')
const nPoem = book.chapters.reduce((n, c) => n + c.paragraphs.filter((p) => isTitle(p.original)).length, 0)
const total = nPoem || book.chapters.length   // 有《诗题》段的按首数,否则一章即一首
console.log(`✓ 合并 ${Object.keys(out).length} 篇(库中共 ${Object.keys(sorted).length}/${total})→ ${dst.replace(ROOT + '/', '')}`)
console.log(`  扫描目录 ${dirs.length} 个`)
