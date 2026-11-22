// 观象 · 书桌 —— 图解结构化数据的闸(docs/desk-baihua-spec.md §2)。
// 打包脚本(build-desk-packs.mjs)与转换管线(figs-apply.mjs)共用:同一张 SVG、同一份 fig,两边判定一致。
import crypto from 'node:crypto'
import { TRIGRAMS, TABLE } from '../lib/hexagram-table.mjs'

export const figKey = (svg) => crypto.createHash('sha1').update(svg).digest('hex').slice(0, 12)

const TRI_NAMES = new Set(Object.values(TRIGRAMS).map((t) => t.name))
const HEX_NAMES = new Set(Object.values(TABLE).flatMap((row) => Object.values(row).map(([, name]) => name)))
const AT = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
export const KINDS = ['quote', 'cols', 'rows', 'flow', 'tree', 'timeline', 'table', 'gua', 'ring', 'notes']

const decode = (s) => s
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')

// SVG 里看得见的字:所有 <text> 的内容(含其中的 <tspan>),不含 <title> <desc> <style>
export function svgTexts(svg) {
  const s = svg.replace(/<(title|desc|style)\b[\s\S]*?<\/\1>/g, '')
  return [...s.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')).trim()).filter(Boolean)
}

// fig 里所有要显示的字符串(kind / form / at / 卦名不算)
export function figStrings(fig) {
  const out = []
  const walk = (v, key, inGuas) => {
    if (typeof v === 'string') { if (!['kind', 'form', 'at'].includes(key) && !(inGuas && key === 'name')) out.push(v) }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key, inGuas))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k, inGuas || k === 'guas')
  }
  walk(fig, '', false)
  return out
}

const bag = (strs) => {
  const m = new Map()
  for (const s of strs) for (const c of s.normalize('NFC')) if (/[\p{L}\p{N}]/u.test(c)) m.set(c, (m.get(c) || 0) + 1)
  return m
}

