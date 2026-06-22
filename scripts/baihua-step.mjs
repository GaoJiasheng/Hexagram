// 白话通宵自驱编排(串行,单 workflow ~16 并发已是 API 上限,严禁并行多 workflow)。
// 用法: node scripts/baihua-step.mjs <workflow-result.json>
//   ① 装配该 result → ② check-data(坏引文已在装配处丢弃,应恒过)→ ③ 提交
//   ④ 算下一批(道→儒→佛→阳明 顺序,跳已完成/已 3 次失败的章)→ ⑤ gen 出下一个 workflow 脚本
//   末行打印 `LAUNCH <scriptPath>`(让我 Workflow 起它)或 `DONE`(全部完成)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' })

const CORPORA = ['dao']   // owner 2026-06-22:阶段2 道升级加厚(**只道德经** 81 章,见 gen THICK_BOOKS;庄子/参同契等维持原普通档,已从 git 恢复)
const CAP = 14                                // 每批最多章数→单 workflow 并发(实际同时跑数由 runtime 封顶 min(16,核数-2))。owner 2026-06-22:经传短章轻、白天 quota 宽,提到 14;有坏引文丢块+3 次重试+断点续跑兜底,撞限流可恢复
const MAXATT = 3                              // 单章最多重试次数(防顽固章死循环)
const ATT_FILE = path.join(ROOT, 'scripts/.baihua-attempts.json')

const resultPath = process.argv[2]

// ── ① 装配 ──
if (resultPath && fs.existsSync(resultPath)) {
  try {
    sh(`node ${ROOT}/scripts/assemble-baihua.mjs "${resultPath}"`)
  } catch (e) {
    console.error('装配出错:', e.stdout || e.message)
  }
}

// ── ② check-data ──
let pass = false
try {
  const out = sh('npm run check-data 2>&1')
  pass = out.includes('校验通过')
  const m = out.match(/白话覆盖:[^\n]*/)
  if (m) console.error(m[0])
} catch (e) {
  console.error('check-data 失败:\n', (e.stdout || '').split('\n').filter((l) => l.includes('✗') || l.includes('白话')).join('\n'))
  process.exit(2)
}
if (!pass) { console.error('check-data 未通过,中止(需人工查)'); process.exit(2) }

// ── ③ 提交本批 ──
if (resultPath && fs.existsSync(resultPath)) {
  try {
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
    const units = (Array.isArray(result) ? result : result.result || []).filter((u) => u && u.data)
    const nos = units.map((u) => u.no)
    const books = [...new Set(units.map((u) => `${u.corpus}/${u.book}`))].join(',')
    const subject = `feat(baihua): ${books} 白话 ${Math.min(...nos)}–${Math.max(...nos)}(产出 ${units.length} 章,落盘以 check-data 为准)`
    sh('git add -A')
    try {
      sh(`git commit -q -m ${JSON.stringify(subject)} -m ${JSON.stringify('Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')}`)
      console.error('已提交:', subject)
    } catch { console.error('提交跳过(无变更)') }
  } catch (e) { console.error('提交步骤出错:', e.message) }
}

// ── ④ 算下一批 ──
const att = fs.existsSync(ATT_FILE) ? JSON.parse(fs.readFileSync(ATT_FILE, 'utf8')) : {}
let totalDone = 0, totalAll = 0, next = null
const gaps = []   // 报告:已 3 次失败、放弃的章
for (const corpus of CORPORA) {
  // 各 corpus 的书目→章号列表;易经形态不同(hexagrams.json 64 卦,slug 固定 hexagrams)
  let books
  if (corpus === 'yijing') {
    const hexes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
    books = [{ slug: 'hexagrams', nos: hexes.map((q) => q.id) }]
    // 经传/十翼(章序即处理序:系辞上→系辞下→说卦→序卦→杂卦)
    for (const jz of ['xici-shang', 'xici-xia', 'shuogua', 'xugua', 'zagua']) {
      const cf = path.join(ROOT, `src/data/yijing/classics/${jz}.json`)
      if (fs.existsSync(cf)) books.push({ slug: jz, nos: JSON.parse(fs.readFileSync(cf, 'utf8')).chapters.map((c) => c.no) })
    }
  } else {
    const texts = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/texts.json`), 'utf8')).filter((t) => t.status === 'done')
    books = texts.map((t) => ({ slug: t.slug, nos: JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${t.slug}.json`), 'utf8')).chapters.map((c) => c.no) }))
  }
  for (const b of books) {
    const bp = path.join(ROOT, `src/data/${corpus}/baihua/${b.slug}.json`)
    const bh = fs.existsSync(bp) ? JSON.parse(fs.readFileSync(bp, 'utf8')) : {}
    totalAll += b.nos.length
    totalDone += b.nos.filter((no) => String(no) in bh).length
    const missing = b.nos.filter((no) => !(String(no) in bh))
    for (const no of missing) {
      const k = `${corpus}/${b.slug}#${no}`
      if ((att[k] || 0) >= MAXATT) gaps.push(k)
    }
    if (!next) {
      const tryable = missing.filter((no) => (att[`${corpus}/${b.slug}#${no}`] || 0) < MAXATT)
      if (tryable.length) next = { corpus, slug: b.slug, batch: tryable.slice(0, CAP) }
    }
  }
}
console.error(`\n进度: ${totalDone}/${totalAll} 章白话` + (gaps.length ? `  放弃(≥${MAXATT}次失败): ${gaps.join(', ')}` : ''))

if (!next) { console.log('DONE'); process.exit(0) }

// 记一次尝试
for (const no of next.batch) {
  const k = `${next.corpus}/${next.slug}#${no}`
  att[k] = (att[k] || 0) + 1
}
fs.writeFileSync(ATT_FILE, JSON.stringify(att, null, 0) + '\n')

// ── ⑤ gen 下一个 workflow 脚本 ──
const from = next.batch[0], to = next.batch[next.batch.length - 1]
try {
  const out = sh(`node ${ROOT}/scripts/gen-baihua-wf.mjs ${next.corpus} ${next.slug} ${from} ${to}`)
  console.error(out.trim())
} catch (e) { console.error('gen 出错:', e.stdout || e.message); process.exit(3) }
console.log(`LAUNCH scripts/.baihua-${next.corpus}-${next.slug}-wf.js`)
