import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { loadClassics, CLASSICS_META, hexagramById } from '../data.js'
import ClassicText from '../components/ClassicText.jsx'
import { saveReadingProgress } from '../storage.js'
import { useSettings } from '../SettingsContext.jsx'
import { getClassicAnchors } from '../zhushiAnchored.js'

const HEX_NAMES = new Set()
for (const [, h] of hexagramById) HEX_NAMES.add(h.name)

// 仅链接明确的卦名(避免"乾坤"连用误链; 必须独立成词)
function linkHexNames(text) {
  if (!text) return text
  const parts = []
  let i = 0
  while (i < text.length) {
    let matched = false
    // Try to match a hexagram name at current position
    for (const name of HEX_NAMES) {
      if (text.startsWith(name, i) && name.length === 1) {
        // Single-char names: only link if followed by '卦' or '之' or surrounded by non-char
        const next = text[i + 1]
        if (next === '卦' || next === '之' || next === '，' || next === '。' || next === undefined || next === ' ') {
          // check it's a known single char name
          const hexArr = [...hexagramById.values()]
          const hex = hexArr.find(h => h.name === name)
          if (hex) {
            parts.push(<Link key={i} to={`/hexagram/${hex.id}`} className="classic-hex-link">{name}</Link>)
            i += name.length
            matched = true
            break
          }
        }
      } else if (text.startsWith(name, i) && name.length > 1) {
        const hexArr = [...hexagramById.values()]
        const hex = hexArr.find(h => h.name === name)
        if (hex) {
          parts.push(<Link key={i} to={`/hexagram/${hex.id}`} className="classic-hex-link">{name}</Link>)
          i += name.length
          matched = true
          break
        }
      }
    }
    if (!matched) {
      if (typeof parts[parts.length - 1] === 'string') {
        parts[parts.length - 1] += text[i]
      } else {
        parts.push(text[i])
      }
      i++
    }
  }
  return parts
}

const FONT_SCALES = [0.9, 1, 1.15]

export default function ClassicsReadPage() {
  const { book, chapter: chapterParam } = useParams()
  const navigate = useNavigate()
  const { settings, setSettings } = useSettings()
  const [classics, setClassics] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const tocRef = useRef(null)

  const meta = CLASSICS_META.find(m => m.key === book)

  useEffect(() => {
    setLoading(true)
    loadClassics(book)
      .then(data => { setClassics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book])

  useEffect(() => {
    if (classics) {
      saveReadingProgress(book, chapter)
      window.scrollTo(0, 0)
    }
  }, [book, chapter, classics])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!classics) return <div className="page-content"><p className="text-faint">经传文件未找到: {book}</p></div>

  const currentChapter = classics.chapters.find(c => c.no === chapter)
  const totalChapters = classics.chapters.length

  return (
    <div className="read-page">
      {/* 左侧目录 */}
      <nav className="read-toc" ref={tocRef} aria-label="章节目录">
        <div className="read-toc__title">{meta?.title || classics.title}</div>
        {classics.chapters.map(c => (
          <Link
            key={c.no}
            to={`/classics/${book}/${c.no}`}
            className={`read-toc__item ${c.no === chapter ? 'read-toc__item--active' : ''}`}
          >
            第{c.no}章
          </Link>
        ))}
      </nav>

      {/* 正文 */}
      <main className="read-content">
        <div className="read-toolbar">
          <div className="seg-control">
            {FONT_SCALES.map(s => (
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
            <h2 className="read-chapter-title">第{chapter}章</h2>
            {currentChapter.paragraphs.map((p, i) => (
              <ClassicText
                key={i}
                original={p.original}
                translation={p.translation}
                anchors={getClassicAnchors(book, currentChapter.no, i)}
              />
            ))}
          </>
        ) : (
          <p className="text-faint">第{chapter}章不存在</p>
        )}

        <div className="read-nav">
          {chapter > 1 ? (
            <Link to={`/classics/${book}/${chapter - 1}`} className="read-nav__prev">← 第{chapter - 1}章</Link>
          ) : <span />}
          {chapter < totalChapters && (
            <Link to={`/classics/${book}/${chapter + 1}`} className="read-nav__next">第{chapter + 1}章 →</Link>
          )}
        </div>
      </main>
    </div>
  )
}
