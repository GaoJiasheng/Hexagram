import { createContext, useContext, useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { makeTopology, GUTTER, NODE_W, NODE_H, HEADER_H } from '../zhuzi/topology.js'
import './RuLineagePage.css'

// 学脉 / 传灯图的通用视图(design-v24 §5 儒门学脉图抽出来的,§13 再挂一份禅宗传灯数据)。
// 与诸子拓扑图共用一套布局与几何(zhuzi/topology.js 的 makeTopology),换一份数据即另一张图。
// 动什么:开关几类线、点人、点线。悟什么:谁接谁、谁驳谁、谁并立——每根线挂着站内原文,闸逐条回查。
// props:data(ru-lineage.json 同形)· title / site(页题)· crumbs(面包屑)· svgLabel · markerId · fanli · back
// 样式沿用 RuLineagePage.css 的 .ru-lineage 类名(那是「学脉图」的皮,不只儒门用)。

const Ctx = createContext(null)
const useLineage = () => useContext(Ctx)
const DISPUTED_DASH = '1.5 4'
// edgeGeometry 返回的是带路径的副本,不能拿 indexOf 找回原边;按 from|to|type(闸保证唯一)建索引
const edgeKey = (e) => `${e.from}|${e.to}|${e.type}`

export default function LineageView({ data, title, site, crumbs, svgLabel, markerId, fanli, back, className = '' }) {
  usePageTitle(title, site)
  const T = useMemo(() => {
    const made = makeTopology(data)
    const { topology } = made
    return {
      ...made,
      ALL_TYPES: topology.edgeTypes.map((t) => t.key),
      DEFAULT_ON: [topology.edgeTypes[0].key],   // 默认只亮第一类(师承 / 传法)骨架——全画上是一团乱麻
      EDGE_INDEX: new Map(topology.edges.map((e, i) => [edgeKey(e), i])),
      schoolColor: (key) => made.schoolById[key]?.color || 'var(--ink-soft)',
    }
  }, [data])
  const { topology, computeLayout, edgeGeometry, nodeById, typeById, schoolById, ALL_TYPES, DEFAULT_ON, EDGE_INDEX, schoolColor } = T
  const layout = useMemo(() => computeLayout(), [computeLayout])
  const { rows, pos, width, height, eraX, eraW, endX } = layout
  const edges = useMemo(() => edgeGeometry(topology.edges, pos), [edgeGeometry, topology, pos])

  const [on, setOn] = useState(() => new Set(DEFAULT_ON))
  const [sel, setSel] = useState(null)          // {kind:'node', id} | {kind:'edge', i}
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  // 窄屏默认列表;挂载时 innerWidth 可能为 0(预览器视口塌缩),0 视为未知、先给图(与诸子拓扑图同一处理)
  const [view, setView] = useState('graph')
  const chose = useRef(false)
  const [hover, setHover] = useState(null)
  const drag = useRef(null)

  const toggle = (k) => setOn((s) => {
    const next = new Set(s)
    next.has(k) ? next.delete(k) : next.add(k)
    return next
  })

  const selNodeId = sel?.kind === 'node' ? sel.id : null
  // 选中某人时他的线一律显示(不受类型开关限制)
  const visible = edges.filter((e) => (selNodeId ? e.from === selNodeId || e.to === selNodeId : on.has(e.type)))
  const litNodes = selNodeId ? new Set([selNodeId, ...visible.flatMap((e) => [e.from, e.to])]) : null
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

  useEffect(() => {
    const w = window.innerWidth
    if (!chose.current && w > 0 && w < 760) setView('list')
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const startDrag = (ev) => {
    if (ev.target.closest('.topo-node, .topo-edge')) return
    drag.current = { x: ev.clientX, y: ev.clientY, px: pan.x, py: pan.y }
  }
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSel(null) }
  const pickNode = (id) => setSel((s) => (s?.kind === 'node' && s.id === id ? null : { kind: 'node', id }))
  const nDisputed = topology.edges.filter((e) => e.c === 'disputed').length
  const arrow = markerId || 'rulin-arrow'

  return (
    <Ctx.Provider value={T}>
      <div className={`topo-page ru-lineage ${className}`}>
        {crumbs}

        <header className="page-header">
          <h1 className="page-title">{topology.title}</h1>
          <p className="page-subtitle">{topology.subtitle}</p>
        </header>
        <p className="topo-intro" dangerouslySetInnerHTML={{ __html: mdBold(topology.intro) }} />
        <p className="topo-note">{topology.note}</p>
        {topology.companion && (
          <details className="topo-vs">
            <summary>{topology.companion.label}</summary>
            <p dangerouslySetInnerHTML={{ __html: mdBold(topology.companion.text) }} />
            <p><Link to={topology.companion.href} className="ru-lineage__companion">{topology.companion.linkLabel || '去看诸子拓扑图 ›'}</Link></p>
          </details>
        )}

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
            <button type="button" className={view === 'graph' ? 'on' : ''} aria-pressed={view === 'graph'}
              onClick={() => { chose.current = true; setView('graph') }}>图</button>
            <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'}
              onClick={() => { chose.current = true; setView('list') }}>列表</button>
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
              <svg className="topo-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={svgLabel}>
                <defs>
                  {/* 箭头随线着色(context-stroke)——谁传谁、谁说谁,方向就是这张图的意思 */}
                  <marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                </defs>
                <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: 'center' }}>
                  {/* 朝代带 */}
                  {topology.eras.map((e, i) => (
                    <g key={e.key}>
                      {i > 0 && <line x1={eraX[i]} y1={HEADER_H - 24} x2={eraX[i]} y2={height - 8}
                        style={{ stroke: 'var(--line)' }} strokeWidth="0.5" strokeDasharray="4 5" />}
                      <text className="topo-era" x={eraX[i] + eraW[i] / 2} y={26} textAnchor="middle">{e.label}</text>
                      <text className="topo-era-when" x={eraX[i] + eraW[i] / 2} y={40} textAnchor="middle">{e.when}</text>
                    </g>
                  ))}
                  {/* 此后 */}
                  <rect x={endX + 8} y={HEADER_H - 24} width={118} height={height - HEADER_H + 12}
                    rx="5" style={{ fill: 'none', stroke: 'var(--line)' }} strokeWidth="0.5" strokeDasharray="4 4" />
                  <text className="topo-era" x={endX + 67} y={26} textAnchor="middle">此后</text>
                  {topology.end.items.map((it, i) => (
                    <g key={it.label}>
                      <text className="topo-end" x={endX + 67} y={HEADER_H + 40 + i * 52} textAnchor="middle">{it.label}</text>
                      <text className="topo-end-when" x={endX + 67} y={HEADER_H + 56 + i * 52} textAnchor="middle">{it.when}</text>
                    </g>
                  ))}

                  {/* 学派行 */}
                  {rows.map((r) => (
                    <text key={r.school.key} className="topo-row-label" x={12} y={r.top + r.h / 2 + 4}
                      style={{ fill: schoolColor(r.school.key) }}>{r.school.label}</text>
                  ))}

                  {/* 关系线——画在人之下 */}
                  {visible.map((e) => {
                    const t = typeById[e.type]
                    const idx = EDGE_INDEX.get(edgeKey(e))
                    const active = sel?.kind === 'edge' && sel.i === idx
                    const near = !hover || e.from === hover || e.to === hover
                    const disputed = e.c === 'disputed'
                    return (
                      <path key={edgeKey(e)}
                        className={`topo-edge ${active ? 'topo-edge--on' : ''} ${near ? '' : 'topo-edge--far'}`}
                        d={e.d} style={{ fill: 'none', stroke: t.color }}
                        strokeWidth={active ? 2.2 : 1.2}
                        strokeDasharray={disputed ? DISPUTED_DASH : t.dash || undefined}
                        strokeLinecap={disputed ? 'round' : undefined}
                        markerEnd={`url(#${arrow})`}
                        onClick={() => setSel({ kind: 'edge', i: idx })}>
                        <title>{`${nodeById[e.from].label} → ${nodeById[e.to].label}:${t.label}${disputed ? '(存疑)' : ''}`}</title>
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
                        onClick={() => pickNode(n.id)}
                        tabIndex={0} role="button" aria-pressed={isSel} aria-label={`${n.label},${schoolById[n.school]?.label},${n.when}`}
                        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pickNode(n.id) } }}>
                        <rect x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx="5" />
                        <rect className="ru-lineage__bar" x={-NODE_W / 2} y={-NODE_H / 2 + 5} width={3} height={NODE_H - 10} rx="1.5"
                          style={{ fill: schoolColor(n.school), stroke: 'none' }} />
                        <text textAnchor="middle" y="5">{n.label}</text>
                        {n.caveat && <circle className="topo-node__flag" cx={NODE_W / 2 - 7} cy={-NODE_H / 2 + 7} r="2.6" />}
                      </g>
                    )
                  })}
                </g>
              </svg>
            </div>
            <p className="topo-hint">
              点一个人 → 只亮他的线 · 点一根线 → 看出处原文 · 拖动可平移 · Esc 取消选中
              <span className="ru-lineage__legend">
                <svg width="26" height="6" aria-hidden="true"><line x1="2" y1="3" x2="24" y2="3" style={{ stroke: 'var(--ink-soft)' }} strokeWidth="1.6" strokeDasharray={DISPUTED_DASH} strokeLinecap="round" /></svg>
                点线 = 存疑(旧说 / 归属未定,{nDisputed} 根)
              </span>
              <span className="topo-hint__flag">● 标记 = 其书旧题或站内无书</span>
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

        <p className="ru-lineage__fanli"><b>凡例</b> {fanli}</p>

        <p className="topo-back">{back}</p>
      </div>
    </Ctx.Provider>
  )
}

