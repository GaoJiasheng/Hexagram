#!/usr/bin/env node
// 观象 · 书桌 —— 插画 prompt 预备 ①:把「还没出图、也还没有现成 prompt」的每一张,备成写手代理的输入单元。
//   node scripts/desk/art-prompts-prep.mjs <guanshu|classics> [--only <book,…>] [--per 12] [--clean]
// 输出 scripts/.cache/desk-art/prompts/<set>/in/uNNN.json:
//   {set, book, title, category, used:[本书已出图的 CHOSEN 句], items:[{id:"<book>/<stem>", kind, brief}]}
//   brief = 今天给 Codex 的指令去掉「出图」那一步(画风句 + 材料 + 这张图是什么 + 怎么设计 + 全部硬规矩,另给版式句 / 收尾句原文),
//   由两个出图脚本的 briefFor() 生成,材料截取与长度上限和出图时完全一样。
// 观书一本书一个单元(该书全部待出的图在一起,写手好让它们彼此不同);古籍封面 + 横幅进该书第一个单元,各章每 --per 章一个单元。
// 另写 <set>/args.json(Workflow 参数)。out/ 里若还有没 apply 的结果则拒跑(先 apply;或 --clean 连 out 一起清掉)。
// 流程:prep → Workflow(art-prompts-wf.js,写手写 out 并自查)→ art-prompts-apply.mjs → 出图脚本见 .ready.txt 即只出图。
import fs from 'node:fs'
import path from 'node:path'
import { setOf, setDir, has, usedOf, unitId, ROOT } from './art-prompts-sets.mjs'

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d }
const setName = argv[0]
if (!setName || setName.startsWith('--')) { console.error('用法:node scripts/desk/art-prompts-prep.mjs <guanshu|classics> [--only <book,…>] [--per 12] [--clean]'); process.exit(1) }
const S = setOf(setName)
const per = Math.max(1, +opt('--per', 12))
const only = opt('--only') ? new Set(opt('--only').split(',').map((s) => s.trim()).filter(Boolean)) : null
const base = setDir(setName), inDir = path.join(base, 'in'), outDir = path.join(base, 'out')

const pendingOut = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.json')) : []
if (pendingOut.length && !argv.includes('--clean')) {
  console.error(`${path.relative(ROOT, outDir)} 里还有 ${pendingOut.length} 个没 apply 的结果。先跑 node scripts/desk/art-prompts-apply.mjs ${setName};确定不要了再加 --clean。`)
  process.exit(1)
}
fs.rmSync(inDir, { recursive: true, force: true })
if (argv.includes('--clean')) fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(inDir, { recursive: true }); fs.mkdirSync(outDir, { recursive: true })

const books = S.books()
if (only) for (const b of only) if (!books.includes(b)) { console.error(`未知书 ${b}`); process.exit(1) }
const units = [], skipped = []
let images = 0, chars = 0, readyAlready = 0, doneAlready = 0
for (const id of books) {
  if (only && !only.has(id)) continue
  let bk
  try { bk = S.load(id) } catch (e) { skipped.push(`${id}(${e.code || e.message.slice(0, 60)})`); continue }
  const dir = S.dir(id)
  const pending = []
  for (const j of S.jobs(bk)) {
    if (has(dir, j.stem, '.png')) { doneAlready++; continue }
    if (has(dir, j.stem, '.ready.txt')) { readyAlready++; continue }
    pending.push(j)
  }
  if (!pending.length) continue
  const item = (j) => ({ id: `${id}/${j.stem}`, kind: j.kind, brief: S.brief(bk, j.kind, j.ch) })
  const head = { set: setName, book: id, title: S.title(bk), category: S.category(bk), used: usedOf(dir) }
  let groups
  if (setName === 'guanshu') groups = [pending]
  else {
    const covers = pending.filter((j) => j.kind !== 'head'), heads = pending.filter((j) => j.kind === 'head')
    groups = []
    for (let i = 0; i < heads.length; i += per) groups.push(heads.slice(i, i + per))
    if (covers.length) { if (groups.length) groups[0] = [...covers, ...groups[0]]; else groups.push(covers) }
  }
  for (const g of groups) {
    const u = { ...head, items: g.map(item) }
    images += u.items.length; chars += u.items.reduce((a, x) => a + x.brief.length, 0)
    units.push(u)
  }
}
units.forEach((u, i) => fs.writeFileSync(path.join(inDir, `${unitId(i)}.json`), JSON.stringify({ unit: unitId(i), ...u }, null, 1)))
const ids = units.map((_, i) => unitId(i))
fs.writeFileSync(path.join(base, 'args.json'), JSON.stringify({ root: ROOT, set: setName, ids }, null, 1))
console.log(`${setName}:${new Set(units.map((u) => u.book)).size} 本书、${units.length} 个单元、${images} 张待写 prompt,brief 共 ${chars.toLocaleString('en')} 字符(平均 ${images ? Math.round(chars / images) : 0}/张)`)
console.log(`  已出图 ${doneAlready} 张、已有现成 prompt ${readyAlready} 张,都跳过`)
if (skipped.length) console.log(`  读不出材料、跳过的书:${skipped.join('、')}`)
console.log(`  输入 ${path.relative(ROOT, inDir)}/u001…${ids.at(-1) || ''};Workflow 参数 ${path.relative(ROOT, path.join(base, 'args.json'))}`)
