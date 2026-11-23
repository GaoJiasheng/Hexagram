#!/usr/bin/env node
// 观象 · 书桌 —— 插画 prompt 预备 ③:把写手代理的结果过一遍自查,合格的写成出图脚本认的现成 prompt。
//   node scripts/desk/art-prompts-apply.mjs <guanshu|classics>
// 每个 out/uNNN.json 重跑 art-prompts-check 的全部规则;合格的那张写到出图缓存目录 <book>/<stem>.ready.txt
// (与出图后存的 .txt 同一 IMAGERY / CHOSEN / PROMPT 版式);整单元都合格的,in + out 挪到 applied/<时间>/ 存档。
// 末了打印覆盖:该套待出图里有现成 prompt 的 / 还缺的。
import fs from 'node:fs'
import path from 'node:path'
import { setOf, setDir, has } from './art-prompts-sets.mjs'
import { checkUnit, readUnit, report } from './art-prompts-check.mjs'

const setName = process.argv[2]
if (!setName) { console.error('用法:node scripts/desk/art-prompts-apply.mjs <guanshu|classics>'); process.exit(1) }
const S = setOf(setName)
const base = setDir(setName), outDir = path.join(base, 'out'), inDir = path.join(base, 'in')

function readyText(o) {
  return `IMAGERY:\n${o.imagery.map((x, i) => `${i + 1}. ${x.replace(/\s+/g, ' ').trim()}`).join('\n')}\n\nCHOSEN: ${o.chosen.replace(/\s+/g, ' ').trim()}\n\nPROMPT: ${o.prompt.replace(/\s+/g, ' ').trim()}\n`
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outs = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => /^u\d+\.json$/.test(f)).sort() : []
let wrote = 0, rejected = 0, archived = 0
for (const f of outs) {
  const unit = f.slice(0, -5)
  if (!fs.existsSync(path.join(inDir, f))) { console.log(`? ${unit}:没有对应的 in 文件,跳过`); continue }
  const { input, output, err } = readUnit(setName, unit)
  if (err) { console.log(`✗ ${unit}:${err}`); rejected += input.items.length; continue }
  const res = checkUnit(input, output)
  for (const it of input.items) {
    if (res.items[it.id]?.length) { rejected++; continue }
    const [book, stem] = it.id.split('/')
    const dir = S.dir(book)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, `${stem}.ready.txt`), readyText(output[it.id]))
    wrote++
  }
  const lines = report(res)
  if (lines.length) console.log(`${unit}(${input.book}):\n  ${lines.join('\n  ')}`)
  if (res.ok) {
    const dest = path.join(base, 'applied', stamp)
    fs.mkdirSync(dest, { recursive: true })
    fs.renameSync(path.join(outDir, f), path.join(dest, `out-${f}`))
    fs.renameSync(path.join(inDir, f), path.join(dest, `in-${f}`))
    archived++
  }
}
console.log(`写入现成 prompt ${wrote} 张;没过自查 ${rejected} 张(留在 out/,改好再 apply);整单元存档 ${archived} 个`)

// 覆盖
let pending = 0, ready = 0, books = 0, missingBooks = 0
for (const id of S.books()) {
  let bk
  try { bk = S.load(id) } catch { continue }
  const dir = S.dir(id)
  const p = S.jobs(bk).filter((j) => !has(dir, j.stem, '.png'))
  if (!p.length) continue
  const r = p.filter((j) => has(dir, j.stem, '.ready.txt')).length
  pending += p.length; ready += r; books++; if (r < p.length) missingBooks++
}
console.log(`覆盖(${setName}):待出图 ${pending} 张(${books} 本),有现成 prompt ${ready} 张,还缺 ${pending - ready} 张(${missingBooks} 本)`)

