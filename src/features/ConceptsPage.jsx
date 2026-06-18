import { Link } from 'react-router-dom'
import concepts from '../data/concepts.json'
import { bookBySlug, chapterHref } from './reader/booksIndex.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { TOPICS as DEBATES } from './debates/debates.js'

// 义理专题 · 跨派概念(#150/#151)——复用 concepts.json(义理互见的同一份策展数据),
// 把每个概念聚类铺成一题:概念释 + 各书最具代表的一章链接,跨组对读。挂总门户(天然跨组,
// 中立外壳)。与「桥」「义理互见」同源:人工策展、grep 验证,不泛滥。
export default function ConceptsPage() {
  usePageTitle('义理专题')
  return (
    <div className="concepts-page page-content">
      <div className="basics-breadcrumb">
        <Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">义理专题 · 跨派概念</h1>
        <p className="page-subtitle text-soft">同一名相,诸家如何各自言说。每题列各书最具代表的一章,点入对读。</p>
      </div>

      <div className="concepts-list">
        {concepts.clusters.map((c) => {
          const debate = DEBATES.find((t) => t.concept === c.term)
          return (
          <section key={c.term} className="concept-card">
            <h2 className="concept-card__term">{c.term}{debate && <Link to={`/debates/${debate.id}`} className="concept-card__debate">→ 入争鸣</Link>}</h2>
            <p className="concept-card__gloss">{c.gloss}</p>
            <div className="concept-card__loci">
              {c.loci.map((l) => {
                const b = bookBySlug(l.slug)
                return b ? (
                  <Link key={l.label} to={chapterHref(b, l.ch)} className="concept-card__locus">{l.label} →</Link>
                ) : null
              })}
            </div>
          </section>
          )
        })}
      </div>

      <p className="concepts-page__note text-faint">
        诸题由人工策展,各章均经原文核验确含该概念;读经时章末「义理互见」亦会就近指引。
      </p>
    </div>
  )
}
