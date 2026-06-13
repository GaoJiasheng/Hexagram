import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ClassicText from '../../yijing/components/ClassicText.jsx'
import { useSettings } from '../../yijing/SettingsContext.jsx'
import { saveReadingProgress } from '../../yijing/storage.js'
import { loadDaoText, getDaoMeta } from '../data.js'
import { getDaoAnchors } from '../daoAnchored.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'

const FONT_SCALES = [0.9, 1, 1.15]

// 道藏章节阅读器(v6 §3)——照经传阅读器模式:左侧目录 + 字号/译文开关 + 翻页 + 进度
export default function DaoReadPage() {
  const { slug, chapter: chapterParam } = useParams()
  const { settings, setSettings } = useSettings()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = getDaoMeta(slug)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}${meta.sectionUnit || '章'}` : null, '观道')

  useEffect(() => {
    setLoading(true)
    loadDaoText(slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (book) {
      saveReadingProgress(slug, chapter)
      window.scrollTo(0, 0)
    }
  }, [slug, chapter, book])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典: {slug}</p>
        <Link to="/dao" className="btn btn--secondary">返回道藏</Link>
      </div>
    )
  }

  const totalChapters = book.chapters.length
  const currentChapter = book.chapters.find((c) => c.no === chapter)
  const label = (c) => c.title ?? (totalChapters > 1 ? `第${c.no}${meta.sectionUnit}` : '全文')

  return (
    <div className="read-page">
      {/* 左侧目录 */}
      <nav className="read-toc" aria-label="章节目录">
        <div className="read-toc__title">
          <Link to={`/dao/${slug}`} className="read-toc__back">{book.title}</Link>
        </div>
        {book.chapters.map((c) => (
          <Link
            key={c.no}
            to={`/dao/${slug}/${c.no}`}
            className={`read-toc__item ${c.no === chapter ? 'read-toc__item--active' : ''}`}
          >
            {label(c)}
          </Link>
        ))}
      </nav>

      {/* 正文 */}
      <main className="read-content">
        <div className="read-toolbar">
          <div className="seg-control">
            {FONT_SCALES.map((s) => (
              <button
                key={s}
                className={`seg-btn ${settings.fontScale === s ? 'seg-btn--active' : ''}`}
                onClick={() => setSettings({ fontScale: s })}
              >
                {s === 0.9 ? '小' : s === 1 ? '中' : '大'}
              </button>
            ))}
          </div>
          <label className="toggle-label">
            <span>译文</span>
            <button
              className={`toggle-btn ${settings.showTranslation ? 'toggle-btn--on' : ''}`}
              onClick={() => setSettings({ showTranslation: !settings.showTranslation })}
            >
              {settings.showTranslation ? '开' : '关'}
            </button>
          </label>
        </div>

        {currentChapter ? (
          <>
            <h2 className="read-chapter-title">{label(currentChapter)}</h2>
            {currentChapter.paragraphs.map((p, i) => (
              <ClassicText
                key={i}
                original={p.original}
                translation={p.translation}
                anchors={getDaoAnchors(slug, currentChapter.no, i)}
              />
            ))}
          </>
        ) : (
          <p className="text-faint">第{chapter}{meta.sectionUnit}不存在</p>
        )}

        <div className="read-nav">
          {chapter > 1 ? (
            <Link to={`/dao/${slug}/${chapter - 1}`} className="read-nav__prev">
              ← {label(book.chapters[chapter - 2] ?? { no: chapter - 1 })}
            </Link>
          ) : <span />}
          {chapter < totalChapters && (
            <Link to={`/dao/${slug}/${chapter + 1}`} className="read-nav__next">
              {label(book.chapters[chapter] ?? { no: chapter + 1 })} →
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
