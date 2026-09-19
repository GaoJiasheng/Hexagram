import { useId, useState } from 'react'
import { WUXING, shengOf, keOf, shengBy, keBy } from '../ganzhi/index.js'
import './WuxingWheel.css'

// 五行生克图(kind: wuxing)。
// 五行按正五边形排(木顶,顺时针 木→火→土→金→水):**相生画外圈五边形的边,相克画内部五角星**——
// 生是相邻、克是隔一,这个几何本身就是知识,不必额外解释。
// 交互:点一行 → 只亮与它有关的线,面板列出「它生谁/谁生它/它克谁/谁克它」(讲推导,不下结论)。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const N = WUXING.length
const CX = 150, CY = 150, R = 100, NR = 34

function pos(i) {
  const theta = ((i * 360) / N - 90) * (Math.PI / 180)
  return { x: CX + R * Math.cos(theta), y: CY + R * Math.sin(theta) }
}
const PTS = WUXING.map((_, i) => pos(i))

function shrink(a, b, startPad, endPad) {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len
  return { x1: a.x + ux * startPad, y1: a.y + uy * startPad, x2: b.x - ux * endPad, y2: b.y - uy * endPad }
}

function explainNode(wx, mode) {
  const lines = []
  if (mode !== 'ke') {
    lines.push(['它生谁', `${wx} 生 ${shengOf(wx)}——顺着外圈走一步。`])
    lines.push(['谁生它', `${shengBy(wx)} 生 ${wx}——外圈上它的上一位。`])
  }
  if (mode !== 'sheng') {
    lines.push(['它克谁', `${wx} 克 ${keOf(wx)}——隔一位,五角星的一条边。`])
    lines.push(['谁克它', `${keBy(wx)} 克 ${wx}——隔它一位,反过来克它。`])
  }
  return lines
}

export default function WuxingWheel({ center, highlight = [], labels, mode = 'both' }) {
  const rawId = useId()
  const uid = `wxw${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const [pick, setPick] = useState(WUXING.includes(center) ? center : null)

  const toggle = (wx) => setPick((cur) => (cur === wx ? null : wx))
  const connected = (i, j) => !pick || WUXING.indexOf(pick) === i || WUXING.indexOf(pick) === j

  const showSheng = mode !== 'ke'
  const showKe = mode !== 'sheng'

  return (
    <div className="wx">
      <div className="wx-figure">
        <svg className="wx-svg" viewBox="0 0 300 300" aria-hidden="true">
          <defs>
            <marker id={`${uid}-a`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
              <path className="wx-arrow" d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
            <marker id={`${uid}-af`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse">
              <path className="wx-arrow wx-arrow--active" d="M0,0 L7,3.5 L0,7 Z" />
            </marker>
          </defs>

          {showSheng && WUXING.map((wx, i) => {
            const j = (i + 1) % N
            const on = connected(i, j)
            const active = pick && on
            const { x1, y1, x2, y2 } = shrink(PTS[i], PTS[j], NR + 2, NR + 9)
            return (
              <line key={`s${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                className={`wx-edge wx-edge--sheng${active ? ' is-active' : ''}${pick && !on ? ' is-dim' : ''}`}
                markerEnd={`url(#${uid}-${active ? 'af' : 'a'})`} />
            )
          })}

          {showKe && WUXING.map((wx, i) => {
            const j = (i + 2) % N
            const on = connected(i, j)
            const active = pick && on
            const { x1, y1, x2, y2 } = shrink(PTS[i], PTS[j], NR + 2, NR + 9)
            return (
              <line key={`k${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                className={`wx-edge wx-edge--ke${active ? ' is-active' : ''}${pick && !on ? ' is-dim' : ''}`}
                markerEnd={`url(#${uid}-${active ? 'af' : 'a'})`} />
            )
          })}

          {WUXING.map((wx, i) => {
            const { x, y } = PTS[i]
            const isActive = pick === wx
            const isHl = highlight.includes(wx)
            return (
              <g key={wx} className={`wx-node sz-char--${WX_CLASS[wx]}${isActive ? ' is-active' : ''}`}>
                {isHl && <circle className="wx-node__ring" cx={x} cy={y} r={NR + 6} />}
                <circle className="wx-node__circle" cx={x} cy={y} r={NR} />
                <text className="wx-node__char" x={x} y={y - 4}>{wx}</text>
                {labels && labels[wx] && <text className="wx-node__label" x={x} y={y + 15}>{labels[wx]}</text>}
              </g>
            )
          })}
        </svg>

        <div className="wx-hit">
          {WUXING.map((wx, i) => {
            const { x, y } = PTS[i]
            return (
              <button
                key={wx}
                type="button"
                className="wx-hitbtn"
                style={{ left: `${(x / 300) * 100}%`, top: `${(y / 300) * 100}%`, width: `${((NR + 4) * 2 / 300) * 100}%`, height: `${((NR + 4) * 2 / 300) * 100}%` }}
                aria-pressed={pick === wx}
                aria-label={`${wx}${labels && labels[wx] ? `(${labels[wx]})` : ''}`}
                onClick={() => toggle(wx)}
              />
            )
          })}
        </div>
      </div>

      <div className="wx-detail" aria-live="polite">
        {pick ? (
          <>
            <p className="wx-detail__head">{pick}</p>
            <ul className="wx-detail__list">
              {explainNode(pick, mode).map(([k, t]) => (
                <li key={k}><b>{k}</b>{t}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="wx-detail__hint">点一个字,看它生谁、克谁。</p>
        )}
      </div>
      <p className="wx-foot">相生是相邻,相克是隔一——五个字排成一圈,两种关系就都在图上了。</p>
    </div>
  )
}
