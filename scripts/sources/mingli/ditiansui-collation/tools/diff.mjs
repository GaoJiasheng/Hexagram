// 章级 Myers diff:本站(去命例段)vs 见证本(去纯干支行),两个见证本各跑一遍
// 产出 hunks-<w>.json + coverage-<w>.json + basechap.json(每章归一串与映射,供后续定位)
import fs from 'fs'
import path from 'path'
import { loadBase, loadQuanxue, loadGushiwen, norm, myers, isGanzhiLine, HERE } from './lib.mjs'

const base = loadBase()
const W8 = 8

function baseChapter(bc) {
  let B = '', bmap = []
  for (const p of bc.paras) {
    if (p.skip) continue
    const n = norm(p.original)
    for (let k = 0; k < n.s.length; k++) bmap.push({ para: p.idx, off: n.map[k] })
    B += n.s
  }
  return { B, bmap }
}
const baseChaps = base.map(baseChapter)
fs.writeFileSync(path.join(HERE, 'basechap.json'), JSON.stringify(baseChaps.map((x, i) => ({ no: base[i].no, B: x.B, bmap: x.bmap }))))

function run(name, wit) {
  const hunks = [], coverage = []
  for (let ci = 0; ci < base.length; ci++) {
    const bc = base[ci], wc = wit[ci]
    const { B, bmap } = baseChaps[ci]
    let W = ''
    for (const t of wc.paras) { if (isGanzhiLine(t)) continue; W += norm(t).s }
    const grams = new Set()
    for (let i = 0; i + W8 <= W.length; i++) grams.add(W.slice(i, i + W8))
    for (const p of bc.paras) {
      if (p.skip) continue
      const s = norm(p.original).s
      let tot = 0, hit = 0
      for (let i = 0; i + W8 <= s.length; i++) { tot++; if (grams.has(s.slice(i, i + W8))) hit++ }
      coverage.push({ ch: bc.no, para: p.idx, len: s.length, ratio: tot ? hit / tot : (W.includes(s) ? 1 : 0) })
    }
    const runs = myers([...B], [...W])
    for (let r = 0; r < runs.length; r++) {
      const rr = runs[r]
      if (rr.op === '=') continue
      let del = null, ins = null
      if (rr.op === '-') { del = rr.a; if (runs[r + 1]?.op === '+') { ins = runs[r + 1].b; r++ } }
      else { ins = rr.b; if (runs[r + 1]?.op === '-') { del = runs[r + 1].a; r++ } }
      let bpos
      if (del) bpos = del[0]
      else {
        let k = r - 1
        while (k >= 0 && runs[k].op !== '=') k--
        bpos = k >= 0 ? runs[k].a[1] : 0
      }
      const bText = del ? B.slice(del[0], del[1]) : ''
      const wText = ins ? W.slice(ins[0], ins[1]) : ''
      const wpos = ins ? ins[0] : null
      const anchor = bmap[Math.min(bpos, bmap.length - 1)]
      hunks.push({ ch: bc.no, para: anchor?.para, off: anchor?.off, bStart: bpos, bEnd: bpos + bText.length, bText, wText,
        wCtx: wpos != null ? W.slice(Math.max(0, wpos - 8), wpos) + '[' + wText + ']' + W.slice(wpos + wText.length, wpos + wText.length + 8) : null })
    }
  }
  fs.writeFileSync(path.join(HERE, `hunks-${name}.json`), JSON.stringify(hunks, null, 1))
  fs.writeFileSync(path.join(HERE, `coverage-${name}.json`), JSON.stringify(coverage, null, 1))
  const matched = coverage.filter((c) => c.ratio >= 0.6).length
  console.log(name, 'paras', coverage.length, 'matched>=0.6', matched, (matched / coverage.length * 100).toFixed(1) + '%', 'hunks', hunks.length)
}
run('quanxue', loadQuanxue())
run('gushiwen', loadGushiwen())
