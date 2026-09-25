// node show.mjs idx... :显示本站原文与两见证本原文的对应片段(带标点)
import fs from 'fs'
import { loadBase, loadQuanxue, loadGushiwen, norm, isGanzhiLine } from './lib.mjs'
const S = JSON.parse(fs.readFileSync('sites.json', 'utf8'))
const base = loadBase(), Q = loadQuanxue(), G = loadGushiwen()
const rawCh = (w, ch) => w[ch - 1].paras.filter((t) => !isGanzhiLine(t)).join('¶')
function locate(raw, anchorL, anchorR) {
  const n = norm(raw, { doFold: true })
  let i = anchorL ? n.s.indexOf(anchorL) : -1
  if (i < 0 && anchorR) { const j = n.s.indexOf(anchorR); if (j >= 0) i = j - 1 }
  if (i < 0) return '（未定位）'
  const o = n.map[i + (anchorL ? anchorL.length : 0)] ?? raw.length
  return raw.slice(Math.max(0, o - 30), o + 40)
}
for (const a of process.argv.slice(2)) {
  const x = S[+a]
  const p = base[x.ch - 1].paras[x.para].original
  console.log(`#${a} ${x.ch}.${x.para} 本: ${p.slice(Math.max(0, x.oStart - 40), x.oStart)}【${p.slice(x.oStart, x.oEnd)}】${p.slice(x.oEnd, x.oEnd + 40)}`)
  const bc = norm(p)
  // 左锚:本站归一串位置前 6 字
  const nb = norm(base[x.ch - 1].paras.filter(q => !q.skip).map(q => q.original).join('¶'))
  const L = x.L2 ? null : null
  const cB = JSON.parse(fs.readFileSync('basechap.json', 'utf8'))[x.ch - 1].B
  const bs = cB.indexOf(norm(p).s) // 段在章串中的起点
  let k = 0; const m = norm(p).map; while (k < m.length && m[k] < x.oStart) k++
  const pos = bs + k
  const aL = cB.slice(Math.max(0, pos - 6), pos), aR = cB.slice(pos + x.bText.length, pos + x.bText.length + 6)
  console.log(`   Q: ${locate(rawCh(Q, x.ch), aL, aR)}`)
  console.log(`   G: ${locate(rawCh(G, x.ch), aL, aR)}`)
}
