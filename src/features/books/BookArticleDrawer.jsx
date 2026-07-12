import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BaihuaArticle } from '../reader/BaihuaBlock.jsx'
import FontScaleControl from '../reader/FontScaleControl.jsx'

// 书文章图层:与白话文章同款抽屉——先弹层预览,点 ⤢ 再进整页 URL(可收藏/分享/刷新保留)。
export default function BookArticleDrawer({ open, accent, brand, chap, data, onFull, onClose }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="baihua-overlay" data-site="portal" role="dialog" aria-modal="true" aria-label={`${brand} · ${chap}`}>
      <div className="baihua-overlay__backdrop" onClick={onClose} />
      <aside className="baihua-drawer">
        <header className="baihua-drawer__head">
          <div className="baihua-drawer__titles">
            <span className="baihua-drawer__seal" style={accent ? { background: accent } : undefined}>观</span>
            <span className="baihua-drawer__titletext">
              <span className="baihua-drawer__brand">{brand}</span>
              <span className="baihua-drawer__chap">{chap}</span>
            </span>
          </div>
          <div className="baihua-drawer__actions">
            <button onClick={onFull} aria-label="整页研读" title="整页研读(独立页 · 可收藏、分享、刷新保留)">⤢</button>
            <button onClick={onClose} aria-label="关闭" title="关闭(Esc)">✕</button>
          </div>
        </header>
        <div className="baihua-drawer__toolbar">
          <span className="baihua-drawer__toolbar-label">字号</span>
          <FontScaleControl />
        </div>
        <div className="baihua-drawer__body">
          {data ? <BaihuaArticle data={data} /> : <p className="text-faint">这篇暂时无法载入。</p>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
