import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import zhushiData from '../../../data/yijing/zhushi.json'
import { useSettings } from '../SettingsContext.jsx'
import { placeAnchors, mergeSpans } from '../../reader/xiangzhu.js'

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

// 词典模式定位:返回 [{start,end,entry}]
function dictSpans(text) {
  const spans = []
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
      spans.push({ start: i, end: i + hit.term.length, entry: hit })
      i += hit.term.length
    } else i++
  }
  return spans
}

// 区间 → 段(纯文本 / 注释词交替)
function toSegs(text, spans) {
  const segs = []
  let pos = 0
  for (const p of spans) {
    if (p.start < pos) continue
    if (p.start > pos) segs.push({ text: text.slice(pos, p.start), at: pos })
    segs.push({ entry: p.entry, at: p.start })
    pos = p.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), at: pos })
  return segs
}

function ZhuTerm({ entry, quiet = false }) {
  const [open, setOpen] = useState(false)
  // 气泡经 portal 渲染到 body——逃出 content-visibility/overflow 容器的绘制裁剪
  // (#144 在 .read-para 上加 content-visibility:auto,其隐含 paint 包含会把溢出本段的气泡裁掉,致 tooltip 不可见)。
  // pos 为 fixed 坐标 {left, top, below, maxH, site};null 时先隐藏测量、再算定位。
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const popRef = useRef(null)
  // 真实点按(含移动端轻点)会先触发 mouseover/focus 把气泡打开,紧跟的 click 不应再切换关闭;
  // 此标记记录「本次手势由悬停/聚焦打开」,由 click 消费
  const gestureOpenedRef = useRef(false)
  // 鼠标从词移到气泡上(详注长、可能要在里面滚)不关:离开后稍等,进了气泡就取消
  const leaveTimer = useRef(0)
  const cancelLeave = () => { clearTimeout(leaveTimer.current); leaveTimer.current = 0 }
  const scheduleLeave = () => {
    cancelLeave()
    leaveTimer.current = setTimeout(() => { gestureOpenedRef.current = false; setOpen(false) }, 140)
  }
  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const trig = ref.current, pop = popRef.current
    if (!trig || !pop) return
    const tr = trig.getBoundingClientRect()
    const pr = pop.getBoundingClientRect()
    const vh = window.innerHeight
    const margin = 8, gap = 8
    let left = tr.left + tr.width / 2
    const halfW = pr.width / 2
    if (left - halfW < margin) left = margin + halfW
    else if (left + halfW > window.innerWidth - margin) left = window.innerWidth - margin - halfW
    // 默认浮于触发词上方;上方放不下才翻到下方;两边都放不下(长详注 + 矮屏)取空间大的一边,限高、气泡内滚
    const roomAbove = tr.top - gap - margin
    const roomBelow = vh - tr.bottom - gap - margin
    let below = false
    let maxH = null
    if (pr.height > roomAbove) {
      if (pr.height <= roomBelow || roomBelow >= roomAbove) below = true
      const room = below ? roomBelow : roomAbove
      if (pr.height > room) maxH = Math.max(120, room)
    }
    const top = below ? tr.bottom + gap : tr.top - gap
    const site = trig.closest('[data-site]')?.getAttribute('data-site') || undefined
    setPos({ left, top, below, maxH, site })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onOutside = (e) => {
      if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // fixed 气泡不随文滚动,滚动即关、避免错位;气泡自己内部的滚动(长详注)不算
    const onScroll = (e) => { if (popRef.current?.contains(e.target)) return; setOpen(false) }
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
        className={`zhushi__trigger ${quiet ? 'zhushi__trigger--xz' : ''}`}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`注释：${entry.term}`}
        onMouseEnter={() => { cancelLeave(); gestureOpenedRef.current = !open; setOpen(true) }}
        onMouseLeave={scheduleLeave}
        onFocus={() => { gestureOpenedRef.current = !open; setOpen(true) }}
        onBlur={(e) => {
          // 焦点移进气泡(点桥链接)不关
          if (popRef.current?.contains(e.relatedTarget)) return
          gestureOpenedRef.current = false; setOpen(false)
        }}
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
          className={`zhushi__popover zhushi__popover--portal ${entry.more ? 'zhushi__popover--xz' : ''}`}
          role="tooltip"
          data-site={pos?.site}
          onMouseEnter={cancelLeave}
          onMouseLeave={scheduleLeave}
          // 在气泡里按下鼠标(滚动条、选字)不让触发词失焦——失焦即关
          onMouseDown={(e) => { if (!e.target.closest('a')) e.preventDefault() }}
          style={{
            position: 'fixed',
            left: pos ? `${pos.left}px` : '-9999px',
            top: pos ? `${pos.top}px` : '0px',
            bottom: 'auto',
            maxHeight: pos?.maxH ? `${pos.maxH}px` : undefined,
            transform: pos && pos.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            visibility: pos ? 'visible' : 'hidden',
          }}
        >
          <span className="zhushi__term">
            {entry.term}
            {entry.reading && <span className="zhushi__reading">（{entry.reading}）</span>}
          </span>
          {entry.note && <span className="zhushi__note">{entry.note}</span>}
          {entry.more && <span className="zhushi__more">{entry.more}</span>}
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

const VERSE_PUNCT = /[，。；！？]/

/** 经文字词注释。词典模式(v4 §1):对全文做最长优先匹配,用于卦辞与爻辞原文。
 *  锚定模式(v5 §3):传入 anchors 时只标注指定位置,用于传文逐段注疏。
 *  dict:无 anchors 时是否走词典模式(默认走;阅读器里「本段无简注、只有详注」的段传 false)。
 *  detail:该处的详注原始条目 [{k,d,x,r?}](docs/xiangzhu-spec.md),与简注按 mergeSpans 合并——详注优先,
 *    不重叠的简注照留,桥(qiao)必留。分片异步到手:先按简注渲染,到了原地升级(键按字位,段落不重挂)。
 *  设置「字词注释」关(settings.showNotes === false)→ 两层一概不标,只出原文。
 *  verse(#143):诗体经(黄庭等)按句读换行——在纯文本段内逢句读插 <br/>,注释词跨行不受影响。 */
export default function AnnotatedText({ text, anchors, detail = null, dict, verse = false }) {
  const { settings } = useSettings()
  if (!text) return null
  let segs
  let quiet = false   // 合了详注的段:整段下划线一律放轻(含留下来的简注),同一段里不一深一浅
  if (settings.showNotes === false) {
    segs = [{ text, at: 0 }]
  } else {
    const useDict = dict ?? !anchors?.length
    let spans = anchors?.length ? placeAnchors(text, anchors) : useDict ? dictSpans(text) : []
    if (detail?.length && settings.showXiangzhu !== false) { spans = mergeSpans(text, spans, detail); quiet = true }
    segs = toSegs(text, spans)
  }
  if (!verse) {
    return (
      <>
        {segs.map((s) =>
          s.entry ? <ZhuTerm key={`z${s.at}`} entry={s.entry} quiet={quiet} /> : <span key={`t${s.at}`}>{s.text}</span>
        )}
      </>
    )
  }
  const out = []
  segs.forEach((s) => {
    const i = s.at
    if (s.entry) { out.push(<ZhuTerm key={`z${i}`} entry={s.entry} quiet={quiet} />); return }
    // 纯文本段:按句读切片,逢句末标点插换行(含段-注释边界处的标点)
    for (const [j, pc] of s.text.split(/(?<=[，。；！？])/).filter(Boolean).entries()) {
      out.push(<span key={`${i}-${j}`}>{pc}</span>)
      if (VERSE_PUNCT.test(pc[pc.length - 1])) out.push(<br key={`${i}-${j}-br`} />)
    }
  })
  while (out.length && out[out.length - 1]?.type === 'br') out.pop()   // 去末尾多余换行
  return <>{out}</>
}
