// node grepw.mjs <ch> <短语>:在两见证本该章原文里查短语(归一后)并显示上下文
import { loadQuanxue, loadGushiwen, loadBase, norm } from './lib.mjs'
const [ch, ...ks] = process.argv.slice(2)
const Q = loadQuanxue(), G = loadGushiwen(), B = loadBase()
for (const k of ks) {
  for (const [name, w] of [['本', B[ch - 1].paras.filter(p => !p.skip).map(p => p.original)], ['Q', Q[ch - 1].paras], ['G', G[ch - 1].paras]]) {
    const raw = w.join('¶'); const n = norm(raw); const kk = norm(k).s
    let i = n.s.indexOf(kk); if (i < 0) { console.log(name, k, '—'); continue }
    while (i >= 0) { const o = n.map[i]; console.log(name, k, raw.slice(Math.max(0, o - 25), o + 30)); i = n.s.indexOf(kk, i + 1) }
  }
}
