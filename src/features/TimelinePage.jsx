import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import data from '../data/timeline.json'
import { ALL_BOOKS } from './reader/booksIndex.js'
import { SITE_MAP } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 全站时间轴(2026-09-25,owner:「做一下全站的时间轴,我看看」)——把十几组、七十多部书按成书年代
// 摆到同一条轴上,看谁与谁同时、谁接谁。数据在 src/data/timeline.json(一书一条,年代取通行说法,
// 存疑的用虚圈、托名伪作不上轴);书名/链接/撰人/分组由 booksIndex 派生,加书只需补一条 json。
// 走中立外壳(与 /concepts 同),门户可达;portalHidden 的组(观数 review 前)在这里同样不露出。

const GROUP_LABEL = (site) => site.portalTitle.replace(/(研读|研习|典籍)$/, '')
// 中立外壳把 --cinnabar 压成 --ink-soft,易经要用不被 muted 的 --cinnabar-pure(同辩论页)
const accentOf = (site) => (site.accent === 'cinnabar' ? 'var(--cinnabar-pure)' : `var(--${site.accent})`)
const yearText = (y) => (y < 0 ? `前${-y}` : String(y))

// 轴上刻度按朝代等宽(非等时):先秦几百年里挤着二十多部,汉以后千年才十几部,等时刻度会把先秦堆成一团。
const W = 960, PAD = 12, TOP = 30, LANE_H = 13, MIN_SPAN = 6, LANE_GAP = 5
function layoutRuler(bands, items) {
  const bw = (W - PAD * 2) / bands.length
  const xOf = (y) => {
    let i = bands.findIndex((b) => y < b.to)
    if (i === -1) i = bands.length - 1
    const b = bands[i]
    const t = Math.min(1, Math.max(0, (y - b.from) / (b.to - b.from)))
    return PAD + i * bw + t * bw
  }
  // 一书一段:from→to 画成横条(短的也留一小截),同一泳道里前后不相碰即可复用,按起点排好后贪心分道
  const spans = items.map((it) => {
    const x1 = xOf(it.from), x2 = Math.max(xOf(it.to), x1 + MIN_SPAN)
    return { it, x1, x2 }
  }).sort((a, b) => a.x1 - b.x1 || a.x2 - b.x2)
  const laneEnd = []
  for (const sp of spans) {
    let lane = laneEnd.findIndex((end) => sp.x1 - end >= LANE_GAP)
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(sp.x2) } else laneEnd[lane] = sp.x2
    sp.lane = lane
  }
  return { bw, spans, lanes: laneEnd.length }
}

