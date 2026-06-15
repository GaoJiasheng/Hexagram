import { Link } from 'react-router-dom'
import texts from '../../../data/dao/texts.json'
import { getReadingProgress } from '../../yijing/storage.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'

const STATUS_LABEL = { pending: '整理中', partial: '可读·译注中', done: '可阅读' }

// 今日一章:按 日期 hash 定一书一章(每日变),链到该章
function pickToday() {
  const readable = texts.filter((t) => t.status === 'done' && t.sections > 0)
  if (!readable.length) return null
  const d = new Date()
  const s = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}|/dao`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const book = readable[h % readable.length]
  const ch = book.sections > 1 ? (h % book.sections) + 1 : 1
  const to = book.singlePage ? `/dao/${book.slug}` : `/dao/${book.slug}/${ch}`
  return { book, ch, to }
}

// 道藏模块首页 — 书架(v4 §3.6;v10 §6 续读入口)
export default function DaoHomePage() {
  usePageTitle(null, '观道')
  const progress = getReadingProgress()
  const today = pickToday()
  return (
    <div className="dao-home">
      <div className="page-header">
        <h1 className="page-title">道藏研读</h1>
        <p className="page-subtitle">道德经、南华内篇、参同契等六部道家入门经典——原文、白话译注、每章延伸俱全。</p>
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
