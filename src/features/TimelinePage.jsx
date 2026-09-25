import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import data from '../data/timeline.json'
import renwu from '../data/renwu.json'
import { ALL_BOOKS } from './reader/booksIndex.js'
import { SITE_MAP } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'
import { useHashScroll } from './RenwuPage.jsx'

// 全站时间轴(2026-09-25,owner:「做一下全站的时间轴,我看看」「人也放上去」)——把十几组七十多部书
// 与五十来位撰人/译者/注家摆到同一条轴上,看谁与谁同时、谁接谁。数据在 src/data/timeline.json
// (books:一书一条;people:一人一条,生卒不详者给大致区间并标 disputed;年代都取通行说法,存疑的用虚线,
// 托名伪作不上轴);书名/链接/撰人/分组/主色由 booksIndex + registry 派生,加书只需补一条 json。
// 走中立外壳(与 /concepts 同),门户可达;portalHidden 的组(观数 review 前)在这里同样不露出。

const GROUP_LABEL = (site) => site.portalTitle.replace(/(研读|研习|典籍)$/, '')
// 中立外壳把 --cinnabar 压成 --ink-soft,易经要用不被 muted 的 --cinnabar-pure(同辩论页)
const accentOf = (site) => (site.accent === 'cinnabar' ? 'var(--cinnabar-pure)' : `var(--${site.accent})`)
const yearText = (y) => (y < 0 ? `前${-y}` : String(y))

// 轴上刻度按朝代等宽(非等时):先秦几百年里挤着二十多部,汉以后千年才十几部,等时刻度会把先秦堆成一团。
const W = 960, PAD = 26, TOP = 30, LANE_H = 13, MIN_SPAN = 6, LANE_GAP = 5, NAME_PX = 9.5
function makeScale(bands) {
  const bw = (W - PAD * 2) / bands.length
  const xOf = (y) => {
    let i = bands.findIndex((b) => y < b.to)
    if (i === -1) i = bands.length - 1
    const b = bands[i]
    const t = Math.min(1, Math.max(0, (y - b.from) / (b.to - b.from)))
    return PAD + i * bw + t * bw
  }
  return { bw, xOf }
}
// 一条一段:from→to 画成横条(短的也留一小截);同一泳道里前后不相碰即可复用,按起点排好后贪心分道。
// 人物条右侧还要挂名字,占位按名字宽度一起算;挤到右缘的名字改挂在条左边。
function layoutLanes(xOf, items, withName) {
  const spans = items.map((it) => {
    const x1 = xOf(it.from), x2 = Math.max(xOf(it.to), x1 + MIN_SPAN)
    const nameW = withName ? it.name.length * NAME_PX + 6 : 0
    const nameRight = x2 + nameW <= W - PAD
    return { it, x1, x2, nameRight, occ: [nameRight ? x1 : x1 - nameW, nameRight ? x2 + nameW : x2] }
  }).sort((a, b) => a.occ[0] - b.occ[0] || a.occ[1] - b.occ[1])
  const laneEnd = []
  for (const sp of spans) {
    let lane = laneEnd.findIndex((end) => sp.occ[0] - end >= LANE_GAP)
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(sp.occ[1]) } else laneEnd[lane] = sp.occ[1]
    sp.lane = lane
  }
  return { spans, lanes: laneEnd.length }
}

const lineStyle = (it) => ({
  stroke: it.accent, strokeWidth: it.kind === 'person' ? 2.5 : 4, strokeLinecap: 'round',
  opacity: it.c === 'disputed' ? 0.45 : 0.9, strokeDasharray: it.c === 'disputed' ? '2 3' : undefined,
})
const dotStyle = (it) => (it.c === 'disputed' ? { fill: 'var(--paper)', stroke: it.accent, strokeWidth: 1.4 } : { fill: it.accent })

