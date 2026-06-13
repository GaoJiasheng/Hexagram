import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import ClassicText from '../yijing/components/ClassicText.jsx'
import { useSettings } from '../yijing/SettingsContext.jsx'

const FONT_SCALES = [0.9, 1, 1.15]

// 通用经典阅读器(v14 §3)——平台级,跨站共用。
// 易经经传 / 道藏逐章 / 短经单页 三处皆以此为核,差异全由 props 注入:
//   mode 'paged'|'single';chapters;chapter(逐章当前);tocBack(目录头);
//   chapterLabel(c);chapterHref(no)(逐章路由);anchorId(no)(单页锚点);
//   getAnchors(no,i);renderYanyi(no)?;header?(单页题解)
export default function ClassicReader({
  mode = 'paged',
  chapters,
  chapter,
  tocBack,
  chapterLabel,
  chapterHref,
  anchorId = (no) => `ch-${no}`,
  getAnchors = () => null,
  renderYanyi = () => null,
  header = null,
  sectionUnit = '章',
}) {
  const { settings, setSettings } = useSettings()
  const { hash } = useLocation()
  const single = mode === 'single'
  const multi = chapters.length > 1

  // 单页:hash 锚点定位(目录点击跳章)
  useEffect(() => {
    if (!single || !hash) return
    const t = setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [single, hash])

  const Toolbar = (
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
  )

  const Para = (no, p, i) => (
    <ClassicText key={i} original={p.original} translation={p.translation} anchors={getAnchors(no, i)} />
  )

  return (
    <div className={`read-page ${single ? 'dao-single' : ''}`}>
      <nav className="read-toc" aria-label="章节目录">
        <div className="read-toc__title">{tocBack}</div>
        {chapters.map((c) =>
          single ? (
            <a key={c.no} href={`#${anchorId(c.no)}`} className="read-toc__item">{chapterLabel(c)}</a>
          ) : (
            <Link
              key={c.no}
              to={chapterHref(c.no)}
              className={`read-toc__item ${c.no === chapter ? 'read-toc__item--active' : ''}`}
            >
              {chapterLabel(c)}
            </Link>
          ),
        )}
      </nav>

      <main className="read-content">
        {header}
        {Toolbar}

        {single ? (
          chapters.map((c) => (
            <section key={c.no} id={anchorId(c.no)} className="dao-single__chapter">
              {multi && <h2 className="read-chapter-title">{chapterLabel(c)}</h2>}
              {c.paragraphs.map((p, i) => Para(c.no, p, i))}
              {renderYanyi(c.no)}
            </section>
          ))
        ) : (() => {
          const cur = chapters.find((c) => c.no === chapter)
          if (!cur) return <p className="text-faint">第{chapter}{sectionUnit}不存在</p>
          const idx = chapters.findIndex((c) => c.no === chapter)
          const prev = chapters[idx - 1]
          const next = chapters[idx + 1]
          return (
            <>
              <h2 className="read-chapter-title">{chapterLabel(cur)}</h2>
              {cur.paragraphs.map((p, i) => Para(cur.no, p, i))}
              {renderYanyi(cur.no)}
              <div className="read-nav">
                {prev ? (
                  <Link to={chapterHref(prev.no)} className="read-nav__prev">← {chapterLabel(prev)}</Link>
                ) : <span />}
                {next && (
                  <Link to={chapterHref(next.no)} className="read-nav__next">{chapterLabel(next)} →</Link>
                )}
              </div>
            </>
          )
        })()}
      </main>
    </div>
  )
}
