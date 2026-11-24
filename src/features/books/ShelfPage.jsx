// 书房 · 书包(/books/shelf):管理员把各处做好的 .deskbook 传进对象存储,书桌 App 的「添书 → 书房」里就能加。
//
// 和观书其余页一样只给管理员:页面与数据都由边缘(functions/_middleware.js 的 /books 闸)与接口
//(server/desk-shelf.js,非管理员一律 404 / 空列表)把住;这里的 BooksGate 只是体面的提示。
// 每个书包上传前在浏览器里**完整校验**(scripts/desk/deskbook-core.mjs,措辞原样显示),只有过了的才能传。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import HomeSeal from './HomeSeal.jsx'
import BooksGate from './BooksGate.jsx'
import { useBookAccess } from './useBooks.js'
import { KIND_LABEL, SHELF_ACCEPT, SINGLE_MAX, checkFile, deleteItem, fetchShelf, formatBytes, hasResume, patchItem, uploadPackage } from './shelfClient.js'
import './books.css'
import './shelf.css'

const UNFILED = '未分栏'
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '')
let seq = 0

// ── 待传队列里的一项 ──
function QueueItem({ q, onUpload, onRemove }) {
  const b = q.check?.book
  const busy = q.status === 'checking' || q.status === 'uploading'
  return (
    <li className={`shelf-q shelf-q--${q.status}`}>
      <div className="shelf-q__head">
        <div className="shelf-q__name">
          <b>{b?.title || q.file.name}</b>
          {b && <span className="shelf-q__meta">{KIND_LABEL[b.kind] || b.kind || '?'} · {Array.isArray(b.chapters) ? b.chapters.length : 0} {b.unit || '章'} · 修订 {b.revision ?? '?'} · {formatBytes(q.file.size)}</span>}
          {!b && <span className="shelf-q__meta">{formatBytes(q.file.size)}</span>}
        </div>
        <div className="shelf-q__acts">
          {q.status === 'ready' && <button type="button" className="shelf-btn shelf-btn--primary" onClick={() => onUpload(q, false)}>{q.resumable ? '接着上传' : '上传'}</button>}
          {q.status === 'conflict' && <button type="button" className="shelf-btn shelf-btn--warn" onClick={() => onUpload(q, true)}>覆盖上传</button>}
          {q.status === 'failed' && <button type="button" className="shelf-btn" onClick={() => onUpload(q, q.replace)}>重试</button>}
          {!busy && <button type="button" className="shelf-btn shelf-btn--quiet" onClick={() => onRemove(q)} aria-label={`移出 ${q.file.name}`}>移出</button>}
        </div>
      </div>
      <div className="shelf-q__file">{q.file.name}{b?.id ? ` · ${b.id}` : ''}</div>
      {q.status === 'checking' && <p className="shelf-q__note">校验中⋯</p>}
      {q.status === 'uploading' && (
        <div className="shelf-q__prog" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(q.progress * 100)}>
          <span style={{ width: `${(q.progress * 100).toFixed(1)}%` }} />
          <em>{q.file.size > SINGLE_MAX ? '分片上传 ' : ''}{Math.round(q.progress * 100)}%</em>
        </div>
      )}
      {q.status === 'done' && <p className="shelf-q__note shelf-q__note--ok">已上传，进了书房「{q.item?.category || UNFILED}」。</p>}
      {(q.status === 'failed' || q.status === 'conflict') && <p className="shelf-q__note shelf-q__note--err">{q.error}</p>}
      {q.check?.errors?.length > 0 && (
        <details className="shelf-q__issues" open>
          <summary>校验不过：{q.check.errors.length} 处错误（不能上传）</summary>
          <ul>{q.check.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      )}
      {q.check?.warnings?.length > 0 && (
        <details className="shelf-q__issues shelf-q__issues--warn">
          <summary>{q.check.warnings.length} 条提示</summary>
          <ul>{q.check.warnings.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </details>
      )}
    </li>
  )
}

// ── 书房里的一本 ──
function ShelfRow({ item, categories, onPatch, onDelete }) {
  const [cat, setCat] = useState(item.category || '')
  const [err, setErr] = useState('')
  useEffect(() => setCat(item.category || ''), [item.category])
  const saveCat = async () => {
    const v = cat.trim()
    if (v === (item.category || '')) return
    try { setErr(''); await onPatch(item, { category: v }) } catch (e) { setErr(e.message); setCat(item.category || '') }
  }
  const listId = `shelf-cats-${item.id}`
  return (
    <li className={`shelf-row${item.hidden ? ' shelf-row--hidden' : ''}`}>
      <div className="shelf-row__cover" style={{ '--row-accent': item.theme?.accent || 'var(--line)' }}>
        {item.cover ? <img src={item.cover} alt="" loading="lazy" /> : <span aria-hidden="true">{(item.title || '?').slice(0, 1)}</span>}
      </div>
      <div className="shelf-row__body">
        <div className="shelf-row__title">{item.title}{item.subtitle && <span className="shelf-row__sub"> · {item.subtitle}</span>}</div>
        <div className="shelf-row__meta">
          {KIND_LABEL[item.kind] || item.kind} · {item.chapters} {item.unit || '章'} · {formatBytes(item.bytes)} · 修订 {item.revision} · {fmtDate(item.updatedAt)}
          {item.hidden && <span className="shelf-row__flag">已隐藏</span>}
        </div>
        <div className="shelf-row__ctl">
          <label className="shelf-row__cat">
            <span>分栏</span>
            <input
              list={listId}
              value={cat}
              placeholder={UNFILED}
              maxLength={24}
              onChange={(e) => setCat(e.target.value.replace(/\s/g, ''))}
              onBlur={saveCat}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              aria-label={`《${item.title}》的分栏`}
            />
            <datalist id={listId}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <span className="shelf-row__toggle">
            <span>隐藏</span>
            <button
              type="button"
              role="switch"
              aria-checked={item.hidden}
              aria-label={`在书桌里隐藏《${item.title}》`}
              className={`switch switch--sm ${item.hidden ? 'switch--on' : ''}`}
              onClick={() => onPatch(item, { hidden: !item.hidden }).catch((e) => setErr(e.message))}
            ><span className="switch__knob" /></button>
          </span>
          <a className="shelf-btn" href={item.package} download>下载</a>
          <button type="button" className="shelf-btn shelf-btn--quiet shelf-btn--danger" onClick={() => onDelete(item).catch((e) => setErr(e.message))}>删除</button>
        </div>
        {err && <p className="shelf-q__note shelf-q__note--err">{err}</p>}
      </div>
    </li>
  )
}

export default function ShelfPage() {
  usePageTitle(null, '观象 · 古籍研读站')
  const access = useBookAccess()
  const [items, setItems] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [queue, setQueue] = useState([])
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  const reload = useCallback(() => {
    fetchShelf().then((x) => { setItems(x); setLoadErr('') }).catch((e) => setLoadErr(e.message))
  }, [])
  useEffect(() => { if (access === 'allowed') reload() }, [access, reload])

  const update = (id, patch) => setQueue((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))

  const addFiles = (list) => {
    const files = [...list].filter((f) => f && f.size > 0)
    for (const file of files) {
      const id = ++seq
      setQueue((qs) => [...qs, { id, file, status: 'checking', progress: 0 }])
      checkFile(file)
        .then((check) => update(id, { check, status: check.ok ? 'ready' : 'invalid', resumable: check.ok && file.size > SINGLE_MAX && hasResume(check.sha256) }))
        .catch((e) => update(id, { status: 'invalid', check: { errors: [e?.message || String(e)], warnings: [] } }))
    }
  }

  const onUpload = async (q, replace) => {
    update(q.id, { status: 'uploading', progress: 0, error: '', replace })
    try {
      const item = await uploadPackage(q.file, q.check, { replace, onProgress: (n, total) => update(q.id, { progress: total ? n / total : 0 }) })
      update(q.id, { status: 'done', item, progress: 1 })
      reload()
    } catch (e) {
      update(q.id, { status: e.status === 409 ? 'conflict' : 'failed', error: e.message })
    }
  }

  const onPatch = async (item, patch) => {
    const next = await patchItem(item.id, patch)
    setItems((xs) => xs.map((x) => (x.id === next.id ? next : x)))
  }
  const onDelete = async (item) => {
    if (!window.confirm(`从书房删除《${item.title}》（修订 ${item.revision}）？\n书包与封面会一起从存储里删掉，不能恢复；已加到书桌上的不受影响。`)) return
    await deleteItem(item.id)
    setItems((xs) => xs.filter((x) => x.id !== item.id))
  }

  const categories = useMemo(() => [...new Set((items || []).map((x) => x.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh')), [items])
  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase()
    const hit = (x) => !f || [x.title, x.subtitle, x.id, x.category, ...(x.tags || []), ...(x.authors || [])].some((s) => s && String(s).toLowerCase().includes(f))
    const m = new Map()
    for (const x of (items || []).filter(hit)) {
      const k = x.category || UNFILED
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(x)
    }
    return [...m.entries()].sort(([a], [b]) => (a === UNFILED) - (b === UNFILED) || a.localeCompare(b, 'zh'))
  }, [items, filter])

  // 放在所有 hook 之后(提前 return 会让 hook 数量对不上)
  if (access !== 'allowed') return <BooksGate state={access} />
  if (items === null && loadErr) return <BooksGate state="denied" />

  const toggle = (k) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const total = items?.length || 0

  return (
    <div className="books-page shelf-page" data-site="portal">
      <div className="books-topbar">
        <Link to="/books" className="book-home__back">← 观书</Link>
        <HomeSeal />
      </div>
      <div className="books-head">
        <h1 className="books-title">书房 · 书包</h1>
        <p className="books-sub">把做好的书包放进书房，书桌上随时能加</p>
      </div>

      <section className="shelf-explain">
        <p>
          <b>书包</b>是「观象 · 书桌」读的一本书：一个 <code>.deskbook</code> 文件（zip），里面是书目清单、各章文字与图片。
          怎么做一本书、格式与校验工具，见公开的<a href="/desk/standard/">书包格式标准</a>。
        </p>
        <p>
          这里的书<b>只有管理员账号看得到</b>：网站上就是这一页；书桌 App 里是「添书 → 书房」，按分栏列出，隐藏的不列。
          放进来的书包先在本机浏览器里完整校验，过了才能上传；超过 {SINGLE_MAX / 1048576} MB 的分片上传，断了可以接着传。
        </p>
      </section>

      <section
        className={`shelf-drop${drag ? ' shelf-drop--on' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
      >
        <p className="shelf-drop__line">把 <code>.deskbook</code> 拖到这里，可以一次放几本</p>
        <button type="button" className="shelf-btn shelf-btn--primary" onClick={() => inputRef.current?.click()}>选择书包</button>
        <input ref={inputRef} type="file" accept={SHELF_ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </section>

      {queue.length > 0 && (
        <section className="shelf-section">
          <div className="shelf-section__bar">
            <h2 className="shelf-h">待传</h2>
            {queue.some((q) => q.status === 'done' || q.status === 'invalid') && (
              <button type="button" className="shelf-btn shelf-btn--quiet" onClick={() => setQueue((qs) => qs.filter((q) => q.status !== 'done' && q.status !== 'invalid'))}>清掉已完成</button>
            )}
          </div>
          <ul className="shelf-queue">
            {queue.map((q) => <QueueItem key={q.id} q={q} onUpload={onUpload} onRemove={(x) => setQueue((qs) => qs.filter((y) => y.id !== x.id))} />)}
          </ul>
        </section>
      )}

      <section className="shelf-section">
        <div className="shelf-section__bar">
          <h2 className="shelf-h">书房里的书 <span className="shelf-count">{total}</span></h2>
          <input className="shelf-search" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="找书名、分栏、标签" aria-label="筛选书房里的书" />
        </div>
        {loadErr && <p className="shelf-q__note shelf-q__note--err">{loadErr}</p>}
        {items === null && !loadErr && <p className="route-loading">⋯</p>}
        {items && total === 0 && <p className="books-empty">书房还是空的。把书包拖到上面就行。</p>}
        {items && total > 0 && groups.length === 0 && <p className="books-empty">没有对得上的书。</p>}
        {groups.map(([cat, list]) => {
          const open = !collapsed.has(cat) || !!filter.trim()
          return (
            <div key={cat} className="shelf-group">
              <button type="button" className="shelf-group__head" aria-expanded={open} onClick={() => toggle(cat)}>
                <span className="shelf-group__caret" aria-hidden="true">{open ? '▾' : '▸'}</span>
                {cat} <span className="shelf-count">{list.length}</span>
              </button>
              {open && (
                <ul className="shelf-list">
                  {list.map((item) => <ShelfRow key={item.id} item={item} categories={categories} onPatch={onPatch} onDelete={onDelete} />)}
                </ul>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
