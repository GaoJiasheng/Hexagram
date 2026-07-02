// P1 打磨自驱编排(串行,同 baihua-step 模式)。用法:node scripts/polish-step.mjs [workflow-result.json]
// ① 应用 result 的编辑(带校验:禁 quote/越界/截断/星号不配对)② check-data ③ commit
// ④ 按书序算下一批(进度记 scripts/.polish-progress.json)⑤ gen 下一个 workflow → 打印 LAUNCH/DONE
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 })

// 书序:重点三件套(易64卦→经传→道德经)→ 道藏其余
const BOOKS = [
  ['yijing', 'hexagrams'], ['yijing', 'xici-shang'], ['yijing', 'xici-xia'], ['yijing', 'shuogua'], ['yijing', 'xugua'], ['yijing', 'zagua'],
  ['dao', 'daodejing'], ['dao', 'zhuangzi-neipian'], ['dao', 'zhuangzi-waipian'], ['dao', 'zhuangzi-zapian'], ['dao', 'liezi'], ['dao', 'wenzi'], ['dao', 'huangting'], ['dao', 'cantongqi'], ['dao', 'qingjingjing'], ['dao', 'ganyingpian'], ['dao', 'yinfujing'],
]
const CAP = 10
const PROG = path.join(ROOT, 'scripts/.polish-progress.json')
const prog = fs.existsSync(PROG) ? JSON.parse(fs.readFileSync(PROG, 'utf8')) : {}

// ── ① 应用编辑 ──
const resultPath = process.argv[2]
if (resultPath && fs.existsSync(resultPath)) {
  const raw = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
  const units = Array.isArray(raw) ? raw : raw.result || []
  const byFile = {}
  let applied = 0, rejected = 0, skipped = 0
  for (const u of units) {
    if (!u || !u.edits) { skipped++; continue }
    const f = `src/data/${u.corpus}/baihua/${u.slug}.json`
    byFile[f] ??= JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    const ch = byFile[f][u.ch]
    if (!ch) { skipped++; continue }
    let ok = 0
    for (const e of u.edits) {
      const b = ch.blocks?.[e.i]
      if (!b || b.type === 'quote') { rejected++; continue }
      if (e.field === 'caption' && b.type !== 'figure') { rejected++; continue }
      if (e.field === 'text' && b.text === undefined) { rejected++; continue }
      const old = e.field === 'caption' ? b.caption : b.text
      if (typeof e.text !== 'string' || !e.text.trim()) { rejected++; continue }
      if (old && (e.text.length < old.length * 0.25 || e.text.length > old.length * 2.5)) { rejected++; continue } // 防截断/注水
      if (((e.text.match(/\*\*/g) || []).length % 2) !== 0) { rejected++; continue } // 星号须配对
      if (e.field === 'caption') b.caption = e.text; else b.text = e.text
      ok++
    }
    applied += ok
    const key = `${u.corpus}/${u.slug}`
    prog[key] ??= []
    if (!prog[key].includes(String(u.ch))) prog[key].push(String(u.ch))
  }
  for (const [f, o] of Object.entries(byFile)) fs.writeFileSync(path.join(ROOT, f), JSON.stringify(o, null, 1) + '\n')
  fs.writeFileSync(PROG, JSON.stringify(prog) + '\n')
  console.error(`应用编辑 ${applied} 处 · 拒收 ${rejected} · 跳过 ${skipped} 单元`)
}

// ── ② check-data ──
let pass = false
try { pass = sh('npm run check-data 2>&1').includes('校验通过') } catch (e) { console.error((e.stdout || '').split('\n').filter((l) => l.includes('✗')).join('\n')) }
if (!pass) { console.error('check-data 未通过,中止'); process.exit(2) }

// ── ③ commit ──
if (resultPath) {
  try {
    sh('git add -A')
    sh(`git commit -q -m "style(baihua): P1 打磨批次(去口癖/开头/免责/加粗)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"`)
    console.error('已提交')
  } catch { console.error('无变更可提交') }
}

// ── ④ 下一批 ──
let total = 0, done = 0, next = null
for (const [corpus, slug] of BOOKS) {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))
  const chs = Object.keys(book)
  total += chs.length
  const doneList = prog[`${corpus}/${slug}`] || []
  done += chs.filter((c) => doneList.includes(String(c))).length
  if (!next) {
    const todo = chs.filter((c) => !doneList.includes(String(c)))
    if (todo.length) next = { corpus, slug, batch: todo.slice(0, CAP) }
  }
}
console.error(`\n打磨进度: ${done}/${total} 章`)
if (!next) { console.log('DONE'); process.exit(0) }

// ── ⑤ gen ──
console.error(sh(`node ${ROOT}/scripts/gen-polish-wf.mjs ${next.corpus} ${next.slug} ${next.batch.join(',')}`).trim())
console.log(`LAUNCH scripts/.polish-${next.corpus}-${next.slug}-wf.js`)
