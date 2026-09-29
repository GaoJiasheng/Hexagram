import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { getMeta } from '../reader/corpus.js'
import { chapterParts } from '../reader/chapterParts.js'
import map from '../../data/ru/shijing-map.json'
import { regionRadius, poemTitlesOf, clusterBox, poemHref, COUNT_LABEL_GAP } from './shijingMap.js'
import './ShijingMapPage.css'

// 诗经十五国风示意图(design-v24 §8)。
// 动什么:点图上一国(或下方国名、方向键)。悟什么:国风是十五个地方的歌——
// 邶鄘卫挤在一处其实同是卫地,二南在南、豳秦在西、齐在最东;郑风最多,桧、曹各只四首。
// 示意图,只表相对方位,非考古地图(凡例明说)。数据 src/data/ru/shijing-map.json,闸 scripts/lib/check-shijing-map.mjs。

const { w: W, h: H } = map.view
const REGIONS = map.regions
const TOTAL = REGIONS.reduce((s, r) => s + r.poems, 0)
const fengName = (r) => (r.name.length === 1 ? `${r.name}风` : r.name)

export default function ShijingMapPage() {
  usePageTitle('十五国风示意图 · 诗经', '观仁')
  const [sp, setSp] = useSearchParams()
  const [book, setBook] = useState({ status: 'loading', data: null })
  const nodeRefs = useRef({})

  // 原文只为取诗题:动态加载(与阅读器同一个 chunk),不把注疏、延伸一并拉下来
  useEffect(() => {
    let alive = true
    import('../../data/ru/classics/shijing.json')
      .then((mod) => { if (alive) setBook({ status: 'ready', data: mod.default }) })
      .catch(() => { if (alive) setBook({ status: 'error', data: null }) })
    return () => { alive = false }
  }, [])

  const selIdx = REGIONS.findIndex((r) => r.id === sp.get('g'))
  const sel = selIdx >= 0 ? REGIONS[selIdx] : null

  const poems = useMemo(() => {
    if (!sel || !book.data) return null
    const chapter = book.data.chapters.find((c) => c.no === sel.ch)
    if (!chapter) return null
    const parts = chapterParts(chapter, getMeta('ru', 'shijing') || { poemTitles: true })
    return poemTitlesOf(chapter).map((p) => ({ ...p, href: poemHref(sel.ch, p.idx, parts) }))
  }, [sel, book.data])

  const select = (id, focus = false) => {
    setSp(id ? { g: id } : {}, { replace: true })
    if (focus) nodeRefs.current[id]?.focus()
  }

  // 方向键按《诗经》编次在十五组之间走(单一 tab 停靠点,roving tabindex)
  const onNodeKey = (ev, i) => {
    const n = REGIONS.length
    let j = null
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = (i + 1) % n
    else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = (i - 1 + n) % n
    else if (ev.key === 'Home') j = 0
    else if (ev.key === 'End') j = n - 1
    else if (ev.key === 'Enter' || ev.key === ' ') j = i
    if (j === null) return
    ev.preventDefault()
    select(REGIONS[j].id, true)
  }
  const tabStop = sel ? sel.id : REGIONS[0].id

  return (
    <div className="sjm-page">
      <div className="basics-breadcrumb sjm-crumbs">
        <Link to="/ru/shijing" className="basics-breadcrumb__link">← 诗经</Link>
        <span className="sjm-crumbs__sep" aria-hidden="true">·</span>
        <Link to="/ru" className="basics-breadcrumb__link">儒典</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">十五国风 · 示意图</h1>
        <p className="page-subtitle">国风 {TOTAL} 首,出自哪些地方。</p>
      </div>
      <p className="sjm-intro">
        国风是十五个地方的歌。点图上一国(或图下的国名),右边列出这一组的诗题和它采自哪里;<strong>圆越大,诗越多</strong>。
        对着图看,几件事一眼就明白:邶、鄘、卫挤在一处,其实同是卫地;二南在南,豳、秦在西,齐在最东;
        郑风最多(21 首),桧、曹各只 4 首。
      </p>

      <div className="sjm-layout">
        <figure className="sjm-map">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="sjm-svg"
            role="group"
            aria-label="十五国风示意图:只表相对方位,上北下南。方向键按《诗经》编次切换。"
          >
            <rect className="sjm-bg" x="1" y="1" width={W - 2} height={H - 2} rx="14" />

            {map.rivers?.map((rv) => (
              <g key={rv.name} className="sjm-river-g" aria-hidden="true">
                <path className="sjm-river" d={rv.d} />
                <text className="sjm-river-label" x={rv.labelX} y={rv.labelY}>{rv.name}</text>
              </g>
            ))}

            {map.clusters?.map((c) => {
              const box = clusterBox(REGIONS, c.ids)
              if (!box) return null
              return (
                <g key={c.label} className="sjm-cluster-g" aria-hidden="true">
                  <rect className="sjm-cluster" x={box.x} y={box.y} width={box.w} height={box.h} rx="22" />
                  <text className="sjm-cluster-label" x={box.x + 10} y={box.y - 9}>{c.label}</text>
                </g>
              )
            })}

            <g className="sjm-compass" transform={`translate(${W - 48} 58)`} aria-hidden="true">
              <path className="sjm-compass__arrow" d="M 0 -20 L 7 -4 L 0 -8 L -7 -4 Z" />
              <line className="sjm-compass__line" x1="0" y1="-8" x2="0" y2="22" />
              <text className="sjm-compass__label" x="0" y="-28" textAnchor="middle">北</text>
            </g>
            <text className="sjm-stamp" x={W - 18} y={H - 16} textAnchor="end" aria-hidden="true">示意 · 不按比例</text>

            <g role="radiogroup" aria-label="十五国风">
              {REGIONS.map((r, i) => {
                const rad = regionRadius(r.poems)
                const active = sel?.id === r.id
                return (
                  <g
                    key={r.id}
                    ref={(el) => { nodeRefs.current[r.id] = el }}
                    className={`sjm-node${active ? ' is-active' : ''}`}
                    transform={`translate(${r.x} ${r.y})`}
                    tabIndex={r.id === tabStop ? 0 : -1}
                    role="radio"
                    aria-checked={active}
                    aria-label={`${fengName(r)},${r.poems} 首`}
                    onClick={() => select(r.id)}
                    onKeyDown={(ev) => onNodeKey(ev, i)}
                  >
                    <title>{`${fengName(r)} · ${r.poems} 首`}</title>
                    <circle className="sjm-node__ring" r={rad + 6} />
                    <circle className="sjm-node__disc" r={rad} />
                    <text
                      className={`sjm-node__name${r.name.length > 1 ? ' sjm-node__name--two' : ''}`}
                      textAnchor="middle" dominantBaseline="central"
                    >{r.name}</text>
                    <text className="sjm-node__count" x={rad + COUNT_LABEL_GAP} y="0" dominantBaseline="central">{r.poems} 首</text>
                  </g>
                )
              })}
            </g>
          </svg>

          <div className="sjm-chips" role="group" aria-label="按《诗经》编次选国">
            {REGIONS.map((r) => (
              <button
                key={r.id} type="button"
                className={`sjm-chip${sel?.id === r.id ? ' is-on' : ''}`}
                aria-pressed={sel?.id === r.id}
                onClick={() => select(r.id)}
              >
                {fengName(r)}<span className="sjm-chip__n">{r.poems}</span>
              </button>
            ))}
          </div>
        </figure>

        <aside className="sjm-panel" aria-label="所选一国的诗题">
          {sel ? (
            <>
              {/* 只让题头与来路进读屏播报;诗题列表太长,不随每次切换整段念一遍 */}
              <div aria-live="polite">
                <p className="sjm-panel__eyebrow">国风 · 第 {sel.ch} 组</p>
                <h2 className="sjm-panel__name">
                  {fengName(sel)}<span className="sjm-panel__count">{sel.poems} 首</span>
                </h2>
                <p className="sjm-panel__note">{sel.note}</p>
              </div>
              {book.status === 'loading' && <p className="sjm-panel__hint">载入诗题…</p>}
              {book.status === 'error' && <p className="sjm-panel__hint">诗题没载进来,可以直接读这一组。</p>}
              {poems && (
                <ol className="sjm-poems">
                  {poems.map((p) => (
                    <li key={p.idx}>
                      <Link to={p.href} className="sjm-poem">《{p.title}》</Link>
                    </li>
                  ))}
                </ol>
              )}
              <Link to={`/ru/shijing/${sel.ch}`} className="sjm-panel__read">读这一组 →</Link>
            </>
          ) : (
            <div className="sjm-panel__empty">
              <p className="sjm-panel__name sjm-panel__name--plain">十五国风 · {TOTAL} 首</p>
              <p className="sjm-panel__note">点图上任一国,这里列出它的诗题与来路;点诗题直达阅读器里那一首。</p>
            </div>
          )}
        </aside>
      </div>

      <p className="sjm-fanli">
        <strong>凡例</strong>:这是<strong>示意图,只表相对方位,非考古地图</strong>——各组位置按旧说地望(郑玄《诗谱》及历代考订)排定前后左右,
        不按比例、不给经纬;河道只画大势(春秋时黄河东北流入海,与今道不同)。二南、桧等地望诸说不一。
        诗题与首数取自本站《诗经》原文(毛诗本,国风十五组共 {TOTAL} 首)。
      </p>
    </div>
  )
}
