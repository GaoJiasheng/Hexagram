import { Link } from 'react-router-dom'

// 组内跨书参引(#5):把延伸文本里同组其他书名自动链到该书。
// refs:[{title,to}] 长名优先;earliest-then-longest 避免重叠误切。守分组隔离——只在本组书目内匹配。
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

// 构建某组的参引表(跳当前书);剥书名尾部括注(如「战国策(选)」→「战国策」)便于匹配。
export function buildRefs(books, homeBase, currentSlug) {
  return books
    .filter((b) => b.slug !== currentSlug && b.title)
    .map((b) => ({ title: b.title.replace(/[（(][^）)]*[)）]\s*$/, ''), to: `${homeBase}/${b.slug}` }))
    .filter((r) => r.title.length >= 2)
    .sort((a, b) => b.title.length - a.title.length)
}
