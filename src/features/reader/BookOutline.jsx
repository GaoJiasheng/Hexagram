import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getReadingProgress } from '../yijing/storage.js'
import { getMeta, loadText } from './corpus.js'
import { chapterAnchors, chapterParts } from './chapterParts.js'
import { sizeTier } from './bookSizes.js'
import DaoduEntry from './DaoduEntry.jsx'

// 一本书的「展开版」:题解 + 书级导读 + 续读 + **全部篇目**,直接摆在首页上。
// 两处共用:SingleBookHome(一组一书:唐诗 / 宋词 / 元曲 / 古文)与 ScriptureShelf 的展开模式
// (owner 2026-10-02:书少的组——墨家一本、心学两本、纵横两本——首页放一两张书架卡再点进去看目录
// 是多此一举,在大类这里就把每本书的目录展开)。目录按书的机制分支:
//   · poemTitles 书(唐诗七类):每类一段,类名下逐首列诗题,点诗题直落那一首(带 ?p= 屏号 + 锚)
//   · pieces 书(传习录三卷):每卷一段,卷名下逐条列条目题,同上(条头锚 piece-<章>-<段>)
//   · volumes(古文观止十二卷):按卷分段列篇,章对象带 source 时篇题旁小字显出处
//   · 其余:章即一篇,平铺多列
//   · singlePage 短经(大学问):没有目录可列,只给一条「读全文」
// beforeToc:插在题解之后、目录之前的自定义块(古文组用它把「课本古文补编」按学段列出)
export default function BookOutline({ corpus, slug, basePath, volumes, beforeToc = null }) {
  const meta = getMeta(corpus, slug)
  const [chapters, setChapters] = useState(null)
  useEffect(() => {
    let alive = true
    loadText(corpus, slug).then((b) => { if (alive) setChapters(b?.chapters || null) })
    return () => { alive = false }
  }, [corpus, slug])

  if (!meta) return null

  const resumeCh = (meta.sections > 1 && getReadingProgress()[slug]) || 0
  const tier = sizeTier(slug)
  const poemBook = !!meta.poemTitles
  const grouped = poemBook || !!meta.pieces          // 章内有自然边界的书:章名下逐首 / 逐条列
  const anchorUnit = poemBook ? '首' : '条'
  const single = !!meta.singlePage
  const renderFlat = (c) => (
    <li key={c.no}>
      <Link to={`${basePath}/${slug}/${c.no}`} className={c.no === resumeCh ? 'book-toc__link--current' : ''}>
        <span className="book-toc__no">{c.no}</span>{c.title || `第 ${c.no} ${meta.sectionUnit}`}
        {c.source && <span className="book-toc__src">{c.source}</span>}
      </Link>
    </li>
  )
  const totalAnchors = chapters
    ? (grouped ? chapters.reduce((n, c) => n + (chapterAnchors(c, meta)?.length || 0), 0) : chapters.length)
    : null

  return (
    <>
      <section className="book-home__book">
        <div className="book-home__head">
          <h2 className="book-home__title">
            <Link to={`${basePath}/${slug}`}>{meta.title}</Link>
          </h2>
          <p className="dao-text-meta">
            {[meta.era, meta.attribution, `${meta.sections} ${meta.sectionUnit}`, totalAnchors && grouped ? `${totalAnchors} ${anchorUnit}` : null]
              .filter(Boolean).join(' · ')}
            {tier && <span className={`book-tier book-tier--${tier.cls}`}>{tier.label}</span>}
          </p>
          <p className="dao-text-brief">{meta.brief}</p>
          {meta.dubious && <p className="dubious-badge">⚠ 托名·真伪存疑：学界多判为现代伪作。本站作文献批判材料研读，非处世权术教程。</p>}
          {meta.caveat && !meta.dubious && <p className="caveat-badge">⚠ {meta.caveat}——详见撰人小传，本站作文献存疑研读。</p>}
        </div>
        <div className="dao-text-aside">
          {meta.authorNote && <p className="dao-text-authornote">{meta.authorNote}</p>}
          <DaoduEntry corpus={corpus} slug={slug} bookTitle={meta.title} />
        </div>
        {resumeCh > 0 && (
          <Link to={`${basePath}/${slug}/${resumeCh}`} className="dao-text-resume">
            继续读 · 第 {resumeCh} {meta.sectionUnit} →
          </Link>
        )}
        {single && (
          <Link to={`${basePath}/${slug}`} className="dao-text-resume">
            读全文 · {meta.sections} {meta.sectionUnit} →
          </Link>
        )}
      </section>

      {beforeToc}

      {!single && (
        <section className="dao-text-sections book-home__toc">
          <h2 className="dao-text-sections__title">
            目录{chapters ? (grouped ? ` · ${chapters.length} ${meta.sectionUnit} ${totalAnchors} ${anchorUnit}` : ` · ${chapters.length} ${meta.sectionUnit || '首'}`) : ''}
          </h2>
          {!chapters ? (
            <div className="dao-section-grid" aria-label="目录载入中" aria-busy="true">
              {Array.from({ length: Math.min(meta.sections || 8, 24) }, (_, i) => (
                <span key={i} className="dao-section-cell dao-section-cell--skeleton" aria-hidden="true" />
              ))}
            </div>
          ) : grouped ? (
            chapters.map((c) => {
              const anchors = chapterAnchors(c, meta) || []
              const parts = chapterParts(c, meta)
              return (
                <div key={c.no} className="book-toc__group">
                  <Link to={`${basePath}/${slug}/${c.no}`} className={`book-toc__head ${c.no === resumeCh ? 'book-toc__head--current' : ''}`}>
                    <span className="book-toc__no">{c.no}</span>
                    <span className="book-toc__name">{c.title}</span>
                    <span className="book-toc__count">{anchors.length} {anchorUnit}</span>
                  </Link>
                  <ul className="book-toc__poems">
                    {anchors.map((a) => {
                      const pi = parts ? parts.findIndex((x) => a.from >= x.from && a.from < x.to) : -1
                      const q = pi >= 0 ? `?p=${pi + 1}` : ''
                      return (
                        <li key={a.from}>
                          <Link to={`${basePath}/${slug}/${c.no}${q}#${a.id}`}>{a.label}</Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          ) : volumes?.length ? (
            volumes.map((v) => (
              <div key={v.no} className="book-toc__group">
                <div className="book-toc__head book-toc__head--static">
                  <span className="book-toc__name">{v.title}</span>
                  <span className="book-toc__count">{v.to - v.from + 1} {meta.sectionUnit}</span>
                </div>
                <ul className="book-toc__poems book-toc__poems--flat">
                  {chapters.filter((c) => c.no >= v.from && c.no <= v.to).map((c) => renderFlat(c))}
                </ul>
              </div>
            ))
          ) : (
            <ul className="book-toc__poems book-toc__poems--flat">
              {chapters.map((c) => renderFlat(c))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
