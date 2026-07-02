// P1 富文本·只加粗 自驱编排(批式,单代理跑多章摊薄开销)。
// 用法:node scripts/bold-step.mjs [workflow.output|result.json]
// ① 应用上一批加粗(校验:精确子串/lead·p/每块≤2/≤40字/不落已加粗区)② check-data ③ commit
// ④ 算下一批「尚无 ** 的章」(已加粗或已尝试即跳过)⑤ gen 批式 workflow → 打印 LAUNCH/DONE
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 })

// 范围:易经 + 道藏(与审读一致)
const BOOKS = [
  ['yijing', 'hexagrams'], ['yijing', 'xici-shang'], ['yijing', 'xici-xia'], ['yijing', 'shuogua'], ['yijing', 'xugua'], ['yijing', 'zagua'],
  ['dao', 'daodejing'], ['dao', 'zhuangzi-neipian'], ['dao', 'zhuangzi-waipian'], ['dao', 'zhuangzi-zapian'], ['dao', 'liezi'], ['dao', 'wenzi'], ['dao', 'huangting'], ['dao', 'cantongqi'], ['dao', 'qingjingjing'], ['dao', 'ganyingpian'], ['dao', 'yinfujing'],
]
const BATCH = 15   // 每批章数(→ BATCH/CHUNK 个并发代理);受 workflow 脚本 512KB 上限约束,厚章约 22KB/章
const CHUNK = 5    // 每代理章数
const PROG = path.join(ROOT, 'scripts/.bold-progress.json')
const prog = fs.existsSync(PROG) ? JSON.parse(fs.readFileSync(PROG, 'utf8')) : {}

const hasBold = (a) => (a.blocks || []).some((b) => (b.type === 'lead' || b.type === 'p') && typeof b.text === 'string' && b.text.includes('**'))

// ── ① 应用加粗 ──
const inPath = process.argv[2]
if (inPath && fs.existsSync(inPath)) {
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'))
  const units = Array.isArray(raw) ? raw : Array.isArray(raw.result) ? raw.result : Array.isArray(raw.result?.result) ? raw.result.result : []
  const byFile = {}
  let applied = 0, rejected = 0, touched = 0
  for (const u of units) {
    if (!u || !u.bolds) continue
    const f = `src/data/${u.corpus}/baihua/${u.slug}.json`
    byFile[f] ??= JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    const ch = byFile[f][u.ch]
    if (!ch) continue
    let chTouched = false
    for (const item of u.bolds) {
      const b = ch.blocks?.[item.i]
      if (!b || (b.type !== 'lead' && b.type !== 'p') || typeof b.text !== 'string') { rejected += (item.spans || []).length; continue }
      let n = 0
      for (const span of item.spans || []) {
        if (n >= 2) { rejected++; continue }
        if (typeof span !== 'string' || !span.trim() || span.length > 40 || span.includes('**')) { rejected++; continue }
        const idx = b.text.indexOf(span)
        if (idx < 0) { rejected++; continue }
        const before = b.text.slice(0, idx)
        if (((before.match(/\*\*/g) || []).length % 2) !== 0) { rejected++; continue }
        b.text = before + '**' + span + '**' + b.text.slice(idx + span.length)
        applied++; n++; chTouched = true
      }
    }
    // 无论是否加到(0 加粗也算尝试过),记进度,防重复选中
    const key = `${u.corpus}/${u.slug}`
    prog[key] ??= []
    if (!prog[key].includes(String(u.ch))) prog[key].push(String(u.ch))
    if (chTouched) touched++
  }
  for (const [f, o] of Object.entries(byFile)) fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, 1) + '\n')
  fs.writeFileSync(PROG, JSON.stringify(prog) + '\n')
  console.error(`加粗 ${applied} 处 · 拒收 ${rejected} · 涉及 ${touched} 章`)
}

// ── ② check-data ──
let pass = false
try { pass = sh('npm run check-data 2>&1').includes('校验通过') } catch (e) { console.error((e.stdout || '').split('\n').filter((l) => l.includes('✗')).join('\n')) }
if (!pass) { console.error('check-data 未通过,中止'); process.exit(2) }

// ── ③ commit ──
if (inPath) {
  try {
    sh('git add -A')
    sh(`git commit -q -m "style(baihua): P1 富文本加粗批次(易+道,只标题眼不改字)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`)
    console.error('已提交')
  } catch { console.error('无变更可提交') }
}

// ── ④ 下一批(尚无 ** 且未尝试过的章)──
let total = 0, done = 0, next = null
for (const [corpus, slug] of BOOKS) {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))
  const doneList = prog[`${corpus}/${slug}`] || []
  const chs = Object.keys(book)
  total += chs.length
  const isDone = (c) => hasBold(book[c]) || doneList.includes(String(c))
  done += chs.filter(isDone).length
  if (!next) {
    const todo = chs.filter((c) => !isDone(c))
    if (todo.length) next = { corpus, slug, batch: todo.slice(0, BATCH) }
  }
}
console.error(`\n加粗进度: ${done}/${total} 章`)
if (!next) { console.log('DONE'); process.exit(0) }

// ── ⑤ gen ──
console.error(sh(`node ${ROOT}/scripts/gen-bold-batch-wf.mjs ${next.corpus} ${next.slug} ${next.batch.join(',')} ${CHUNK}`).trim())
console.log(`LAUNCH scripts/.bold-${next.corpus}-${next.slug}-wf.js`)
