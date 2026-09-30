// 唐诗「体裁 × 诗人」矩阵 的校验闸(design-v24 §14)。
// 数据 src/data/tangshi/tangshi-poets.json 由 scripts/gen-tangshi-poets.mjs 从抓取缓存(诗页 header 的 author)与站内原文派生;这里回查:
//   · 每首的 (ch, para) 指向该章一个诗题段(「《题》」),题与之相等;同一首不许算给两人
//   · 每章的首数 = 该章诗题段数;总首数 = 全书诗题段数(一首不漏、不多)
//   · 诗人名非空、不重;n = poems.length
import path from 'node:path'

export const OUT = 'src/data/tangshi/tangshi-poets.json'
export const SRC = 'src/data/tangshi/classics/tangshi300.json'

export default function check({ ROOT, err, info, readJson }) {
  const tag = '唐诗诗人矩阵'
  const data = readJson(path.join(ROOT, OUT))
  const book = readJson(path.join(ROOT, SRC))
  if (!Array.isArray(data?.poets) || !Array.isArray(data?.groups)) { err(`${tag}: ${OUT} 缺 poets / groups`); return }
  const byNo = new Map(book.chapters.map((c) => [c.no, c]))
  const headsOf = (c) => c.paragraphs.map((p, i) => (/^《.+》$/.test(p.original) ? i : -1)).filter((i) => i >= 0)
  const heads = new Map(book.chapters.map((c) => [c.no, headsOf(c)]))
  for (const g of data.groups) {
    const c = byNo.get(g.ch)
    if (!c) { err(`${tag}: 第 ${g.ch} 章不存在`); continue }
    if (g.n !== heads.get(g.ch).length) err(`${tag}: 第 ${g.ch} 章记 ${g.n} 首,原文有 ${heads.get(g.ch).length} 个诗题段`)
    if (g.title !== c.title) err(`${tag}: 第 ${g.ch} 章题「${g.title}」≠ 原文「${c.title}」`)
  }
  const seen = new Map()
  const names = new Set()
  let total = 0
  for (const p of data.poets) {
    if (!p.name || typeof p.name !== 'string') { err(`${tag}: 诗人缺 name`); continue }
    if (names.has(p.name)) err(`${tag}: 诗人「${p.name}」重复`)
    names.add(p.name)
    if (!Array.isArray(p.poems) || p.poems.length !== p.n) err(`${tag} ${p.name}: n=${p.n} ≠ poems ${p.poems?.length}`)
    for (const q of p.poems || []) {
      const c = byNo.get(q.ch)
      const para = c?.paragraphs?.[q.para]?.original
      if (!para) { err(`${tag} ${p.name}《${q.title}》: ${q.ch}.${q.para} 不存在`); continue }
      if (para !== `《${q.title}》`) err(`${tag} ${p.name}《${q.title}》: 第 ${q.ch} 章第 ${q.para} 段不是这个诗题(${para.slice(0, 16)})`)
      const k = `${q.ch}.${q.para}`
      if (seen.has(k)) err(`${tag}: ${k}《${q.title}》既算给「${seen.get(k)}」又算给「${p.name}」`)
      seen.set(k, p.name)
      total++
    }
  }
  const allHeads = [...heads.values()].reduce((n, a) => n + a.length, 0)
  if (total !== allHeads) err(`${tag}: 诗人表共 ${total} 首,原文诗题段 ${allHeads} 个`)
  info(`${tag}: ${data.poets.length} 家 · ${total} 首 · 最多 ${data.poets[0]?.name} ${data.poets[0]?.n} 首`)
}
