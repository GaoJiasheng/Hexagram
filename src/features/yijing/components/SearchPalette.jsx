import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { allHexagrams } from '../data.js'

function highlight(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--cinnabar-bg)', color: 'var(--cinnabar)' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function searchHexagrams(q) {
  if (!q) return []
  const lower = q.toLowerCase()
  const results = []
  for (const h of allHexagrams) {
    if (
      h.name.includes(q) ||
      h.fullName.includes(q) ||
      h.pinyin?.toLowerCase().includes(lower) ||
      String(h.id) === q
    ) {
      results.push({ type: 'hexagram', id: h.id, label: `${h.fullName}`, sub: `第${h.id}卦`, hex: h })
    }
  }
  return results.slice(0, 5)
}

function searchTexts(q) {
  if (!q || q.length < 2) return []
  const results = []
  for (const h of allHexagrams) {
    const fields = [
      { text: h.judgment?.original, label: `${h.name}·卦辞` },
      ...h.lines.map(l => ({ text: l.original, label: `${h.name}·${l.title}` })),
    ]
    for (const f of fields) {
      if (f.text?.includes(q)) {
        results.push({ type: 'text', id: h.id, label: `…${f.text}…`, sub: f.label, hex: h })
        if (results.length >= 5) return results
      }
    }
  }
  return results
}

export default function SearchPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const hexResults = searchHexagrams(query)
  const textResults = query.length >= 2 ? searchTexts(query) : []
  const allResults = [...hexResults, ...textResults]

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  function go(r) {
    navigate(`/hexagram/${r.id}`)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allResults.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && allResults[selected]) go(allResults[selected])
  }

  if (!open) return null

  return (
    <div className="search-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="search-palette" role="dialog" aria-label="全局搜索">
        <div className="search-palette__input-row">
          <span className="search-palette__icon">◌</span>
          <input
            ref={inputRef}
            className="search-palette__input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜索卦名、拼音、卦序或原文…"
            aria-label="搜索"
          />
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>
        {allResults.length > 0 && (
          <ul className="search-results" role="listbox">
            {hexResults.length > 0 && (
              <li className="search-results__group-label">卦</li>
            )}
            {hexResults.map((r, i) => (
              <li
                key={r.id + '-hex'}
                className={`search-result ${selected === i ? 'search-result--selected' : ''}`}
                role="option"
                aria-selected={selected === i}
                onClick={() => go(r)}
              >
                <span className="search-result__label">{highlight(r.label, query)}</span>
                <span className="search-result__sub">{r.sub}</span>
              </li>
            ))}
            {textResults.length > 0 && (
              <li className="search-results__group-label">原文</li>
            )}
            {textResults.map((r, i) => (
              <li
                key={r.id + '-text-' + i}
                className={`search-result ${selected === hexResults.length + i ? 'search-result--selected' : ''}`}
                role="option"
                aria-selected={selected === hexResults.length + i}
                onClick={() => go(r)}
              >
                <span className="search-result__label">{highlight(r.label, query)}</span>
                <span className="search-result__sub">{r.sub}</span>
              </li>
            ))}
          </ul>
        )}
        {query && allResults.length === 0 && (
          <p className="search-palette__empty">无匹配结果</p>
        )}
      </div>
    </div>
  )
}
