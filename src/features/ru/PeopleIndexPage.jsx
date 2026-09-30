import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText, getMeta } from '../reader/corpus.js'
import { chapterParts } from '../reader/chapterParts.js'
import './LunyuPeoplePage.css'

// 人物出场索引的通用页(design-v24 §2 论语版抽出来,§14 推广到孟子 / 传习录)。
// 一本对话集按人切开:左边人物按出场篇数排,右边是这个人出场的每一段。
// 数据由 scripts/gen-<book>-people.mjs 从原文派生,每条带命中片段(evidence)可回查;这里只渲染,不重算。
// spec:{ data, corpus, slug, home, homeLabel, bookHref, bookTitle, siteName, title, subtitle, listLabel, rows:[{label, chs}], intro, fanli }
const STACKED = '(max-width: 760px)'
const shortTitle = (t) => t.replace(/第[一二三四五六七八九十]+$/, '')

// 把 text 里 [at, at+len) 那一段标出来
function Marked({ text, at, len }) {
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="lp-mark">{text.slice(at, at + len)}</mark>
      {text.slice(at + len)}
    </>
  )
}

function HitItem({ hit, href }) {
  const inHead = hit.head.indexOf(hit.evidence)
  return (
    <li className="lp-hit">
      <span className="lp-hit__no" title={`本篇第 ${hit.para + 1} 段`}>{hit.para + 1}</span>
      <div className="lp-hit__body">
        <p className="lp-hit__head">
          {inHead >= 0
            ? <Marked text={hit.head} at={inHead + hit.mark} len={hit.term.length} />
            : hit.head}
          {hit.cut && '……'}
        </p>
        {inHead < 0 && (
          <p className="lp-hit__ev">
            <span className="lp-hit__ev-dots" aria-hidden="true">…</span>
            <Marked text={hit.evidence} at={hit.mark} len={hit.term.length} />
            <span className="lp-hit__ev-dots" aria-hidden="true">…</span>
          </p>
        )}
      </div>
      <Link to={href} className="lp-hit__go">读这一段 →</Link>
    </li>
  )
}

