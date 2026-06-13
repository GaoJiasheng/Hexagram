import { Link } from 'react-router-dom'
import texts from '../../../data/dao/texts.json'
import { getReadingProgress } from '../../yijing/storage.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'

const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 道藏模块首页 — 书架(v4 §3.6;v10 §6 续读入口)
export default function DaoHomePage() {
  usePageTitle(null, '观道')
  const progress = getReadingProgress()
  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">道藏研读</h1>
        <p className="page-subtitle">六部入门经典，原文俱已录入，自《道德经》始逐部补全译注。</p>
      </div>

      <div className="dao-shelf">
        {texts.map(t => {
          const done = progress[t.slug] || 0
          return (
            <Link key={t.slug} to={`/dao/${t.slug}`} className="dao-book">
              <div className="dao-book__title">{t.title}</div>
              <div className="dao-book__alias">{t.alias}</div>
              <div className="dao-book__meta">
                <span>{t.era}</span>
                <span>{t.sections} {t.sectionUnit}</span>
              </div>
              <p className="dao-book__brief">{t.brief}</p>
              <span className={`dao-book__status dao-book__status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
              {done > 0 && t.sections > 1 && (
                <span className="dao-book__continue">读至第 {done} {t.sectionUnit}</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
