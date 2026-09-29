import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { VB, CX, CY, ringLayout, labelLines, centerLabelLines, arcBetween } from './ringLayout.js'
import './RingChart.css'

// ring · 通用环形序列(design-v24 §4)。第 0 项在正上方,顺时针排开。
// 动什么 → 悟什么:点一项看它的释义与出处;方向键 / 下方按钮沿环逐项走——
// arrows 时箭头标出先后,走到末项再往下一步又回到首项,「环」本身就是要讲的东西。
// props 契约与校验见 ring.schema.js。件内不写任何具体学说的内容:释义、引文、出处全由调用方给。

function Detail({ cur, sel, n, items, arrows, loop }) {
  if (!cur) return null
  const isItem = typeof sel === 'number'
  const hasPrev = isItem && (loop || sel > 0)
  const hasNext = isItem && (loop || sel < n - 1)
  return (
    <>
      <p className="ring-detail__head">
        <span className="ring-detail__label">{cur.label}</span>
        {isItem && <span className="ring-detail__pos">{sel + 1} / {n}</span>}
      </p>
      {arrows && isItem && (
        <p className="ring-detail__flow">
          {hasPrev ? <span>{items[(sel - 1 + n) % n].label}</span> : <span className="ring-detail__end">起</span>}
          <span aria-hidden="true"> → </span>
          <b>{cur.label}</b>
          <span aria-hidden="true"> → </span>
          {hasNext ? <span>{items[(sel + 1) % n].label}</span> : <span className="ring-detail__end">止</span>}
        </p>
      )}
      {cur.note && <p className="ring-detail__note">{cur.note}</p>}
      {cur.quote && <blockquote className="ring-detail__quote">「{cur.quote}」</blockquote>}
      {cur.href
        ? <Link to={cur.href} className="ring-detail__cite">{cur.cite || '读原文'} →</Link>
        : cur.cite && <p className="ring-detail__cite ring-detail__cite--plain">{cur.cite}</p>}
    </>
  )
}

