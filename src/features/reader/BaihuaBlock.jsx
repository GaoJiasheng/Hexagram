import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getBaihua } from './baihua.js'
import { SITE_MAP } from '../../sites/registry.js'

// 单个内容块渲染器（design-v22 §3 的块结构）
function Block({ block }) {
  switch (block.type) {
    case 'lead':
      return <p className="baihua-lead">{block.text}</p>
    case 'h2':
      return <h2 className="baihua-h2">{block.text}</h2>
    case 'p':
      return <p className="baihua-p">{block.text}</p>
    case 'quote':
      return (
        <div className="baihua-quote">
          <p className="baihua-quote__orig">{block.original}</p>
          {block.translation && <p className="baihua-quote__trans">{block.translation}</p>}
        </div>
      )
    case 'figure':
      return (
        <figure className="baihua-figure">
          {block.ftype && <span className="baihua-figure__tag">{block.ftype}</span>}
          {/* 内联 SVG：站内生成、用 CSS 变量着色，随明暗/组色自适应（§3.7） */}
          <div className="baihua-figure__svg" dangerouslySetInnerHTML={{ __html: block.svg }} />
          {block.caption && <figcaption className="baihua-figure__cap">{block.caption}</figcaption>}
        </figure>
      )
    case 'refs':
      return (
        <div className="baihua-refs">
          <p className="baihua-refs__title">原文出处与参考</p>
          <ul>{block.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )
    default:
      return null
  }
}

// 白话模块：章内一个低调折叠入口条 → 点开为侧抽屉（桌面）/ 全屏浮层（移动）。
// 打开后持久（仅手动关），可「整页」放大（design-v22 §2）。
export default function BaihuaBlock({ corpus, slug, chapter, bookTitle, sectionUnit = '章' }) {
  const data = getBaihua(corpus, slug, chapter)
  const [open, setOpen] = useState(false)
  const [maxi, setMaxi] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  if (!data) return null

  const seal = SITE_MAP[corpus]?.brand || ''
  const entryLabel = `白话${bookTitle}`
  const chapterName = `第${chapter}${sectionUnit}`

  return (
    <>
      <button className="baihua-entry" onClick={() => setOpen(true)} aria-expanded={open}>
        {seal && <span className="baihua-entry__seal">{seal}</span>}
        <span className="baihua-entry__text">
          <span className="baihua-entry__title">{entryLabel} · {chapterName}</span>
          <span className="baihua-entry__hint">大白话 + 配图，把这一章讲给完全没读过的人 · 点开</span>
        </span>
        <span className="baihua-entry__chev" aria-hidden="true">▸</span>
      </button>

      {open && createPortal(
        <div
          className={`baihua-overlay ${maxi ? 'baihua-overlay--max' : ''}`}
          data-site={corpus}
          role="dialog"
          aria-modal="true"
          aria-label={`${entryLabel} · ${chapterName}`}
        >
          <div className="baihua-overlay__backdrop" onClick={() => setOpen(false)} />
          <aside className="baihua-drawer">
            <header className="baihua-drawer__head">
              <div className="baihua-drawer__titles">
                {seal && <span className="baihua-drawer__seal">{seal}</span>}
                <span className="baihua-drawer__titletext">
                  <span className="baihua-drawer__brand">{entryLabel}</span>
                  <span className="baihua-drawer__chap">{chapterName}{data.subtitle ? ` · ${data.subtitle}` : ''}</span>
                </span>
              </div>
              <div className="baihua-drawer__actions">
                <button onClick={() => setMaxi((m) => !m)} aria-label="整页 / 抽屉" title={maxi ? '收回抽屉' : '展开整页研读'}>
                  {maxi ? '⤡' : '⤢'}
                </button>
                <button onClick={() => setOpen(false)} aria-label="关闭" title="关闭（Esc）">✕</button>
              </div>
            </header>
            <div className="baihua-drawer__body">
              {data.centralIdea && (
                <div className="baihua-idea">
                  <span className="baihua-idea__tag">中心思想</span>
                  <span>{data.centralIdea}</span>
                </div>
              )}
              {data.blocks.map((b, i) => <Block key={i} block={b} />)}
              <p className="baihua-drawer__foot">— 白话研读，重在体会思想；引文出处见上。—</p>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