// 多重集之差:返回 { missing: 'SVG 有、fig 没有的字', extra: 'fig 有、SVG 没有的字' }
export function diffText(fig, svg) {
  // 角上的「观象」印章:SVG 里单独成一个 <text> 的「观」「象」(或「观象」)不比
  const texts = svgTexts(svg)
  const seal = texts.includes('观象') ? ['观象'] : (texts.includes('观') && texts.includes('象') ? ['观', '象'] : [])
  for (const t of seal) texts.splice(texts.indexOf(t), 1)
  const a = bag(texts), b = bag(figStrings(fig))
  let missing = '', extra = ''
  for (const [c, n] of a) { const d = n - (b.get(c) || 0); if (d > 0) missing += c.repeat(d) }
  for (const [c, n] of b) { const d = n - (a.get(c) || 0); if (d > 0) extra += c.repeat(d) }
  return { missing, extra }
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const strOrList = (v) => isStr(v) || (Array.isArray(v) && v.length > 0 && v.every(isStr))
const item = (v, need = 'head') => v && typeof v === 'object' && isStr(v[need]) && (v.body === undefined || strOrList(v.body))

// 返回问题列表(空 = 过闸)
export function checkFig(fig, svg) {
  const p = []
  if (!fig || typeof fig !== 'object' || Array.isArray(fig)) return ['不是对象']
  if (!KINDS.includes(fig.kind)) return [`kind「${fig.kind}」不认识`]
  if (fig.title !== undefined && !isStr(fig.title)) p.push('title 不是字符串')
  if (fig.foot !== undefined && !(Array.isArray(fig.foot) && fig.foot.every(isStr))) p.push('foot 应为字符串数组')
  const list = (v, name, min = 1) => { if (!Array.isArray(v) || v.length < min) { p.push(`${name} 应为至少 ${min} 项的数组`); return [] } return v }
  switch (fig.kind) {
    case 'quote':
      if (!isStr(fig.text)) p.push('quote 缺 text')
      break
    case 'cols': {
      const cols = list(fig.cols, 'cols', 2)
      if (cols.length > 4) p.push('cols 超过 4 栏')
      for (const c of cols) {
        if (!c || !isStr(c.head)) p.push('cols 某栏缺 head')
        for (const l of list(c?.lines, 'cols[].lines', 0)) if (!isStr(l) && !item(l)) p.push('cols[].lines 某项既不是字符串也不是 {head, body}')
      }
      break
    }
    case 'rows':
      for (const it of list(fig.items, 'items')) if (!item(it)) p.push('rows.items 某项缺 head')
      break
    case 'flow':
      for (const it of list(fig.steps, 'steps', 2)) if (!item(it)) p.push('flow.steps 某项缺 head')
      if (fig.result !== undefined && !item(fig.result)) p.push('flow.result 缺 head')
      break
    case 'tree':
      if (fig.root !== undefined && !item(fig.root)) p.push('tree.root 缺 head')
      for (const b of list(fig.branches, 'branches', 2)) {
        if (!item(b)) p.push('tree.branches 某项缺 head')
        if (b?.children !== undefined) for (const c of list(b.children, 'children')) if (!item(c)) p.push('tree.children 某项缺 head')
      }
      break
    case 'timeline':
      for (const it of list(fig.points, 'points', 2)) if (!item(it)) p.push('timeline.points 某项缺 head')
      break
    case 'table': {
      const rows = list(fig.rows, 'rows')
      if (fig.heads !== undefined && !(Array.isArray(fig.heads) && fig.heads.every((h) => typeof h === 'string'))) p.push('table.heads 应为字符串数组')
      const w = fig.heads?.length ?? rows[0]?.length
      for (const r of rows) if (!Array.isArray(r) || r.length !== w || !r.every((c) => typeof c === 'string')) { p.push('table.rows 各行应等长、每格是字符串'); break }
      break
    }
    case 'gua':
      for (const g of list(fig.guas, 'guas')) {
        if (!g || !['hex', 'tri'].includes(g.form)) { p.push('guas[].form 应为 hex 或 tri'); continue }
        if (!(g.form === 'hex' ? HEX_NAMES : TRI_NAMES).has(g.name)) p.push(`guas[].name「${g.name}」不是合法的${g.form === 'hex' ? '六十四卦' : '八经卦'}名`)
        if (g.lines !== undefined && !(Array.isArray(g.lines) && g.lines.every(isStr))) p.push('guas[].lines 应为字符串数组')
      }
      if (fig.yao !== undefined) {
        const yao = list(fig.yao, 'yao')
        if (yao.length && ![6, 7].includes(yao.length)) p.push(`yao 应为 6 项(乾坤含用九 / 用六时 7 项),现 ${yao.length} 项`)
        for (const y of yao) if (!y || !isStr(y.label)) p.push('yao 某项缺 label')
        if (fig.guas?.length !== 1 || fig.guas[0].form !== 'hex') p.push('有 yao 时 guas 应只有一个六画卦')
      }
      break
    case 'ring': {
      const seen = new Set()
      for (const it of list(fig.items, 'items', 3)) {
        if (!item(it)) p.push('ring.items 某项缺 head')
        if (!AT.has(it?.at)) p.push(`ring.items 的 at「${it?.at}」不合法`)
        else if (seen.has(it.at)) p.push(`ring.items 的 at「${it.at}」重复`)
        seen.add(it?.at)
      }
      break
    }
    case 'notes':
      for (const l of list(fig.lines, 'lines')) if (!isStr(l)) p.push('notes.lines 某项不是字符串')
      break
  }
  for (const s of figStrings(fig)) if ([...s].length > 120) { p.push(`有一条字符串超过 120 字:「${s.slice(0, 16)}…」`); break }
  const { missing, extra } = diffText(fig, svg)
  if (missing) p.push(`漏字:「${missing.slice(0, 40)}」`)
  if (extra) p.push(`多字:「${extra.slice(0, 40)}」`)
  return p
}
