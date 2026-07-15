import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 从左到右的层级思想树（书主页门面）。支持句子节点（多行自动换行）、任意深度（第四级+）、
// 变高 tidy-tree 布局（按每个节点实际高度分配纵向空间，展开时整树重排、零重叠）、平滑贝塞尔连线、
// ± 折叠泡。目标：不是大纲，而是能完整铺开全书思想的脑图。参 XMind / MindNode。
const HUES = ['#b0553c', '#3f7d6e', '#b3873a', '#7a5a9c', '#5b8046', '#4a6b8a']
const FS = [15, 13, 12.5, 12, 11.5]
const COL = 186, X0 = 64, CW = 760, MIN_CH = 520
const MAXW = 150, PADH = 13, PADV = 12, VGAP = 13, PAD_V = 24
const MIN_TAP = 42 // 触屏最小命中区(近 iOS HIG 44pt 建议),视觉尺寸不够则用透明命中矩形补齐
const ZMIN = 0.5, ZMAX = 2.4
const fsOf = (d) => FS[Math.min(d, FS.length - 1)]
const lhOf = (fs) => fs + 5

function wrap(text, fs) {
  const per = Math.max(5, Math.floor(MAXW / fs))
  if (text.length <= per) return [text]
  const lines = []
  for (let i = 0; i < text.length; i += per) lines.push(text.slice(i, i + per))
  return lines.length > 4 ? [...lines.slice(0, 3), lines.slice(3).join('').slice(0, per - 1) + '…'] : lines
}

// 把 client 坐标(触点位置)换算成 SVG viewBox 内部坐标(与 CW/clientWidth 缩放一致)
function svgPoint(svgEl, clientX, clientY) {
  const rect = svgEl.getBoundingClientRect()
  const s = CW / rect.width
  return { x: (clientX - rect.left) * s, y: (clientY - rect.top) * s }
}