export default function TimelinePage() {
  usePageTitle('全站时间轴')
  const [params, setParams] = useSearchParams()
  const selGroups = (params.get('g') || '').split(',').filter(Boolean)
  const hideDisputed = params.get('sure') === '1'
  const showPeople = params.get('p') !== '0'

  // json 记录 + booksIndex 的书目记录 → 轴上一条(书名/链接/撰人/分组/主色都从书目派生)
  const { books, people } = useMemo(() => {
    const bookOf = (corpus, slug) => (slug === null
      ? ALL_BOOKS.find((b) => b.corpus === corpus)
      : ALL_BOOKS.find((b) => b.corpus === corpus && b.slug === slug))
    const visibleSite = (key) => { const s = SITE_MAP[key]; return s && !s.portalHidden ? s : null }
    const books = []
    for (const t of data.items) {
      const book = bookOf(t.corpus, t.slug)
      const site = book && visibleSite(book.siteKey)
      if (!site) continue
      books.push({ ...t, kind: 'book', book, site, name: book.title, group: GROUP_LABEL(site), accent: accentOf(site), id: `tl-${t.corpus}-${t.slug || 'all'}` })
    }
    const people = []
    for (const t of renwu.people) {
      const site = visibleSite(t.group)
      if (!site) continue
      const links = (t.books || []).map((slug) => bookOf(t.group, slug)).filter(Boolean)
      people.push({ ...t, kind: 'person', site, siteKey: t.group, links, group: GROUP_LABEL(site), accent: accentOf(site), pid: t.id, id: `tl-p-${t.id}` })
    }
    return { books, people }
  }, [])

  const groups = useMemo(() => {
    const m = new Map()
    for (const it of [...books, ...people]) {
      const g = m.get(it.site.key) || { key: it.site.key, label: it.group, accent: it.accent, count: 0 }
      g.count++
      m.set(it.site.key, g)
    }
    return [...m.values()]
  }, [books, people])

  const pass = (it) => (!selGroups.length || selGroups.includes(it.site.key)) && !(hideDisputed && it.c === 'disputed')
  const vBooks = books.filter(pass)
  const vPeople = showPeople ? people.filter(pass) : []
  const dated = vBooks.filter((it) => it.c !== 'pseudo')
  const pseudo = vBooks.filter((it) => it.c === 'pseudo')

  const { bw, xOf } = useMemo(() => makeScale(data.bands), [])
  const bookLanes = useMemo(() => layoutLanes(xOf, dated, false), [xOf, dated])
  const peopleLanes = useMemo(() => layoutLanes(xOf, vPeople, true), [xOf, vPeople])
  const bookTop = TOP + 8
  const bookH = Math.max(1, bookLanes.lanes) * LANE_H
  const peopleTop = bookTop + bookH + (vPeople.length ? 14 : 0)
  const peopleH = vPeople.length ? peopleLanes.lanes * LANE_H : 0
  const H = peopleTop + peopleH + 22

  const setParam = (k, v) => { const p = new URLSearchParams(params); if (v == null) p.delete(k); else p.set(k, v); setParams(p, { replace: true }) }
  const toggleGroup = (k) => {
    const next = selGroups.includes(k) ? selGroups.filter((x) => x !== k) : [...selGroups, k]
    setParam('g', next.length ? next.join(',') : null)
  }
  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  useHashScroll([dated.length, vPeople.length])

  // 竖轴按朝代分节;书与人按起点混排(书按成书上限、人按生年),某朝代什么都没有就不出节
  const sections = data.bands
    .map((b) => ({
      band: b,
      items: [...dated, ...vPeople].filter((it) => it.from >= b.from && it.from < b.to).sort((a, c) => a.from - c.from || a.to - c.to),
    }))
    .filter((s) => s.items.length)

  return (
    <div className="timeline-page page-content">
      <div className="basics-breadcrumb">
        <Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">全站时间轴 · 诸书与诸人</h1>
        <p className="page-subtitle text-soft">站内 {books.length} 部书、{people.length} 位撰人译者注家摆在同一条轴上:谁与谁同时,谁接着谁。年代取通行说法,存疑者标出、不拍板。</p>
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
              <button type="button" className="debates-chip debates-chip--more" onClick={() => setParam('g', null)}>全部</button>
            )}
          </div>
        </div>
        <div className="tl-filters__row">
          <label className="tl-filters__sure">
            <input type="checkbox" checked={showPeople} onChange={() => setParam('p', showPeople ? '0' : null)} /> 显示人物
          </label>
          <label className="tl-filters__sure">
            <input type="checkbox" checked={hideDisputed} onChange={() => setParam('sure', hideDisputed ? null : '1')} /> 只看年代大致确定的(隐藏 {[...books, ...people].filter((it) => it.c === 'disputed').length} 条存疑)
          </label>
        </div>
      </div>

      {/* 横轴总览:朝代等宽;上半是书(from→to 横条),下半是人(生卒横条 + 名字);点一下滚到下面那一条 */}
      <figure className="tl-ruler">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="各书成书年代与诸人生卒总览">
          {data.bands.map((b, i) => (
            <g key={b.key}>
              <rect x={PAD + i * bw} y={TOP - 4} width={bw} height={H - TOP - 8} rx="2" style={{ fill: i % 2 ? 'color-mix(in srgb, var(--ink) 4%, transparent)' : 'transparent' }} />
              <text x={PAD + i * bw + bw / 2} y={16} textAnchor="middle" style={{ fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)', fontSize: 12 }}>{b.label}</text>
              <text x={PAD + i * bw + 2} y={H - 6} style={{ fill: 'var(--ink-faint)', fontSize: 9 }}>{yearText(b.from)}</text>
            </g>
          ))}
          <text x={8} y={bookTop + 10} style={{ fill: 'var(--ink-faint)', fontFamily: 'var(--font-serif)', fontSize: 11 }}>书</text>
          {bookLanes.spans.map(({ it, x1, x2, lane }) => {
            const y = bookTop + lane * LANE_H
            return (
              <g key={it.id} className="tl-ruler__dot" onClick={() => jumpTo(it.id)} style={{ cursor: 'pointer' }}>
                <title>{it.name} · {it.label}</title>
                <line x1={x1} y1={y} x2={x2} y2={y} style={lineStyle(it)} />
                <circle cx={x1} cy={y} r={3.2} style={dotStyle(it)} />
              </g>
            )
          })}
          {vPeople.length > 0 && (
            <>
              <line x1={PAD} y1={peopleTop - 8} x2={W - PAD} y2={peopleTop - 8} style={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <text x={8} y={peopleTop + 10} style={{ fill: 'var(--ink-faint)', fontFamily: 'var(--font-serif)', fontSize: 11 }}>人</text>
              {peopleLanes.spans.map(({ it, x1, x2, lane, nameRight }) => {
                const y = peopleTop + lane * LANE_H
                return (
                  <g key={it.id} className="tl-ruler__dot" onClick={() => jumpTo(it.id)} style={{ cursor: 'pointer' }}>
                    <title>{it.name} · {it.label}</title>
                    <line x1={x1} y1={y} x2={x2} y2={y} style={lineStyle(it)} />
                    <text
                      x={nameRight ? x2 + 4 : x1 - 4} y={y + 3.3} textAnchor={nameRight ? 'start' : 'end'}
                      style={{ fill: it.accent, fontFamily: 'var(--font-serif)', fontSize: NAME_PX, opacity: it.c === 'disputed' ? 0.7 : 1 }}
                    >{it.name}</text>
                  </g>
                )
              })}
            </>
          )}
        </svg>
        <figcaption className="text-faint">刻度按朝代等宽,不按年数。上半每条横线是一部书从成书上限到下限的跨度,下半是各人的生卒;实线年代大致有共识,虚线为存疑。点一下跳到下面那一条。</figcaption>
      </figure>

      <div className="tl-sections">
        {sections.map(({ band, items }) => (
          <section key={band.key} className="tl-section">
            <h2 className="tl-section__head">
              <span className="tl-section__era">{band.label}</span>
              <span className="tl-section__years text-faint">{yearText(band.from)} — {yearText(band.to)}</span>
              <span className="tl-section__n text-faint">{items.filter((i) => i.kind === 'book').length} 部 · {items.filter((i) => i.kind === 'person').length} 人</span>
            </h2>
            <ol className="tl-list">
              {items.map((it) => (
                <li key={it.id} id={it.id} className={`tl-item tl-item--${it.kind} ${it.c === 'disputed' ? 'tl-item--disputed' : ''}`}>
                  <span className="tl-item__dot" style={it.c === 'disputed' ? { borderColor: it.accent } : { background: it.accent, borderColor: it.accent }} />
                  <div className="tl-item__body">
                    <div className="tl-item__head">
                      <span className="tl-item__year">{it.label}</span>
                      {it.kind === 'book'
                        ? <Link to={it.book.href} className="tl-item__title">{it.name}</Link>
                        : <Link to={`/renwu#${it.pid}`} className="tl-item__title tl-item__title--person" title="看人物志">{it.name} ↗</Link>}
                      <span className="tl-item__group" style={{ color: it.accent, borderColor: it.accent }}>{it.group}</span>
                      {it.c === 'disputed' && <span className="tl-item__flag">{it.kind === 'book' ? '成书存疑' : '生卒不详'}</span>}
                    </div>
                    {it.kind === 'book' && it.book.attribution && <div className="tl-item__meta text-soft">{it.book.attribution}</div>}
                    {it.note && <p className="tl-item__note">{it.note}</p>}
                    {it.kind === 'person' && it.links.length > 0 && (
                      <div className="tl-item__books">
                        {it.links.map((b) => <Link key={b.slug} to={b.href} className="tl-item__book">《{b.title}》</Link>)}
                      </div>
                    )}
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
                      <Link to={it.book.href} className="tl-item__title">{it.name}</Link>
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
        年代只用来定位先后,不是考据结论:有明确纪年的写纪年,有共识的写朝代,存疑的照各书撰人小传如实标出。译经按译出年代排,选本按所收作品年代排;人物按生卒排,生卒不详者给大致活动年代。
      </p>
    </div>
  )
}
