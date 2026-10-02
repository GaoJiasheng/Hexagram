import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { getReadingProgress } from '../yijing/storage.js'
import { sizeTier } from './bookSizes.js'
import SchoolEntry from './SchoolEntry.jsx'
import BookOutline from './BookOutline.jsx'

const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 书少的组首页不摆书架卡,直接把每本书的目录展开(owner 2026-10-02:墨家一本、心学两本、
// 纵横两本,点一张卡再看目录是多此一举)。阈值按书数:≤ 这个数且全部可读就展开;
// 书多的组(儒 9、佛 10、道 15…)仍是书架卡——几十本书的目录摊在一页上反而找不到。
export const EXPAND_MAX_BOOKS = 2

// 通用书架首页(v15)——读经类站的首页,列书目;status≠pending 时卡片可点进阅读。
// 仿 DaoHomePage 的 dao-shelf/dao-book 样式(主色由 [data-site] 主题驱动);续读入口同 v10 §6。
// 「今日一章」卡 2026-10-01 按 owner 意见去掉(随机点一章意义不大)。
// expand:显式 true/false 可覆盖自动判断(默认按 EXPAND_MAX_BOOKS)。
export default function ScriptureShelf({ texts, title, subtitle, basePath, brand, disclaimer, corpus, expand }) {
  usePageTitle(null, brand)
  const progress = getReadingProgress()
  const expanded = expand ?? (!!corpus && texts.length > 0 && texts.length <= EXPAND_MAX_BOOKS && texts.every((t) => t.status !== 'pending'))
  return (
    <div className={`dao-home ${expanded ? 'book-home' : ''}`}>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {disclaimer && <div className="shelf-disclaimer" role="note">⚠ {disclaimer}</div>}

      {corpus && <SchoolEntry corpus={corpus} />}

      {expanded ? (
        <div className="shelf-outlines">
          {texts.map((t) => (
            <div key={t.slug} className="shelf-outline">
              <BookOutline corpus={corpus} slug={t.slug} basePath={basePath} />
            </div>
          ))}
        </div>
      ) : (
        <div className="dao-shelf">
          {texts.map(t => {
            const inner = (
              <>
                <div className="dao-book__title">{t.title}</div>
                {t.alias && <div className="dao-book__alias">{t.alias}</div>}
                {t.dubious && <div className="dao-book__dubious">⚠ 托名·疑现代伪作</div>}
                {t.caveat && !t.dubious && <div className="dao-book__caveat">⚠ {t.caveat}</div>}
                <div className="dao-book__meta">
                  <span>{t.era}</span>
                  <span>{t.sections} {t.sectionUnit}</span>
                  {sizeTier(t.slug) && <span className={`book-tier book-tier--${sizeTier(t.slug).cls}`}>{sizeTier(t.slug).label}</span>}
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
      )}
    </div>
  )
}
