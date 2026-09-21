// 译注延单元自查(2026-09-21):给 workflow 里的译/校代理用,一条命令核完「条数 · 断句逐字 · 注疏锚点 · 延伸条数」。
// 起因:三命通会卷六实跑,每个代理平均 9–16 轮工具调用,大半花在摸数据结构、自己写比对脚本上;
// 每一轮都要重读十几万 token 的上下文。给一把现成的尺子,轮数能压到三四轮。
//   node scripts/check-unit.mjs <corpus> <book> <spec> <draft.json>
//   spec = 章:起-止[,章:起-止…](合包按包内次序列;段下标 0 起、闭区间),如 106:0-0,107:0-0
//   draft.json = {translations, punctuated?, zhushi, yanyi}(zhushi 的 key 是包内连续下标)
// 判据与装配器一致(scripts/lib/punct-layer.mjs · assemble-newtexts.mjs);只读不写。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { core, validPunctuated } from './lib/punct-layer.mjs'
import { t2s } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, book, spec, file] = process.argv.slice(2)
if (!corpus || !book || !spec || !file) { console.log('用法: node scripts/check-unit.mjs <corpus> <book> <章:起-止,…> <draft.json>'); process.exit(2) }
const data = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${book}.json`), 'utf8'))
const draft = JSON.parse(fs.readFileSync(file, 'utf8'))
const paras = []
const parts = spec.split(',').map((s) => { const m = s.match(/^(\d+):(\d+)-(\d+)$/); if (!m) { console.log('spec 写错了:' + s); process.exit(2) } return { no: +m[1], from: +m[2], to: +m[3] } })
for (const p of parts) {
  const ch = data.chapters.find((c) => c.no === p.no)
  if (!ch) { console.log(`✗ 没有第 ${p.no} 章`); process.exit(2) }
  for (let i = p.from; i <= p.to; i++) paras.push({ no: p.no, i, p: ch.paragraphs[i] })
}
const N = paras.length
const bad = []
const tr = draft.translations || []
if (tr.length !== N) bad.push(`translations 条数 ${tr.length},应为 ${N}`)
tr.forEach((t, k) => { if (k < N && !String(t || '').trim() && !paras[k].p.pillars && core(paras[k].p.original).length > 12) bad.push(`translations[${k}] 是空的(原文「${paras[k].p.original.slice(0, 14)}…」)`) })
const pu = draft.punctuated
if (pu) {
  if (pu.length !== N) bad.push(`punctuated 条数 ${pu.length},应为 ${N}`)
  pu.forEach((s, k) => {
    if (k >= N || paras[k].p.pillars) return
    const a = [...core(t2s(String(s || '')))], b = [...core(paras[k].p.original)]
    if (validPunctuated(t2s(String(s || '')), paras[k].p.original)) return
    let d = 0
    while (d < a.length && d < b.length && a[d] === b[d]) d++
    bad.push(`punctuated[${k}] 与底本不逐字相等:第 ${d} 个字起不同 —— 你的「${a.slice(Math.max(0, d - 6), d + 8).join('')}」/ 底本「${b.slice(Math.max(0, d - 6), d + 8).join('')}」` + (a.length !== b.length ? `(字数 ${a.length} vs ${b.length})` : ''))
  })
}
for (const [key, arr] of Object.entries(draft.zhushi || {})) {
  const k = Number(key)
  if (!(k >= 0 && k < N)) { bad.push(`zhushi key "${key}" 越界(应在 0..${N - 1})`); continue }
  const base = pu && pu[k] ? t2s(String(pu[k])) : paras[k].p.original
  if ((arr || []).length > 4) bad.push(`zhushi["${key}"] 有 ${arr.length} 条,至多 4 条`)
  const ranges = []
  for (const e of arr || []) {
    const term = t2s(String(e.term || ''))
    const at = base.indexOf(term)
    if (!term || at < 0) { bad.push(`zhushi["${key}"] term「${e.term}」不是该段的精确子串`); continue }
    if ([...String(e.note || '')].length > 40) bad.push(`zhushi["${key}"]「${e.term}」note 超 40 字(${[...e.note].length})`)
    if (ranges.some((r) => at < r[1] && r[0] < at + term.length)) bad.push(`zhushi["${key}"]「${e.term}」与同段另一条重叠`)
    ranges.push([at, at + term.length])
  }
}
const yy = draft.yanyi || []
if (parts.length > 1 && yy.length !== parts.length) bad.push(`yanyi 条数 ${yy.length},合包应恰为 ${parts.length}(一篇一条)`)
console.log(bad.length ? `✗ ${bad.length} 处要改:\n- ` + bad.join('\n- ') : `✓ 全过:${N} 段 · 译文/断句/注疏锚点/延伸条数 都对`)
process.exit(bad.length ? 1 : 0)
