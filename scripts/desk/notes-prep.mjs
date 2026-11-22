#!/usr/bin/env node
// 详注生产 · 备料(docs/xiangzhu-spec.md §4)。按站内的书跑,直接读 src/data。
//   node scripts/desk/notes-prep.mjs <corpus>/<slug> [--size 1300]
//   例:dao/qingjingjing · yijing/hexagrams · yijing/xici-shang
// · 跳过真源 src/data/<corpus>/xiangzhu/<slug>.json 里已有详注的章(可续跑)。
// · 切单元:按章凑成每单元约 --size 个原文字(默认 1300);一章太长就按段切;一段决不拆开(一段就超长的,自成一个单元)。
//   原文为空的段不进单元。
// · 每个 item:ch 章号 · chTitle 章题 · seg 段下标(卦为部位键)· label(卦的部位中文名)· o 原文 · t 站内译文 · old 该段已有简注。
// · 产出 scripts/.desk-notes/<corpus>--<slug>/in/uNNN.json 与 args.json({dir, book, ids} → notes-codex.mjs,或交 Workflow scripts/desk/notes-wf.js)。
//   上一轮的 out/ 若还有文件,整个挪到 out-<时间>/ 存档(单元编号每轮重排,旧输出与新输入对不上)。
import fs from 'node:fs'
import path from 'node:path'
import { redlines } from '../lib/baihua-redlines.mjs'
import { ROOT, parseBookId, loadBook, readTruth, oldNotes, len } from '../lib/xiangzhu.mjs'

const argv = process.argv.slice(2)
const id = parseBookId(argv.find((a) => !a.startsWith('--')))
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const SIZE = Number(opt('size', 1300)) || 1300
if (!id) { console.error('用法: node scripts/desk/notes-prep.mjs <corpus>/<slug> [--size 1300]'); process.exit(2) }
const book = loadBook(id.corpus, id.slug)
if (!book) { console.error(`✗ ${id.id}:站内没有这本书的原文数据`); process.exit(2) }

const done = readTruth(id.corpus, id.slug)
const old = oldNotes(id.corpus, id.slug)
const WORK = path.join(ROOT, 'scripts/.desk-notes', `${id.corpus}--${id.slug}`)
fs.rmSync(path.join(WORK, 'in'), { recursive: true, force: true })
fs.mkdirSync(path.join(WORK, 'in'), { recursive: true })
const outDir = path.join(WORK, 'out')
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  fs.renameSync(outDir, path.join(WORK, `out-${stamp}`))
  for (const f of ['verify-state.json', 'codex-failed.json', 'codex-draft-stats.json', 'codex-verify-stats.json']) if (fs.existsSync(path.join(WORK, f))) fs.renameSync(path.join(WORK, f), path.join(WORK, `out-${stamp}`, f))
  console.log(`  上一轮的 out/ 已挪到 ${path.relative(ROOT, WORK)}/out-${stamp}/`)
}
fs.mkdirSync(outDir, { recursive: true })

const units = []
let cur = [], curChars = 0, skipped = 0
const flush = () => { if (cur.length) { units.push(cur); cur = []; curChars = 0 } }
for (const c of book.chapters) {
  if (done[String(c.no)] && Object.keys(done[String(c.no)]).length) { skipped++; continue }
  const items = c.segs.map((s) => {
    const o0 = old[String(c.no)]?.[String(s.seg)]
    return {
      ch: c.no, chTitle: c.title, seg: s.seg,
      ...(book.hexagram ? { label: s.label } : {}),
      o: s.o,
      ...(s.t ? { t: s.t } : {}),
      ...(o0?.length ? { old: o0 } : {}),
    }
  })
  if (!items.length) continue
  const n = items.reduce((a, x) => a + len(x.o), 0)
  if (n > SIZE * 1.6) {                       // 一章太长:按段切成几个单元(段不拆)
    flush()
    for (const it of items) { if (curChars > 0 && curChars + len(it.o) > SIZE) flush(); cur.push(it); curChars += len(it.o) }
    flush()
  } else {
    if (curChars > 0 && curChars + n > SIZE) flush()
    cur.push(...items); curChars += n
  }
}
flush()
const redline = redlines(id.slug)[id.corpus] || ''
const ids = units.map((u, i) => {
  const uid = `u${String(i + 1).padStart(3, '0')}`
  fs.writeFileSync(path.join(WORK, 'in', `${uid}.json`), JSON.stringify({ book: book.title, corpus: id.corpus, slug: id.slug, redline, chars: u.reduce((a, x) => a + len(x.o), 0), items: u }, null, 1))
  return uid
})
const chars = units.flat().reduce((a, x) => a + len(x.o), 0)
fs.writeFileSync(path.join(WORK, 'args.json'), JSON.stringify({ dir: WORK, book: book.title, corpus: id.corpus, slug: id.slug, ids, chars }))
console.log(`${id.id}《${book.title}》:${ids.length} 个单元 · 待注 ${chars} 字 · 已有详注的章 ${skipped} → ${path.relative(ROOT, WORK)}/args.json`)
