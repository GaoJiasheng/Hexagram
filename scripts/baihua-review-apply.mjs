// 白话代理复核 · 通用合并器(与 baihua-review-prep.mjs 成对;观数那轮的 mingli-review-apply.mjs 推广到各组)。
//   node scripts/baihua-review-apply.mjs <批名> <workflow .output>…
// 对每个单元:读代理写的输出文件 → 结构校验(四字段、块类型合法、figure 块数与次序原样、widget 原样、块数不缩水)
// → 还原 svg → check-baihua-draft(易经六十四卦没有 classics 文件,改为自核引文子串)→ 通过才写回 src/data/<组>/baihua/<书>.json[key];
// 不通过一律保留原稿并记明原因。末尾写 docs/baihua-review-<批名>-<日期>.md:白话修正 + 拒收 + 代理报的站内译文疑误(本轮不改译文)。
// 红线与全站引文由 check-data 最后统一过。合并是幂等的,可把几次的 .output 一起传。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { workDir, hexagramParas } from './baihua-review-prep.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BLOCK_TYPES = new Set(['lead', 'p', 'h2', 'quote', 'figure', 'refs', 'list', 'callout', 'pull', 'steps', 'widget'])

const [batch, ...outputFiles] = process.argv.slice(2)
if (!batch || !outputFiles.length) { console.log('用法: node scripts/baihua-review-apply.mjs <批名> <workflow.output> [more.output…]'); process.exit(2) }
const WORK = workDir(batch)
const results = outputFiles.flatMap((f) => { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return Array.isArray(j) ? j : (j.result || []) })
const units = JSON.parse(fs.readFileSync(path.join(WORK, 'units.json'), 'utf8'))
const uid = (x) => `${x.corpus}:${x.slug}:${x.key}`
const byKey = new Map(units.map((u) => [uid(u), u]))

const cache = {}
const fileOf = (corpus, slug) => path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`)
const loadBaihua = (corpus, slug) => cache[`${corpus}/${slug}`] ||= JSON.parse(fs.readFileSync(fileOf(corpus, slug), 'utf8'))
let hexes = null
const hexText = (key) => {
  hexes ||= JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
  const h = hexes.find((x) => x.id === Number(key))
  return h ? hexagramParas(h).map((p) => p.original).join('') : ''
}
const norm = (s) => String(s || '').replace(/[\s　]/g, '')

const report = { ok: 0, fixed: 0, rejected: [], findings: [], missing: 0, changes: 0, trans: [] }
const applied = new Set()
const seen = new Set()
for (const r of results) {
  if (!r || !r.slug || seen.has(uid(r))) continue
  seen.add(uid(r))
  const u = byKey.get(uid(r))
  if (!u) continue
  const verdict = r.result?.verdict
  const findings = Array.isArray(r.result?.findings) ? r.result.findings : []
  const trans = Array.isArray(r.result?.translationIssues) ? r.result.translationIssues : []
  if (trans.length) report.trans.push({ u, trans })
  if (verdict === 'ok' || verdict === 'skip') { report.ok++; continue }
  if (!fs.existsSync(u.outFile)) { report.missing++; report.rejected.push([u, '代理说改了却没写输出文件']); continue }
  let out
  try { out = JSON.parse(fs.readFileSync(u.outFile, 'utf8')) } catch { report.rejected.push([u, '输出不是合法 JSON']); continue }
  const book = loadBaihua(u.corpus, u.slug)
  const orig = book[u.key]
  const why = validate(out, orig)
  if (why) { report.rejected.push([u, why]); continue }
  const svgs = orig.blocks.filter((b) => b.type === 'figure').map((b) => b.svg)
  let fi = 0
  const blocks = out.blocks.map((b) => (b.type === 'figure' ? { ...b, svg: svgs[fi++] } : b))
  const merged = { ...orig, title: out.title, subtitle: out.subtitle, centralIdea: out.centralIdea, blocks }
  const bad = draftCheck(u, merged)
  if (bad) { report.rejected.push([u, bad]); continue }
  report.fixed++
  report.changes += findings.length
  report.findings.push({ u, findings, note: r.result?.note })
  if (JSON.stringify(orig) === JSON.stringify(merged)) continue
  book[u.key] = merged
  applied.add(`${u.corpus}/${u.slug}`)
}

function draftCheck(u, merged) {
  if (u.corpus === 'yijing' && u.slug === 'hexagrams') {
    const text = norm(hexText(u.key))
    for (const b of merged.blocks) if (b.type === 'quote' && b.original && !text.includes(norm(b.original))) return `引文不是本卦原文子串:${String(b.original).slice(0, 30)}`
    return null
  }
  const tmp = path.join(WORK, 'tmp-draft.json')
  fs.writeFileSync(tmp, JSON.stringify(merged))
  try {
    execFileSync('node', ['scripts/check-baihua-draft.mjs', u.corpus, u.slug, String(u.key), tmp], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return null
  } catch (e) {
    const text = String(e.stdout || e.stderr || e.message)
    // 只剩「figure 的 svg 写死颜色」一类:svg 是从原稿原样还原的,是原稿既有问题,不是复核改坏,放行
    const items = text.split('\n').filter((l) => /^\s*- /.test(l))
    if (items.length > 0 && items.every((l) => /\(figure\) svg/.test(l))) return null
    return `check-baihua-draft 未过: ${text.trim().split('\n').slice(-4).join(' / ').slice(0, 300)}`
  }
}

function validate(out, orig) {
  if (!out || typeof out !== 'object') return '输出不是对象'
  for (const k of ['title', 'subtitle', 'centralIdea']) if (typeof out[k] !== 'string' || !out[k].trim()) return `缺 ${k}`
  if (!Array.isArray(out.blocks) || !out.blocks.length) return 'blocks 空'
  for (const b of out.blocks) if (!b || !BLOCK_TYPES.has(b.type)) return `块类型不合法: ${b?.type}`
  const of = orig.blocks.filter((b) => b.type === 'figure'), nf = out.blocks.filter((b) => b.type === 'figure')
  if (of.length !== nf.length) return `figure 块数变了 ${of.length}→${nf.length}(图不许增删)`
  for (let i = 0; i < nf.length; i++) if (nf[i].svg !== '__SVG__' && nf[i].svg !== of[i].svg) return `第 ${i + 1} 张图的 svg 被改写`
  const wkey = (b) => JSON.stringify({ kind: b.kind, props: b.props })
  const origW = orig.blocks.filter((b) => b.type === 'widget')
  if (origW.length !== out.blocks.filter((b) => b.type === 'widget').length) return 'widget 块数变了(交互件不许增删)'
  // 交互件参数不在复核范围:按次序把原稿的 kind/props 放回去(caption 仍取修正稿)
  let wi = 0
  out.blocks = out.blocks.map((b) => (b.type === 'widget' ? { ...b, kind: origW[wi].kind, props: origW[wi++].props } : b))
  void wkey
  if (out.blocks.length < orig.blocks.length * 0.8) return `块数缩水过多 ${orig.blocks.length}→${out.blocks.length}`
  return null
}

for (const k of applied) {
  const [corpus, slug] = k.split('/')
  // 按原文件的缩进写回(各书 1 格 / 2 格不一),免得一处修正带出整份文件的空白 diff
  const raw = fs.readFileSync(fileOf(corpus, slug), 'utf8')
  const indent = (/^\{\n( +)"/.exec(raw)?.[1] || '  ').length
  // 键顺序也照原文件:「1」「1-1」混排时 JS 对象会把纯数字键提前,所以按原文件顶层键的次序逐个写
  const pad = ' '.repeat(indent)
  const order = [...raw.matchAll(new RegExp(`^${pad}("(?:[^"\\\\]|\\\\.)*"): `, 'gm'))].map((m) => JSON.parse(m[1]))
  const keys = [...order.filter((x) => x in cache[k]), ...Object.keys(cache[k]).filter((x) => !order.includes(x))]
  const body = keys.map((x) => `${pad}${JSON.stringify(x)}: ${JSON.stringify(cache[k][x], null, indent).replace(/\n/g, '\n' + pad)}`).join(',\n')
  fs.writeFileSync(fileOf(corpus, slug), `{\n${body}\n}` + (raw.endsWith('\n') ? '\n' : ''))
}

