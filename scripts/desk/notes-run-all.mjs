#!/usr/bin/env node
// 详注 · 全站连跑(docs/xiangzhu-spec.md §4、§6)。按 §6 的顺序一本一本跑:
//   notes-prep → notes-codex 起草 → notes-codex --verify 核查 → notes-apply → npm run check-data(不过即整轮停)
//   node scripts/desk/notes-run-all.mjs --list                       列计划:每本原文字数、还缺详注的字数、合计
//   node scripts/desk/notes-run-all.mjs [--only dao/liezi,ru/mengzi] [--from fo/xinjing] [--concurrency 5] [--size 1300] [--dry]
// · 书单从各组 texts.json 与易经数据派生(scripts/lib/xiangzhu.mjs 的 allBooks),已全覆盖的书跳过。
// · 可中断续跑:每本书走到哪一步记在 scripts/.desk-notes/run-all.json 的 state;再跑时从断处接(起草 / 核查本身也跳过已做完的单元)。
//   每本书跑完往同一文件的 log 里追加一条统计(单元数、条数、密度、Codex tokens、用时、核查改动数)。
// · Codex 连续 3 个单元失败(限流 / 额度)→ notes-codex 退出码 3 → 整轮干净地停下,不往下烧书单。
// · 不碰 git。
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ROOT, allBooks, parseBookId, loadBook, bookChars, chaptersMissing, len } from '../lib/xiangzhu.mjs'

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const LIST = argv.includes('--list')
const DRY = argv.includes('--dry')
const CONC = Number(opt('concurrency', 5)) || 5
const SIZE = Number(opt('size', 1300)) || 1300
const ONLY = opt('only', '') ? opt('only', '').split(',').map((s) => s.trim()).filter(Boolean) : null
const FROM = opt('from', '')
for (const s of [...(ONLY || []), ...(FROM ? [FROM] : [])]) if (!parseBookId(s)) { console.error(`✗ 书名写法不对:${s}(应为 <corpus>/<slug>)`); process.exit(2) }

const STATE_FILE = path.join(ROOT, 'scripts/.desk-notes/run-all.json')
const loadState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { state: {}, log: [] })
const db = loadState()
db.state ||= {}; db.log ||= []
const save = () => { fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(db, null, 1) + '\n') }

// ── 计划
let plan = allBooks()
const all = plan.map((b) => b.id)
for (const s of [...(ONLY || []), ...(FROM ? [FROM] : [])]) if (!all.includes(s)) { console.error(`✗ 书单里没有 ${s}`); process.exit(2) }
if (ONLY) plan = plan.filter((b) => ONLY.includes(b.id))
if (FROM) plan = plan.slice(plan.findIndex((b) => b.id === FROM))
const info = (b) => {
  const book = loadBook(b.corpus, b.slug)
  const miss = chaptersMissing(b.corpus, b.slug)
  return { ...b, title: book?.title || b.slug, chars: bookChars(b.corpus, b.slug), missChars: miss.reduce((a, c) => a + c.segs.reduce((x, s) => x + len(s.o), 0), 0), missCh: miss.length, chapters: book?.chapters.filter((c) => c.segs.length).length || 0 }
}

if (LIST) {
  const rows = plan.map(info)
  const w = Math.max(...rows.map((r) => r.id.length))
  rows.forEach((r, i) => {
    const st = r.missCh === 0 ? '已全覆盖' : r.missCh === r.chapters ? '' : `缺 ${r.missCh}/${r.chapters} 章`
    console.log(`${String(i + 1).padStart(3)}  ${r.id.padEnd(w)}  ${r.title.padEnd(10, ' ')}  ${String(r.chars).padStart(7)} 字  ${r.missCh ? String(r.missChars).padStart(7) + ' 字待注' : ''}  ${st}`)
  })
  const tot = rows.reduce((a, r) => a + r.chars, 0), todo = rows.reduce((a, r) => a + r.missChars, 0)
  console.log(`\n共 ${rows.length} 本 · 原文 ${tot} 字 · 已全覆盖 ${rows.filter((r) => !r.missCh).length} 本 · 待注 ${rows.filter((r) => r.missCh).length} 本 ${todo} 字`)
  const top = [...rows].sort((a, b) => b.chars - a.chars).slice(0, 10)
  console.log(`最大的十本:${top.map((r) => `${r.id}(${r.title})${r.chars}`).join(' · ')}`)
  process.exit(0)
}

