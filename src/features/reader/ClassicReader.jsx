import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ClassicText from '../yijing/components/ClassicText.jsx'
import QuoteCard from './QuoteCard.jsx'
import { useSettings } from '../yijing/SettingsContext.jsx'
import { getCorpusMarks, toggleCorpusMark, getCorpusNotes, saveCorpusNote } from '../yijing/storage.js'

const FONT_SCALES = [0.9, 1, 1.15, 1.35]
const FONT_SCALE_LABELS = { 0.9: '小', 1: '中', 1.15: '大', 1.35: '特大' }

// 本章注疏一览(Tier 1):遍历该章各段 anchors,折叠列出,替逐词悬停。
function ChapterNotes({ chapter, getAnchors }) {
  const notes = []
  chapter.paragraphs.forEach((p, i) => {
    const ents = getAnchors(chapter.no, i)
    if (ents) ents.forEach((e) => notes.push(e))
  })
  if (!notes.length) return null
  return (
    <details className="chapter-notes">
      <summary className="chapter-notes__summary">本章注疏 · {notes.length} 条</summary>
      <dl className="chapter-notes__list">
        {notes.map((e, k) => (
          <div key={k} className="chapter-notes__item">
            <dt className="chapter-notes__term">{e.term}</dt>
            <dd className="chapter-notes__note">
              {e.note}
              {e.qiao && <Link to={e.qiao.to} className="zhu-qiao-link"> {e.qiao.label}</Link>}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

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
  renderBaihua = () => null,   // 白话模块入口条（design-v22），挂在章题之下
  paraLabel = () => null,
  header = null,
  sectionUnit = '章',
  verse = false,    // 诗体经按句读换行(黄庭等,#143)
  bookTitle = '',   // 金句卡署名用(#147)
  markCtx = null,   // {corpus, slug}:启用读经站段落收藏/笔记(Tier 2);null 则关闭
}) {
  const { settings, setSettings } = useSettings()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const single = mode === 'single'
  const multi = chapters.length > 1

  // 段落收藏 / 笔记(仅 markCtx 存在时)
  const [marks, setMarks] = useState(() => (markCtx ? getCorpusMarks() : {}))
  const [notes, setNotes] = useState(() => (markCtx ? getCorpusNotes() : {}))
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [copiedSeg, setCopiedSeg] = useState(null)
  const [cardSeg, setCardSeg] = useState(null)   // 金句卡(#147):{original, translation, source}
  // 单页长经(金刚经 32 分/黄庭 36 章铺一页)scroll-spy:点亮侧栏当前章 + 回显移动端 select(#145)。
  // 当前章 = 顶部已越过工具条线(130px)的最后一章;rAF 节流,挂载即同步算一次(不依赖后台 rAF)。
  const [activeAnchor, setActiveAnchor] = useState(null)
  useEffect(() => {
    if (!single) return
    let raf = 0
    const compute = () => {
      raf = 0
      const secs = [...document.querySelectorAll('.dao-single__chapter')]
      if (!secs.length) return
      let cur = Number(secs[0].dataset.no)
      for (const s of secs) {
        if (s.getBoundingClientRect().top <= 130) cur = Number(s.dataset.no)
        else break
      }
      setActiveAnchor(cur)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute) }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [single, chapters])
  // 长目录(道德经/难经 81 章…)章变化时把侧栏当前章滚入视野,免手动找高亮项。
  // ref 挂在 <nav> 上(plain DOM 稳),querySelector 取 active 项;直接算容器 scrollTop
  // (避免 scrollIntoView 的窗口副作用),仅在不可见时居中。useLayoutEffect 于 DOM commit 后、
  // paint 前同步执行,布局已准且不依赖 rAF(后台标签 rAF 会被节流)。
  const tocRef = useRef(null)
  useLayoutEffect(() => {
    const toc = tocRef.current
    const el = toc && toc.querySelector('.read-toc__item--active')
    if (!toc || !el || getComputedStyle(toc).display === 'none') return
    const tr = toc.getBoundingClientRect(), er = el.getBoundingClientRect()
    if (er.top < tr.top || er.bottom > tr.bottom) {
      toc.scrollTop += (er.top - tr.top) - tr.height / 2 + er.height / 2
    }
  }, [chapter, activeAnchor])
  function copyLink(no, i) {
    const url = `${window.location.origin}${window.location.pathname}#seg-${no}-${i}`
    try {
      navigator.clipboard?.writeText(url)
      setCopiedSeg(`${no}-${i}`)
      setTimeout(() => setCopiedSeg(null), 1500)
    } catch { /* clipboard 不可用 */ }
  }
  function toggleMark(no, i, snippet) {
    setMarks({ ...toggleCorpusMark(markCtx.corpus, markCtx.slug, no, i, snippet) })
  }
  function openEdit(key, text) { setEditing(key); setDraft(text) }
  function saveNote(no, i, snippet) {
    setNotes({ ...saveCorpusNote(markCtx.corpus, markCtx.slug, no, i, draft, snippet) })
    setEditing(null)
  }

  // hash 锚点定位(目录跳章 / 段落深链 #seg-章-段);rAF 等布局完成再定位,长经更稳。
  // 单页与逐章模式皆适用(逐章深链 #seg-N-i)。
  useEffect(() => {
    if (!hash) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = document.getElementById(decodeURIComponent(hash.slice(1)))
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
      })
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [single, hash])

  // 逐章模式 ←→ 键翻章(移植卦页交互);有浮层打开时让位
  useEffect(() => {
    if (single) return
    function onKey(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (document.querySelector('.search-overlay, .settings-overlay, .module-portal, .tour')) return
      const idx = chapters.findIndex((c) => c.no === chapter)
      const dest = e.key === 'ArrowLeft' ? chapters[idx - 1] : chapters[idx + 1]
      if (dest) navigate(chapterHref(dest.no))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [single, chapters, chapter, navigate, chapterHref])

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
            {FONT_SCALE_LABELS[s]}
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
      {settings.showTranslation && (
        <label className="toggle-label">
          <span>对照</span>
          <button
            className={`toggle-btn ${settings.transLayout === 'side' ? 'toggle-btn--on' : ''}`}
            onClick={() => setSettings({ transLayout: settings.transLayout === 'side' ? 'stack' : 'side' })}
            title="原文/译文 上下 ⇄ 左右对照"
          >
            {settings.transLayout === 'side' ? '左右' : '上下'}
          </button>
        </label>
      )}
    </div>
  )

  const Para = (no, p, i) => {
    const label = paraLabel(no, i)
    const text = <ClassicText original={p.original} translation={p.translation} anchors={getAnchors(no, i)} verse={verse} />
    if (!markCtx) {
      if (!label) return <ClassicText key={i} original={p.original} translation={p.translation} anchors={getAnchors(no, i)} verse={verse} />
      return (
        <div key={i} className="read-para">
          <span className="read-para__num">{label}</span>
          <div className="read-para__body">{text}</div>
        </div>
      )
    }
    // 读经站:每段可收藏(★)/ 笔记(✎)
    const key = `${markCtx.corpus}:${markCtx.slug}:${no}:${i}`
    const marked = !!marks[key]
    const note = notes[key]
    const isEditing = editing === key
    const copied = copiedSeg === `${no}-${i}`
    return (
      <div key={i} id={`seg-${no}-${i}`} className={`read-para read-para--markable ${marked ? 'read-para--marked' : ''}`}>
        {label && <span className="read-para__num">{label}</span>}
        <div className="read-para__body">
          {text}
          {note && !isEditing && (
            <button className="para-note" onClick={() => openEdit(key, note.text)} title="点击编辑批注">
              <span className="para-note__icon" aria-hidden="true">✎</span>{note.text}
            </button>
          )}
          {isEditing && (
            <div className="para-note-editor">
              <textarea
                className="para-note-editor__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="写点批注…"
                rows={3}
                autoFocus
              />
              <div className="para-note-editor__actions">
                <button className="btn btn--secondary" onClick={() => saveNote(no, i, p.original)}>保存</button>
                <button className="btn btn--ghost" onClick={() => setEditing(null)}>取消</button>
              </div>
            </div>
          )}
        </div>
        <div className="para-actions">
          <button
            className={`para-act ${marked ? 'para-act--on' : ''}`}
            onClick={() => toggleMark(no, i, p.original)}
            aria-label={marked ? '取消收藏' : '收藏此段'}
            aria-pressed={marked}
            data-tip={marked ? '取消收藏' : '收藏此段'}
          >★</button>
          <button
            className={`para-act ${note ? 'para-act--on' : ''}`}
            onClick={() => openEdit(key, note?.text || '')}
            aria-label="批注"
            data-tip={note ? '编辑批注' : '写批注'}
          >✎</button>
          <button
            className={`para-act ${copied ? 'para-act--on' : ''}`}
            onClick={() => copyLink(no, i)}
            aria-label="复制本段链接"
            data-tip={copied ? '已复制链接' : '复制本段链接'}
          >{copied ? '✓' : '🔗'}</button>
          <button
            className="para-act"
            onClick={() => setCardSeg({ original: p.original, translation: p.translation, source: cardSource(no) })}
            aria-label="生成金句卡"
            data-tip="生成金句卡"
          >🖼</button>
        </div>
      </div>
    )
  }

  // 金句卡署名:《书名》· 章名(分章书)
  const cardSource = (no) => {
    const c = chapters.find((x) => x.no === no)
    const lbl = c && multi ? ` · ${chapterLabel(c)}` : ''
    return bookTitle ? `《${bookTitle}》${lbl}` : lbl
  }

  return (
    <div className={`read-page ${single ? 'dao-single' : ''}`}>
      <nav className="read-toc" aria-label="章节目录" ref={tocRef}>
        <div className="read-toc__title">{tocBack}</div>
        {chapters.map((c) =>
          single ? (
            <a key={c.no} href={`#${anchorId(c.no)}`}
              className={`read-toc__item ${c.no === activeAnchor ? 'read-toc__item--active' : ''}`}>{chapterLabel(c)}</a>
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
              value={single ? (activeAnchor || '') : chapter}
              onChange={(e) => jumpTo(Number(e.target.value))}
            >
              {single && !activeAnchor && <option value="">选择章节…</option>}
              {chapters.map((c) => (
                <option key={c.no} value={c.no}>{chapterLabel(c)}</option>
              ))}
            </select>
          </div>
        )}
        {Toolbar}

        {single ? (
          chapters.map((c) => (
            <section key={c.no} id={anchorId(c.no)} data-no={c.no} className="dao-single__chapter">
              {multi && <h2 className="read-chapter-title">{chapterLabel(c)}</h2>}
              {c.paragraphs.map((p, i) => Para(c.no, p, i))}
              <ChapterNotes chapter={c} getAnchors={getAnchors} />
              {renderYanyi(c.no)}
              {renderBaihua(c.no)}
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
              <ChapterNotes chapter={cur} getAnchors={getAnchors} />
              {renderYanyi(cur.no)}
              {renderBaihua(cur.no)}
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
      {cardSeg && <QuoteCard {...cardSeg} onClose={() => setCardSeg(null)} />}
    </div>
  )
}
