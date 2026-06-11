import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import HexagramFigure from '../components/HexagramFigure.jsx'
import TrigramBadge from '../components/TrigramBadge.jsx'
import ClassicText from '../components/ClassicText.jsx'
import LineRow from '../components/LineRow.jsx'
import DerivationStrip from '../components/DerivationStrip.jsx'
import NoteEditor from '../components/NoteEditor.jsx'
import { getHexagram, hexagramByBinary } from '../data.js'
import { getBianGua, lineTitle } from '../engine/transforms.js'
import { addRecentHexagram, getBookmarks, toggleBookmark } from '../storage.js'
import { useSettings } from '../SettingsContext.jsx'

export default function HexagramDetailPage() {
  const { id } = useParams()
  const hex = getHexagram(Number(id))
  const navigate = useNavigate()
  const { settings, setSettings } = useSettings()

  const [previewLine, setPreviewLine] = useState(null) // 1-indexed or null
  const [hoveredLine, setHoveredLine] = useState(null)
  const [bookmarked, setBookmarked] = useState(() => getBookmarks().includes(Number(id)))
  const [tuanOpen, setTuanOpen] = useState(true)
  const [xiangOpen, setXiangOpen] = useState(true)
  const [wenyangOpen, setWenyangOpen] = useState(false)

  useEffect(() => {
    if (hex) {
      addRecentHexagram(hex.id)
      setPreviewLine(null)
      setBookmarked(getBookmarks().includes(hex.id))
    }
  }, [id])

  if (!hex) {
    return (
      <div className="page-content">
        <p className="text-faint">未找到第 {id} 卦</p>
        <Link to="/hexagrams" className="btn btn--secondary">返回总览</Link>
      </div>
    )
  }

  const prevHex = getHexagram(hex.id - 1)
  const nextHex = getHexagram(hex.id + 1)

  // 头部卦画: 点击爻预览变卦
  const previewBinary = previewLine != null
    ? getBianGua(hex.binary, [previewLine])
    : hex.binary
  const previewHex = previewLine != null ? hexagramByBinary.get(previewBinary) : null

  function handleLineClick(pos) {
    setPreviewLine(prev => prev === pos ? null : pos)
  }

  function handleBookmark() {
    const next = toggleBookmark(hex.id)
    setBookmarked(next.includes(hex.id))
  }

  // 判断爻的标记: 爻位置 → lineTitle
  function getMovingLabel() {
    if (previewLine == null) return null
    const lt = lineTitle(previewLine, hex.binary[previewLine - 1] === '1')
    return lt
  }

  return (
    <div className="detail-page">
      {/* 右侧锚点目录 */}
      <nav className="detail-toc" aria-label="页面目录">
        <a href="#judgment">卦辞</a>
        <a href="#tuan">彖</a>
        <a href="#xiang">象</a>
        <a href="#lines">六爻</a>
        {hex.extra?.wenyan && <a href="#wenyan">文言</a>}
        <a href="#related">关联</a>
        <a href="#note">笔记</a>
      </nav>

      <div className="detail-content">
        {/* ① 头部 */}
        <header className="detail-header">
          <div className="detail-header__figure">
            <HexagramFigure
              binary={previewBinary}
              size="lg"
              interactive="toggle-moving"
              movingLines={previewLine ? [previewLine] : []}
              onLineClick={handleLineClick}
              highlightLine={hoveredLine}
              label={`${hex.fullName}卦画，点击爻预览变卦`}
            />
            {previewHex && previewLine != null && (
              <div className="detail-preview-card">
                <span className="detail-preview-card__label">{getMovingLabel()}动</span>
                <span className="detail-preview-card__arrow">→</span>
                <Link to={`/hexagram/${previewHex.id}`} className="detail-preview-card__link">
                  <strong>变为{previewHex.fullName}</strong>
                  <span>第{previewHex.id}卦 →</span>
                </Link>
                <button className="detail-preview-card__close" onClick={() => setPreviewLine(null)} aria-label="还原">✕</button>
              </div>
            )}
          </div>

          <div className="detail-header__info">
            <div className="detail-header__name-row">
              <h1 className="detail-header__name">{hex.name}</h1>
              <span className="detail-header__seal" aria-hidden="true">{hex.name}</span>
            </div>
            <p className="detail-header__pinyin">{hex.pinyin} · 第{hex.id}卦</p>
            <div className="detail-header__trigrams">
              <TrigramBadge trigramId={hex.upperTrigram} /> 上
              <span className="detail-header__sep">·</span>
              <TrigramBadge trigramId={hex.lowerTrigram} /> 下
            </div>
            <p className="detail-header__fullname">{hex.fullName}</p>
            <DerivationStrip hexagram={hex} />
            <div className="detail-header__actions">
              <button
                className={`bookmark-btn ${bookmarked ? 'bookmark-btn--active' : ''}`}
                onClick={handleBookmark}
                aria-label={bookmarked ? '取消收藏' : '收藏此卦'}
              >
                {bookmarked ? '★ 已收藏' : '☆ 收藏'}
              </button>
              <Link to={`/workbench?gua=${hex.id}`} className="btn btn--primary">
                以此卦推演 →
              </Link>
            </div>
          </div>
        </header>

        {/* 译文开关 */}
        <div className="detail-toggle-row">
          <label className="toggle-label">
            <span>显示译文</span>
            <button
              className={`toggle-btn ${settings.showTranslation ? 'toggle-btn--on' : ''}`}
              onClick={() => setSettings({ showTranslation: !settings.showTranslation })}
              aria-pressed={settings.showTranslation}
            >
              {settings.showTranslation ? '译' : '原'}
            </button>
          </label>
        </div>

        {/* ② 卦辞 */}
        <section id="judgment" className="detail-section">
          <h2 className="detail-section__title">卦辞</h2>
          <ClassicText original={hex.judgment.original} translation={hex.judgment.translation} />
        </section>

        {/* ③ 彖传 */}
        <section id="tuan" className="detail-section">
          <button className="detail-section__toggle" onClick={() => setTuanOpen(o => !o)}>
            <h2 className="detail-section__title">彖传</h2>
            <span>{tuanOpen ? '▲' : '▼'}</span>
          </button>
          {tuanOpen && <ClassicText original={hex.tuan.original} translation={hex.tuan.translation} />}
        </section>

        {/* ③ 大象传 */}
        <section id="xiang" className="detail-section">
          <button className="detail-section__toggle" onClick={() => setXiangOpen(o => !o)}>
            <h2 className="detail-section__title">象传</h2>
            <span>{xiangOpen ? '▲' : '▼'}</span>
          </button>
          {xiangOpen && <ClassicText original={hex.daxiang.original} translation={hex.daxiang.translation} />}
        </section>

        {/* ④ 六爻 — 初爻在上方(按阅读顺序) */}
        <section id="lines" className="detail-section">
          <h2 className="detail-section__title">六爻</h2>
          <div className="lines-list">
            {hex.lines.map((line, i) => (
              <LineRow
                key={i}
                line={line}
                pos={i + 1}
                binary={hex.binary}
                onHover={setHoveredLine}
                isHighlighted={hoveredLine === i + 1}
              />
            ))}
            {/* 用九/用六 */}
            {hex.extra?.use && (
              <div className="line-row line-row--use">
                <div className="line-row__header">
                  <span className="line-row__title">{hex.extra.use.title}</span>
                </div>
                <p className="line-row__text">{hex.extra.use.original}</p>
                {hex.extra.use.xiaoxiang?.original && (
                  <p className="line-row__xiaoxiang">{hex.extra.use.xiaoxiang.original}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ⑤ 文言传(仅乾坤) */}
        {hex.extra?.wenyan?.length > 0 && (
          <section id="wenyan" className="detail-section">
            <button className="detail-section__toggle" onClick={() => setWenyangOpen(o => !o)}>
              <h2 className="detail-section__title">文言传</h2>
              <span>{wenyangOpen ? '▲' : '▼'}</span>
            </button>
            {wenyangOpen && (
              <div className="wenyan-body">
                {hex.extra.wenyan.map((para, i) => (
                  <ClassicText key={i} original={para.original} translation={para.translation} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ⑥ 关联 */}
        <section id="related" className="detail-section">
          <h2 className="detail-section__title">关联</h2>
          {hex.xugua && <p className="related-text"><span className="related-label">序卦：</span>{hex.xugua}</p>}
          {hex.zagua && <p className="related-text"><span className="related-label">杂卦：</span>{hex.zagua}</p>}
        </section>

        {/* ⑦ 笔记 */}
        <section id="note" className="detail-section">
          <NoteEditor hexagramId={hex.id} />
        </section>

        {/* prev/next */}
        <div className="detail-nav">
          {prevHex ? (
            <Link to={`/hexagram/${prevHex.id}`} className="detail-nav__prev">
              ← 第{prevHex.id}卦 {prevHex.name}
            </Link>
          ) : <span />}
          {nextHex && (
            <Link to={`/hexagram/${nextHex.id}`} className="detail-nav__next">
              第{nextHex.id}卦 {nextHex.name} →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
