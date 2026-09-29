import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import data from '../../data/ru/lunyu-people.json'
import './LunyuPeoplePage.css'

// I5 · 论语孔门弟子出场索引(docs/design-v24.md §2)。
// 《论语》本是对话集,这一页按人切开:左边人物按出场篇数排,右边是这个人出场的每一段。
// 数据 src/data/ru/lunyu-people.json 由 scripts/gen-lunyu-people.mjs 从原文派生,每条带命中片段(evidence)可回查。
const STACKED = '(max-width: 760px)'
const shortTitle = (t) => t.replace(/第[一二三四五六七八九十]+$/, '')
const TITLE = Object.fromEntries(data.chapters.map((c) => [c.ch, c.title]))
const MAX_PIAN = Math.max(...data.people.map((p) => p.pian))

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

function HitItem({ hit }) {
  const inHead = hit.head.indexOf(hit.evidence)
  const href = `/ru/lunyu/${hit.ch}#p${hit.para + 1}`
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

export default function LunyuPeoplePage() {
  usePageTitle('孔门弟子出场索引', '观仁')
  const [params, setParams] = useSearchParams()
  const whoParam = params.get('who')
  const cur = data.people.find((p) => p.id === whoParam) || data.people[0]
  const btnRefs = useRef({})
  const detailRef = useRef(null)
  const picked = useRef(false)

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

  return (
    <div className="lp-page">
      <div className="basics-breadcrumb">
        <Link to="/ru/lunyu" className="basics-breadcrumb__link">← 论语</Link>
        <span className="lp-crumb-sep" aria-hidden="true">·</span>
        <Link to="/ru" className="basics-breadcrumb__link">儒典</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">孔门弟子出场索引</h1>
        <p className="page-subtitle text-soft">《论语》二十篇,{data.people.length} 位孔门中人,各在哪几篇出场。</p>
      </div>
      <p className="lp-intro">
        《论语》是一部对话集,问的人不同,孔子答的也不同——同是问仁,答颜渊是「克己复礼」,答樊迟是「爱人」。
        这一页按人切开:<strong>点一个名字</strong>,就列出他出场的每一段;那排二十格是二十篇,着色的是他出场的篇,点一格跳到那一篇。
        多点几个人对照着看:子路、子贡几乎篇篇都在;颜渊多见于前半部,《先进》一篇连记其死;
        第十九篇《子张》通篇是弟子自己的话,朱注谓「子夏为多,子贡次之」——孔子身后弟子各自立说,从这里已看得出来。
      </p>

      <div className="lp-layout">
        <nav className="lp-people" aria-label="孔门弟子(按出场篇数)">
          <p className="lp-people__cap">按出场篇数 · 共 {total} 条</p>
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
                    <span className="lp-person__num">{p.pian} 篇<span className="lp-person__duan"> · {p.hits.length} 段</span></span>
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
            <p className="lp-who__stat">出场 <b>{cur.pian}</b> 篇 · <b>{cur.hits.length}</b> 段</p>
          </header>

          <div className="lp-pianpu" role="group" aria-label={`${cur.name}出场的篇`}>
            {[0, 10].map((base) => (
              <div key={base} className="lp-pianpu__row">
                <span className="lp-pianpu__lab">{base ? '下论' : '上论'}</span>
                <div className="lp-pianpu__cells">
                  {data.chapters.slice(base, base + 10).map((c) => {
                    const n = groups.get(c.ch)?.length || 0
                    const lab = shortTitle(c.title).slice(0, 2)
                    return n
                      ? (
                        <button key={c.ch} type="button" className="lp-cell is-hit"
                          style={{ '--lp-p': `${16 + Math.min(n, 6) * 7}%` }}
                          aria-label={`${c.title}:${n} 段,跳到该篇`} title={`${c.title} · ${n} 段`}
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
                <Link to={`/ru/lunyu/${ch}`} className="lp-pian__link">{TITLE[ch]}</Link>
                <span className="lp-pian__count">{hits.length} 段</span>
              </h3>
              <ol className="lp-hits">
                {hits.map((h) => <HitItem key={`${h.ch}-${h.para}`} hit={h} />)}
              </ol>
            </section>
          ))}
        </section>
      </div>

      <p className="lp-fanli">
        凡例:出场由脚本从站内《论语》原文逐段检出,每条附命中片段,可回查。全称、字、尊称(子路 / 季路 / 仲由、冉有 / 冉子……)出现即计;
        单字呼名(由、赐、回、参、商、师、求、偃、雍、赤、点、柴、鲤、枨)只在呼格处计——其后紧接「也」「乎」「曰」或逗号、叹号,或人工列出的呼名句(「吾与回言」「赐不受命」……);
        另设排除表,「末由也已」「观其所由」「士师」「富而可求」「不忮不求」「有若无」之类不计。宰我名「予」与孔子自称同形,只收确指的三处。
        同一段提到某人即算一次出场,不论是本人发言、问答还是被人提及;一段计入多人。姓名字号据《史记·仲尼弟子列传》与朱熹《论语集注》,
        存疑者标「旧说」「一说」。子服景伯(鲁大夫,非弟子)与「牢曰」之牢(旧说弟子琴牢,事迹不详)未收。
      </p>
    </div>
  )
}
