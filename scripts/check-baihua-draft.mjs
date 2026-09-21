// 白话草稿自查(2026-09-21):给 workflow 里的起草/校对代理用,一条命令核完装配器与 check-data 会卡的那几样。
// 起因同 check-unit.mjs:代理每多一轮工具调用就要重读十几万 token 上下文,而轮数大半花在摸数据结构、读校验脚本上。
//   node scripts/check-baihua-draft.mjs <corpus> <slug> <章号> <draft.json>
//   draft.json = 与白话 schema 同形的一个对象 {title, subtitle, centralIdea, blocks:[…]}
// 判据与 scripts/assemble-baihua.mjs / check-data 的 checkBaihua 一致;只读不写。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateWidget } from '../src/features/shared/widgets/schema.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, slug, no, file] = process.argv.slice(2)
if (!corpus || !slug || !no || !file) { console.log('用法: node scripts/check-baihua-draft.mjs <corpus> <slug> <章号> <draft.json>'); process.exit(2) }
const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
const ch = book.chapters.find((c) => c.no === Number(no))
if (!ch) { console.log(`✗ ${corpus}/${slug} 没有第 ${no} 章`); process.exit(2) }
const text = ch.paragraphs.map((p) => p.original).join('')
const d = JSON.parse(fs.readFileSync(file, 'utf8'))
const blocks = Array.isArray(d.blocks) ? d.blocks : []
const bad = [], soft = []
for (const k of ['title', 'centralIdea']) if (!String(d[k] || '').trim()) bad.push(`缺 ${k}`)
if (!blocks.some((b) => b.type === 'h2')) bad.push('没有 h2 小节标题')
const isCJK = (c) => c >= '一' && c <= '鿿'
const han = (s) => [...String(s)].filter(isCJK).join('')
const H = han(text)
let nq = 0
blocks.forEach((b, i) => {
  const at = `blocks[${i}](${b.type}${b.kind ? ':' + b.kind : ''})`
  if (b.type === 'quote') {
    nq++
    const q = String(b.original || '')
    if (!q) return bad.push(`${at} 没有 original`)
    if (text.includes(q)) return
    const hq = han(q)
    if (hq.length >= 4 && H.includes(hq)) return soft.push(`${at} 只是标点与原文不同(装配器会按汉字回吸,可不改):「${q.slice(0, 18)}…」`)
    let n = hq.length
    while (n > 3 && !H.includes(hq.slice(0, n))) n--
    bad.push(`${at} original 不是本章原文的子串:「${q.slice(0, 24)}…」` + (n > 3 ? ` —— 前 ${n} 个字对得上,第 ${n + 1} 个字「${hq[n] || ''}」起对不上` : ' —— 开头就对不上(是不是引了别章的话?)'))
    if (!String(b.translation || '').trim()) bad.push(`${at} 没有 translation`)
  }
  if (b.type === 'figure') {
    const svg = String(b.svg || '')
    if (!svg) bad.push(`${at} 没有 svg`)
    if (!/viewBox/.test(svg)) bad.push(`${at} svg 缺 viewBox`)
    if (/#[0-9a-fA-F]{3,8}\b/.test(svg)) bad.push(`${at} svg 写死了颜色 ${svg.match(/#[0-9a-fA-F]{3,8}\b/)[0]},只许 var(--…)/currentColor`)
    if (/\sfill="var\(|\sstroke="var\(/.test(svg)) bad.push(`${at} svg 用了 fill="var(…)" 属性——presentation 属性不认 var(),须写 style="fill:var(--x)"`)
    if (!String(b.caption || '').trim()) bad.push(`${at} 缺 caption`)
  }
  if (b.type === 'widget') {
    const errs = validateWidget(b)
    const pz = b.kind === 'sizhu' && Array.isArray(b.props?.pillars) ? b.props.pillars : null
    const foreign = pz ? pz.filter((gz) => !text.includes(gz)) : []
    if (errs.length) bad.push(`${at} 参数不合法:${errs.join(';')}`)
    if (foreign.length) bad.push(`${at} 四柱里的 ${foreign.join(' ')} 不见于本章原文——不许自编命例`)
  }
  if ((b.type === 'list' || b.type === 'callout') && !(b.items || []).length) bad.push(`${at} 是空的`)
  if (b.type === 'steps' && !((b.steps || b.items || []).length)) bad.push(`${at} 是空的`)
  if (b.type === 'callout' && b.label && [...b.label].length > 12) bad.push(`${at} label 超 12 字——label 是短签,整句话请放回 items`)
  if (b.type === 'pull' && !String(b.text || '').trim()) bad.push(`${at} 没有 text`)
})
if (nq < 1) bad.push('全篇没有一条 quote')
const pulls = blocks.filter((b) => b.type === 'pull').length
if (pulls > 1) bad.push(`pull 有 ${pulls} 处,每章至多 1 处`)
if (blocks.length && blocks[blocks.length - 1].type !== 'refs') soft.push('末尾不是 refs 块')
const chars = blocks.reduce((a, b) => a + [...String(b.text || '')].length + (b.items || []).join('').length + [...String(b.translation || '')].length, 0)
console.log((bad.length ? `✗ ${bad.length} 处要改:\n- ` + bad.join('\n- ') : `✓ 硬项全过:${nq} 条引文 · ${blocks.filter((b) => b.type === 'figure').length} 图 · ${blocks.filter((b) => b.type === 'widget').length} 件 · 正文约 ${chars} 字`)
  + (soft.length ? `\n(提示,不必为此再跑一轮)\n- ` + soft.join('\n- ') : ''))
process.exit(bad.length ? 1 : 0)
