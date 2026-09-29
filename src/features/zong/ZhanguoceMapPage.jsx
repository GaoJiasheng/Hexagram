import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import data from '../../data/zong/zhanguoce-map.json'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import {
  hexTerritories, AXIS, yearText, makeXScale, layoutLanes, selectedChs, piecesOfState,
} from './zhanguoceMap.js'
import './ZhanguoceMapPage.css'

// 战国策七国示意图 + 合纵连横时间轴(design-v24 §9 · I12)。
// 上半一张七国示意图(点一国 / 一处地名 → 亮出所涉之篇;叠「合纵」「连横」两层线看这两个词原本指什么局面),
// 下半一条时间轴(一篇一条,年代存疑者虚线;点条 → 落到原文)。两半联动:停在时间轴一条上,地图亮出这一篇牵动的国。
// 数据 src/data/zong/zhanguoce-map.json:每篇的年代只据篇中人物在位可推,kw / 「」引文都由 check-zhanguoce-map 回查原文。
// 纵横红线:思想史视角,如实标说辞水分,不作权术教程。

const BOOK = '/zong/zhanguoce'
const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八']
const STATE = Object.fromEntries(data.states.map((s) => [s.id, s]))
const PLACE = Object.fromEntries(data.places.map((p) => [p.id, p]))
const PIECE = Object.fromEntries(data.pieces.map((p) => [p.ch, p]))
const BY_YEAR = [...data.pieces].sort((a, b) => a.from - b.from || a.to - b.to || a.ch - b.ch)
const COUNT = Object.fromEntries(data.states.map((s) => [s.id, piecesOfState(data, s.id).length]))
// 四档中性灰给相邻各国错开(地图四色的意思),亮色只留给「被点中 / 被牵动」
const TINT = { qin: 13, chu: 19, qi: 25, yan: 8, zhao: 19, wei: 13, han: 8, zhou: 25 }
const tint = (id) => `color-mix(in srgb, var(--ink) ${TINT[id] ?? 11}%, var(--paper))`
const lit = (pct) => `color-mix(in srgb, var(--cinnabar) ${pct}%, var(--paper))`
const statesText = (ids) => ids.map((id) => STATE[id].name).join(' · ')

// 两国中心连线,两端各缩进一段,免得压住国名
function shortSeg(a, b, cut = 22) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  return { x1: a.x + ux * cut, y1: a.y + uy * cut, x2: b.x - ux * cut, y2: b.y - uy * cut }
}
// 叠加层用弧线:同一方向上的几条(秦→魏、秦→齐)不至于叠成一条、压住中间的国名。弧一律向北拱。
function arcPath(a, b, bend = 0.13) {
  const { x1, y1, x2, y2 } = shortSeg(a, b)
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  let nx = -(y2 - y1), ny = x2 - x1          // 垂直于连线、长度与连线相同
  if (ny > 0) { nx = -nx; ny = -ny }         // 取朝北的那一侧
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(mx + nx * bend).toFixed(1)} ${(my + ny * bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
}
const onKeyActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }

// 时间轴尺寸(viewBox 单位;容器窄于 min-width 时横向滚动)
const TW = 720, TPAD = 14, AXIS_Y = 18, KING_Y = 30, KING_H = 14, LANE_TOP = 66, LANE_H = 22

