import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BaihuaArticle } from './BaihuaBlock.jsx'
import FontScaleControl from './FontScaleControl.jsx'
import FontFamilyControl from './FontFamilyControl.jsx'
import { useAutoHideHeader } from './useAutoHideHeader.js'

// 长文图层(白话/观书/辩题白话讲解共用):先弹右侧抽屉,可就这么放着不耽误看正文;
// 点 ⤢ 再进整页 URL(可收藏/分享/刷新保留),Esc 或点遮罩关。
// 原为观书专用(BookArticleDrawer),2026-08-01 提到 reader/ 共享——避免写第三份。
export default function ArticleDrawer({ open, accent, brand, chap, data, seal = '观', site = 'portal', empty = '这篇暂时无法载入。', onFull, onClose }) {
  const { hidden, onScroll, barRef, barStyle } = useAutoHideHeader()

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
    <div className="baihua-overlay" data-site={site} role="dialog" aria-modal="true" aria-label={`${brand} · ${chap}`}>
      <div className="baihua-overlay__backdrop" onClick={onClose} />
      {/* 头部条浮在正文之上(不占文档流),收起时平移出视口——布局不变、正文不跳 */}
      <aside className="baihua-drawer" style={barStyle}>
        <div ref={barRef} className={`baihua-drawer__bar${hidden ? ' baihua-drawer__bar--hidden' : ''}`}>
          <header className="baihua-drawer__head">
            <div className="baihua-drawer__titles">
              <span className="baihua-drawer__seal" style={accent ? { background: accent } : undefined}>{seal}</span>
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
            <span className="baihua-drawer__toolbar-label">字体</span>
            <FontFamilyControl />
            <span className="baihua-drawer__toolbar-label">字号</span>
            <FontScaleControl />
          </div>
        </div>
        <div className="baihua-drawer__body" onScroll={onScroll}>
          {data ? <BaihuaArticle data={data} /> : <p className="text-faint">{empty}</p>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
