// 近一年逐日阅读热力(SVG,一格一天,墨色深浅五档)。heat = [{day:'YYYY-MM-DD', sec}] 旧→新、恰 365 项。
// 用 style 上色(SVG presentation 属性不认 var(),项目老坑);月份标签取每列首日为 1 号或跨月处。
import { useEffect, useRef } from 'react'

const CELL = 11, GAP = 2, STEP = CELL + GAP

function level(sec) {
  if (sec <= 0) return 0
  if (sec < 300) return 1
  if (sec < 900) return 2
  if (sec < 1800) return 3
  return 4
}
const FILL = ['var(--line)', 'color-mix(in srgb, var(--cinnabar) 28%, var(--paper))', 'color-mix(in srgb, var(--cinnabar) 52%, var(--paper))', 'color-mix(in srgb, var(--cinnabar) 76%, var(--paper))', 'var(--cinnabar-pure)']

function fmt(sec) {
  if (sec <= 0) return '无记录'
  if (sec < 60) return `${sec} 秒`
  return `${Math.round(sec / 60)} 分钟`
}

export default function ReadHeatmap({ heat }) {
  const boxRef = useRef(null)
  // 手机上容器横向滚动:初始滚到最右,先看到最近的日子(不用 rAF——后台标签页会被节流)
  useEffect(() => { const el = boxRef.current; if (el) el.scrollLeft = el.scrollWidth }, [heat])
  if (!Array.isArray(heat) || heat.length === 0) return null
  // 第一天所在的星期几决定首列偏移(周一为行 0)
  const first = new Date(`${heat[0].day}T00:00:00`)
  const offset = (first.getDay() + 6) % 7
  const cols = Math.ceil((offset + heat.length) / 7)
  const width = cols * STEP + 28, height = 7 * STEP + 18
  const months = []
  let lastMonth = -1
  heat.forEach((h, i) => {
    const idx = i + offset, col = Math.floor(idx / 7)
    const m = Number(h.day.slice(5, 7))
    if (m !== lastMonth) { if (lastMonth !== -1 || i === 0) months.push({ col, label: `${m}月` }); lastMonth = m }
  })
  return (
    <div className="read-heat" ref={boxRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="read-heat__svg" role="img" aria-label="近一年逐日阅读时长热力图">
        {['一', '三', '五'].map((d, i) => (
          <text key={d} x="0" y={(i * 2 + 1) * STEP + 16} className="read-heat__axis">{d}</text>
        ))}
        {months.map((m, i) => (i === 0 && m.col === 0 && months.length > 1 && months[1].col < 3 ? null : (
          <text key={`${m.label}-${m.col}`} x={m.col * STEP + 22} y="8" className="read-heat__axis">{m.label}</text>
        )))}
        {heat.map((h, i) => {
          const idx = i + offset, col = Math.floor(idx / 7), row = idx % 7
          return (
            <rect key={h.day} x={col * STEP + 22} y={row * STEP + 12} width={CELL} height={CELL} rx="2" style={{ fill: FILL[level(h.sec)] }}>
              <title>{h.day} · {fmt(h.sec)}</title>
            </rect>
          )
        })}
      </svg>
      <div className="read-heat__legend" aria-hidden="true">
        <span>少</span>
        {FILL.map((f, i) => <i key={i} style={{ background: f }} />)}
        <span>多</span>
      </div>
    </div>
  )
}