export default function ZhanguoceMapPage() {
  usePageTitle('七国图 · 合纵连横', '观衡')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sel = params.get('s') || ''                       // 'qin' | 'p:handan' | ''
  const overlay = params.get('v') || ''                   // 'zong' | 'heng' | ''
  const [hot, setHot] = useState(null)                    // 指针 / 焦点所在的篇次

  const setParam = (k, v) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    setParams(p, { replace: true })
  }
  const toggleSel = (v) => setParam('s', sel === v ? '' : v)

  const { paths } = useMemo(() => hexTerritories(data.view, data.states), [])
  const chs = useMemo(() => selectedChs(data, sel), [sel])
  const selState = STATE[sel] || null
  const selPlace = sel.startsWith('p:') ? PLACE[sel.slice(2)] : null
  const hotPiece = hot ? PIECE[hot] : null
  const axis = data.axes.find((a) => a.id === overlay) || null

  // 地图上每国的底色:被悬停之篇的主场国最亮、其余所涉国次之;否则看点选
  const stateFill = (id) => {
    if (hotPiece) {
      if (hotPiece.states[0] === id) return lit(62)
      if (hotPiece.states.includes(id)) return lit(38)
      return tint(id)
    }
    if (selState) return id === sel ? lit(58) : tint(id)
    if (selPlace && selPlace.state === id) return lit(30)
    return tint(id)
  }
  const placeLit = (p) => (hotPiece ? p.chs.includes(hotPiece.ch) : selPlace ? selPlace.id === p.id : false)

  // 时间轴
  const xOf = useMemo(() => makeXScale(TW, TPAD, TPAD), [])
  const { spans, lanes } = useMemo(() => layoutLanes(data.pieces, xOf, { W: TW, padR: TPAD }), [xOf])
  const TH = LANE_TOP + lanes * LANE_H + 10
  const ticks = []
  for (let y = AXIS.from; y <= AXIS.to; y += 20) ticks.push(y)
  const inSel = (ch) => !chs || chs.has(ch)

  const list = chs ? BY_YEAR.filter((p) => chs.has(p.ch)) : BY_YEAR
  const selTitle = selState ? `${selState.name}国` : selPlace ? selPlace.name : ''
  const nDisputed = data.pieces.filter((p) => p.c === 'disputed').length

  const hoverProps = (ch) => ({
    onMouseEnter: () => setHot(ch), onMouseLeave: () => setHot(null),
    onFocus: () => setHot(ch), onBlur: () => setHot(null),
  })

  return (
    <div className="zgm-page">
      <div className="basics-breadcrumb">
        <Link to={BOOK} className="basics-breadcrumb__link">← 战国策(选)</Link>
        <span className="zgm-crumb-sep text-faint">·</span>
        <Link to="/zong" className="basics-breadcrumb__link">纵横首页</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">七国图 · 合纵连横时间轴</h1>
        <p className="page-subtitle text-soft">本站所选《战国策》十八篇,各在哪几国、落在哪一段年代。</p>
      </div>
      <p className="zgm-intro">
        <strong>点一国</strong>(或一处地名),看十八篇里哪几篇在那里发生——秦牵进了 {COUNT.qin} 篇,韩只有 {COUNT.han} 篇;点邯郸,亮出的两篇原来是同一场围城的前后事。
        <strong>叠上「合纵」「连横」两层线</strong>,看这两个词原本说的是什么样的局面。
        <strong>把指针停在时间轴的一条上</strong>,地图亮出这一篇牵动的国;点下去就落到原文。
        再留意那 {nDisputed} 条虚线:篇里自称的年代与出土材料或篇内人物对不上——说辞不是史书。
      </p>

      {/* ---------- 上半:七国示意图 ---------- */}
      <section className="zgm-map" aria-label="七国示意图">
        <div className="zgm-toolbar">
          <span className="zgm-toolbar__label text-faint">叠一层线</span>
          <div className="zgm-seg" role="group" aria-label="叠加合纵或连横连线">
            {[['', '不叠'], ...data.axes.map((a) => [a.id, a.name])].map(([id, name]) => (
              <button
                key={id || 'none'} type="button" aria-pressed={overlay === id}
                className={`zgm-seg__btn ${overlay === id ? 'is-on' : ''}`}
                onClick={() => setParam('v', id)}
              >{name}</button>
            ))}
          </div>
        </div>

        <div className="zgm-map__body">
          <figure className="zgm-map__fig">
            <svg viewBox={`0 0 ${data.view.w} ${data.view.h}`} className="zgm-map__svg" role="group" aria-label="战国七国示意图:只表相对方位,非考古地图">
              {data.states.map((s) => (
                <path
                  key={s.id} d={paths[s.id]}
                  className={`zgm-state ${sel === s.id ? 'is-sel' : ''}`}
                  style={{ fill: stateFill(s.id) }}
                  role="button" tabIndex={0} aria-pressed={sel === s.id}
                  aria-label={`${s.name}国,涉 ${COUNT[s.id]} 篇`}
                  onClick={() => toggleSel(s.id)} onKeyDown={onKeyActivate(() => toggleSel(s.id))}
                />
              ))}
              {data.rivers.map((r) => (
                <g key={r.name} className="zgm-river" aria-hidden="true">
                  <path d={r.d} style={{ fill: 'none', stroke: 'var(--azure)', strokeWidth: 2, opacity: 0.5 }} />
                  <text x={r.lx} y={r.ly} style={{ fill: 'var(--azure)', fontFamily: 'var(--font-serif)', fontSize: 13, opacity: 0.85 }}>{r.name}</text>
                </g>
              ))}
              {axis && axis.links.map(([a, b], i) => (
                <path
                  key={`${axis.id}-${a}-${b}`} d={arcPath(STATE[a], STATE[b])} className="zgm-axis-line" aria-hidden="true"
                  style={{ fill: 'none', stroke: axis.id === 'zong' ? 'var(--azure)' : 'var(--cinnabar-pure)', strokeWidth: 3.2, strokeLinecap: 'round', animationDelay: `${i * 90}ms` }}
                />
              ))}
              {hotPiece && hotPiece.states.slice(1).map((id) => {
                const seg = shortSeg(STATE[hotPiece.states[0]], STATE[id])
                return <line key={`hot-${id}`} {...seg} aria-hidden="true" style={{ stroke: 'var(--cinnabar)', strokeWidth: 2, strokeDasharray: '5 4', strokeLinecap: 'round' }} />
              })}
              {data.states.map((s) => (
                <g key={`lb-${s.id}`} className="zgm-state-label" aria-hidden="true">
                  <text x={s.x} y={s.y + 7} textAnchor="middle" style={{ fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontSize: s.id === 'zhou' ? 18 : 24, fontWeight: 600 }}>{s.name}</text>
                  {s.w >= 30 && <text x={s.x} y={s.y + 22} textAnchor="middle" style={{ fill: 'var(--ink-soft)', fontSize: 10 }}>{COUNT[s.id]} 篇</text>}
                </g>
              ))}
              {data.places.map((p) => {
                const on = placeLit(p)
                const lx = p.lp === 'b' ? p.x : p.x + 6
                const ly = p.lp === 'b' ? p.y + 15 : p.y + 4
                return (
                  <g
                    key={p.id} className={`zgm-place ${on ? 'is-on' : ''}`}
                    role="button" tabIndex={0} aria-pressed={sel === `p:${p.id}`}
                    aria-label={`${p.name},见 ${p.chs.length} 篇`}
                    onClick={() => toggleSel(`p:${p.id}`)} onKeyDown={onKeyActivate(() => toggleSel(`p:${p.id}`))}
                  >
                    <circle cx={p.x} cy={p.y} r={9} style={{ fill: 'transparent' }} />
                    <circle cx={p.x} cy={p.y} r={on ? 4.6 : 3.2} style={{ fill: on ? 'var(--cinnabar-pure)' : 'var(--ink-soft)', stroke: 'var(--paper)', strokeWidth: 1.2 }} />
                    <text
                      x={lx} y={ly} textAnchor={p.lp === 'b' ? 'middle' : 'start'}
                      style={{ fill: on ? 'var(--cinnabar-pure)' : 'var(--ink-soft)', fontSize: on ? 12.5 : 11, fontWeight: on ? 600 : 400, stroke: 'var(--paper)', strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' }}
                    >{p.name}</text>
                  </g>
                )
              })}
            </svg>
            <figcaption className="zgm-cap text-faint">
              示意图,非考古地图:格子按「离哪国中心近」粗分,只表相对方位(秦西、齐东、燕东北、楚南),不对应任何一年的疆界,也不给经纬。
            </figcaption>
          </figure>

          <aside className="zgm-panel">
            {hotPiece ? (
              <div className="zgm-panel__hot">
                <div className="zgm-panel__kicker text-faint">第{CN[hotPiece.ch]}篇 · {hotPiece.label}</div>
                <div className="zgm-panel__title">{hotPiece.title}</div>
                <div className="zgm-panel__states">所涉:{statesText(hotPiece.states)}<span className="text-faint">(虚线自{STATE[hotPiece.states[0]].name}国连出)</span></div>
                <p className="zgm-panel__note">{hotPiece.note}</p>
              </div>
            ) : selTitle ? (
              <div>
                <div className="zgm-panel__head">
                  <span className="zgm-panel__title">{selTitle}</span>
                  <span className="text-faint">{selState ? `十八篇里涉及 ${list.length} 篇` : `${list.length} 篇原文提到这里`}</span>
                  <button type="button" className="zgm-clear" onClick={() => setParam('s', '')}>清除</button>
                </div>
                <ol className="zgm-panel__list">
                  {list.map((p) => (
                    <li key={p.ch}>
                      <Link to={`${BOOK}/${p.ch}`} className="zgm-panel__link" {...hoverProps(p.ch)}>
                        <span className="zgm-panel__no">{p.ch}</span>{p.title}
                      </Link>
                      <span className={`zgm-panel__yr text-faint ${p.c === 'disputed' ? 'is-disputed' : ''}`}>{p.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="zgm-panel__hint text-soft">点地图上一国或一处地名,这里列出所涉之篇;或在下面按国、按地名点选。</p>
            )}

            <div className="zgm-chips" role="group" aria-label="按国选">
              {[...data.states].sort((a, b) => COUNT[b.id] - COUNT[a.id]).map((s) => (
                <button key={s.id} type="button" className={`zgm-chip ${sel === s.id ? 'is-on' : ''}`} aria-pressed={sel === s.id} onClick={() => toggleSel(s.id)}>
                  {s.name}<span className="zgm-chip__n">{COUNT[s.id]}</span>
                </button>
              ))}
            </div>
            <div className="zgm-chips zgm-chips--place" role="group" aria-label="按地名选">
              {data.places.map((p) => (
                <button key={p.id} type="button" className={`zgm-chip zgm-chip--place ${sel === `p:${p.id}` ? 'is-on' : ''}`} aria-pressed={sel === `p:${p.id}`} onClick={() => toggleSel(`p:${p.id}`)}>
                  {p.name}<span className="zgm-chip__n">{p.chs.length}</span>
                </button>
              ))}
            </div>
          </aside>
        </div>

        {axis && (
          <div className={`zgm-axis zgm-axis--${axis.id}`}>
            <div className="zgm-axis__head"><span className="zgm-axis__name">{axis.name}</span>{axis.gloss}</div>
            <ul className="zgm-axis__cites">
              {axis.cites.map((c) => (
                <li key={`${c.ch}-${c.quote}`}>
                  <q className="zgm-q">{c.quote}</q>
                  <Link to={`${BOOK}/${c.ch}`} className="zgm-axis__src">第{CN[c.ch]}篇《{PIECE[c.ch].title}》→</Link>
                </li>
              ))}
            </ul>
            <p className="zgm-axis__def">
              韩非在《{data.def.title}》里这样界定两者:<q className="zgm-q">{data.def.quote}</q>
              <Link to={`/fa/${data.def.slug}/${data.def.ch}`} className="zgm-axis__src">《{data.def.book}·{data.def.title}》→</Link>
              ——他是站在法家立场评这两套说辞的。至于「六国南北相连为纵、与西边的秦东西相连为横」,是后人就地势打的比方;地图上的线只是把这个比方画出来。
            </p>
          </div>
        )}
      </section>

      {/* ---------- 下半:时间轴 ---------- */}
      <section className="zgm-tl" aria-label="十八篇时间轴">
        <h2 className="zgm-h2">时间轴 · 一篇一条<span className="zgm-tl__swipe zgm-h2__filter text-faint">左右滑动看全</span></h2>
        <div className="zgm-tl__canvas">
          <svg viewBox={`0 0 ${TW} ${TH}`} className="zgm-tl__svg" role="group" aria-label="十八篇的推定年代">
            {ticks.map((y) => (
              <g key={y} aria-hidden="true">
                <line x1={xOf(y)} y1={AXIS_Y + 4} x2={xOf(y)} y2={TH - 6} style={{ stroke: 'var(--line)', strokeWidth: 1 }} />
                <text x={xOf(y)} y={AXIS_Y} textAnchor="middle" style={{ fill: 'var(--ink-faint)', fontSize: 10 }}>{yearText(y)}</text>
              </g>
            ))}
            {data.qinKings.map((k, i) => {
              const x1 = Math.max(xOf(k.from), xOf(AXIS.from)), x2 = xOf(k.to + 1)
              const w = x2 - x1
              return (
                <g key={k.name} aria-hidden="true">
                  <title>{`秦${k.name} · ${yearText(k.from)}—${yearText(k.to)}`}</title>
                  <rect x={x1 + 0.5} y={KING_Y} width={Math.max(0, w - 1)} height={KING_H} rx={2} style={{ fill: `color-mix(in srgb, var(--ink) ${i % 2 ? 7 : 12}%, var(--paper))` }} />
                  {w > k.name.length * 10 + 4 && (
                    <text x={x1 + w / 2} y={KING_Y + 10.5} textAnchor="middle" style={{ fill: 'var(--ink-soft)', fontSize: 9.5, fontFamily: 'var(--font-serif)' }}>{k.name}</text>
                  )}
                </g>
              )
            })}
            <text x={TPAD} y={KING_Y + KING_H + 11} style={{ fill: 'var(--ink-faint)', fontSize: 9 }} aria-hidden="true">↑ 秦君在位(参照)</text>
            <g aria-hidden="true">
              <line x1={xOf(-221)} y1={KING_Y - 2} x2={xOf(-221)} y2={TH - 6} style={{ stroke: 'var(--cinnabar-pure)', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.7 }} />
              <text x={xOf(-221) - 3} y={KING_Y + KING_H + 11} textAnchor="end" style={{ fill: 'var(--cinnabar-pure)', fontSize: 9 }}>秦兼天下 前221</text>
            </g>
            {spans.map(({ it, x1, x2, lane, nameRight, occ }) => {
              const y = LANE_TOP + lane * LANE_H
              const dim = !inSel(it.ch)
              const on = hot === it.ch
              const dis = it.c === 'disputed'
              return (
                <g
                  key={it.ch} className={`zgm-bar ${on ? 'is-hot' : ''}`}
                  style={{ opacity: dim ? 0.18 : 1, cursor: 'pointer' }}
                  role="link" tabIndex={0}
                  aria-label={`第${CN[it.ch]}篇 ${it.title},${it.label}${dis ? ',年代存疑' : ''}`}
                  {...hoverProps(it.ch)}
                  onClick={() => navigate(`${BOOK}/${it.ch}`)}
                  onKeyDown={onKeyActivate(() => navigate(`${BOOK}/${it.ch}`))}
                >
                  <title>{`${it.title} · ${it.label}`}</title>
                  <rect
                    x={occ[0] - 5} y={y - LANE_H / 2 + 1} width={occ[1] - occ[0] + 10} height={LANE_H - 2} rx={3}
                    style={{ fill: on ? 'var(--cinnabar-bg)' : 'transparent' }}
                  />
                  <line x1={x1} y1={y} x2={x2} y2={y} style={{ stroke: 'var(--cinnabar)', strokeWidth: on ? 6 : 4.5, strokeLinecap: 'round', opacity: dis ? 0.55 : 0.95, strokeDasharray: dis ? '3 4' : undefined }} />
                  <circle cx={x1} cy={y} r={3.4} style={dis ? { fill: 'var(--paper)', stroke: 'var(--cinnabar)', strokeWidth: 1.4 } : { fill: 'var(--cinnabar)' }} />
                  <text
                    x={nameRight ? x2 + 6 : x1 - 6} y={y + 4} textAnchor={nameRight ? 'start' : 'end'}
                    style={{ fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontSize: 12, fontWeight: on ? 700 : 400, opacity: dis ? 0.8 : 1 }}
                  >
                    <tspan style={{ fill: 'var(--ink-faint)', fontSize: 9.5 }}>{it.ch} </tspan>{it.title}{dis ? ' ?' : ''}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <p className="zgm-cap text-faint">
          横轴按年(前380—前220),每条是一篇从推定上限到下限的跨度;实线大致可推,虚线存疑(篇末「?」)。上方灰带是秦君在位,只作参照。停在一条上看地图,点一下读原文。
        </p>
      </section>

      {/* ---------- 年代推定表 ---------- */}
      <section className="zgm-table" aria-label="十八篇年代推定">
        <h2 className="zgm-h2">
          十八篇年代推定
          {selTitle && (
            <span className="zgm-h2__filter text-faint">
              只看{selTitle}({list.length} 篇)<button type="button" className="zgm-clear" onClick={() => setParam('s', '')}>显示全部</button>
            </span>
          )}
        </h2>
        <ol className="zgm-list">
          {list.map((p) => (
            <li
              key={p.ch} id={`zgm-${p.ch}`}
              className={`zgm-item ${p.c === 'disputed' ? 'zgm-item--disputed' : ''} ${hot === p.ch ? 'is-hot' : ''}`}
              onMouseEnter={() => setHot(p.ch)} onMouseLeave={() => setHot(null)}
            >
              <div className="zgm-item__head">
                <span className="zgm-item__year">{p.label}</span>
                <Link to={`${BOOK}/${p.ch}`} className="zgm-item__title" onFocus={() => setHot(p.ch)} onBlur={() => setHot(null)}>
                  第{CN[p.ch]}篇 · {p.title}
                </Link>
                {p.c === 'disputed' && <span className="zgm-item__flag">年代存疑</span>}
              </div>
              <div className="zgm-item__states">
                {p.states.map((id, i) => (
                  <button key={id} type="button" className={`zgm-mini ${sel === id ? 'is-on' : ''} ${i === 0 ? 'is-main' : ''}`} onClick={() => toggleSel(id)} title={i === 0 ? '说辞发生之国' : '所涉之国'}>
                    {STATE[id].name}
                  </button>
                ))}
                <span className="zgm-item__kw text-faint">据篇中「{p.kw}」</span>
              </div>
              <p className="zgm-item__note">{p.note}</p>
              {p.caveat && <p className="zgm-item__caveat"><span className="zgm-item__caveat-tag">说辞水分</span>{p.caveat}</p>}
            </li>
          ))}
        </ol>
      </section>

      <p className="zgm-fanli text-faint">
        凡例 · 地图是示意图,不是考古地图:七国与地名只表相对方位,疆域按距离粗分,不代表任何年代的实际版图,不给经纬。
        年代为推定:每篇只据篇中人物(君主、说客)的在位或活动推出大致区间;篇文自带上下限的(如「秦灭韩亡魏」)照篇文收紧,推不出或篇内自相抵牾的标「存疑」、画虚线,只给「战国中期」一类说法。
        君主在位与灭国之年取通行纪年;齐威王、宣王的在位年有《史记》与据《竹书纪年》校订两说,区间取宽。
        每篇所据人名、表中「」引文都回查过站内原文。说辞多铺张,「说辞水分」一栏如实标出——这里读的是战国人怎么说话、怎么打算,不是教人怎么说。
      </p>
    </div>
  )
}
