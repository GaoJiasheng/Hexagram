import { Link } from 'react-router-dom'
import texts from '../../../data/dao/texts.json'

const STATUS_LABEL = { pending: '整理中', partial: '部分可读', done: '可阅读' }

// 道藏模块首页 — 书架(v4 §3.6)
export default function DaoHomePage() {
  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">道藏研读</h1>
        <p className="page-subtitle">六部入门经典，自《道德经》始。经文整理中，将循易经模块同一套管线录入。</p>
      </div>

      <div className="dao-shelf">
        {texts.map(t => (
          <Link key={t.slug} to={`/dao/${t.slug}`} className="dao-book">
            <div className="dao-book__title">{t.title}</div>
            <div className="dao-book__alias">{t.alias}</div>
            <div className="dao-book__meta">
              <span>{t.era}</span>
              <span>{t.sections} {t.sectionUnit}</span>
            </div>
            <p className="dao-book__brief">{t.brief}</p>
            <span className={`dao-book__status dao-book__status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
