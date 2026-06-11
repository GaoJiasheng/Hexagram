import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import glossaryData from '../../../data/yijing/glossary.json'

const glossaryMap = new Map(glossaryData.map(g => [g.key, g]))

export default function TermTip({ term, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const entry = glossaryMap.get(term)
  if (!entry) return <>{children ?? term}</>

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

  const aliasNote = entry.aliases.length ? `（${entry.aliases.join('·')}）` : ''

  return (
    <span className="termtip" ref={ref}>
      <span
        className="termtip__trigger"
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`术语：${entry.name}${aliasNote}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKey}
      >
        {children ?? entry.name}
      </span>
      {open && (
        <span className="termtip__popover" role="tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <span className="termtip__name">
            {entry.name}
            {entry.aliases.length > 0 && <span className="termtip__aliases">（{entry.aliases.join('·')}）</span>}
          </span>
          <span className="termtip__brief">{entry.brief}</span>
          <Link
            to={`/basics/glossary#${term}`}
            className="termtip__more"
            onClick={() => setOpen(false)}
            tabIndex={0}
          >
            详见名词表 →
          </Link>
        </span>
      )}
    </span>
  )
}
