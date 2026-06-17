import { useState, useEffect, useRef, useDeferredValue, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchCorpus, ensureCorpusIndexed, searchAllCorpora, ensureAllIndexed } from './corpusSearch.js'
import { corpusTexts } from './corpus.js'

// 全站模式空状态:跨派核心概念 chips(点击即全站检索),呼应「织成网」的用法
const ALL_SCOPE_CHIPS = ['无为', '格物', '致良知', '兼爱', '中道', '性', '仁', '理']

// 读经类站的全站检索面板(C1)——复用易经 SearchPalette 的样式与交互,数据源换成 corpusSearch。
// corpus 决定隔离:只搜当前组自己的书。
function highlight(text, query) {
  if (!query || typeof text !== 'string') return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--cinnabar-bg)', color: 'var(--cinnabar)' }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// searchFn/indexFn 可注入:默认走 corpus,dao 站注入自己的 searchDao/ensureDaoIndexed(批D)。
// books:空状态展示的经名 chips(dao 站由 DaoSearchPalette 注入;corpus 站默认取本站书目)。
export default function CorpusSearchPalette({ corpus, open, onClose, searchFn, indexFn, books }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [indexed, setIndexed] = useState(false)
  const [, setIndexTick] = useState(0)
  const [scope, setScope] = useState('local')   // 'local' 本站 | 'all' 全站(#140/B1)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const allMode = scope === 'all'
  const doSearch = allMode ? searchAllCorpora : (searchFn || ((q) => searchCorpus(corpus, q)))
  const doIndex = allMode ? ensureAllIndexed : (indexFn || (() => ensureCorpusIndexed(corpus)))
  const localChips = books || corpusTexts(corpus).filter((t) => t.status !== 'pending').slice(0, 6).map((t) => t.title)
  const bookChips = allMode ? ALL_SCOPE_CHIPS : localChips

  const deferredQuery = useDeferredValue(query)   // 大 corpus:延迟查询,免每键同步全表扫卡顿
  const groups = doSearch(deferredQuery)
  const flat = groups.flatMap((g) => g.items)
  const indexing = query.trim().length >= 2 && !indexed

  // 开面板:清空、复位为本站、聚焦
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setScope('local')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, corpus])

  // 建索引:开面板或切换范围时(全站首切会动态拉道藏数据层,故先置 indexing 态)
  useEffect(() => {
    if (!open) return
    setIndexed(false)
    doIndex().then(() => { setIndexed(true); setIndexTick((t) => t + 1) })
  }, [open, corpus, scope])

  // 打开时锁背景滚动 + 关闭还原焦点(避免穿透滚动与焦点丢失)
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

  useEffect(() => { setSelected(0) }, [deferredQuery])

  function go(r) { navigate(r.to); onClose() }

  function handleKey(e) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && flat[selected]) go(flat[selected])
  }

  if (!open) return null

  let cursor = -1
  return (
    <div className="search-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="search-palette" role="dialog" aria-modal="true" aria-label="全站搜索">
        <div className="search-palette__input-row">
          <span className="search-palette__icon">◌</span>
          <input
            ref={inputRef}
            className="search-palette__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜索经名、正文、译文、注疏、延伸…"
            aria-label="搜索"
          />
          <div className="search-scope" role="tablist" aria-label="检索范围">
            <button type="button" role="tab" aria-selected={!allMode}
              className={`search-scope__btn ${!allMode ? 'is-active' : ''}`}
              onClick={() => setScope('local')}>本站</button>
            <button type="button" role="tab" aria-selected={allMode}
              className={`search-scope__btn ${allMode ? 'is-active' : ''}`}
              onClick={() => setScope('all')}>全站</button>
          </div>
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
                      <span className="search-result__sub">{r.sub}</span>
                    </li>
                  )
                })}
              </Fragment>
            ))}
          </ul>
        )}
        {indexing && flat.length === 0 && <p className="search-palette__empty">{allMode ? '正在建立全站索引…' : '正在建立全文索引…'}</p>}
        {!indexing && query && flat.length === 0 && <p className="search-palette__empty">无匹配结果</p>}
        {!query.trim() && bookChips.length > 0 && (
          <div className="search-empty-hint">
            <p className="search-empty-hint__scope">
              {allMode
                ? '全站检索九站经藏,结果按组分栏 —— 搜跨派概念,一面看遍诸家。'
                : '搜正文 / 译文 / 注疏 / 延伸 —— 输入 2 字以上检索全文。'}
            </p>
            <div className="search-chips">
              {bookChips.map((b) => (
                <button key={b} type="button" className="search-chip" onClick={() => { setQuery(b); inputRef.current?.focus() }}>{b}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
