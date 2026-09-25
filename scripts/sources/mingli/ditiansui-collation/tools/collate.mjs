// 汇总:见证本差异(劝学网 Q / 古诗文网 G)+ 白话·注疏自标疑讹 → sites.json(待人工定档)
import fs from 'fs'
import path from 'path'
import { HERE, loadBase, norm } from './lib.mjs'

const base = loadBase()
const bc = JSON.parse(fs.readFileSync(path.join(HERE, 'basechap.json'), 'utf8'))
const HQ = JSON.parse(fs.readFileSync(path.join(HERE, 'hunks-quanxue.json'), 'utf8'))
const HG = JSON.parse(fs.readFileSync(path.join(HERE, 'hunks-gushiwen.json'), 'utf8'))
const NP = JSON.parse(fs.readFileSync(path.join(HERE, 'note-pairs.json'), 'utf8'))

const ALL = bc.map((c) => c.B).join('〇')
const count = (s) => { if (!s) return 0; let n = 0, i = ALL.indexOf(s); while (i >= 0) { n++; i = ALL.indexOf(s, i + 1) } return n }

const sites = new Map()
const key = (h) => `${h.ch}:${h.bStart}:${h.bEnd}`
const overlaps = (h, s, e) => (h.bStart === h.bEnd ? (h.bStart >= s && h.bStart <= e) : (h.bStart < e && h.bEnd > s)) || (s === e && h.bStart <= s && h.bEnd >= s)
function reading(H, ch, s, e, bText) {
  const hs = H.filter((h) => h.ch === ch && overlaps(h, s, e))
  if (!hs.length) return { t: bText, same: true }
  const exact = hs.find((h) => h.bStart === s && h.bEnd === e)
  if (exact) return { t: exact.wText, same: false, ctx: exact.wCtx }
  return { t: '≈' + hs.map((h) => `${h.bText}>${h.wText}`).join('|'), same: false, partial: true, ctx: hs[0].wCtx }
}
for (const h of [...HQ, ...HG]) {
  const k = key(h)
  if (!sites.has(k)) sites.set(k, { ch: h.ch, bStart: h.bStart, bEnd: h.bEnd, bText: h.bText, notes: [] })
}
// 注记定位到 B 区间
for (const p of NP) {
  const c = bc[p.ch - 1]
  for (const hit of p.hits) {
    const len = p.from.length
    const idx = []
    c.bmap.forEach((m, i) => { if (m.para === hit.para && m.off >= hit.off && m.off < hit.off + len) idx.push(i) })
    if (!idx.length) continue
    const s = idx[0], e = idx[idx.length - 1] + 1
    // 挂到重叠的 site 上;没有就新建(见证本与本站同)
    let attached = false
    for (const st of sites.values()) {
      if (st.ch !== p.ch) continue
      const ss = st.bStart, ee = st.bEnd
      const ov = ss === ee ? (ss >= s && ss <= e) : (ss < e && ee > s)
      if (ov) { st.notes.push(`${p.src}:${p.from}→${p.to ?? '?'}${p.src === 'zhushi' ? '〔' + p.note.slice(0, 30) + '〕' : ''}`); attached = true }
    }
    if (!attached) {
      const k = `${p.ch}:${s}:${e}:note`
      if (!sites.has(k)) sites.set(k, { ch: p.ch, bStart: s, bEnd: e, bText: c.B.slice(s, e), notes: [], noteOnly: true })
      sites.get(k).notes.push(`${p.src}:${p.from}→${p.to ?? '?'}${p.src === 'zhushi' ? '〔' + p.note.slice(0, 30) + '〕' : ''}`)
    }
  }
}
const out = []
for (const st of sites.values()) {
  const c = bc[st.ch - 1]
  const q = reading(HQ, st.ch, st.bStart, st.bEnd, st.bText)
  const g = reading(HG, st.ch, st.bStart, st.bEnd, st.bText)
  // 原文位置
  const s = st.bStart, e = st.bEnd
  const m0 = c.bmap[Math.min(s, c.bmap.length - 1)]
  const para = m0.para
  const orig = base[st.ch - 1].paras[para].original
  const oStart = s < c.bmap.length ? c.bmap[s].off : orig.length
  const oEnd = e > s ? c.bmap[e - 1].off + [...orig.slice(c.bmap[e - 1].off)][0].length : oStart
  const ctx = orig.slice(Math.max(0, oStart - 6), oStart) + '〔' + orig.slice(oStart, oEnd) + '〕' + orig.slice(oEnd, oEnd + 6)
  // 内证:正字搭配在全书别处出现次数(L/R 为归一串邻字)
  const L2 = c.B.slice(Math.max(0, s - 2), s), R2 = c.B.slice(e, e + 2)
  const L1 = L2.slice(-1), R1 = R2.slice(0, 1)
  const ev = (w, self) => ({ tri: count(L1 + w + R1) - self, l: count(L2 + w) - self, r: count(w + R2) - self })
  const wAlt = !q.same && !q.partial ? q.t : (!g.same && !g.partial ? g.t : null)
  out.push({
    ch: st.ch, title: base[st.ch - 1].title, para, oStart, oEnd, ctx, bText: st.bText,
    q: q.same ? '=' : q.t, g: g.same ? '=' : g.t, wctx: q.ctx || g.ctx || '',
    notes: st.notes, noteOnly: !!st.noteOnly,
    evBase: ev(st.bText, 1), evWit: wAlt != null ? ev(wAlt, 0) : null, wAlt,
    L2, R2,
  })
}
out.sort((a, b) => a.ch - b.ch || a.para - b.para || a.oStart - b.oStart)
fs.writeFileSync(path.join(HERE, 'sites.json'), JSON.stringify(out, null, 1))
console.log('sites', out.length, 'noteOnly', out.filter((x) => x.noteOnly).length)
