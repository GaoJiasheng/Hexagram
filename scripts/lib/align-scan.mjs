// 译文对位扫描(2026-09-19):装配器只核「译文条数 = 段数」,查不出**整段错位**(第 i 条译的是第 i±1 段)。
// 白话直译会保留原文里的大量实字(干支、五行、术语、人名),所以可以拿「原文用字在译文里的留存率」当对位信号:
//   keep(i, j) = 原文第 i 段的汉字(去虚字)有多大比例出现在第 j 段译文里
// 若连续 ≥3 段都是「邻段译文比本段译文更像」(差值 > 0.2),判为一处错位。短句多的歌赋也抓得住。
const STOP = new Set([...'之乎者也而其于以为则所与或若乃亦且矣焉哉不有无是此彼曰云'])
const han = (s) => [...String(s || '')].filter((c) => /[一-鿿]/.test(c) && !STOP.has(c))
const keep = (orig, tr) => { const o = han(orig); if (o.length < 4) return null; const t = new Set(han(tr)); return o.filter((c) => t.has(c)).length / o.length }

/** @returns {{ch:number, from:number, to:number, dir:number}[]} 每处错位:章号、起止段、方向(+1 = 译文后移一段) */
export function scanMisalign(book) {
  const out = []
  for (const c of book.chapters || []) {
    const ps = c.paragraphs
    for (const dir of [1, -1]) {
      let run = []
      const flush = () => { if (run.length >= 3) out.push({ ch: c.no, from: run[0], to: run[run.length - 1], dir }); run = [] }
      ps.forEach((p, i) => {
        const self = p.translation ? keep(p.original, p.translation) : null
        const nb = ps[i + dir]?.translation ? keep(p.original, ps[i + dir].translation) : null
        if (p.pillars || self === null || nb === null) { if (!p.pillars) flush(); return }
        if (nb - self > 0.2 && nb > 0.45) run.push(i); else flush()
      })
      flush()
    }
  }
  return out
}