/** 窄屏与「看不清图」时的兜底:按学派列人,每人分「他怎么说别人 / 别人怎么说他」。 */
function ListView({ onPick, sel }) {
  const { topology, relationsOf } = useLineage()
  return (
    <div className="topo-list">
      {topology.schools.map((s) => {
        const people = topology.nodes.filter((n) => n.school === s.key)
        if (!people.length) return null
        return (
          <section key={s.key} className="topo-list__school">
            <h2 style={{ color: s.color }}>{s.label}</h2>
            {people.map((n) => {
              const { out, in: inc } = relationsOf(n.id)
              return (
                <article key={n.id} className={`topo-list__person ${sel === n.id ? 'is-sel' : ''}`}>
                  <button type="button" className="topo-list__name" onClick={() => onPick(n.id)}>
                    {n.label}<span className="topo-list__when">{n.when}</span>
                  </button>
                  {out.length > 0 && <Rel title="他怎么说、传给谁" list={out} pick="to" onPick={onPick} />}
                  {inc.length > 0 && <Rel title="谁说他、他承自谁" list={inc} pick="from" onPick={onPick} />}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

function Tag({ type, disputed }) {
  const { typeById } = useLineage()
  const t = typeById[type]
  return (
    <>
      <span className="topo-rel__tag" style={{ '--tc': t.color }}>{t.label}</span>
      {disputed && <span className="ru-lineage__disputed">存疑</span>}
    </>
  )
}

function Rel({ title, list, pick, onPick }) {
  const { nodeById } = useLineage()
  return (
    <div className="topo-rel">
      <h3>{title}</h3>
      <ul>
        {list.map((e) => {
          const other = nodeById[e[pick]]
          return (
            <li key={edgeKey(e)}>
              <Tag type={e.type} disputed={e.c === 'disputed'} />
              <button type="button" className="topo-rel__who" onClick={() => onPick(other.id)}>{other.label}</button>
              <span className="topo-rel__gist">{e.gist}</span>
              {e.note && <p className="ru-lineage__edge-note">{e.note}</p>}
              <Cites cites={e.cites} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Cites({ cites }) {
  const { citeHref } = useLineage()
  return (
    <ul className="topo-cites">
      {cites.map((c, i) => (
        <li key={i}>
          <q>{c.quote}</q>
          <Link to={citeHref(c)} className="topo-cite__src">{c.label} · 读原文 ›</Link>
        </li>
      ))}
    </ul>
  )
}

function BookLinks({ node }) {
  const books = [node.book, ...(node.alsoBooks || [])].filter(Boolean)
  if (!books.length && !node.renwu) return null
  return (
    <p className="topo-detail__book ru-lineage__books">
      {books.map((b) => <Link key={b.slug} to={`/${b.corpus}/${b.slug}`}>读《{b.title}》›</Link>)}
      {node.renwu && <Link to={`/renwu#${node.renwu}`}>人物志 ›</Link>}
    </p>
  )
}

function DebateLinks({ node }) {
  const { debatesOf } = useLineage()
  const list = debatesOf(node)
  if (!list.length) return null
  return (
    <div className="topo-debates">
      <h3>他在争鸣里参过的辩<span className="topo-debates__n">{list.length}</span></h3>
      <p className="topo-debates__list">
        {list.map((t) => <Link key={t.id} to={`/debates/${t.id}`} className="topo-debates__one">{t.title}</Link>)}
      </p>
    </div>
  )
}

function Detail({ sel, onPick }) {
  const { topology, nodeById, typeById, schoolById, schoolColor, relationsOf } = useLineage()
  if (!sel) return null
  if (sel.kind === 'node') {
    const n = nodeById[sel.id]
    if (!n) return null
    const { out, in: inc } = relationsOf(n.id)
    return (
      <aside className="topo-detail" aria-live="polite">
        <h2>{n.label}<span className="topo-detail__when">{n.when}</span>
          <span className="topo-detail__school" style={{ color: schoolColor(n.school) }}>{schoolById[n.school]?.label}</span></h2>
        <p>{n.note}</p>
        {n.caveat && <p className="topo-detail__caveat">⚠ {n.caveat}</p>}
        <BookLinks node={n} />
        <DebateLinks node={n} />
        {out.length > 0 && <Rel title="他怎么说、传给谁" list={out} pick="to" onPick={onPick} />}
        {inc.length > 0 && <Rel title="谁说他、他承自谁" list={inc} pick="from" onPick={onPick} />}
      </aside>
    )
  }
  const e = topology.edges[sel.i]
  if (!e) return null
  const t = typeById[e.type]
  return (
    <aside className="topo-detail" aria-live="polite">
      <h2>
        <button type="button" className="topo-rel__who" onClick={() => onPick(e.from)}>{nodeById[e.from].label}</button>
        <span className="topo-detail__arrow" style={{ '--tc': t.color }}>→</span>
        <button type="button" className="topo-rel__who" onClick={() => onPick(e.to)}>{nodeById[e.to].label}</button>
        <Tag type={e.type} disputed={e.c === 'disputed'} />
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

void GUTTER
