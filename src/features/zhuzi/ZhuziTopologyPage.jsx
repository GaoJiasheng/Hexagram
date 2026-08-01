import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import {
  topology, computeLayout, edgeGeometry, nodeById, typeById, schoolById,
  citeHref, relationsOf, GUTTER, ERA_W, NODE_W, NODE_H, HEADER_H,
} from './topology.js'

const ALL_TYPES = topology.edgeTypes.map((t) => t.key)
// 默认只亮「师承·取用」骨架 —— 37 条边全画上去是毛线球,先给骨架,其余按类型开。
const DEFAULT_ON = ['lineage']

export default function ZhuziTopologyPage() {
  usePageTitle('诸子拓扑图')
  const { rows, pos, width, height } = useMemo(() => computeLayout(), [])
  const edges = useMemo(() => edgeGeometry(topology.edges, pos), [pos])

  const [on, setOn] = useState(() => new Set(DEFAULT_ON))
  const [sel, setSel] = useState(null)          // {kind:'node'|'edge', ...}
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  // 视图默认值:窄屏给列表(大图在手机上是硬伤)。
  // 坑:挂载时 innerWidth 可能是 0(iframe/预览器视口塌缩),0 < 760 会把桌面用户误判进列表,
  // 且此后再不纠正。故 0 视为「还不知道」,先给图,等布局稳定后在 effect 里再判一次。
  const [view, setView] = useState('graph')
  const chose = useRef(false)          // 用户手动切过就不再自动改
  const [hover, setHover] = useState(null)   // 密集态下光靠点击不够:掠过就预览他的线
  const drag = useRef(null)

  const toggle = (k) => setOn((s) => {
    const next = new Set(s)
    next.has(k) ? next.delete(k) : next.add(k)
    return next
  })

  const selNodeId = sel?.kind === 'node' ? sel.id : null
  // 选中某人时,他的边一律显示(不受类型开关限制)——否则点了人却看不到关系,很别扭。
  const visible = edges.filter((e) => (selNodeId ? e.from === selNodeId || e.to === selNodeId : on.has(e.type)))
  const litNodes = selNodeId
    ? new Set([selNodeId, ...visible.flatMap((e) => [e.from, e.to])])
    : null
  const hoverLit = hover && !selNodeId
    ? new Set([hover, ...visible.filter((e) => e.from === hover || e.to === hover).flatMap((e) => [e.from, e.to])])
    : null
  const lit = litNodes || hoverLit

  const move = useCallback((ev) => {
    if (!drag.current) return
    setPan({ x: drag.current.px + (ev.clientX - drag.current.x), y: drag.current.py + (ev.clientY - drag.current.y) })
  }, [])
  const up = useCallback(() => { drag.current = null }, [])
  useEffect(() => {
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [move, up])

  const startDrag = (ev) => {
    if (ev.target.closest('.topo-node, .topo-edge')) return
    drag.current = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y }
  }
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSel(null) }

  useEffect(() => {
    const w = window.innerWidth
    if (!chose.current && w > 0 && w < 760) setView('list')
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const endW = topology.eras.length * ERA_W + GUTTER

  return (
    <main className="topo-page">
      <header className="topo-head">
        <h1>{topology.title}</h1>
        <p className="topo-sub">{topology.subtitle}</p>
        <p className="topo-intro" dangerouslySetInnerHTML={{ __html: mdBold(topology.intro) }} />
        <p className="topo-note">{topology.note}</p>
      </header>

      <div className="topo-bar">
        <div className="topo-types">
          {topology.edgeTypes.map((t) => (
            <button key={t.key} type="button"
              className={`topo-type ${on.has(t.key) ? 'topo-type--on' : ''}`}
              style={{ '--tc': t.color }}
              aria-pressed={on.has(t.key)}
              onClick={() => toggle(t.key)}>
              <span className="topo-type__dash" aria-hidden="true" style={t.dash ? { borderTopStyle: 'dashed' } : undefined} />
              {t.label}
              <span className="topo-type__n">{topology.edges.filter((e) => e.type === t.key).length}</span>
            </button>
          ))}
          <button type="button" className="topo-type topo-type--all"
            onClick={() => setOn(new Set(on.size === ALL_TYPES.length ? DEFAULT_ON : ALL_TYPES))}>
            {on.size === ALL_TYPES.length ? '只看骨架' : '全部显示'}
          </button>
        </div>
        <div className="topo-view">
          <button type="button" className={view === 'graph' ? 'on' : ''} onClick={() => { chose.current = true; setView('graph') }}>图</button>
          <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => { chose.current = true; setView('list') }}>列表</button>
        </div>
      </div>

      {view === 'graph' ? (
        <>
          <div className="topo-canvas" onPointerDown={startDrag}>
            <div className="topo-zoom">
              <button type="button" onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))} aria-label="放大">＋</button>
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))} aria-label="缩小">－</button>
              <button type="button" onClick={reset} aria-label="复位">复位</button>
            </div>
            <svg className="topo-svg" viewBox={`0 0 ${width} ${height}`} role="img"
              aria-label="诸子拓扑图:横轴为时代,纵轴为学派,连线为诸子之间的指摘、推许、论辩与师承">
              <defs>
                {/* 箭头随线着色(context-stroke),否则「谁说谁」这个方向就丢了——而方向正是这张图的全部意义 */}
                <marker id="topo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </marker>
              </defs>
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: 'center' }}>
                {/* 时代带 */}
                {topology.eras.map((e, i) => (
                  <g key={e.key}>
                    {i > 0 && <line x1={GUTTER + i * ERA_W} y1={HEADER_H - 24} x2={GUTTER + i * ERA_W} y2={height - 8}
                      stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4 5" />}
                    <text className="topo-era" x={GUTTER + i * ERA_W + ERA_W / 2} y={26} textAnchor="middle">{e.label}</text>
                    <text className="topo-era-when" x={GUTTER + i * ERA_W + ERA_W / 2} y={40} textAnchor="middle">{e.when}</text>
                  </g>
                ))}
                {/* 终局带 */}
                <rect x={endW + 8} y={HEADER_H - 24} width={topology.eras.length ? 118 : 0} height={height - HEADER_H + 12}
                  rx="5" fill="none" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="4 4" />
                <text className="topo-era" x={endW + 67} y={26} textAnchor="middle">终局</text>
                {topology.end.items.map((it, i) => (
                  <g key={it.label}>
                    <text className="topo-end" x={endW + 67} y={HEADER_H + 40 + i * 52} textAnchor="middle">{it.label}</text>
                    <text className="topo-end-when" x={endW + 67} y={HEADER_H + 56 + i * 52} textAnchor="middle">{it.when}</text>
                  </g>
                ))}

                {/* 学派行 */}
                {rows.map((r) => (
                  <text key={r.school.key} className="topo-row-label" x={16} y={r.top + r.h / 2 + 4}>{r.school.label}</text>
                ))}

                {/* 关系线 —— 画在节点之下 */}
                {visible.map((e, i) => {
                  const t = typeById[e.type]
                  const active = sel?.kind === 'edge' && sel.i === topology.edges.indexOf(e)
                  const near = !hover || e.from === hover || e.to === hover
                  return (
                    <path key={`${e.from}-${e.to}-${e.type}-${i}`}
                      className={`topo-edge ${active ? 'topo-edge--on' : ''} ${near ? '' : 'topo-edge--far'}`}
                      d={e.d} fill="none" stroke={t.color}
                      strokeWidth={active ? 2.2 : 1.1}
                      strokeDasharray={t.dash || undefined}
                      markerEnd="url(#topo-arrow)"
                      onClick={() => setSel({ kind: 'edge', i: topology.edges.indexOf(e) })}>
                      <title>{`${nodeById[e.from].label} → ${nodeById[e.to].label}:${t.label}`}</title>
                    </path>
                  )
                })}

                {/* 人 */}
                {topology.nodes.map((n) => {
                  const p = pos[n.id]
                  const dim = lit && !lit.has(n.id)
                  const isSel = selNodeId === n.id
                  return (
                    <g key={n.id} className={`topo-node ${dim ? 'topo-node--dim' : ''} ${isSel ? 'topo-node--sel' : ''}`}
                      transform={`translate(${p.x} ${p.y})`}
                      onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
                      onClick={() => setSel(isSel ? null : { kind: 'node', id: n.id })}
                      tabIndex={0} role="button"
                      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel(isSel ? null : { kind: 'node', id: n.id }) } }}>
                      <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx="5" />
                      <text textAnchor="middle" y="5">{n.label}</text>
                      {n.caveat && <circle className="topo-node__flag" cx={NODE_W / 2 - 7} cy={-NODE_H / 2 + 7} r="2.6" />}
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
          <p className="topo-hint">
            点一个人 → 只亮他的关系 · 点一根线 → 看出处原文 · 拖动可平移 · Esc 取消选中
            <span className="topo-hint__flag">● 标记表示成书或其人存疑</span>
          </p>
        </>
      ) : (
        <ListView onPick={(id) => setSel({ kind: 'node', id })} sel={selNodeId} />
      )}

      <Detail sel={sel} onPick={(id) => setSel({ kind: 'node', id })} />

      <section className="topo-end-note">
        <h2>{topology.end.label}</h2>
        <ul>
          {topology.end.items.map((it) => (
            <li key={it.label}><b>{it.when} · {it.label}</b>——{it.note}</li>
          ))}
        </ul>
        <p className="topo-note">{topology.end.note}</p>
      </section>

      <p className="topo-back"><Link to="/hexagram">← 诸学门户</Link> · <Link to="/debates">赛博 · 百家争鸣</Link></p>
    </main>
  )
}

