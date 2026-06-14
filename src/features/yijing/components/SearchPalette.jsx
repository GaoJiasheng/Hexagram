import { useState, useEffect, useRef, useDeferredValue, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchAll, ensureClassicsIndexed } from '../searchIndex.js'

function highlight(text, query) {
  if (!query || typeof text !== 'string') return text
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

export default function SearchPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [, setIndexTick] = useState(0)   // 经传索引补建完成后触发重查
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const deferredQuery = useDeferredValue(query)
  const groups = searchAll(deferredQuery)
  const flat = groups.flatMap(g => g.items)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      ensureClassicsIndexed().then(() => setIndexTick(t => t + 1))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // 打开时锁背景滚动 + 关闭还原焦点
  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus()
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [deferredQuery])

  function go(r) {
    navigate(r.to)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && flat[selected]) go(flat[selected])
  }

  if (!open) return null

  let cursor = -1
  return (
    <div className="search-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="全局搜索">
        <div className="search-palette__input-row">
          <span className="search-palette__icon">◌</span>
          <input
            ref={inputRef}
            className="search-palette__input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜索卦、经传、名词、筮例、史事、人物…"
            aria-label="搜索"
          />
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>
        {flat.length > 0 && (
          <ul className="search-results" role="listbox">
            {groups.map(g => (
              <Fragment key={g.key}>
                <li className="search-results__group-label">{g.label}</li>
                {g.items.map(r => {
                  cursor++
                  const idx = cursor
                  return (
                    <li
                      key={r.id}
                      className={`search-result ${selected === idx ? 'search-result--selected' : ''}`}
                      role="option"
                      aria-selected={selected === idx}
                      onClick={() => go(r)}
                    >
                      <span className="search-result__label">{highlight(r.label, deferredQuery)}</span>
                      <span className="search-result__sub">{r.sub}</span>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        )}
        {query && flat.length === 0 && (
          <p className="search-palette__empty">无匹配结果</p>
        )}
      </div>
    </div>
  )
}
