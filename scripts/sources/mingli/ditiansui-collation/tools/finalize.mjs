// 合并 auto + 人工结论 → ditiansui-collation.tsv + ditiansui-typofixes.json(并逐条自核 expect)
import fs from 'fs'
import path from 'path'
import { S, auto } from './auto.mjs'
import { keyOf } from './keys.mjs'
import { DEC } from './decisions.mjs'
import { HERE, loadBase, loadQuanxue, norm, isGanzhiLine } from './lib.mjs'
import { t2s } from '/Users/gavin/work/hexagram/scripts/lib/wikisource.mjs'

const base = loadBase()
const Q = loadQuanxue()
const HAN = /\p{Script=Han}/u
const PUNCT = /[，。；：、！？“”‘’（）《》〈〉,.;:!?]/

// ---- 当前文本(非命例段),可变,按序施加各条 ----
const paras = [] // {ch, idx, text}
for (const c of base) for (const p of c.paras) if (!p.skip) paras.push({ ch: c.no, idx: p.idx, text: p.original })
const find = (ch, idx) => paras.find((p) => p.ch === ch && p.idx === idx)
const countAll = (s) => paras.reduce((n, p) => n + (s ? p.text.split(s).length - 1 : 0), 0)

// ---- 模拟管线在 typoFixes 之前的原文(维基缓存 → 解包 → 繁简 → 既有勘误),用于核 from 在 tidyPunct 之前也命中 ----
const cfg = fs.readFileSync('/Users/gavin/work/hexagram/scripts/corpus/mingli.config.mjs', 'utf8')
const cache = JSON.parse(fs.readFileSync('/Users/gavin/work/hexagram/scripts/.cache/wikisource.json', 'utf8'))
let RAW = cache['滴天髓闡微'].replace(/\{\{\*\|(原注[：:][^{}]*)\}\}/g, '$1').replace(/\{\{annotate\|(任氏曰[：:][^{}]*)\}\}/g, '$1').split('\n').map(t2s).join('\n')
const grab = (name) => { const m = cfg.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`)); return [...m[1].matchAll(/from: '([^']*)', to: '([^']*)'/g)].map((x) => [x[1], x[2]]) }
for (const [f, t] of [...grab('DITIANSUI_FIXES'), ...grab('DITIANSUI_TYPOS')]) RAW = RAW.split(f).join(t)
const countRaw = (s) => RAW.split(s).length - 1

// ---- 逐 site 定结论 ----
const rows = []
S.forEach((x, i) => {
  const a = auto(x)
  const d = DEC[keyOf[i]] || {}
  const g = d.g ?? a.grade
  if (g === 'X') return
  const type = d.type ?? a.type
  const orig = base[x.ch - 1].paras[x.para].original
  const seg = orig.slice(x.oStart, x.oEnd)
  let from = d.from, to = d.to2
  if (!from) {
    let rep = d.to
    if (rep == null && x.noteOnly) {
      const n = x.notes.map((s) => s.match(/^[a-z]+:(.*?)→(.*?)(〔|$)/)).find((m) => m && m[1] === seg && m[2] !== '?')
      rep = n ? n[2] : null
    }
    if (rep == null) rep = a.to
    from = seg; to = rep
  }
  const ctx6 = orig.slice(Math.max(0, x.oStart - 6), x.oStart) + '〔' + seg + '〕' + orig.slice(x.oEnd, x.oEnd + 6)
  const ev = x.evWit ? `正写搭配他处见:${x.L2.slice(-1)}+W+${x.R2.slice(0, 1)}×${x.evWit.tri}/左二×${x.evWit.l}/右二×${x.evWit.r}` : ''
  const src = [...new Set(x.notes.map((s) => ({ baihua: '白话', zhushi: '注疏', scan: '扫描', translation: '译文' })[s.split(':')[0]]))].join('+')
  rows.push({ i, key: keyOf[i], ch: x.ch, title: x.title, para: x.para, oStart: x.oStart, oEnd: x.oEnd, seg, ctx6,
    q: x.q, g: x.g, type, grade: g, from, to, why: d.why || '', ev, src, noteOnly: x.noteOnly })
})

// ---- 内证:改动核心(去公共前后缀)连同左右各一字,在全书(非命例段、只留汉字)的出现次数 ----
const ALLN = paras.map((p) => norm(p.text).s).join('〇')
const cnt = (t) => (t ? ALLN.split(t).length - 1 : 0)
for (const r of rows) {
  if (r.to == null || r.from == null) { r.ev2 = ''; continue }
  const a = norm(r.from, { doFold: false }).s, b = norm(r.to, { doFold: false }).s
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++
  let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++
  let oc = a.slice(p, a.length - q), nc = b.slice(p, b.length - q)
  // 纯插入/删除时,核心为空的一侧借一个邻字
  const orig = base[r.ch - 1].paras[r.para].original
  const ctxN = norm(orig.slice(Math.max(0, r.oStart - 8), r.oStart)).s, ctxR = norm(orig.slice(r.oEnd, r.oEnd + 8)).s
  const Lc = p > 0 ? a[p - 1] : ctxN.slice(-1), Rc = q > 0 ? a[a.length - q] : ctxR.slice(0, 1)
  const good = [Lc + nc + Rc, Lc + nc, nc + Rc].map((t) => `「${t}」${cnt(t)}`), badN = cnt(Lc + oc + Rc)
  r.ev2 = `正写 ${good.join(' ')};讹写「${Lc + oc + Rc}」${badN}`
}

// ---- 生成 typoFixes(A/B),按文档序;每条 from 在当时全文唯一 ----
const fixes = [], problems = [], SHIFT = {}
const ab = rows.filter((r) => r.grade === 'A' || r.grade === 'B').sort((a, b) => a.ch - b.ch || a.para - b.para || a.oStart - b.oStart)
for (const r of ab) {
  const P = find(r.ch, r.para)
  if (r.to == null) { problems.push(`${r.key}: 缺正字`); continue }
  if (/[才杀余于]/.test(r.to) && !r.noteOnly && !DEC[r.key]?.to && !DEC[r.key]?.to2) problems.push(`${r.key}: 正字含折叠字「${r.to}」,请核原书写法`)
  let core = r.from, coreTo = r.to
  const shift = (SHIFT[r.ch + '.' + r.para] ||= 0)
  const o = r.oStart + shift
  // 定位:取段内离(原偏移+前序条目累计增减)最近的一处;纯插入即落在该偏移
  let at = -1
  {
    // 片段可能在段内多处,取离原偏移最近者
    let best = -1, bd = 1e9
    if (core) { let j = P.text.indexOf(core); while (j >= 0) { const dd = Math.abs(j - o); if (dd < bd) { bd = dd; best = j } j = P.text.indexOf(core, j + 1) } }
    else best = Math.min(o, P.text.length) // 纯插入
    at = best
  }
  if (at < 0) { problems.push(`${r.key}: 段内找不到「${core}」`); continue }
  // 扩上下文直到全书唯一(且不含半角标点/空格边界问题)
  let L = 0, R = 0, fromS, toS
  for (let k = 0; k < 40; k++) {
    fromS = P.text.slice(at - L, at) + core + P.text.slice(at + core.length, at + core.length + R)
    toS = P.text.slice(at - L, at) + coreTo + P.text.slice(at + core.length, at + core.length + R)
    const ok = fromS.length >= 3 && countAll(fromS) === 1 && [...fromS].filter((c) => HAN.test(c)).length >= 3
    if (ok) break
    if (k % 2 === 0 && at - L > 0) L++; else if (at + core.length + R < P.text.length) R++; else if (at - L > 0) L++; else break
  }
  // 两端不以标点起止(更稳),能收就收——但须仍唯一
  if (countAll(fromS) !== 1) { problems.push(`${r.key}: 无法取得唯一 from(「${fromS}」×${countAll(fromS)})`); continue }
  const rawN = countRaw(fromS)
  if (rawN !== 1) problems.push(`${r.key}: from「${fromS}」在模拟管线原文中命中 ${rawN} 处(预期 1),疑与半角标点/清洗差异有关`)
  fixes.push({ from: fromS, to: toS, expect: 1, reason: `[${r.grade}] 第${r.ch}章(${r.title})第${r.para}段:${r.why || (r.q !== '=' || r.g !== '=' ? '见证本作「' + (r.q !== '=' ? r.q : r.g) + '」' : '')}`, _key: r.key })
  P.text = P.text.slice(0, at - L) + toS + P.text.slice(at + core.length + R)
  SHIFT[r.ch + '.' + r.para] += coreTo.length - core.length
  RAW = RAW.split(fromS).join(toS)
  r.fix = fromS + ' → ' + toS
}

// ---- 输出 ----
const esc = (s) => String(s ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ')
const tsv = ['章\t章题\t段\t本站上下文(〔〕内为本站读法)\t本站读法\t劝学网本\t古诗文本\t差异类型\t同书内证(全书只留汉字计次;讹写含本处)\t标出来源\t判定\t依据\t建议 typoFix']
for (const r of rows.sort((a, b) => a.ch - b.ch || a.para - b.para || a.oStart - b.oStart)) {
  tsv.push([r.ch, r.title, r.para, r.ctx6, r.seg || '∅', r.q === '=' ? '同本站' : r.q, r.g === '=' ? '同本站' : r.g, r.type, r.grade === '-' ? '' : (r.ev2 || r.ev), r.src, r.grade, r.why, r.fix || ''].map(esc).join('\t'))
}
fs.writeFileSync(path.join(HERE, 'ditiansui-collation.tsv'), tsv.join('\n') + '\n')
fs.writeFileSync(path.join(HERE, 'ditiansui-typofixes.json'), JSON.stringify(fixes.map(({ _key, ...f }) => f), null, 1))
fs.writeFileSync(path.join(HERE, 'problems.txt'), problems.join('\n') + '\n')
const gc = {}; for (const r of rows) gc[r.grade] = (gc[r.grade] || 0) + 1
console.log("rows", rows.length, gc, 'fixes', fixes.length, 'problems', problems.length)
