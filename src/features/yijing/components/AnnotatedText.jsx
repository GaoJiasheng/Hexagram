import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import zhushiData from '../../../data/yijing/zhushi.json'

// 按首字索引,同首字内长词优先(v4 §1.3 最长优先扫描)
const byFirstChar = new Map()
for (const z of zhushiData) {
  const c = z.term[0]
  if (!byFirstChar.has(c)) byFirstChar.set(c, [])
  byFirstChar.get(c).push(z)
}
for (const list of byFirstChar.values()) {
  list.sort((a, b) => b.term.length - a.term.length)
}

function segment(text) {
  const segs = []
  let i = 0
  while (i < text.length) {
    let hit = null
    const candidates = byFirstChar.get(text[i])
    if (candidates) {
      for (const z of candidates) {
        if (text.startsWith(z.term, i)) { hit = z; break }
      }
    }
    if (hit) {
      segs.push({ entry: hit })
      i += hit.term.length
    } else {
      const last = segs[segs.length - 1]
      if (last && last.text !== undefined) last.text += text[i]
      else segs.push({ text: text[i] })
      i++
    }
  }
  return segs
}

function ZhuTerm({ entry }) {
  const [open, setOpen] = useState(false)
  // 气泡经 portal 渲染到 body——逃出 content-visibility/overflow 容器的绘制裁剪
  // (#144 在 .read-para 上加 content-visibility:auto,其隐含 paint 包含会把溢出本段的气泡裁掉,致 tooltip 不可见)。
  // pos 为 fixed 坐标 {left, top, below, site};null 时先隐藏测量、再算定位。
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const popRef = useRef(null)
  // 真实点按(含移动端轻点)会先触发 mouseover/focus 把气泡打开,紧跟的 click 不应再切换关闭;
  // 此标记记录「本次手势由悬停/聚焦打开」,由 click 消费
  const gestureOpenedRef = useRef(false)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const trig = ref.current, pop = popRef.current
    if (!trig || !pop) return
    const tr = trig.getBoundingClientRect()
    const pr = pop.getBoundingClientRect()
    const margin = 8, gap = 8
    let left = tr.left + tr.width / 2
    const halfW = pr.width / 2
    if (left - halfW < margin) left = margin + halfW
    else if (left + halfW > window.innerWidth - margin) left = window.innerWidth - margin - halfW
    // 默认浮于触发词上方;上方放不下则翻到下方
    let below = false
    let top = tr.top - gap
    if (tr.top - pr.height - gap < margin) { below = true; top = tr.bottom + gap }
    const site = trig.closest('[data-site]')?.getAttribute('data-site') || undefined
    setPos({ left, top, below, site })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)  // fixed 气泡不随文滚动,滚动即关、避免错位
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function onKey(e) {
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o) }
  }

  return (
    <span className="zhushi" ref={ref}>
      <span
        className="zhushi__trigger"
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`注释：${entry.term}`}
        onMouseEnter={() => { gestureOpenedRef.current = !open; setOpen(true) }}
        onMouseLeave={() => { gestureOpenedRef.current = false; setOpen(false) }}
        onFocus={() => { gestureOpenedRef.current = !open; setOpen(true) }}
        onBlur={() => { gestureOpenedRef.current = false; setOpen(false) }}
        onClick={() => {
          if (gestureOpenedRef.current) { gestureOpenedRef.current = false; return }
          setOpen(o => !o)
        }}
        onKeyDown={onKey}
      >
        {entry.term}
      </span>
      {open && createPortal(
        <span
          ref={popRef}
          className="zhushi__popover zhushi__popover--portal"
          role="tooltip"
          data-site={pos?.site}
          style={{
            position: 'fixed',
            left: pos ? `${pos.left}px` : '-9999px',
            top: pos ? `${pos.top}px` : '0px',
            bottom: 'auto',
            transform: pos && pos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          <span className="zhushi__term">
            {entry.term}
            {entry.reading && <span className="zhushi__reading">（{entry.reading}）</span>}
          </span>
          {entry.note && <span className="zhushi__note">{entry.note}</span>}
          {entry.source && <span className="zhushi__source">——{entry.source}</span>}
          {entry.qiao && (
            <Link to={entry.qiao.to} className="zhushi__qiao">{entry.qiao.label}</Link>
          )}
        </span>,
        document.body,
      )}
    </span>
  )
}

// 锚定模式(v5 §3):只标注 anchors 指定的词在第 n 次出现的那一处。
// 区间重叠由 check-data 校验,此处防御性跳过;未命中条目静默忽略。
function segmentAnchored(text, anchors) {
  const placed = []
  for (const a of anchors) {
    const n = a.n ?? 1
    let idx = -1
    let from = 0
    for (let k = 0; k < n; k++) {
      idx = text.indexOf(a.term, from)
      if (idx === -1) break
      from = idx + 1
    }
    if (idx === -1) continue
    placed.push({ start: idx, end: idx + a.term.length, entry: a })
  }
  placed.sort((x, y) => x.start - y.start)
  const segs = []
  let pos = 0
  for (const p of placed) {
    if (p.start < pos) continue
    if (p.start > pos) segs.push({ text: text.slice(pos, p.start) })
    segs.push({ entry: p.entry })
    pos = p.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) })
  return segs
}

const VERSE_PUNCT = /[，。；！？]/

/** 经文字词注释。词典模式(v4 §1):对全文做最长优先匹配,用于卦辞与爻辞原文。
 *  锚定模式(v5 §3):传入 anchors 时只标注指定位置,用于传文逐段注疏。
 *  verse(#143):诗体经(黄庭等)按句读换行——在纯文本段内逢句读插 <br/>,注释词跨行不受影响。 */
export default function AnnotatedText({ text, anchors, verse = false }) {
  if (!text) return null
  const segs = anchors?.length ? segmentAnchored(text, anchors) : segment(text)
  if (!verse) {
    return (
      <>
        {segs.map((s, i) =>
          s.entry ? <ZhuTerm key={i} entry={s.entry} /> : <span key={i}>{s.text}</span>
        )}
      </>
    )
  }
  const out = []
  segs.forEach((s, i) => {
    if (s.entry) { out.push(<ZhuTerm key={i} entry={s.entry} />); return }
    // 纯文本段:按句读切片,逢句末标点插换行(含段-注释边界处的标点)
    for (const [j, pc] of s.text.split(/(?<=[，。；！？])/).filter(Boolean).entries()) {
      out.push(<span key={`${i}-${j}`}>{pc}</span>)
      if (VERSE_PUNCT.test(pc[pc.length - 1])) out.push(<br key={`${i}-${j}-br`} />)
    }
  })
  while (out.length && out[out.length - 1]?.type === 'br') out.pop()   // 去末尾多余换行
  return <>{out}</>
}
