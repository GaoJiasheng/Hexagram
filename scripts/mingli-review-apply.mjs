// 观数白话人读复核的合并器(与 mingli-review-prep.mjs 成对)。
//   node scripts/mingli-review-apply.mjs <workflow .output 文件>
// 对每个单元:读代理写的输出文件 → 结构校验(四字段、块类型合法、figure 块数与次序原样、widget 原样、quote 的 original 仍是原文子串)
// → 还原 svg → check-baihua-draft → 通过才写回 src/data/mingli/baihua/<slug>.json[key];不通过一律保留原稿并记明原因。
// 末尾把「改了什么」汇成 docs/mingli-baihua-review-<日期>.md 给 owner 看;红线由 check-data 最后统一过。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { WORK } from './mingli-review-prep.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLOCK_TYPES = new Set(['lead', 'p', 'h2', 'quote', 'figure', 'refs', 'list', 'callout', 'pull', 'steps', 'widget'])

const [, , outputFile] = process.argv
if (!outputFile) { console.log('用法: node scripts/mingli-review-apply.mjs <workflow.output>'); process.exit(2) }
const results = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
const units = JSON.parse(fs.readFileSync(path.join(WORK, 'units.json'), 'utf8'))
const byKey = new Map(units.map((u) => [`${u.slug}:${u.key}`, u]))

const booksCache = {}
const loadBaihua = (slug) => booksCache[slug] ||= JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/mingli/baihua/${slug}.json`), 'utf8'))

const report = { ok: 0, fixed: 0, rejected: [], findings: [], missing: 0, changes: 0 }
const applied = new Set()
for (const r of results) {
  if (!r || !r.slug) continue
  const u = byKey.get(`${r.slug}:${r.key}`)
  if (!u) continue
  const verdict = r.result?.verdict
  const findings = Array.isArray(r.result?.findings) ? r.result.findings : []
  if (verdict === 'ok' || verdict === 'skip') { report.ok++; continue }
  if (!fs.existsSync(u.outFile)) { report.missing++; report.rejected.push([u.label, '代理说改了却没写输出文件']); continue }
  let out
  try { out = JSON.parse(fs.readFileSync(u.outFile, 'utf8')) } catch { report.rejected.push([u.label, '输出不是合法 JSON']); continue }
  const book = loadBaihua(r.slug)
  const orig = book[r.key]
  const why = validate(out, orig)
  if (why) { report.rejected.push([u.label, why]); continue }
  // 还原 svg(按 figure 次序)
  const svgs = orig.blocks.filter((b) => b.type === 'figure').map((b) => b.svg)
  let fi = 0
  const blocks = out.blocks.map((b) => (b.type === 'figure' ? { ...b, svg: svgs[fi++] } : b))
  const merged = { ...orig, title: out.title, subtitle: out.subtitle, centralIdea: out.centralIdea, blocks }
  // check-baihua-draft(与装配器 / check-data 同一把尺子)
  const tmp = path.join(WORK, 'tmp-draft.json')
  fs.writeFileSync(tmp, JSON.stringify(merged))
  try {
    execFileSync('node', ['scripts/check-baihua-draft.mjs', 'mingli', r.slug, String(r.key), tmp], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    const msg = String(e.stdout || e.stderr || e.message).trim().split('\n').slice(-4).join(' / ')
    report.rejected.push([u.label, `check-baihua-draft 未过: ${msg.slice(0, 300)}`])
    continue
  }
  const before = JSON.stringify(orig), after = JSON.stringify(merged)
  if (before === after) { report.ok++; continue }
  book[r.key] = merged
  applied.add(r.slug)
  report.fixed++
  report.changes += findings.length
  report.findings.push({ label: u.label, slug: r.slug, key: r.key, findings, note: r.result?.note })
}

function validate(out, orig) {
  if (!out || typeof out !== 'object') return '输出不是对象'
  for (const k of ['title', 'subtitle', 'centralIdea']) if (typeof out[k] !== 'string' || !out[k].trim()) return `缺 ${k}`
  if (!Array.isArray(out.blocks) || !out.blocks.length) return 'blocks 空'
  for (const b of out.blocks) if (!b || !BLOCK_TYPES.has(b.type)) return `块类型不合法: ${b?.type}`
  const of = orig.blocks.filter((b) => b.type === 'figure'), nf = out.blocks.filter((b) => b.type === 'figure')
  if (of.length !== nf.length) return `figure 块数变了 ${of.length}→${nf.length}(图不许增删)`
  for (let i = 0; i < nf.length; i++) if (nf[i].svg !== '__SVG__' && nf[i].svg !== of[i].svg) return `第 ${i + 1} 张图的 svg 被改写`
  const ow = orig.blocks.filter((b) => b.type === 'widget'), nw = out.blocks.filter((b) => b.type === 'widget')
  if (JSON.stringify(ow) !== JSON.stringify(nw)) return 'widget 块被改动(交互件参数不在复核范围)'
  const shrink = out.blocks.length < orig.blocks.length * 0.8
  if (shrink) return `块数缩水过多 ${orig.blocks.length}→${out.blocks.length}`
  return null
}

for (const slug of applied) {
  fs.writeFileSync(path.join(ROOT, `src/data/mingli/baihua/${slug}.json`), JSON.stringify(booksCache[slug], null, 2) + '\n')
}

// 汇报
const day = new Date().toISOString().slice(0, 10)
const lines = [`# 观数白话代理复核 · ${day}`, '', `> 每章一个 opus 代理逐段对照原文(含站内译文)与白话,只改事实错误 / 讲偏 / 红线,不重写风格;`,
  `> 主会话逐片校验(结构 · 图块原样 · 引文子串 · check-baihua-draft)后合并。**机器闸只保证「没改坏」,改得对不对仍须人眼抽查**——下面按书列全部修正,请 owner 抽看。`, '',
  `- 复核 ${results.length} 章:无需修改 ${report.ok} · 已修正 ${report.fixed}(${report.changes} 处)· 拒收 ${report.rejected.length} · 缺输出 ${report.missing}`, '']
const bySlug = new Map()
for (const f of report.findings) { if (!bySlug.has(f.slug)) bySlug.set(f.slug, []); bySlug.get(f.slug).push(f) }
for (const [slug, list] of bySlug) {
  lines.push(`## ${slug}(${list.length} 章)`, '')
  for (const f of list) {
    lines.push(`### ${f.label} → \`/mingli/${slug}/baihua/${f.key}\``)
    for (const x of f.findings) lines.push(`- **${x.where || '—'}**:${x.wrong} → ${x.fix}${x.why ? `(${x.why})` : ''}`)
    if (f.note) lines.push(`- 代理附注:${f.note}`)
    lines.push('')
  }
}
if (report.rejected.length) {
  lines.push('## 拒收(保留原稿)', '')
  for (const [label, why] of report.rejected) lines.push(`- ${label}:${why}`)
  lines.push('')
}
const docFile = path.join(ROOT, `docs/mingli-baihua-review-${day}.md`)
fs.writeFileSync(docFile, lines.join('\n'))
console.log(lines.slice(5, 6).join('\n'))
console.log(`汇报 → ${docFile}`)
for (const [label, why] of report.rejected.slice(0, 20)) console.log('  拒收', label, why.slice(0, 160))
