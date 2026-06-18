import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadDebate, groupAccent, EPIGRAPH } from './debates.js'
import { bookBySlug, chapterHref } from '../reader/booksIndex.js'

// 圆桌节点坐标:n 家匀布于圆周(自顶部顺时针)
function nodePositions(n, cx, cy, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180)
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

// 论辩图谱的一条诘难边(F→T),端点缩到节点边缘,中点垂直微弯(让对向边不重叠)
function edgePath(F, T, sign) {
  const dx = T.x - F.x, dy = T.y - F.y, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len, pad = 30
  const fx = F.x + ux * pad, fy = F.y + uy * pad
  const tx = T.x - ux * pad, ty = T.y - uy * pad
  const mx = (fx + tx) / 2 + -uy * 16 * sign, my = (fy + ty) / 2 + ux * 16 * sign
  return `M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`
}

export default function DebatePage() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [revealed, setRevealed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const timer = useRef(null)

  usePageTitle(d?.title, '百家争鸣')

  useEffect(() => {
    let alive = true
    setD(null); setRevealed(1); setPlaying(false)
    loadDebate(id).then((x) => { if (alive) setD(x) })
    return () => { alive = false }
  }, [id])

  const turns = d ? d.rounds.flatMap((r) => r.turns.map((t) => ({ ...t, phase: r.phase }))) : []
  const total = turns.length

  useEffect(() => {
    if (!playing) return
    if (revealed >= total) { setPlaying(false); return }
    timer.current = setTimeout(() => setRevealed((r) => Math.min(r + 1, total)), 2200)
    return () => clearTimeout(timer.current)
  }, [playing, revealed, total])

  if (!d) {
    return (
      <div className="debate-page page-content">
        <div className="basics-breadcrumb"><Link to="/debates" className="basics-breadcrumb__link">← 百家争鸣</Link></div>
        <p className="text-faint">载入中…</p>
      </div>
    )
  }

  const schools = d.schools
  const byKey = Object.fromEntries(schools.map((s) => [s.key, s]))
  const pos = nodePositions(schools.length, 200, 158, 110)
  const nodeOf = Object.fromEntries(schools.map((s, i) => [s.key, pos[i]]))
  const activeKey = turns[revealed - 1]?.school
  const done = revealed >= total

  let lastPhase = null

  return (
    <div className="debate-page page-content">
      <div className="basics-breadcrumb"><Link to="/debates" className="basics-breadcrumb__link">← 百家争鸣</Link></div>

      <div className="debate-head">
        <h1 className="debate-title">{d.title}</h1>
        <p className="debate-question">{d.question}</p>
        <p className="debate-framing text-soft">{d.framing}</p>
      </div>

      {/* 圆桌布阵 + 论辩图谱(合一):印章环坐,诘难成朱线 */}
      <svg className="debate-graph" viewBox="0 0 400 300" role="img" aria-label="论辩图谱:各家环坐,诘难关系以朱线相连">
        <defs>
          <marker id="dbt-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" style={{ fill: 'var(--cinnabar)' }} />
          </marker>
        </defs>
        {turns.map((t, i) => {
          if (!t.rebut || !nodeOf[t.rebut]) return null
          const sign = schools.findIndex((s) => s.key === t.rebut) < schools.findIndex((s) => s.key === t.school) ? 1 : -1
          return (
            <path key={`e${i}`} className={`debate-edge ${i < revealed ? 'debate-edge--on' : ''}`}
              d={edgePath(nodeOf[t.rebut], nodeOf[t.school], sign)}
              markerEnd="url(#dbt-arrow)" pathLength="1" />
          )
        })}
        {schools.map((s, i) => (
          <g key={s.key} className={`debate-node ${activeKey === s.key ? 'debate-node--active' : ''}`}
            style={{ animationDelay: `${180 + i * 110}ms` }} transform={`translate(${pos[i].x},${pos[i].y})`}>
            {activeKey === s.key && <circle className="debate-node__ring" r="30" />}
            <rect x="-24" y="-24" width="48" height="48" rx="9" style={{ fill: groupAccent(s.group) }} />
            <text className="debate-node__seal" textAnchor="middle" dominantBaseline="central" y="1">{s.seal}</text>
            <text className="debate-node__name" textAnchor="middle" y="42">{s.label}</text>
            <text className="debate-node__stance" textAnchor="middle" y="58">{s.stance}</text>
          </g>
        ))}
      </svg>

      {/* 控制条 */}
      <div className="debate-controls">
        <button className="btn btn--secondary" onClick={() => setPlaying((p) => !p)} disabled={done}>
          {playing ? '⏸ 暂停' : '▶ 自动展开'}
        </button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setRevealed((r) => Math.min(r + 1, total)) }} disabled={done}>下一句 →</button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setRevealed(total) }} disabled={done}>跳到收束</button>
        {done && <button className="btn btn--ghost" onClick={() => setRevealed(1)}>↺ 重看</button>}
        <span className="debate-progress">{Math.min(revealed, total)} / {total}</span>
      </div>

      {/* 回合流 */}
      <div className="debate-stream">
        {turns.slice(0, revealed).map((t, i) => {
          const s = byKey[t.school]
          const header = t.phase !== lastPhase
          lastPhase = t.phase
          const book = bookBySlug(t.cite.slug)
          return (
            <div key={i}>
              {header && <div className="debate-phase">{t.phase}</div>}
              <div className="debate-turn" style={{ '--seat': groupAccent(s.group) }}>
                <div className="debate-turn__head">
                  <span className="debate-turn__seal" style={{ background: groupAccent(s.group) }}>{s.seal}</span>
                  <span className="debate-turn__name">{s.label}</span>
                  {t.rebut && <span className="debate-turn__rebut">驳 · {byKey[t.rebut]?.label}</span>}
                </div>
                <p className="debate-turn__point">{t.point}</p>
                <div className="debate-turn__cite">
                  <span className="debate-turn__quote">「{t.cite.quote}」</span>
                  {book && <Link to={chapterHref(book, t.cite.ch)} className="debate-turn__src">{t.cite.label} · 读原文 →</Link>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {done && (
        <div className="debate-coda">
          <div className="debate-coda__tag">会讲 · 殊途</div>
          <p className="debate-coda__text">{d.coda}</p>
          <p className="debate-coda__epigraph">{EPIGRAPH.text} ——《{EPIGRAPH.source}》</p>
          <Link to="/debates" className="btn btn--secondary">换一辩 →</Link>
        </div>
      )}
    </div>
  )
}
