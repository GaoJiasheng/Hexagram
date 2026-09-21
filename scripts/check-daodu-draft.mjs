// 书级导读草稿自查(2026-09-21):与 check-data 的 daodu 段同一套判据,给写导读的代理用,只读不写。
//   node scripts/check-daodu-draft.mjs <corpus> <slug> <draft.json>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, slug, file] = process.argv.slice(2)
if (!corpus || !slug || !file) { console.log('用法: node scripts/check-daodu-draft.mjs <corpus> <slug> <draft.json>'); process.exit(2) }
const a = JSON.parse(fs.readFileSync(file, 'utf8'))
const blocks = Array.isArray(a.blocks) ? a.blocks : []
const bad = [], soft = []
if (!a.title) bad.push('缺 title')
if (!a.centralIdea) bad.push('缺 centralIdea')
if (blocks.filter((b) => b.type === 'h2').length < 4) bad.push('h2 分节少于 4')
if (blocks.filter((b) => b.type === 'pull').length > 1) bad.push('pull 超过 1 处')
const banned = blocks.filter((b) => ['callout', 'list', 'steps'].includes(b.type))
if (banned.length) bad.push(`用了 ${banned.map((b) => b.type).join('/')} 块——本体裁是散文,这三种一律不用`)
const cache = {}
blocks.forEach((b, i) => {
  if (b.type === 'quote') {
    if (!b.original) return bad.push(`blocks[${i}] quote 无 original`)
    if (!b.cite) return bad.push(`blocks[${i}] quote 缺 cite——站外材料请在正文转述并标出处,不要作 quote 块`)
    const cf = path.join(ROOT, `src/data/${b.cite.corpus || corpus}/classics/${b.cite.slug || slug}.json`)
    const book = (cache[cf] ??= fs.existsSync(cf) ? JSON.parse(fs.readFileSync(cf, 'utf8')) : null)
    const c = book?.chapters?.find((x) => String(x.no) === String(b.cite.ch))
    if (!c) return bad.push(`blocks[${i}] quote 指向不存在的章 ${b.cite.slug || slug}#${b.cite.ch}`)
    if (!c.paragraphs.map((p) => p.original).join('').includes(b.original)) bad.push(`blocks[${i}] 引文不是 ${b.cite.slug || slug}#${b.cite.ch} 的原文子串:「${b.original.slice(0, 20)}…」(用脚本从数据里切,不要手打)`)
    if (!b.cite.label) soft.push(`blocks[${i}] cite 没有 label`)
  }
  if (b.type === 'figure') {
    const svg = String(b.svg || '')
    if (!svg) bad.push(`blocks[${i}] figure 缺 svg`)
    else if (/(fill|stroke)\s*=\s*['"]#[0-9a-fA-F]/.test(svg) || /(fill|stroke)\s*:\s*#[0-9a-fA-F]/.test(svg)) bad.push(`blocks[${i}] figure 写死了颜色,须用 style="fill:var(--…)"`)
    else if (/(fill|stroke)\s*=\s*['"]var\(/.test(svg)) bad.push(`blocks[${i}] figure 用了 fill="var(…)" 属性写法,须改 style="fill:var(--…)"`)
    if (svg && !/viewBox/.test(svg)) bad.push(`blocks[${i}] figure 缺 viewBox`)
    if (!b.caption) soft.push(`blocks[${i}] figure 没有 caption`)
  }
  if (b.type === 'table') {
    if (!(b.rows || []).length) bad.push(`blocks[${i}] table 无数据行`)
    const w = (b.head || []).length
    if (w && (b.rows || []).some((r) => r.length !== w)) bad.push(`blocks[${i}] table 有行的列数与表头不符`)
  }
})
const n = (JSON.stringify(blocks).match(/[一-鿿]/g) || []).length
if (n < 4000) bad.push(`仅 ${n} 字,低于 4000 字底线`)
const nFT = blocks.filter((b) => b.type === 'figure' || b.type === 'table').length
const want = n >= 5000 ? 4 : n >= 3000 ? 3 : 2
if (nFT < want) soft.push(`${n} 字只有 ${nFT} 处图表,建议 ${want} 处以上`)
if (!blocks.some((b) => b.type === 'refs')) soft.push('没有 refs 块')
console.log((bad.length ? `✗ ${bad.length} 处要改:\n- ` + bad.join('\n- ') : `✓ 硬项全过:${n} 字 · ${blocks.filter((b) => b.type === 'quote').length} 引文 · ${nFT} 图表`) + (soft.length ? `\n(提示)\n- ` + soft.join('\n- ') : ''))
process.exit(bad.length ? 1 : 0)