const day = new Date().toISOString().slice(0, 10)
const href = (u) => (u.corpus === 'yijing' && u.slug === 'hexagrams' ? `/hexagram/${u.key}` : `/${u.corpus}/${u.slug}/baihua/${u.key}`)
const lines = [`# 白话代理复核 · 批 ${batch} · ${day}`, '',
  '> 每章一个 opus 代理逐段对照原文(含站内译文)与白话,只改事实错误 / 讲偏 / 红线 / 引文译错,不重写风格;',
  '> 主会话逐片校验(结构 · 图块原样 · 引文子串 · check-baihua-draft)后合并。**机器闸只保证「没改坏」,改得对不对仍须人眼抽查。**',
  '> 「站内译文疑误」一节是代理顺手报的原文译文层问题,本轮**没改**,留作下一步逐条核。', '',
  `- 复核 ${seen.size} 章:无需修改 ${report.ok} · 已修正 ${report.fixed}(${report.changes} 处)· 拒收 ${report.rejected.length} · 缺输出 ${report.missing} · 站内译文疑误 ${report.trans.reduce((n, x) => n + x.trans.length, 0)} 条(${report.trans.length} 章)`, '']
const group = (list) => { const m = new Map(); for (const x of list) { const k = `${x.u.corpus}/${x.u.slug}`; if (!m.has(k)) m.set(k, []); m.get(k).push(x) } return m }
for (const [k, list] of group(report.findings)) {
  lines.push(`## ${k}(${list.length} 章)`, '')
  for (const f of list) {
    lines.push(`### ${f.u.label} → \`${href(f.u)}\``)
    for (const x of f.findings) lines.push(`- **${x.where || '—'}**:${x.wrong} → ${x.fix}${x.why ? `(${x.why})` : ''}`)
    if (f.note) lines.push(`- 代理附注:${f.note}`)
    lines.push('')
  }
}
if (report.rejected.length) {
  lines.push('## 拒收(保留原稿)', '')
  for (const [u, why] of report.rejected) lines.push(`- ${u.label}:${why}`)
  lines.push('')
}
if (report.trans.length) {
  lines.push('## 站内译文疑误(本轮未改)', '')
  for (const [k, list] of group(report.trans)) {
    lines.push(`### ${k}`, '')
    for (const t of list) for (const x of t.trans) lines.push(`- ${t.u.label} 第 ${x.para} 段:「${x.wrong}」→「${x.suggest}」${x.why ? `(${x.why})` : ''}`)
    lines.push('')
  }
}
const docFile = path.join(ROOT, `docs/baihua-review-${batch}-${day}.md`)
fs.writeFileSync(docFile, lines.join('\n'))
console.log(lines[6])
console.log(`改写 ${applied.size} 个文件 · 汇报 → ${path.relative(ROOT, docFile)}`)
for (const [u, why] of report.rejected.slice(0, 20)) console.log('  拒收', u.label, why.slice(0, 160))