export default function RingChart({ items = [], center, focus, arrows = false, loop = true, foot }) {
  const n = items.length
  const [sel, setSel] = useState(Number.isInteger(focus) ? focus : null)
  const nodeRefs = useRef([])
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const layout = ringLayout(n, arrows)
  const { R, r, nodes, centerR } = layout

  const centerObj = center && typeof center === 'object' ? center : null
  const centerLabel = centerObj ? centerObj.label : center
  const centerClickable = !!(centerObj && (centerObj.note || centerObj.quote || centerObj.href))

  const roving = typeof sel === 'number' ? sel : Number.isInteger(focus) ? focus : 0
  const cur = sel === 'c' ? centerObj : typeof sel === 'number' ? items[sel] : null

  const pick = (i) => setSel((s) => (s === i ? null : i))
  const go = (i, moveFocus) => {
    const j = ((i % n) + n) % n
    setSel(j)
    if (moveFocus) nodeRefs.current[j]?.focus()
  }
  const stepBy = (d) => go(typeof sel === 'number' ? sel + d : d > 0 ? 0 : n - 1, false)

  const onNodeKey = (ev, i) => {
    const k = ev.key
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); pick(i) }
    else if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); go(i + 1, true) }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); go(i - 1, true) }
    else if (k === 'Home') { ev.preventDefault(); go(0, true) }
    else if (k === 'End') { ev.preventDefault(); go(n - 1, true) }
  }

  const centerLines = centerLabel ? centerLabelLines(centerLabel, centerR) : null
  const title = centerLabel || '环形序列'

  return (
    <div className="ring">
      <svg viewBox={`0 0 ${VB} ${VB}`} className="ring-svg" role="group" aria-label={`${title}:${n} 项,自正上方顺时针排列`}>
        <circle cx={CX} cy={CY} r={R} fill="none" className={`ring-rim${arrows ? ' ring-rim--faint' : ''}`} />

        {arrows && items.map((_, i) => {
          const j = (i + 1) % n
          const a = arcBetween(i, layout)
          const closing = i === n - 1
          const cls = [
            'ring-arc',
            closing && !loop && 'ring-arc--open',
            sel === i && 'is-out',
            sel === j && 'is-in',
          ].filter(Boolean).join(' ')
          return (
            <g key={`arc-${i}`} className={cls}>
              <title>{`${items[i].label} → ${items[j].label}`}</title>
              <path d={a.d} fill="none" className="ring-arc__line" />
              <polygon points={a.head} className="ring-arc__head" />
            </g>
          )
        })}

        {centerLabel && centerR > 18 && (
          centerClickable ? (
            <g
              className={`ring-center is-clickable${sel === 'c' ? ' is-active' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={sel === 'c'}
              aria-label={`${centerLabel}(总说)`}
              onClick={() => setSel((s) => (s === 'c' ? null : 'c'))}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel((s) => (s === 'c' ? null : 'c')) } }}
            >
              <title>{centerLabel}</title>
              <circle cx={CX} cy={CY} r={centerR} className="ring-center__disc" />
              <CenterText lines={centerLines} />
            </g>
          ) : (
            <g className="ring-center" aria-hidden="true">
              <circle cx={CX} cy={CY} r={centerR} className="ring-center__disc" />
              <CenterText lines={centerLines} />
            </g>
          )
        )}

        {items.map((it, i) => {
          const p = nodes[i]
          const { lines, fs } = labelLines(it.label, r)
          const cls = ['ring-node', sel === i && 'is-active', focus === i && 'is-focus', it.quote && 'has-quote'].filter(Boolean).join(' ')
          return (
            <g
              key={`${uid}-${i}`}
              ref={(el) => { nodeRefs.current[i] = el }}
              className={cls}
              role="button"
              tabIndex={i === roving ? 0 : -1}
              aria-pressed={sel === i}
              aria-label={`${it.label}(第 ${i + 1} 项,共 ${n} 项)`}
              transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
              onClick={() => pick(i)}
              onKeyDown={(ev) => onNodeKey(ev, i)}
            >
              <title>{it.label}</title>
              <circle r={r + 5} fill="transparent" />
              <circle r={r} className="ring-node__disc" />
              <text className="ring-node__ch" textAnchor="middle" dominantBaseline="central" style={{ fontSize: `${fs.toFixed(1)}px` }}>
                {lines.length === 1
                  ? lines[0]
                  : lines.map((l, k) => <tspan key={k} x="0" dy={k === 0 ? '-0.55em' : '1.1em'}>{l}</tspan>)}
              </text>
              {it.quote && <circle r={2} cy={r - 5} className="ring-node__dot" />}
            </g>
          )
        })}
      </svg>

      <div className="ring-detail" aria-live="polite">
        {cur
          ? <Detail cur={cur} sel={sel} n={n} items={items} arrows={arrows} loop={loop} />
          : (
            <p className="ring-detail__hint">
              点环上任一项,看它的释义与出处{centerClickable ? ';点中心看总说' : ''}。方向键或下方按钮可沿环逐项走{items.some((it) => it.quote) ? ';节点下沿带小点的,释义引有经文' : ''}。
            </p>
          )}
      </div>

      <div className="ring-steps">
        <button type="button" className="ring-step" onClick={() => stepBy(-1)}>← 上一项</button>
        <button type="button" className="ring-step" onClick={() => stepBy(1)}>下一项 →</button>
      </div>
      {foot && <p className="ring-foot">{foot}</p>}
    </div>
  )
}

function CenterText({ lines }) {
  if (!lines) return null
  const fs = lines.fs
  return (
    <text x={CX} y={CY} className="ring-center__ch" textAnchor="middle" dominantBaseline="central" style={{ fontSize: `${fs.toFixed(1)}px` }}>
      {lines.lines.length === 1
        ? lines.lines[0]
        : lines.lines.map((l, k) => <tspan key={k} x={CX} dy={k === 0 ? '-0.55em' : '1.1em'}>{l}</tspan>)}
    </text>
  )
}