const run = (cmd, args) => new Promise((resolve) => {
  if (DRY) { console.log(`  [dry] ${cmd} ${args.join(' ')}`); return resolve(0) }
  const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' })
  p.on('close', (code) => resolve(code ?? 1))
})
const S = (p) => path.join('scripts/desk', p)
const readStats = (dir, f) => { const p = path.join(dir, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null }
const stop = (msg, code = 1) => { console.log(`\n■ ${msg}`); save(); process.exit(code) }

let ran = 0
for (const b of plan) {
  const i0 = info(b)
  if (!i0.missCh) { console.log(`- ${b.id}《${i0.title}》已全覆盖,跳过`); continue }
  const dir = path.join(ROOT, 'scripts/.desk-notes', `${b.corpus}--${b.slug}`)
  const st = db.state[b.id] ||= {}
  const t0 = Date.now()
  console.log(`\n══ ${b.id}《${i0.title}》 原文 ${i0.chars} 字 · 待注 ${i0.missCh} 章 ${i0.missChars} 字`)
  // 只有上一轮停在 prep 之后、apply 之前才接着用旧的 in/ out/;否则重新备料
  const resume = ['prepped', 'drafted', 'verified'].includes(st.step) && fs.existsSync(path.join(dir, 'args.json'))
  if (!resume) {
    const c = await run('node', [S('notes-prep.mjs'), b.id, '--size', String(SIZE)])
    if (c) stop(`${b.id} 备料失败(退出码 ${c}),整轮停`)
    if (!DRY) { Object.assign(st, { step: 'prepped', at: new Date().toISOString(), tokens: 0, sec: 0 }); delete st.verifyChanged; save() }
  } else console.log(`  接着上一轮(停在 ${st.step})`)
  const args = DRY ? { ids: [] } : JSON.parse(fs.readFileSync(path.join(dir, 'args.json'), 'utf8'))
  if (!DRY && !args.ids.length) { st.step = 'done'; save(); continue }

  let c = await run('node', [S('notes-codex.mjs'), b.id, '--concurrency', String(CONC)])
  const ds = DRY ? null : readStats(dir, 'codex-draft-stats.json')
  if (ds) { st.tokens = (st.tokens || 0) + ds.tokens; st.draftTokens = (st.draftTokens || 0) + ds.tokens }
  if (c === 3) stop(`${b.id} 起草时 Codex 连续失败,整轮停(再跑本脚本即从这本接着做)`, 3)
  if (!DRY) { st.step = 'drafted'; st.draftFailed = ds?.fail || 0; save() }

  c = await run('node', [S('notes-codex.mjs'), b.id, '--verify', '--concurrency', String(CONC)])
  const vs = DRY ? null : readStats(dir, 'codex-verify-stats.json')
  if (vs) { st.tokens = (st.tokens || 0) + vs.tokens; st.verifyTokens = (st.verifyTokens || 0) + vs.tokens }
  if (c === 3) stop(`${b.id} 核查时 Codex 连续失败,整轮停(再跑本脚本即从这本接着做)`, 3)
  if (!DRY) { st.step = 'verified'; save() }

  c = await run('node', [S('notes-apply.mjs'), b.id])
  if (c) stop(`${b.id} 合并失败(退出码 ${c}),整轮停`)
  if (!DRY) { st.step = 'applied'; save() }

  c = await run('npm', ['run', '--silent', 'check-data'])
  if (c) stop(`${b.id} 并入后 check-data 未过,整轮停——先修好再跑`)
  if (DRY) continue

  // 统计
  const as = readStats(dir, 'apply-stats.json') || {}
  const vstate = readStats(dir, 'verify-state.json') || {}
  const vv = Object.values(vstate)
  const left = chaptersMissing(b.corpus, b.slug).length
  const entry = {
    book: b.id, title: i0.title, at: new Date().toISOString(),
    units: args.ids.length, chars: args.chars, notes: as.kept || 0, density: as.density || 0, dropped: as.dropped || 0,
    tokens: st.tokens || 0, draftTokens: st.draftTokens || 0, verifyTokens: st.verifyTokens || 0,
    sec: Math.round((Date.now() - t0) / 1000),
    draftFailed: st.draftFailed || 0,
    verifyChanged: vv.reduce((a, v) => a + (v.changed || 0), 0),
    verifyBefore: vv.reduce((a, v) => a + (v.before || 0), 0),
    verifyRestored: vv.filter((v) => v.status === 'restored').length,
    verifyFailed: vv.filter((v) => v.status === 'failed').length,
    chaptersLeft: left,
  }
  db.log.push(entry)
  st.step = left ? 'partial' : 'done'
  save()
  ran++
  console.log(`  ✓ ${b.id}:${entry.units} 单元 · ${entry.notes} 条 · 每百字 ${entry.density} · tokens ${entry.tokens} · ${entry.sec}s · 核查改动 ${entry.verifyChanged}/${entry.verifyBefore}${left ? ` · 仍缺 ${left} 章(失败单元,再跑即补)` : ''}`)
}
console.log(`\n完成:本轮跑了 ${ran} 本${DRY ? '(dry)' : ''}`)
