import { useParams, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ClassicText from '../../yijing/components/ClassicText.jsx'
import { useSettings } from '../../yijing/SettingsContext.jsx'
import { saveReadingProgress } from '../../yijing/storage.js'
import { loadDaoText, getDaoMeta } from '../data.js'
import { getDaoAnchors } from '../daoAnchored.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import YanyiBlock from '../components/YanyiBlock.jsx'

const FONT_SCALES = [0.9, 1, 1.15]

// 短经单页阅读器(v13 §1):题解 + 全文一页铺开 + 章末延伸 + 左侧章节锚点
export default function DaoSinglePage({ slug, text }) {
  const { settings, setSettings } = useSettings()
  const { hash } = useLocation()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const meta = getDaoMeta(slug)
  usePageTitle(text?.title, '观道')

  useEffect(() => {
    setLoading(true)
    loadDaoText(slug)
      .then((data) => { setBook(data); setLoading(false); saveReadingProgress(slug, data.chapters.length) })
      .catch(() => setLoading(false))
  }, [slug])

  // 章节锚点定位(左侧目录点击)
  useEffect(() => {
    if (!book || !hash) return
    const t = setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [book, hash])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典: {slug}</p>
        <Link to="/dao" className="btn btn--secondary">返回道藏</Link>
      </div>
    )
  }

  const multi = book.chapters.length > 1
  const label = (c) => c.title ?? (multi ? `第${c.no}${meta.sectionUnit}` : '全文')

  return (
    <div className="read-page dao-single">
      {/* 左侧目录:章节锚点 */}
      <nav className="read-toc" aria-label="章节目录">
        <div className="read-toc__title">
          <Link to="/dao" className="read-toc__back">← 道藏</Link>
        </div>
        {book.chapters.map((c) => (
          <a key={c.no} href={`#dao-ch-${c.no}`} className="read-toc__item">{label(c)}</a>
        ))}
      </nav>

      {/* 正文 */}
      <main className="read-content">
        <div className="dao-text-header">
          <h1 className="dao-text-title">{text.title}</h1>
          <p className="dao-text-meta">{text.alias} · {text.era} · {text.attribution}</p>
          <p className="dao-text-brief">{text.brief}</p>
          {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
        </div>

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

        {book.chapters.map((c) => (
          <section key={c.no} id={`dao-ch-${c.no}`} className="dao-single__chapter">
            {multi && <h2 className="read-chapter-title">{label(c)}</h2>}
            {c.paragraphs.map((p, i) => (
              <ClassicText
                key={i}
                original={p.original}
                translation={p.translation}
                anchors={getDaoAnchors(slug, c.no, i)}
              />
            ))}
            <YanyiBlock slug={slug} chapter={c.no} />
          </section>
        ))}
      </main>
    </div>
  )
}
