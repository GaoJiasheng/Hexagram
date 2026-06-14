import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  paraLabel = () => null,
  header = null,
  sectionUnit = '章',
}) {
  const { settings, setSettings } = useSettings()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const single = mode === 'single'
  const multi = chapters.length > 1

  // 单页:hash 锚点定位(目录点击跳章);rAF 等布局完成再定位,长经更稳
  useEffect(() => {
    if (!single || !hash) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)))
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [single, hash])

  // 移动端章节下拉(桌面侧栏目录 @≤768px 被隐藏时的替代入口)
  const jumpTo = (no) => {
    if (!no) return
    if (single) {
      const el = document.getElementById(anchorId(no))
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })  // 同章再选也能滚
      navigate(`#${anchorId(no)}`)
    } else {
      navigate(chapterHref(no))
    }
  }

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

  const Para = (no, p, i) => {
    const label = paraLabel(no, i)
    const text = <ClassicText original={p.original} translation={p.translation} anchors={getAnchors(no, i)} />
    if (!label) return <ClassicText key={i} original={p.original} translation={p.translation} anchors={getAnchors(no, i)} />
    return (
      <div key={i} className="read-para">
        <span className="read-para__num">{label}</span>
        <div className="read-para__body">{text}</div>
      </div>
    )
  }

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
        {multi && (
          <div className="read-toc-mobile">
            <label htmlFor="read-toc-select" className="read-toc-mobile__label">{single ? '跳转章节' : '章节'}</label>
            <select
              id="read-toc-select"
              className="read-toc-mobile__select"
              value={single ? '' : chapter}
              onChange={(e) => jumpTo(Number(e.target.value))}
            >
              {single && <option value="">选择章节…</option>}
              {chapters.map((c) => (
                <option key={c.no} value={c.no}>{chapterLabel(c)}</option>
              ))}
            </select>
          </div>
        )}
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
          if (!cur) return (
            <div className="read-notfound">
              <p className="text-faint">没有第 {chapter} {sectionUnit}（本篇共 {chapters.length} {sectionUnit}）。</p>
              <p className="read-notfound__links">
                <Link to={chapterHref(1)} className="read-toc__back">去第一{sectionUnit}</Link>
                <span className="read-notfound__sep"> · </span>
                {tocBack}
              </p>
            </div>
          )
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