export default function MindTree({ data, onOpenChapter }) {
  const [open, setOpen] = useState(() => new Set())
  const [sel, setSel] = useState(data.id)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [fs, setFs] = useState(false)
  // 多指手势:1 指拖动平移、2 指捏合缩放(锚定在两指中点,而非画面中心)
  const pointers = useRef(new Map())
  const gesture = useRef(null)

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
    // 画布高度按实际内容动态撑开(一级枝多——比如 13 章——时固定高度会把首尾节点挤出可见范围)
    let minY = Infinity, maxY = -Infinity
    nodes.forEach((nd) => { minY = Math.min(minY, nd.y - nd.h / 2); maxY = Math.max(maxY, nd.y + nd.h / 2) })
    const ch = Math.max(MIN_CH, maxY - minY + PAD_V * 2)
    const cy = ch / 2
    const yOff = cy - byId[data.id].y
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
    return { nodes, edges, ch }
  }, [data, open])

  function tap(rec) {
    if (rec.depth >= 1 && rec.n.children) {
      const nx = new Set(open); nx.has(rec.n.id) ? nx.delete(rec.n.id) : nx.add(rec.n.id); setOpen(nx)
    }
    setSel(rec.n.id)
  }
  function allIds(n, s = new Set()) { (n.children || []).forEach((c) => { if (c.children) { s.add(c.id); allIds(c, s) } }); return s }

  // 用 (nz, anchorX, anchorY) 通用锚定缩放:锚点在缩放前后保持画面位置不变
  function applyZoom(nz, anchorX, anchorY, basePan = pan, baseZoom = zoom) {
    const clamped = Math.min(ZMAX, Math.max(ZMIN, nz))
    const k = clamped / baseZoom
    setPan({ x: anchorX - (anchorX - basePan.x) * k, y: anchorY - (anchorY - basePan.y) * k })
    setZoom(clamped)
  }
  function zoomBy(f) {
    applyZoom(zoom * f, CW / 2, layout.ch / 2)
  }
  function reset() { setOpen(new Set()); setSel(data.id); setPan({ x: 0, y: 0 }); setZoom(1) }

  function beginPan(clientX, clientY) {
    gesture.current = { mode: 'pan', startX: clientX, startY: clientY, startPan: pan }
  }
  function beginPinch(svgEl) {
    const pts = [...pointers.current.values()]
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
    const anchor = svgPoint(svgEl, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
    gesture.current = { mode: 'pinch', startDist: dist, startZoom: zoom, startPan: pan, anchor }
  }
  function onPointerDown(e) {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 部分设备/合成指针不支持,不影响手势状态机 */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) beginPan(e.clientX, e.clientY)
    else if (pointers.current.size === 2) beginPinch(e.currentTarget)
    else gesture.current = null // 3 指及以上不处理手势,避免误触
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (!g) return
    if (g.mode === 'pan' && pointers.current.size === 1) {
      const s = CW / e.currentTarget.clientWidth
      setPan({ x: g.startPan.x + (e.clientX - g.startX) * s, y: g.startPan.y + (e.clientY - g.startY) * s })
    } else if (g.mode === 'pinch' && pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      applyZoom(g.startZoom * (dist / g.startDist), g.anchor.x, g.anchor.y, g.startPan, g.startZoom)
    }
  }
  function endPointer(e) {
    pointers.current.delete(e.pointerId)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* 已释放或不支持,忽略 */ }
    if (pointers.current.size === 1) {
      // 双指捏合松开一指后改回单指平移,以当前手指位置为新起点(避免跳变)
      const [[, p]] = pointers.current
      beginPan(p.x, p.y)
    } else if (pointers.current.size === 0) {
      gesture.current = null
    }
  }

  useEffect(() => {
    if (!fs) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setFs(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [fs])
  const selNode = findNode(data, sel)

  const body = (
    <>
      <div className="mm-bar">
        <span className="mm-hint">点节点 → 向右展开 · 单指拖动平移 · 双指捏合缩放</span>
        <span className="mm-tools">
          <button className="mm-ctl" onClick={() => zoomBy(1 / 1.2)} aria-label="缩小" title="缩小">－</button>
          <button className="mm-ctl" onClick={() => zoomBy(1.2)} aria-label="放大" title="放大">＋</button>
          <button className="mm-ctl" onClick={() => setOpen(allIds(data))}>展开全部</button>
          <button className="mm-ctl" onClick={reset}>复位</button>
          <button className="mm-ctl mm-ctl--fs" onClick={() => setFs((v) => !v)}>{fs ? '✕ 退出全屏' : '⤢ 全屏'}</button>
        </span>
      </div>
      <div className="mm-canvas">
        <svg
          viewBox={`0 0 ${CW} ${layout.ch}`}
          preserveAspectRatio="xMidYMid meet"
          className="mm-svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
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
              const hitW = Math.max(r.w, MIN_TAP), hitH = Math.max(r.h, MIN_TAP)
              return (
                <g key={r.n.id} className="mm-node mm-tap" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => tap(r)}>
                  {/* 透明命中区:视觉尺寸小于触屏最小命中建议(≈44pt)时,用它补足点击范围,不改变外观 */}
                  <rect x={r.x - hitW / 2} y={r.y - hitH / 2} width={hitW} height={hitH} fill="transparent" />
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
    </>
  )

  if (fs) {
    // 真全屏:portal 到 body 顶层(逃出祖先的 transform/content-visibility/overflow 裁剪，
    // 与全站其它全屏浮层同一套路——SettingsSheet/Colophon/BaihuaBlock 抽屉皆如此),
    // 并让出安全区(刘海/状态栏/底部手势条),而不是简单 position:fixed 就算数的「假全屏」。
    return createPortal(
      <div className="mm-wrap mm-wrap--fs" role="dialog" aria-modal="true" aria-label="脑图全屏">{body}</div>,
      document.body,
    )
  }

  return <div className="mm-wrap">{body}</div>
}

function findNode(n, id) {
  if (n.id === id) return n
  for (const k of n.children || []) { const r = findNode(k, id); if (r) return r }
  return null
}
