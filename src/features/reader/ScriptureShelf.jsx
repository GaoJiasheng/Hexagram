import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { getReadingProgress } from '../yijing/storage.js'

const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 通用书架首页(v15)——读经类站的首页,列书目;status≠pending 时卡片可点进阅读。
// 仿 DaoHomePage 的 dao-shelf/dao-book 样式(主色由 [data-site] 主题驱动);续读入口同 v10 §6。
// 今日一章:按 日期+站点 hash 定一书一章(各站不同、每日变),链到该章
function pickToday(texts, basePath) {
  const readable = texts.filter((t) => t.status === 'done' && t.sections > 0)
  if (!readable.length) return null
  const d = new Date()
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|${basePath}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const book = readable[h % readable.length]
  const ch = book.sections > 1 ? (h % book.sections) + 1 : 1
  const to = book.singlePage ? `${basePath}/${book.slug}` : `${basePath}/${book.slug}/${ch}`
  return { book, ch, to }
}

export default function ScriptureShelf({ texts, title, subtitle, basePath, brand }) {
  usePageTitle(null, brand)
  const progress = getReadingProgress()
  const today = pickToday(texts, basePath)
  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {today && (
        <Link to={today.to} className="shelf-today">
          <span className="shelf-today__badge">今日一章</span>
          <span className="shelf-today__book">
            《{today.book.title}》{today.book.sections > 1 ? `· 第 ${today.ch} ${today.book.sectionUnit}` : ''}
          </span>
          <span className="shelf-today__arrow" aria-hidden="true">→</span>
        </Link>
      )}

      <div className="dao-shelf">
        {texts.map(t => {
          const inner = (
            <>
              <div className="dao-book__title">{t.title}</div>
              {t.alias && <div className="dao-book__alias">{t.alias}</div>}
              {t.dubious && <div className="dao-book__dubious">⚠ 托名·疑现代伪作</div>}
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