export default function PeopleIndexPage({ spec }) {
  const { data, corpus, slug, siteName, title, subtitle, rows, intro, fanli, listLabel } = spec
  usePageTitle(title, siteName)
  const [params, setParams] = useSearchParams()
  const whoParam = params.get('who')
  const cur = data.people.find((p) => p.id === whoParam) || data.people[0]
  const btnRefs = useRef({})
  const detailRef = useRef(null)
  const picked = useRef(false)
  const TITLE = useMemo(() => Object.fromEntries(data.chapters.map((c) => [c.ch, c.title])), [data])
  const MAX_PIAN = Math.max(...data.people.map((p) => p.pian))

  // 长章拆屏(传习录三卷各三四百段):段锚只在对的那一屏里存在,链接得带 ?p=;要知道分屏得有原文,故载一次书
  const [book, setBook] = useState(null)
  useEffect(() => {
    let alive = true
    loadText(corpus, slug).then((b) => alive && setBook(b)).catch(() => {})
    return () => { alive = false }
  }, [corpus, slug])
  const meta = getMeta(corpus, slug)
  const hrefOf = (ch, para) => {
    const c = book?.chapters?.find((x) => x.no === ch)
    const parts = c ? chapterParts(c, meta) : null
    const pi = parts ? parts.findIndex((pt) => para >= pt.from && para < pt.to) : -1
    return `${spec.bookHref}/${ch}${pi > 0 ? `?p=${pi + 1}` : ''}#p${para + 1}`
  }

  // 该人出场按篇归组
  const groups = useMemo(() => {
    const m = new Map()
    for (const h of cur.hits) {
      if (!m.has(h.ch)) m.set(h.ch, [])
      m.get(h.ch).push(h)
    }
    return m
  }, [cur])

  // 换人之后:窄屏(上下堆叠)或详情顶已滚出视口时,把详情顶带回来。挂载时不动
  useEffect(() => {
    if (!picked.current) return
    picked.current = false
    const el = detailRef.current
    if (!el) return
    const stacked = window.matchMedia?.(STACKED).matches
    if (stacked || el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }, [cur.id])

  function pick(id, { focus = false, scroll = true } = {}) {
    picked.current = scroll
    const next = new URLSearchParams(params)
    next.set('who', id)
    setParams(next, { replace: true })
    if (focus) btnRefs.current[id]?.focus()
  }

  // 人物列表 ↑↓ / Home / End 换人(焦点跟着走,不滚详情)
  function onListKey(e) {
    const ids = data.people.map((p) => p.id)
    const i = ids.indexOf(cur.id)
    let j = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = Math.min(ids.length - 1, i + 1)
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = Math.max(0, i - 1)
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = ids.length - 1
    if (j < 0) return
    e.preventDefault()
    pick(ids[j], { focus: true, scroll: false })
  }

  function jumpPian(ch) {
    document.getElementById(`lp-pian-${ch}`)?.scrollIntoView({ block: 'start' })
  }

  const total = data.people.reduce((n, p) => n + p.hits.length, 0)
  const unit = spec.unit || '篇'

  return (
    <div className="lp-page">
      <div className="basics-breadcrumb">
        <Link to={spec.bookHref} className="basics-breadcrumb__link">← {spec.bookTitle}</Link>
        <span className="lp-crumb-sep" aria-hidden="true">·</span>
        <Link to={spec.home} className="basics-breadcrumb__link">{spec.homeLabel}</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle text-soft">{subtitle}</p>
      </div>
      <p className="lp-intro">{intro}</p>

      <div className="lp-layout">
        <nav className="lp-people" aria-label={listLabel}>
          <p className="lp-people__cap">按出场{unit}数 · 共 {total} 条</p>
          <ul className="lp-people__list" onKeyDown={onListKey}>
            {data.people.map((p) => {
              const on = p.id === cur.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    ref={(el) => { btnRefs.current[p.id] = el }}
                    className={`lp-person ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    tabIndex={on ? 0 : -1}
                    onClick={() => pick(p.id)}
                  >
                    <span className="lp-person__name">{p.name}</span>
                    <span className="lp-person__num">{p.pian} {unit}<span className="lp-person__duan"> · {p.hits.length} 段</span></span>
                    <span className="lp-person__bar" aria-hidden="true">
                      <span style={{ width: `${(p.pian / MAX_PIAN) * 100}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <section className="lp-detail" ref={detailRef} aria-labelledby="lp-who">
          <header className="lp-who" aria-live="polite">
            <h2 id="lp-who" className="lp-who__name">{cur.name}</h2>
            {cur.aliases.length > 0 && (
              <p className="lp-who__alias">原文又称 {cur.aliases.map((a) => <span key={a} className="lp-who__alias-item">{a}</span>)}</p>
            )}
            <p className="lp-who__note">{cur.note}</p>
            <p className="lp-who__stat">出场 <b>{cur.pian}</b> {unit} · <b>{cur.hits.length}</b> 段</p>
          </header>

          <div className="lp-pianpu" role="group" aria-label={`${cur.name}出场的${unit}`}>
            {rows.map((row) => (
              <div key={row.label} className="lp-pianpu__row">
                <span className="lp-pianpu__lab">{row.label}</span>
                <div className="lp-pianpu__cells">
                  {row.chs.map((chNo) => {
                    const c = data.chapters.find((x) => x.ch === chNo)
                    if (!c) return null
                    const n = groups.get(c.ch)?.length || 0
                    const lab = (row.cellLabel ? row.cellLabel(c) : shortTitle(c.title).slice(0, 2))
                    return n
                      ? (
                        <button key={c.ch} type="button" className="lp-cell is-hit"
                          style={{ '--lp-p': `${16 + Math.min(n, 6) * 7}%` }}
                          aria-label={`${c.title}:${n} 段,跳到该${unit}`} title={`${c.title} · ${n} 段`}
                          onClick={() => jumpPian(c.ch)}>
                          <span className="lp-cell__t">{lab}</span>
                          <span className="lp-cell__n">{n}</span>
                        </button>
                      )
                      : (
                        <span key={c.ch} className="lp-cell" title={`${c.title} · 未出场`}>
                          <span className="lp-cell__t">{lab}</span>
                          <span className="lp-cell__n" aria-hidden="true">·</span>
                        </span>
                      )
                  })}
                </div>
              </div>
            ))}
          </div>

          {[...groups.entries()].map(([ch, hits]) => (
            <section key={ch} id={`lp-pian-${ch}`} className="lp-pian">
              <h3 className="lp-pian__title">
                <Link to={`${spec.bookHref}/${ch}`} className="lp-pian__link">{TITLE[ch]}</Link>
                <span className="lp-pian__count">{hits.length} 段</span>
              </h3>
              <ol className="lp-hits">
                {hits.map((h) => <HitItem key={`${h.ch}-${h.para}`} hit={h} href={hrefOf(h.ch, h.para)} />)}
              </ol>
            </section>
          ))}
        </section>
      </div>

      <p className="lp-fanli">{fanli}</p>
    </div>
  )
}
