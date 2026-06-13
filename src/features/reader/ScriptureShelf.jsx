import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { getReadingProgress } from '../yijing/storage.js'

const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 通用书架首页(v15)——读经类站的首页,列书目;status≠pending 时卡片可点进阅读。
// 仿 DaoHomePage 的 dao-shelf/dao-book 样式(主色由 [data-site] 主题驱动);续读入口同 v10 §6。
export default function ScriptureShelf({ texts, title, subtitle, basePath, brand }) {
  usePageTitle(null, brand)
  const progress = getReadingProgress()
  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="dao-shelf">
        {texts.map(t => {
          const inner = (
            <>
              <div className="dao-book__title">{t.title}</div>
              {t.alias && <div className="dao-book__alias">{t.alias}</div>}
              <div className="dao-book__meta">
                <span>{t.era}</span>
                <span>{t.sections} {t.sectionUnit}</span>
              </div>
              <p className="dao-book__brief">{t.brief}</p>
              <span className={`dao-book__status dao-book__status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
              {progress[t.slug] > 0 && t.sections > 1 && t.status !== 'pending' && (
                <span className="dao-book__continue">读至第 {progress[t.slug]} {t.sectionUnit}</span>
              )}
            </>
          )
          return t.status === 'pending'
            ? <div key={t.slug} className="dao-book dao-book--pending" aria-disabled="true">{inner}</div>
            : <Link key={t.slug} to={`${basePath}/${t.slug}`} className="dao-book">{inner}</Link>
        })}
      </div>
    </div>
  )
}
