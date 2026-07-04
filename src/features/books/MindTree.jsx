import { useMemo, useRef, useState } from 'react'

// 从左到右的层级思想树（书主页门面）。支持句子节点（多行自动换行）、任意深度（第四级+）、
// 变高 tidy-tree 布局（按每个节点实际高度分配纵向空间，展开时整树重排、零重叠）、平滑贝塞尔连线、
// ± 折叠泡。目标：不是大纲，而是能完整铺开全书思想的脑图。参 XMind / MindNode。
const HUES = ['#b0553c', '#3f7d6e', '#b3873a', '#7a5a9c', '#5b8046', '#4a6b8a']
const FS = [15, 13, 12.5, 12, 11.5]
const COL = 186, X0 = 64, CW = 760, CH = 520, CY = CH / 2
const MAXW = 150, PADH = 13, PADV = 12, VGAP = 13
const fsOf = (d) => FS[Math.min(d, FS.length - 1)]
const lhOf = (fs) => fs + 5

function wrap(text, fs) {
  const per = Math.max(5, Math.floor(MAXW / fs))
  if (text.length <= per) return [text]
  const lines = []
  for (let i = 0; i < text.length; i += per) lines.push(text.slice(i, i + per))
  return lines.length > 4 ? [...lines.slice(0, 3), lines.slice(3).join('').slice(0, per - 1) + '…'] : lines
}

export default function MindTree({ data, onOpenChapter }) {
  const [open, setOpen] = useState(() => new Set())
  const [sel, setSel] = useState(data.id)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  const layout = useMemo(() => {
    const nodes = [], byId = {}
    let cursor = 0
    function walk(n, depth, hue) {
      const fs = fsOf(depth), lines = wrap(n.label, fs)
      const w = Math.min(Math.max(...lines.map((l) => l.length)) * fs * 0.98, MAXW) + PADH * 2
      const h = lines.length * lhOf(fs) + PADV
      const isOpen = depth === 0 || open.has(n.id)
      const kids = isOpen && n.children ? n.children : null
      let cy
      if (kids && kids.length) {
        const cys = kids.map((c, i) => walk(c, depth + 1, depth === 0 ? HUES[i % HUES.length] : hue))
        cy = (cys[0] + cys[cys.length - 1]) / 2
      } else { cy = cursor + h / 2; cursor += h + VGAP }
      const rec = { n, depth, hue: depth === 0 ? null : hue, x: X0 + depth * COL, y: cy, w, h, lines, fs }
      nodes.push(rec); byId[n.id] = rec
      return cy
    }
    walk(data, 0, null)
    const yOff = CY - byId[data.id].y
    nodes.forEach((nd) => (nd.y += yOff))
    const edges = []
    ;(function ew(n) {
      const p = byId[n.id]; const isOpen = p.depth === 0 || open.has(n.id)
      if (isOpen && n.children) n.children.forEach((c) => {
        const cd = byId[c.id]; if (!cd) return
        edges.push({ id: 'e-' + c.id, x1: p.x + p.w / 2, y1: p.y, x2: cd.x - cd.w / 2, y2: cd.y, hue: cd.hue })
        ew(c)
      })
    })(data)
    return { nodes, edges }
  }, [data, open])

  function tap(rec) {
    if (rec.depth >= 1 && rec.n.children) {
      const nx = new Set(open); nx.has(rec.n.id) ? nx.delete(rec.n.id) : nx.add(rec.n.id); setOpen(nx)
    }
    setSel(rec.n.id)
  }
  function allIds(n, s = new Set()) { (n.children || []).forEach((c) => { if (c.children) { s.add(c.id); allIds(c, s) } }); return s }
  function onDown(e) { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y } }
  function onMove(e) {
    if (!drag.current) return
    const s = CW / e.currentTarget.clientWidth
    setPan({ x: drag.current.px + (e.clientX - drag.current.x) * s, y: drag.current.py + (e.clientY - drag.current.y) * s })
  }
  function onUp() { drag.current = null }
  const selNode = findNode(data, sel)

  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-hint">点节点 → 向右展开 · 拖动平移 · 点节点看要点</span>
        <span>
          <button className="mm-ctl" onClick={() => setOpen(allIds(data))}>展开全部</button>
          <button className="mm-ctl" onClick={() => { setOpen(new Set()); setSel(data.id); setPan({ x: 0, y: 0 }) }}>复位</button>
        </span>
      </div>
      <div className="mm-canvas">
        <svg viewBox={`0 0 ${CW} ${CH}`} className="mm-svg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          <g transform={`translate(${pan.x},${pan.y})`}>
            <g>{layout.edges.map((e) => {
              const mx = (e.x1 + e.x2) / 2
              return <path key={e.id} className="mm-branch" pathLength="1"
                d={`M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`}
                fill="none" stroke={e.hue} strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray: 1, opacity: 0.5 }} />
            })}</g>
            <g>{layout.nodes.map((r) => {
              const isRoot = r.depth === 0, isP = r.depth === 1
              const has = r.n.children && r.n.children.length, opened = open.has(r.n.id)
              const fill = isRoot ? 'var(--cinnabar)' : isP ? r.hue
                : r.depth === 2 ? `color-mix(in srgb, ${r.hue} 16%, var(--paper-raised))`
                : `color-mix(in srgb, ${r.hue} 7%, var(--paper-raised))`
              const txt = isRoot || isP ? '#fff' : 'var(--ink)'
              const top = r.y - (r.lines.length - 1) * lhOf(r.fs) / 2
              return (
                <g key={r.n.id} className="mm-node mm-tap" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tap(r)}>
                  {r.n.id === sel && <rect x={r.x - r.w / 2 - 3} y={r.y - r.h / 2 - 3} width={r.w + 6} height={r.h + 6} rx={10} fill="none" stroke="var(--cinnabar)" strokeWidth="1.5" />}
                  <rect x={r.x - r.w / 2} y={r.y - r.h / 2} width={r.w} height={r.h} rx={Math.min(r.h / 2, 14)}
                    fill={fill} stroke={isRoot ? 'var(--cinnabar)' : r.hue} strokeWidth={isP ? 1.2 : 1} />
                  {r.lines.map((ln, i) => (
                    <text key={i} x={r.x} y={top + i * lhOf(r.fs) + r.fs * 0.34} textAnchor="middle" fontSize={r.fs} fontFamily="var(--font-serif)" fontWeight="500" fill={txt}>{ln}</text>
                  ))}
                  {has && !isRoot && (
                    <g>
                      <circle cx={r.x + r.w / 2} cy={r.y} r="7" fill="var(--paper-raised)" stroke={r.hue} strokeWidth="1" />
                      <text x={r.x + r.w / 2} y={r.y + 3.5} textAnchor="middle" fontSize="11" fill={r.hue}>{opened ? '–' : '+'}</text>
                    </g>
                  )}
                </g>
              )
            })}</g>
          </g>
        </svg>
      </div>
      {selNode && (
        <div className="mm-foot">
          <div><b>{selNode.label}</b>{selNode.ref && <span className="mm-ref"> · 第{selNode.ref.ch}章</span>}</div>
          {selNode.note && <div className="mm-note">{selNode.note}</div>}
          {selNode.ref && onOpenChapter && <button className="mm-go" onClick={() => onOpenChapter(selNode)}>打开该章详读 ↗</button>}
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
