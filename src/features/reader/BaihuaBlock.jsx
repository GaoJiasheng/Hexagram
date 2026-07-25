import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getBaihuaMeta, loadBaihua } from './baihua.js'
import FontScaleControl from './FontScaleControl.jsx'
import { useAutoHideHeader } from './useAutoHideHeader.js'
import { SITE_MAP } from '../../sites/registry.js'

// 内联富文本:把 **加粗** 渲染成 <strong>(React 安全的 split，不用 dangerouslySetInnerHTML)。
// 只认成对的 **…**;落单的 ** 原样保留。无 ** 时直接返回原串（零开销）。
function rich(text) {
  if (typeof text !== 'string' || !text.includes('**')) return text
  const parts = text.split(/(\*\*[^*]+?\*\*)/g)
  return parts.map((p, i) =>
    p.length > 4 && p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p,
  )
}

// 单个内容块渲染器（design-v22 §3 的块结构）
function Block({ block }) {
  switch (block.type) {
    case 'lead':
      return <p className="baihua-lead">{rich(block.text)}</p>
    case 'h2':
      return <h2 className="baihua-h2">{rich(block.text)}</h2>
    case 'p':
      return <p className="baihua-p">{rich(block.text)}</p>
    case 'quote':
      return (
        <div className="baihua-quote">
          <p className="baihua-quote__orig">{block.original}</p>
          {block.translation && <p className="baihua-quote__trans">{rich(block.translation)}</p>}
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
          <ul>{(block.items || []).map((t, i) => <li key={i}>{rich(t)}</li>)}</ul>
        </div>
      )
    default:
      return null
  }
}

// 文章正文（抽屉与整页研读共用）：总纲章 hero 封面 / 普通章中心思想 → 内容块 → 尾注
export function BaihuaArticle({ data }) {
  return (
    <div className="baihua-article">
      {data.hero ? (
        /* 总纲章「封面」(区别于其他章):徽标 + 大字金句 + 中心思想 + 题词 */
        <div className="baihua-hero">
          {data.hero.badge && <span className="baihua-hero__badge">{data.hero.badge}</span>}
          {data.hero.headline && <h1 className="baihua-hero__headline">{data.hero.headline}</h1>}
          <span className="baihua-hero__rule" aria-hidden="true">❖</span>
          {data.centralIdea && <p className="baihua-hero__idea">{rich(data.centralIdea)}</p>}
          {data.hero.tagline && <p className="baihua-hero__tagline">{rich(data.hero.tagline)}</p>}
        </div>
      ) : data.centralIdea && (
        <div className="baihua-idea">
          <span className="baihua-idea__tag">中心思想</span>
          <span>{rich(data.centralIdea)}</span>
        </div>
      )}
      {data.blocks.map((b, i) => <Block key={i} block={b} />)}
      <p className="baihua-drawer__foot">— 白话研读，重在体会思想；引文出处见上。—</p>
    </div>
  )
}

// 白话模块：章末一个低调折叠入口条 → 点开为侧抽屉（桌面）/ 全屏浮层（移动）。
// 打开后持久（仅手动关）；⤢ 切到「整页研读」独立页（design-v22 §2）。
export default function BaihuaBlock({ corpus, slug, chapter, bookTitle, sectionUnit = '章', chapterLabel }) {
  const [meta, setMeta] = useState(undefined)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { hidden, onScroll } = useAutoHideHeader()

  useEffect(() => {
    let alive = true
    setMeta(undefined)
    setData(null)
    getBaihuaMeta(corpus, slug, chapter).then((m) => { if (alive) setMeta(m) })
    return () => { alive = false }
  }, [corpus, slug, chapter])

  useEffect(() => {
    if (!open || data || !meta) return
    let alive = true
    setLoading(true)
    loadBaihua(corpus, slug, chapter).then((article) => {
      if (!alive) return
      setData(article)
      setLoading(false)
    })
    return () => { alive = false }
  }, [open, data, meta, corpus, slug, chapter])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  if (meta === undefined || meta === null) return null

  const seal = SITE_MAP[corpus]?.brand || ''
  const entryLabel = `白话${bookTitle}`
  const chapterName = chapterLabel || `第${chapter}${sectionUnit}`
  // 易经:卦走 /hexagram/:id/baihua、经传走 /classics/:book/:ch/baihua;其余 corpus 走 /<home>/<slug>/baihua/<ch>
  const fullPath = corpus === 'yijing'
    ? (slug === 'hexagrams' ? `/hexagram/${chapter}/baihua` : `/classics/${slug}/${chapter}/baihua`)
    : `${SITE_MAP[corpus]?.home || ''}/${slug}/baihua/${chapter}`
  const goFullPage = () => { setOpen(false); navigate(fullPath) }
  const display = data || meta

  return (
    <>
      <button className={`baihua-entry ${meta.featured ? 'baihua-entry--featured' : ''}`} onClick={() => setOpen(true)} aria-expanded={open}>
        {seal && <span className="baihua-entry__seal">{seal}</span>}
        <span className="baihua-entry__text">
          <span className="baihua-entry__title">
            {entryLabel} · {chapterName}
            {meta.featured && <span className="baihua-entry__flag">总纲</span>}
          </span>
          <span className="baihua-entry__hint">大白话 + 配图，把这一章讲给完全没读过的人 · 点开</span>
        </span>
        <span className="baihua-entry__chev" aria-hidden="true">▸</span>
      </button>

      {open && createPortal(
        <div
          className="baihua-overlay"
          data-site={corpus}
          role="dialog"
          aria-modal="true"
          aria-label={`${entryLabel} · ${chapterName}`}
        >
          <div className="baihua-overlay__backdrop" onClick={() => setOpen(false)} />
          <aside className="baihua-drawer">
            <header className={`baihua-drawer__head${hidden ? ' baihua-drawer__head--hidden' : ''}`}>
              <div className="baihua-drawer__titles">
                {seal && <span className="baihua-drawer__seal">{seal}</span>}
                <span className="baihua-drawer__titletext">
                  <span className="baihua-drawer__brand">{entryLabel}</span>
                  <span className="baihua-drawer__chap">{chapterName}{display.subtitle ? ` · ${display.subtitle}` : ''}</span>
                </span>
              </div>
              <div className="baihua-drawer__actions">
                <button onClick={goFullPage} aria-label="整页研读" title="整页研读（独立页 · 可收藏分享）">⤢</button>
                <button onClick={() => setOpen(false)} aria-label="关闭" title="关闭（Esc）">✕</button>
              </div>
            </header>
            <div className={`baihua-drawer__toolbar${hidden ? ' baihua-drawer__toolbar--hidden' : ''}`}>
              <span className="baihua-drawer__toolbar-label">字号</span>
              <FontScaleControl />
            </div>
            <div className="baihua-drawer__body" onScroll={onScroll}>
              {loading && <p className="text-faint">正在载入白话…</p>}
              {!loading && data && <BaihuaArticle data={data} />}
              {!loading && !data && <p className="text-faint">这一章白话暂时无法载入。</p>}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
