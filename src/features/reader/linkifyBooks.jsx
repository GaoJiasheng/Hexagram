import { Link } from 'react-router-dom'

// 跨书参引:把延伸文本里出现的书名自动链到该书。refs 由 booksIndex.globalBookRefs 提供(全站,#139)。
// refs:[{title,to}] 长名优先;earliest-then-longest 避免重叠误切(如「大学问」不被「大学」截断)。
export function linkifyBooks(text, refs) {
  if (!Array.isArray(refs) || !refs.length || typeof text !== 'string') return text
  const nodes = []
  let rest = text
  let key = 0
  while (rest) {
    let best = null
    for (const r of refs) {
      const idx = rest.indexOf(r.title)
      if (idx !== -1 && (!best || idx < best.idx || (idx === best.idx && r.title.length > best.len))) {
        best = { idx, title: r.title, to: r.to, len: r.title.length }
      }
    }
    if (!best) { nodes.push(rest); break }
    if (best.idx > 0) nodes.push(rest.slice(0, best.idx))
    nodes.push(<Link key={`x${key++}`} to={best.to} className="yanyi-xref">{best.title}</Link>)
    rest = rest.slice(best.idx + best.title.length)
  }
  return nodes
}
