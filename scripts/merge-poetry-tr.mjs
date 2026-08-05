// 把 scratchpad 里逐章/逐片写好的诗词曲译注,合并成 assemble-newtexts.mjs 吃的那种 result 数组。
//
// 为什么要这一步:agent 是一章一文件写的(撞额度只丢正在写的那一章),而
// assemble-newtexts **按 slug 整体覆写**译文/注疏/延伸 —— 同一 slug 分批装配会
// 用后一批覆盖前一批(CLAUDE.md 记的诗经教训)。故必须先合并成一份、再一次性装配。
//
// 用法: node scripts/merge-poetry-tr.mjs <corpus> <slug> [out.json]
//   读 <scratch>/poetry-tr/<corpus>-<章号>.json    (一章一文件,形状 {corpus,book,no,start,end,data})
//   另认 <scratch>/poetry-tr/p[A-Z].json           (长章分片,形状 {tr:{绝对下标:译文}, zs:{绝对下标:[…]}})
//        —— 分片属哪一章由 --chapter 指定,合并后按 start=0 落位。
import fs from 'node:fs'
import path from 'node:path'

const SCRATCH = process.env.POETRY_SCRATCH
  || '/private/tmp/claude-501/-Users-gavin-work-hexagram/83d952e9-395f-4178-b8ce-8d2fc7542c00/scratchpad/poetry-tr'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const [corpus, slug, out = '/tmp/poetry-result.json'] = process.argv.slice(2)
if (!corpus || !slug) { console.error('用法: node scripts/merge-poetry-tr.mjs <corpus> <slug> [out.json]'); process.exit(1) }

const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
const chapters = new Map(book.chapters.map((c) => [c.no, c]))
const units = []
const errs = []

// ① 一章一文件
for (const f of fs.readdirSync(SCRATCH).filter((f) => new RegExp(`^${corpus}-\\d+\\.json$`).test(f))) {
  const u = JSON.parse(fs.readFileSync(path.join(SCRATCH, f), 'utf8'))
  units.push(u)
}
// ② 长章分片(p*.json)——需 --chapter=N 指明属哪一章
const chArg = process.argv.find((a) => a.startsWith('--chapter='))
if (chArg) {
  const no = Number(chArg.split('=')[1])
  const parts = fs.readdirSync(SCRATCH).filter((f) => /^p[A-Z]\.json$/.test(f)).sort()
  if (parts.length) {
    const tr = {}, zs = {}
    for (const f of parts) {
      const p = JSON.parse(fs.readFileSync(path.join(SCRATCH, f), 'utf8'))
      for (const [k, v] of Object.entries(p.tr || {})) {
        if (k in tr) errs.push(`分片下标重复 ${no}#${k}(${f})`)
        tr[k] = v
      }
      for (const [k, v] of Object.entries(p.zs || {})) zs[k] = v
    }
    const n = chapters.get(no).paragraphs.length
    const translations = []
    for (let i = 0; i < n; i++) {
      if (!(String(i) in tr)) { errs.push(`章 ${no} 缺第 ${i} 段译文`); translations.push('') }
      else translations.push(tr[String(i)])
    }
    units.push({ corpus, book: slug, no, start: 0, end: n - 1, data: { translations, zhushi: zs, yanyi: [] } })
  }
}

// 校验:段数对齐、章齐、term 子串(assemble 自己也校,这里先报出来便于定位)
const seen = new Set()
for (const u of units) {
  const c = chapters.get(u.no)
  if (!c) { errs.push(`无第 ${u.no} 章`); continue }
  if (seen.has(u.no)) errs.push(`章 ${u.no} 重复`)
  seen.add(u.no)
  const paras = c.paragraphs.slice(u.start, u.end + 1)
  const tr = u.data.translations
  if (tr.length !== paras.length) errs.push(`章 ${u.no}: 译文 ${tr.length} 段 ≠ 原文 ${paras.length} 段`)
  for (const [k, arr] of Object.entries(u.data.zhushi || {})) {
    const o = paras[Number(k)]?.original ?? ''
    for (const e of arr) if (!o.includes(e.term)) errs.push(`章 ${u.no} 段 ${k}: term「${e.term}」不是原文子串`)
  }
}
const missing = book.chapters.map((c) => c.no).filter((n) => !seen.has(n))

units.sort((a, b) => a.no - b.no)
fs.writeFileSync(out, JSON.stringify(units, null, 0))
console.log(`合并 ${units.length} 章 → ${out}`)
if (missing.length) console.log(`⚠ 尚缺 ${missing.length} 章: ${missing.slice(0, 20).join(',')}${missing.length > 20 ? '…' : ''}`)
if (errs.length) { console.log(`✗ ${errs.length} 处问题:`); errs.slice(0, 15).forEach((e) => console.log('   ' + e)); process.exit(1) }
console.log('✓ 段数对齐、term 全部命中')
