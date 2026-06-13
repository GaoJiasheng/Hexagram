import { Link } from 'react-router-dom'
import { CLASSICS_META } from '../data.js'
import { getReadingProgress } from '../storage.js'

export default function ClassicsListPage() {
  const progress = getReadingProgress()

  return (
    <div className="classics-list-page">
      <div className="page-header">
        <h1 className="page-title">经传通读</h1>
        <p className="page-subtitle text-soft">系辞·说卦·序卦·杂卦，十翼经典通读</p>
      </div>
      <div className="classics-list">
        {CLASSICS_META.map(book => {
          const done = progress[book.key] || 0
          const pct = Math.min(100, Math.round((done / book.chapters) * 100))
          return (
            <Link key={book.key} to={`/classics/${book.key}/${done || 1}`} className="classics-card">
              <div className="classics-card__header">
                <h2 className="classics-card__title">{book.title}</h2>
                <span className="classics-card__chapters">{book.chapters}章</span>
              </div>
              <p className="classics-card__desc">{book.desc}</p>
              <div className="classics-card__progress">
                <div className="classics-card__progress-bar" style={{ width: `${pct}%` }} />
              </div>
              {done > 0 && (
                <p className="classics-card__progress-text text-faint">继续读:第{done}章 →</p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