export default function TimelinePage() {
  usePageTitle('全站时间轴')
  const [params, setParams] = useSearchParams()
  const selGroups = (params.get('g') || '').split(',').filter(Boolean)
  const hideDisputed = params.get('sure') === '1'

  // 一条 json 记录 + booksIndex 的书目记录 → 轴上一点(书名/链接/撰人/分组/主色都从书目派生)
  const all = useMemo(() => {
    const out = []
    for (const t of data.items) {
      const book = t.slug === null
        ? ALL_BOOKS.find((b) => b.corpus === t.corpus)
        : ALL_BOOKS.find((b) => b.corpus === t.corpus && b.slug === t.slug)
      if (!book) continue
      const site = SITE_MAP[book.siteKey]
      if (!site || site.portalHidden) continue
      out.push({ ...t, book, site, group: GROUP_LABEL(site), accent: accentOf(site), id: `tl-${t.corpus}-${t.slug || 'all'}` })
    }
    return out
  }, [])

  const groups = useMemo(() => {
    const m = new Map()
    for (const it of all) {
      const g = m.get(it.site.key) || { key: it.site.key, label: it.group, accent: it.accent, count: 0 }
      g.count++
      m.set(it.site.key, g)
    }
    return [...m.values()]
  }, [all])

  const visible = all.filter((it) => (!selGroups.length || selGroups.includes(it.site.key)) && !(hideDisputed && it.c === 'disputed'))
  const dated = visible.filter((it) => it.c !== 'pseudo')
  const pseudo = visible.filter((it) => it.c === 'pseudo')
  const { bw, spans, lanes } = useMemo(() => layoutRuler(data.bands, dated), [dated])
  const H = TOP + 8 + Math.max(1, lanes) * LANE_H + 22

  const toggleGroup = (k) => {
    const next = selGroups.includes(k) ? selGroups.filter((x) => x !== k) : [...selGroups, k]
    const p = new URLSearchParams(params)
    if (next.length) p.set('g', next.join(',')); else p.delete('g')
    setParams(p, { replace: true })
  }
  const toggleSure = () => {
    const p = new URLSearchParams(params)
    if (hideDisputed) p.delete('sure'); else p.set('sure', '1')
    setParams(p, { replace: true })
  }
  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // 竖轴按朝代分节,节内按 from 排;某朝代一部书也没有就不出节
  const sections = data.bands
    .map((b) => ({ band: b, items: dated.filter((it) => it.from >= b.from && it.from < b.to).sort((a, c) => a.from - c.from || a.to - c.to) }))
    .filter((s) => s.items.length)

  return (
    <div className="timeline-page page-content">
      <div className="basics-breadcrumb">
        <Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">全站时间轴 · 诸书成书年代</h1>
        <p className="page-subtitle text-soft">站内 {all.length} 部书摆在同一条轴上:谁与谁同时,谁接着谁。年代取通行说法,存疑者标出、不拍板。</p>
      </div>

      <div className="tl-filters">
        <div className="debates-facet">
          <span className="debates-facet__label">分组</span>
          <div className="debates-facet__chips">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`debates-chip ${selGroups.includes(g.key) ? 'debates-chip--on' : ''}`}
                onClick={() => toggleGroup(g.key)}
                aria-pressed={selGroups.includes(g.key)}
                style={selGroups.includes(g.key) ? { borderColor: g.accent } : undefined}
              >
                <span className="debates-chip__dot" style={{ background: g.accent }} />
                {g.label}
                <span className="debates-chip__n">{g.count}</span>
              </button>
            ))}
            {selGroups.length > 0 && (
              <button type="button" className="debates-chip debates-chip--more" onClick={() => { const p = new URLSearchParams(params); p.delete('g'); setParams(p, { replace: true }) }}>全部</button>
            )}
          </div>
        </div>
        <label className="tl-filters__sure">
          <input type="checkbox" checked={hideDisputed} onChange={toggleSure} /> 只看年代大致确定的(隐藏 {all.filter((it) => it.c === 'disputed').length} 部存疑)
        </label>
      </div>

      {/* 横轴总览:朝代等宽、点按分组着色;点一下滚到下面那一条 */}
      <figure className="tl-ruler">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="各书成书年代总览">
          {data.bands.map((b, i) => (
            <g key={b.key}>
              <rect x={PAD + i * bw} y={TOP - 4} width={bw} height={H - TOP - 8} rx="2" style={{ fill: i % 2 ? 'color-mix(in srgb, var(--ink) 4%, transparent)' : 'transparent' }} />
              <text x={PAD + i * bw + bw / 2} y={16} textAnchor="middle" style={{ fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)', fontSize: 12 }}>{b.label}</text>
              <text x={PAD + i * bw + 2} y={H - 6} style={{ fill: 'var(--ink-faint)', fontSize: 9 }}>{yearText(b.from)}</text>
            </g>
          ))}
          <line x1={PAD} y1={TOP + 4} x2={W - PAD} y2={TOP + 4} style={{ stroke: 'var(--line)', strokeWidth: 1 }} />
          {spans.map(({ it, x1, x2, lane }) => {
            const y = TOP + 8 + lane * LANE_H
            return (
              <g key={it.id} className="tl-ruler__dot" onClick={() => jumpTo(it.id)} style={{ cursor: 'pointer' }}>
                <title>{it.book.title} · {it.label}</title>
                <line
                  x1={x1} y1={y} x2={x2} y2={y}
                  style={{ stroke: it.accent, strokeWidth: 4, strokeLinecap: 'round', opacity: it.c === 'disputed' ? 0.45 : 0.9, strokeDasharray: it.c === 'disputed' ? '2 3' : undefined }}
                />
                <circle cx={x1} cy={y} r={3.2} style={it.c === 'disputed' ? { fill: 'var(--paper)', stroke: it.accent, strokeWidth: 1.4 } : { fill: it.accent }} />
              </g>
            )
          })}
        </svg>
        <figcaption className="text-faint">刻度按朝代等宽,不按年数;每条横线是一部书从成书上限到下限的跨度,实线年代大致有共识、虚线为成书年代或撰人存疑。点一下跳到该书。</figcaption>
      </figure>

      <div className="tl-sections">
        {sections.map(({ band, items }) => (
          <section key={band.key} className="tl-section">
            <h2 className="tl-section__head">
              <span className="tl-section__era">{band.label}</span>
              <span className="tl-section__years text-faint">{yearText(band.from)} — {yearText(band.to)}</span>
              <span className="tl-section__n text-faint">{items.length} 部</span>
            </h2>
            <ol className="tl-list">
              {items.map((it) => (
                <li key={it.id} id={it.id} className={`tl-item ${it.c === 'disputed' ? 'tl-item--disputed' : ''}`}>
                  <span className="tl-item__dot" style={it.c === 'disputed' ? { borderColor: it.accent } : { background: it.accent, borderColor: it.accent }} />
                  <div className="tl-item__body">
                    <div className="tl-item__head">
                      <span className="tl-item__year">{it.label}</span>
                      <Link to={it.book.href} className="tl-item__title">{it.book.title}</Link>
                      <span className="tl-item__group" style={{ color: it.accent, borderColor: it.accent }}>{it.group}</span>
                      {it.c === 'disputed' && <span className="tl-item__flag">成书存疑</span>}
                    </div>
                    {it.book.attribution && <div className="tl-item__meta text-soft">{it.book.attribution}</div>}
                    {it.note && <p className="tl-item__note">{it.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}

        {pseudo.length > 0 && (
          <section className="tl-section tl-section--pseudo">
            <h2 className="tl-section__head">
              <span className="tl-section__era">今人托古</span>
              <span className="tl-section__years text-faint">旧题唐、五代、隋、明 · 疑现代伪作,不上轴</span>
              <span className="tl-section__n text-faint">{pseudo.length} 部</span>
            </h2>
            <ol className="tl-list">
              {pseudo.map((it) => (
                <li key={it.id} id={it.id} className="tl-item tl-item--pseudo">
                  <span className="tl-item__dot tl-item__dot--x" style={{ borderColor: it.accent, color: it.accent }}>×</span>
                  <div className="tl-item__body">
                    <div className="tl-item__head">
                      <span className="tl-item__year">{it.label}</span>
                      <Link to={it.book.href} className="tl-item__title">{it.book.title}</Link>
                      <span className="tl-item__group" style={{ color: it.accent, borderColor: it.accent }}>{it.group}</span>
                      <span className="tl-item__flag tl-item__flag--pseudo">托名 · 疑现代伪作</span>
                    </div>
                    {it.note && <p className="tl-item__note">{it.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <p className="concepts-page__note text-faint">
        年代只用来定位先后,不是考据结论:有明确纪年的写纪年,有共识的写朝代,存疑的照各书撰人小传如实标出。译经按译出年代排,选本按所收作品年代排。
      </p>
    </div>
  )
}
