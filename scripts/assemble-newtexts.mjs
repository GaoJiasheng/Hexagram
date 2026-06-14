// 一次性装配脚本:把并发 workflow 产出(传习录/孝经/四十二章经 译注延)合并进数据文件。
// 用法: node scripts/assemble-newtexts.mjs <result.json>
// 产出:
//   - scripts/authored/<corpus>-translations.json  (合并新书 slug,章号→段译数组)
//   - src/data/<corpus>/zhushi-anchored/<slug>.json (锚定注疏,章号→局部段下标→条目)
//   - src/data/<corpus>/yanyi.json                  (合并新书 slug,章号→延伸段)
// 校验(对齐 check-data):term 须为原文子串(否则弃)、note≤40字(句读处截断)、同段锚点不重叠(重叠弃)、剔 ref。
// 区间单元(start/end):译文按 start+i 落位;zhushi 局部段下标 +start 还原全局。原文严禁改,只读取以校验 term。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resultPath = process.argv[2]
if (!resultPath) { console.error('用法: node scripts/assemble-newtexts.mjs <result.json>'); process.exit(1) }

const raw = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
const units = Array.isArray(raw) ? raw : raw.result
if (!Array.isArray(units)) { console.error('结果文件无 result 数组'); process.exit(1) }

const SENTINEL = '。，、；：！？「」『』（）·…—'  // 句读截断点

function truncNote(note) {
  const s = t2s(String(note || '')).trim()
  const arr = [...s]
  if (arr.length <= 40) return s
  const head = arr.slice(0, 40)
  for (let i = head.length - 1; i >= 8; i--) {
    if (SENTINEL.includes(head[i])) return head.slice(0, i).join('')  // 截到句读前
  }
  return head.join('')
}

// 读 classics 取原文(校验 term)
const classicsCache = {}
function chapters(corpus, slug) {
  const k = `${corpus}/${slug}`
  if (!classicsCache[k]) classicsCache[k] = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
  return classicsCache[k].chapters
}

// 累积容器:per corpus-slug
const trAcc = {}    // corpus -> slug -> {chNo: [seg...]}
const zhAcc = {}    // corpus -> slug -> {chNo: {globalIdx: [entry...]}}
const yyAcc = {}    // corpus -> slug -> {chNo: [para...]}
const stat = {}
const drop = { term: 0, note: 0, overlap: 0 }

for (const u of units) {
  const { corpus, book: slug, no, start = 0, data = {} } = u
  const chs = chapters(corpus, slug)
  const chapter = chs.find((c) => c.no === no)
  if (!chapter) { console.warn(`⚠ ${corpus}/${slug} 无第 ${no} 章,跳过单元`); continue }
  const paras = chapter.paragraphs
  const sk = `${corpus}/${slug}`
  stat[sk] ??= { tr: 0, zh: 0, yy: 0, chs: chapter ? chs.length : 0 }

  // 译文:tr[i] → 全局段 start+i
  trAcc[corpus] ??= {}; trAcc[corpus][slug] ??= {}
  const trArr = (trAcc[corpus][slug][no] ??= new Array(paras.length).fill(null))
  ;(data.translations || []).forEach((t, i) => {
    const g = start + i
    if (g < paras.length && t) { trArr[g] = t2s(String(t)); stat[sk].tr++ }
  })

  // 锚定注疏:局部段下标 +start;校验 term/note/overlap
  zhAcc[corpus] ??= {}; zhAcc[corpus][slug] ??= {}
  for (const [localIdx, entries] of Object.entries(data.zhushi || {})) {
    const g = start + Number(localIdx)
    const orig = paras[g]?.original
    if (orig == null || !Array.isArray(entries)) continue
    const ranges = []
    const kept = []
    for (const e of entries) {
      const term = t2s(String(e.term || ''))
      if (!term) { drop.term++; continue }
      const idx = orig.indexOf(term)
      if (idx < 0) { drop.term++; continue }
      const note = truncNote(e.note)
      if (!note) { drop.note++; continue }
      const range = [idx, idx + term.length]
      if (ranges.some((r) => range[0] < r[1] && r[0] < range[1])) { drop.overlap++; continue }
      ranges.push(range)
      const out = { term }
      if (e.reading && String(e.reading).trim()) out.reading = String(e.reading).trim()
      out.note = note
      kept.push(out)
    }
    if (kept.length) {
      zhAcc[corpus][slug][no] ??= {}
      zhAcc[corpus][slug][no][String(g)] = kept
      stat[sk].zh += kept.length
    }
  }

  // 延伸:per 章(仅 yanyi 单元)
  if (Array.isArray(data.yanyi) && data.yanyi.length) {
    yyAcc[corpus] ??= {}; yyAcc[corpus][slug] ??= {}
    yyAcc[corpus][slug][no] = data.yanyi.map((p) => t2s(String(p))).filter(Boolean)
    stat[sk].yy++
  }
}

// 写回(合并到既有文件)
function mergeJson(file, mutate) {
  const p = path.join(ROOT, file)
  const cur = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}
  mutate(cur)
  fs.writeFileSync(p, JSON.stringify(cur, null, 2) + '\n')
}

for (const corpus of Object.keys(trAcc)) {
  mergeJson(`scripts/authored/${corpus}-translations.json`, (cur) => {
    for (const [slug, byCh] of Object.entries(trAcc[corpus])) cur[slug] = byCh
  })
}
for (const corpus of Object.keys(zhAcc)) {
  for (const [slug, byCh] of Object.entries(zhAcc[corpus])) {
    fs.writeFileSync(path.join(ROOT, `src/data/${corpus}/zhushi-anchored/${slug}.json`), JSON.stringify(byCh, null, 2) + '\n')
  }
}
for (const corpus of Object.keys(yyAcc)) {
  mergeJson(`src/data/${corpus}/yanyi.json`, (cur) => {
    for (const [slug, byCh] of Object.entries(yyAcc[corpus])) cur[slug] = byCh
  })
}

console.log('装配完成。各书统计(译文段/注疏条/延伸章/总章):')
for (const [sk, s] of Object.entries(stat)) console.log(`  ${sk}: 译 ${s.tr} · 注 ${s.zh} · 延 ${s.yy}/${s.chs}`)
console.log(`丢弃锚点: term未命中 ${drop.term} · note空 ${drop.note} · 区间重叠 ${drop.overlap}`)
