import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// 选章面板(App 外壳用,docs/ipad-app-plan.md §4.1 ④):窄于 1024 时阅读页没有目录侧栏,网页端用的是系统下拉框——
// 表单控件的观感;App 外壳里换成从右侧滑出的目录面板。守全站模态浮层的约定(锁 body 滚动 + 监听 Escape),
// 安卓返回键与右滑返回才认得它(见 native/backButton.js 头注)。
export default function ChapterSheet({ chapters, current, label, title, onPick, onClose }) {
  const curRef = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    curRef.current?.scrollIntoView({ block: 'center' })
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return createPortal(
    <div className="chapter-sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="chapter-sheet" role="dialog" aria-modal="true" aria-label="目录">
        <div className="chapter-sheet__head">
          <span className="chapter-sheet__title">{title || '目录'}</span>
          <button type="button" className="chapter-sheet__close" onClick={onClose} aria-label="关闭">关闭</button>
        </div>
        <ol className="chapter-sheet__list">
          {chapters.map((c) => {
            const on = String(c.no) === String(current)
            return (
              <li key={c.no}>
                <button type="button" ref={on ? curRef : undefined}
                  className={`chapter-sheet__item ${on ? 'is-current' : ''}`}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => { onPick(c.no); onClose() }}>
                  <span className="chapter-sheet__no">{c.no}</span>
                  <span className="chapter-sheet__name">{label(c)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>,
    document.body,
  )
}
