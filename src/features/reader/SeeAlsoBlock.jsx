import { Link } from 'react-router-dom'

// 义理互见 see-also(#141/B2)——章末跨派概念互参。groups 由 seeAlsoFor 提供(已 grep 验证),
// 空则不渲染。每组一个概念,列同聚类他书的代表章链接(跨组,经 booksIndex 解析)。
export default function SeeAlsoBlock({ groups }) {
  if (!groups?.length) return null
  return (
    <div className="seealso-block">
      {groups.map((g) => (
        <div key={g.term} className="seealso-block__group">
          <span className="seealso-block__tag">义理互见 · {g.term}</span>
          {g.gloss && <p className="seealso-block__gloss">{g.gloss}</p>}
          <div className="seealso-block__links">
            {g.items.map((it) => (
              <Link key={it.to} to={it.to} className="seealso-block__link">{it.label} →</Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
