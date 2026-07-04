import { useMemo, useRef, useState } from 'react'

// 从左到右的层级思想树(书主页门面)。根在左、逐列右展、每叶独占一行(tidy-tree,不重叠)、
// 展开时整棵树重排腾地方;连线为两端水平切线的平滑贝塞尔(参 XMind / MindNode)。
const HUES = ['#b0553c', '#3f7d6e', '#b3873a', '#7a5a9c', '#5b8046', '#4a6b8a']
const COL = 208, ROW = 40, X0 = 78, CW = 680, CH = 500, CY = CH / 2
const estW = (label, fs) => Math.min(label.length * fs * 0.98 + 26, 208)

export default function MindTree({ data, onOpenChapter }) {
  const [open, setOpen] = useState(() => new Set())
  const [sel, setSel] = useState(data.id)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  const layout = useMemo(() => {
    const nodes = [], byId = {}
    let slot = 0
    // 一次后序遍历:叶/收起节点各占一行,展开节点居其子节点中点 —— 保证纵向不重叠
    function walk(n, depth, hue) {
      const isOpen = depth === 0 || open.has(n.id)
      const kids = isOpen && n.children ? n.children : null
      let y
      if (kids && kids.length) {
        const ys = kids.map((c, i) => walk(c, depth + 1, depth === 0 ? HUES[i % HUES.length] : hue))
        y = (ys[0] + ys[ys.length - 1]) / 2
      } else { y = slot; slot += 1 }
      const fs = depth === 0 ? 15 : depth === 1 ? 13 : 12
      const rec = { n, depth, hue: depth === 0 ? null : hue, slotY: y, fs, w: estW(n.label, fs), h: fs + 17 }
      nodes.push(rec); byId[n.id] = rec
      return y
    }
    walk(data, 0, null)
    const rootY = byId[data.id].slotY
    const yOff = CY - rootY * ROW          // 根恒居画布纵向中线 → 展开时视图不跳
    nodes.forEach((nd) => { nd.x = X0 + nd.depth * COL; nd.y = yOff + nd.slotY * ROW })
    const edges = []
    function ew(n) {
      const p = byId[n.id]; const isOpen = p.depth === 0 || open.has(n.id)
      if (isOpen && n.children) n.children.forEach((c) => {
        const cd = byId[c.id]; if (!cd) return
        edges.push({ id: 'e-' + c.id, x1: p.x + p.w / 2, y1: p.y, x2: cd.x - cd.w / 2, y2: cd.y, hue: cd.hue })
        ew(c)
      })
    }
    ew(data)
    return { nodes, edges }
  }, [data, open])

  function tap(rec) {
    if (rec.depth >= 1 && rec.n.children) {
      const nx = new Set(open); nx.has(rec.n.id) ? nx.delete(rec.n.id) : nx.add(rec.n.id); setOpen(nx)
    }
    setSel(rec.n.id)
  }
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
        <span className="mm-hint">点节点 → 向右展开 · 拖动平移 · 点叶看要点</span>
        <span>
          <button className="mm-ctl" onClick={() => setOpen(new Set((data.children || []).map((p) => p.id)))}>展开全部</button>
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
                fill="none" stroke={e.hue} strokeWidth="2" strokeLinecap="round" style={{ strokeDasharray: 1, opacity: 0.55 }} />
            })}</g>
            <g>{layout.nodes.map((rec) => {
              const isRoot = rec.depth === 0, isP = rec.depth === 1
              const has = rec.n.children && rec.n.children.length, opened = open.has(rec.n.id)
              const fill = isRoot ? 'var(--cinnabar)' : isP ? rec.hue : 'var(--paper-raised)'
              const txt = isRoot || isP ? '#fff' : 'var(--ink)'
              return (
                <g key={rec.n.id} className="mm-node mm-tap" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tap(rec)}>
                  <rect x={rec.x - rec.w / 2} y={rec.y - rec.h / 2} width={rec.w} height={rec.h} rx={rec.h / 2}
                    fill={fill} stroke={isRoot ? 'var(--cinnabar)' : rec.hue} strokeWidth={isP ? 1.2 : 1} />
                  <text x={rec.x} y={rec.y + rec.fs * 0.35} textAnchor="middle" fontSize={rec.fs} fontFamily="var(--font-serif)" fontWeight="500" fill={txt}>
                    {(has && !opened && !isRoot ? '＋ ' : '') + rec.n.label}
                  </text>
                  {rec.n.id === sel && <rect x={rec.x - rec.w / 2 - 3} y={rec.y - rec.h / 2 - 3} width={rec.w + 6} height={rec.h + 6} rx={(rec.h + 6) / 2} fill="none" stroke="var(--cinnabar)" strokeWidth="1.5" />}
                </g>
              )
            })}</g>
          </g>
        </svg>
      </div>
      {selNode && (
        <div className="mm-foot">
          <div><b>{selNode.label}</b>{selNode.ref && <span className="mm-ref"> · 第{selNode.ref.ch}章</span>}</div>
          <div className="mm-note">{selNode.note}</div>
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
