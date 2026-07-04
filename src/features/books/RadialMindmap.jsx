import { useMemo, useRef, useState } from 'react'

// 放射思想脑图（书主页门面）。中心朱印 + 六条主干各自配色 + 点开逐枝生长 + 拖动平移 + 点叶看要点。
// 与详读页的大纲树共用同一份 mindmap 数据（design：study-feature-design.md §4-A）。
const HUES = ['#b0553c', '#3f7d6e', '#b3873a', '#7a5a9c', '#5b8046', '#4a6b8a']
const CX = 340, CY = 258, R1 = 132, R2 = 236, D2R = Math.PI / 180

function pillW(label, fs) { return label.length * fs * 0.95 + 22 }

export default function RadialMindmap({ data, onSelect, onOpenChapter }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [sel, setSel] = useState(data.id)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  const layout = useMemo(() => {
    const nodes = [], edges = []
    nodes.push({ n: data, x: CX, y: CY, depth: 0 })
    ;(data.children || []).forEach((p, i) => {
      const ang = (-90 + i * (360 / data.children.length)) * D2R
      const hue = HUES[i % HUES.length]
      const px = CX + R1 * Math.cos(ang), py = CY + R1 * Math.sin(ang)
      edges.push({ id: 'e-' + p.id, x1: CX + 46 * Math.cos(ang), y1: CY + 46 * Math.sin(ang), x2: px, y2: py, hue, w: 3 })
      nodes.push({ n: p, x: px, y: py, depth: 1, hue })
      if (expanded.has(p.id) && p.children) {
        const m = p.children.length
        p.children.forEach((c, j) => {
          const sub = ang + (j - (m - 1) / 2) * 26 * D2R
          const lx = CX + R2 * Math.cos(sub), ly = CY + R2 * Math.sin(sub)
          edges.push({ id: 'e-' + c.id, x1: px, y1: py, x2: lx, y2: ly, hue, w: 1.8 })
          nodes.push({ n: c, x: lx, y: ly, depth: 2, hue })
        })
      }
    })
    return { nodes, edges }
  }, [data, expanded])

  function tap(item) {
    const { n, depth } = item
    if (depth === 1 && n.children) {
      const nx = new Set(expanded)
      nx.has(n.id) ? nx.delete(n.id) : nx.add(n.id)
      setExpanded(nx)
    }
    setSel(n.id)
    onSelect && onSelect(n, depth)
  }

  function onDown(e) { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y } }
  function onMove(e) {
    if (!drag.current) return
    const svg = e.currentTarget
    const s = 680 / svg.clientWidth
    setPan({ x: drag.current.px + (e.clientX - drag.current.x) * s, y: drag.current.py + (e.clientY - drag.current.y) * s })
  }
  function onUp() { drag.current = null }

  const selNode = findNode(data, sel)

  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-hint">点主干 → 逐枝生长 · 拖动平移 · 点叶看要点</span>
        <span>
          <button className="mm-ctl" onClick={() => setExpanded(new Set((data.children || []).map((p) => p.id)))}>展开全部</button>
          <button className="mm-ctl" onClick={() => { setExpanded(new Set()); setSel(data.id); setPan({ x: 0, y: 0 }) }}>复位</button>
        </span>
      </div>
      <div className="mm-canvas">
        <svg viewBox="0 0 680 520" className="mm-svg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <g transform={`translate(${pan.x},${pan.y})`}>
            <g>{layout.edges.map((e) => (
              <path key={e.id} className="mm-branch" pathLength="1"
                d={`M${e.x1},${e.y1} C${e.x1 + (e.x2 - e.x1) * 0.35},${e.y1 + (e.y2 - e.y1) * 0.35} ${e.x1 + (e.x2 - e.x1) * 0.65},${e.y1 + (e.y2 - e.y1) * 0.65} ${e.x2},${e.y2}`}
                fill="none" stroke={e.hue} strokeWidth={e.w} strokeLinecap="round" style={{ strokeDasharray: 1, opacity: 0.6 }} />
            ))}</g>
            <g>{layout.nodes.map((it) => it.depth === 0 ? (
              <g key="root" className="mm-node mm-tap" onPointerDown={(e) => e.stopPropagation()} onClick={() => tap(it)}>
                <circle cx={CX} cy={CY} r="46" fill="var(--cinnabar)" stroke="var(--cinnabar)" />
                <text x={CX} y={CY - 4} textAnchor="middle" fontSize="16" fill="var(--paper-raised)" fontFamily="var(--font-serif)" fontWeight="500">第二座</text>
                <text x={CX} y={CY + 16} textAnchor="middle" fontSize="16" fill="var(--paper-raised)" fontFamily="var(--font-serif)" fontWeight="500">山</text>
              </g>
            ) : (() => {
              const fs = it.depth === 1 ? 13 : 12, w = pillW(it.n.label, fs), h = fs + 15
              const isP = it.depth === 1, open = expanded.has(it.n.id), has = it.n.children && it.n.children.length
              return (
                <g key={it.n.id} className="mm-node mm-tap" onPointerDown={(e) => e.stopPropagation()} onClick={() => tap(it)}>
                  <rect x={it.x - w / 2} y={it.y - h / 2} width={w} height={h} rx={h / 2}
                    fill={isP ? it.hue : 'var(--paper-raised)'} stroke={it.hue} strokeWidth={isP ? 1.2 : 1} />
                  <text x={it.x} y={it.y + fs * 0.36} textAnchor="middle" fontSize={fs} fontFamily="var(--font-serif)" fontWeight="500"
                    fill={isP ? '#fff' : 'var(--ink)'}>{(has && !open ? '＋' : '') + it.n.label}</text>
                  {it.n.id === sel && <rect x={it.x - w / 2 - 3} y={it.y - h / 2 - 3} width={w + 6} height={h + 6} rx={(h + 6) / 2} fill="none" stroke="var(--cinnabar)" strokeWidth="1.5" />}
                </g>
              )
            })())}</g>
          </g>
        </svg>
      </div>
      {selNode && (
        <div className="mm-foot">
          <div><b>{selNode.label}</b>{selNode.ref && <span className="mm-ref"> · 第{selNode.ref.ch}章</span>}</div>
          <div className="mm-note">{selNode.note}</div>
          {selNode.ref && onOpenChapter && (
            <button className="mm-go" onClick={() => onOpenChapter(selNode)}>打开该章详读 ↗</button>
          )}
        </div>
      )}
    </div>
  )
}

function findNode(n, id) {
  if (n.id === id) return n
  for (const k of n.children || []) { const r = findNode(k, id); if (r) return r }
  return null
}
