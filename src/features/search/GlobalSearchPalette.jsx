import { useState, useEffect, useRef, useDeferredValue, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureGlobalSearchIndexed, searchGlobal } from './globalSearch.js'

const CHIPS = ['无为', '格物', '兼爱', '乾卦', '伤寒论', '金刚经', '韩非子', '百家争鸣']

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

export default function GlobalSearchPalette({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [indexed, setIndexed] = useState(false)
  const [searching, setSearching] = useState(false)
  const [groups, setGroups] = useState([])
  const [, setTick] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const deferredQuery = useDeferredValue(query)
  const flat = groups.flatMap((g) => g.items)
  const indexing = open && !indexed

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(0)
    setIndexed(false)
    setSearching(false)
    setGroups([])
    ensureGlobalSearchIndexed().then(() => { setIndexed(true); setTick((t) => t + 1) })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

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
    if (!open || !indexed) return
    const q = deferredQuery.trim()
    setSelected(0)
    if (!q) {
      setGroups([])
      setSearching(false)
      return
    }
    let alive = true
    setGroups([])
    setSearching(true)
    searchGlobal(q).then((nextGroups) => {
      if (!alive) return
      setGroups(nextGroups)
      setSearching(false)
    })
    return () => { alive = false }
  }, [open, indexed, deferredQuery])

  function go(r) {
    navigate(r.to)
    onClose()
  }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (flat.length) setSelected((s) => Math.min(s + 1, flat.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setSelected((s) => Math.max(s - 1, 0))
    }
    if (e.key === 'Enter' && flat[selected]) go(flat[selected])
  }

  if (!open) return null

  let cursor = -1
  return (
    <div className="search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="全站搜索">
        <div className="search-palette__input-row">
          <span className="search-palette__icon">⌕</span>
          <input
            ref={inputRef}
            className="search-palette__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜索页面、经典、正文、白话、注疏、专题…"
            aria-label="全站搜索"
          />
          <button className="search-palette__close" onClick={onClose} aria-label="关闭">Esc</button>
        </div>
        {flat.length > 0 && (
          <ul className="search-results" role="listbox">
            {groups.map((g) => (
              <Fragment key={g.key}>
                <li className="search-results__group-label">{g.label}</li>
                {g.items.map((r) => {
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
                      <span className="search-result__sub">
                        {r.sub}
                        {r.snippet && <span className="search-result__snippet"> · {highlight(r.snippet, deferredQuery)}</span>}
                      </span>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        )}
        {indexing && <p className="search-palette__empty">正在载入全站索引…</p>}
        {!indexing && searching && <p className="search-palette__empty">正在检索…</p>}
        {!indexing && !searching && query && flat.length === 0 && <p className="search-palette__empty">无匹配结果</p>}
        {!query.trim() && (
          <div className="search-empty-hint">
            <p className="search-empty-hint__scope">搜全站页面、经典正文、译文、白话、注疏、延伸与专题。输入 2 字以上可搜正文全文。</p>
            <div className="search-chips">
              {CHIPS.map((b) => (
                <button key={b} type="button" className="search-chip" onClick={() => { setQuery(b); inputRef.current?.focus() }}>{b}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