/** 移动端与「看不清图」时的兜底:按人列出「他说别人 / 别人说他」。 */
function ListView({ onPick, sel }) {
  return (
    <div className="topo-list">
      {topology.schools.map((s) => {
        const people = topology.nodes.filter((n) => n.school === s.key)
        if (!people.length) return null
        return (
          <section key={s.key} className="topo-list__school">
            <h2>{s.label}</h2>
            {people.map((n) => {
              const { out, in: inc } = relationsOf(n.id)
              return (
                <article key={n.id} className={`topo-list__person ${sel === n.id ? 'is-sel' : ''}`}>
                  <button type="button" className="topo-list__name" onClick={() => onPick(n.id)}>
                    {n.label}<span className="topo-list__when">{n.when}</span>
                  </button>
                  {!out.length && !inc.length && <p className="topo-list__none">先秦文献里没有与他相涉的互评记载。</p>}
                  {out.length > 0 && <Rel title="他怎么说别人" list={out} pick="to" onPick={onPick} />}
                  {inc.length > 0 && <Rel title="别人怎么说他" list={inc} pick="from" onPick={onPick} />}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function Rel({ title, list, pick, onPick }) {
  return (
    <div className="topo-rel">
      <h3>{title}</h3>
      <ul>
        {list.map((e, i) => {
          const t = typeById[e.type]
          const other = nodeById[e[pick]]
          return (
            <li key={i}>
              <span className="topo-rel__tag" style={{ '--tc': t.color }}>{t.label}</span>
              <button type="button" className="topo-rel__who" onClick={() => onPick(other.id)}>{other.label}</button>
              <span className="topo-rel__gist">{e.gist}</span>
              <Cites cites={e.cites} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Cites({ cites }) {
  return (
    <ul className="topo-cites">
      {cites.map((c, i) => (
        <li key={i}>
          <q>{c.quote}</q>
          <Link to={citeHref(c)} className="topo-cite__src">{c.label} ›</Link>
        </li>
      ))}
    </ul>
  )
}

function Detail({ sel, onPick }) {
  if (!sel) return null
  if (sel.kind === 'node') {
    const n = nodeById[sel.id]
    const { out, in: inc } = relationsOf(n.id)
    return (
      <aside className="topo-detail">
        <h2>{n.label}<span className="topo-detail__when">{n.when}</span>
          <span className="topo-detail__school">{schoolById[n.school]?.label}</span></h2>
        <p>{n.note}</p>
        {n.caveat && <p className="topo-detail__caveat">⚠ {n.caveat}</p>}
        {n.book && <p className="topo-detail__book"><Link to={`/${n.book.corpus}/${n.book.slug}`}>读《{n.book.title}》›</Link></p>}
        {!out.length && !inc.length
          ? <p className="topo-list__none">先秦文献里没有与他相涉的互评记载——图上是孤立的,这不是遗漏。</p>
          : <>
              {out.length > 0 && <Rel title="他怎么说别人" list={out} pick="to" onPick={onPick} />}
              {inc.length > 0 && <Rel title="别人怎么说他" list={inc} pick="from" onPick={onPick} />}
            </>}
      </aside>
    )
  }
  const e = topology.edges[sel.i]
  if (!e) return null
  const t = typeById[e.type]
  return (
    <aside className="topo-detail">
      <h2>
        <button type="button" className="topo-rel__who" onClick={() => onPick(e.from)}>{nodeById[e.from].label}</button>
        <span className="topo-detail__arrow" style={{ '--tc': t.color }}>→</span>
        <button type="button" className="topo-rel__who" onClick={() => onPick(e.to)}>{nodeById[e.to].label}</button>
        <span className="topo-rel__tag" style={{ '--tc': t.color }}>{t.label}</span>
      </h2>
      <p>{e.gist}</p>
      {e.note && <p className="topo-detail__caveat">{e.note}</p>}
      <Cites cites={e.cites} />
    </aside>
  )
}

// 只认 **加粗**,与白话/观书的块渲染同一约定。
function mdBold(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
}
