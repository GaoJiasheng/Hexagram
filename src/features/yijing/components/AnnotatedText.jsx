import { useState, useRef, useEffect } from 'react'
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
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
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
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKey}
      >
        {entry.term}
      </span>
      {open && (
        <span className="zhushi__popover" role="tooltip">
          <span className="zhushi__term">
            {entry.term}
            {entry.reading && <span className="zhushi__reading">（{entry.reading}）</span>}
          </span>
          <span className="zhushi__note">{entry.note}</span>
          {entry.source && <span className="zhushi__source">——{entry.source}</span>}
        </span>
      )}
    </span>
  )
}

/** 经文字词注释(v4 §1):对原文做最长优先匹配,命中词悬停出注。
 *  只用于卦辞与爻辞原文;译文与彖象传不挂。 */
export default function AnnotatedText({ text }) {
  if (!text) return null
  const segs = segment(text)
  return (
    <>
      {segs.map((s, i) =>
        s.entry ? <ZhuTerm key={i} entry={s.entry} /> : <span key={i}>{s.text}</span>
      )}
    </>
  )
}
