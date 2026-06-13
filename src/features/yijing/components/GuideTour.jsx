import { useState, useLayoutEffect, useEffect, useCallback } from 'react'

// 轻量走查(v12 §2):按 CSS 选择器定位目标,描边高亮+气泡说明,逐步走完。无第三方库。
// steps: [{ selector, title, body }];目标找不到的步骤自动跳过(防御)。
export default function GuideTour({ steps, onClose }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[i]

  const measure = useCallback(() => {
    const el = step && document.querySelector(step.selector)
    if (!el) { setRect(null); return }
    const set = () => {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    el.scrollIntoView({ behavior: 'auto', block: 'center' })  // 瞬时滚动,避免读到动画途中的过时 rect
    set()                       // 立即量一次,保证环出现
    requestAnimationFrame(set)  // 滚动落定后再校准
  }, [step])

  useLayoutEffect(() => { measure() }, [measure])
  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // 目标缺失则跳过该步
  useEffect(() => {
    if (step && !document.querySelector(step.selector)) {
      if (i < steps.length - 1) setI(i + 1)
      else onClose()
    }
  }, [i, step, steps.length, onClose])

  if (!step) return null
  const last = i === steps.length - 1
  const next = () => (last ? onClose() : setI(i + 1))

  const tipStyle = rect
    ? rect.top + rect.height + 170 < window.innerHeight
      ? { top: rect.top + rect.height + 12, left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)) }
      : { top: Math.max(12, rect.top - 160), left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)) }
    : { top: '40%', left: '50%', transform: 'translate(-50%,-50%)' }

  return (
    <div className="tour" role="dialog" aria-label="示范走查">
      <div className="tour__backdrop" onClick={next} />
      {rect && (
        <div
          className="tour__ring"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div className="tour__tip" style={tipStyle}>
        <div className="tour__tip-head">
          <span className="tour__tip-title">{step.title}</span>
          <span className="tour__tip-count">{i + 1} / {steps.length}</span>
        </div>
        <p className="tour__tip-body">{step.body}</p>
        <div className="tour__tip-actions">
          <button className="btn-text" onClick={onClose}>跳过</button>
          <button className="btn btn--primary tour__next" onClick={next}>{last ? '完成' : '下一步'}</button>
        </div>
      </div>
    </div>
  )
}
