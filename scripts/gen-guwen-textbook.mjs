// 古文组「课文按课本」(owner 2026-10-05):把逐篇对校结果合成课本文本 → scripts/sources/guwen/textbook.json,
// fetch-corpus 的 textbookOverride 据此替换两本书里课本收录的篇。
//
//   node scripts/gen-guwen-textbook.mjs [--diffs=<目录>]   (默认 scripts/sources/guwen/textbook-diffs)
//
// 对校结果(一篇一个 diff-<book>-<no>.json)由代理对着国家中小学智慧教育平台公开的统编版电子课本页图,
// 逐字逐标点比对本站底本后写出,**只记差异**:edits(底本片段 → 课本片段)、excerpt(课本节选的首尾)、
// paragraphStarts(课本各段开头)。本脚本把差异施加到底本上得出课本文本——不手打、不凭记忆。
// 施加规则全部从严:片段须在本篇恰好出现一次、首尾与段首须依次命中,任何一条对不上整篇作废并报错。
// 底本取「尚未被课本替换」的章(章上没有 textbook 字段);已替换过的篇不再重算,要重算先删 textbook.json 里那篇再重抓。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv.find((a) => a.startsWith('--diffs='))
const DIR = arg ? path.resolve(arg.slice(8)) : path.join(ROOT, 'scripts/sources/guwen/textbook-diffs')
const OUT = path.join(ROOT, 'scripts/sources/guwen/textbook.json')
const book = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/guwen/classics/${slug}.json`), 'utf8'))
const books = { guwenguanzhi: book('guwenguanzhi'), kewen: book('kewen') }
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const count = (s, sub) => { let n = 0, i = -1; while ((i = s.indexOf(sub, i + 1)) !== -1) n++; return n }

let ok = 0
const errs = []
const report = []
for (const f of fs.readdirSync(DIR).filter((x) => /^diff-.+\.json$/.test(x)).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  const c = books[d.book]?.chapters.find((x) => x.no === d.no)
  const fail = (m) => errs.push(`${f}(${d.siteTitle}):${m}`)
  if (!c) { fail('找不到章'); continue }
  if (c.textbook) { report.push({ f, d, skipped: true }); continue }
  if (d.siteTitle && c.title !== d.siteTitle) { fail(`章题不符「${c.title}」`); continue }
  let text = c.paragraphs.map((p) => p.original).join('\n')
  let bad = false
  for (const e of d.edits || []) {
    const n = count(text, e.base)
    if (n !== 1) { fail(`改动片段「${e.base}」在底本出现 ${n} 次`); bad = true; break }
    text = text.replace(e.base, e.textbook)
  }
  if (bad) continue
  const flat = text.replace(/\n/g, '')
  const s = flat.indexOf(d.excerpt?.startsWith || '')
  const eAt = flat.lastIndexOf(d.excerpt?.endsWith || '')
  if (s === -1 || eAt === -1 || eAt < s) { fail(`节选首尾找不到(首「${d.excerpt?.startsWith}」尾「${d.excerpt?.endsWith}」)`); continue }
  const body = flat.slice(s, eAt + d.excerpt.endsWith.length)
  const starts = d.paragraphStarts || []
  const cut = []
  let from = 0
  for (const ps of starts) {
    const at = body.indexOf(ps, from)
    if (at === -1) { fail(`段首「${ps}」找不到`); bad = true; break }
    cut.push(at); from = at + 1
  }
  if (bad) continue
  if (cut[0] !== 0) { fail(`首段段首不在节选开头`); continue }
  const paragraphs = cut.map((at, i) => body.slice(at, cut[i + 1] ?? body.length))
  if (paragraphs.join('') !== body) { fail('分段后拼不回原文'); continue }
  out[d.book] ||= {}
  out[d.book][String(d.no)] = {
    siteTitle: c.title, title: d.textbookTitle, volume: d.volume, printedPage: d.printedPage,
    sourceNote: d.sourceNote, paragraphs,
  }
  report.push({ f, d, before: c.paragraphs.map((p) => p.original).join(''), after: body })
  ok++
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(`课本文本:${ok} 篇写入 ${path.relative(ROOT, OUT)}`)
for (const r of report.filter((x) => !x.skipped)) {
  const cut = r.before.length - r.after.length
  console.log(`  ${r.d.siteTitle} ← ${r.d.volume} ${r.d.textbookTitle}:改 ${(r.d.edits || []).length} 处,${cut > 0 ? `节选去 ${cut} 字` : '全篇'},${(r.d.paragraphStarts || []).length} 段${(r.d.uncertain || []).length ? `,存疑 ${r.d.uncertain.length}` : ''}`)
}
for (const e of errs) console.error('✗', e)
if (errs.length) process.exit(1)
