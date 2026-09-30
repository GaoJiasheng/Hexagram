import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { getReadingProgress } from '../yijing/storage.js'
import { getMeta, loadText } from './corpus.js'
import { chapterAnchors, chapterParts } from './chapterParts.js'
import { sizeTier } from './bookSizes.js'
import SchoolEntry from './SchoolEntry.jsx'
import DaoduEntry from './DaoduEntry.jsx'

// 「一组就是一本书」的首页(owner 2026-10-01:唐诗只有《唐诗三百首》,不会再扩,
// 首页放一张书架卡再点进去看目录是多此一举——直接在首页把这本书的目录展开)。
// 唐诗 / 宋词 / 元曲三组用它:标题与副题照旧,一家之来路照旧,下面不再是书架,
// 而是这本书的题解 + 书级导读 + 续读 + **全部篇目**:
//   · 一章多首的书(唐诗七类,texts.json poemTitles):每类一段,类名下逐首列出诗题,
//     点诗题直落那一首(连同它所在的屏 ?p= 一起带上,与阅读页侧栏同一套锚点);
//   · 一首一章的书(宋词三百首、元曲选):章即是首,平铺成多列列表。
// 组里若还有别的书(宋词补遗),在末尾一行「另收」列出,不与主书争版面。
// volumes(古文观止):一篇一章但原书分十二卷,目录按卷分段列篇 [{no,title,from,to}](章号区间,闭区间);
// 章对象若带 source(出处/作者,管线 chapterMeta 并入),篇题旁以小字显出。
export default function SingleBookHome({ corpus, slug, title, subtitle, basePath, brand, disclaimer, texts, volumes }) {
  usePageTitle(null, brand)
  const meta = getMeta(corpus, slug)
  const [chapters, setChapters] = useState(null)
  useEffect(() => {
    let alive = true
    loadText(corpus, slug).then((b) => { if (alive) setChapters(b?.chapters || null) })
    return () => { alive = false }
  }, [corpus, slug])

  const resumeCh = (meta?.sections > 1 && getReadingProgress()[slug]) || 0
  const tier = sizeTier(slug)
  const others = (texts || []).filter((t) => t.slug !== slug)
  const poemBook = !!meta?.poemTitles
  const renderFlat = (c) => (
    <li key={c.no}>
      <Link to={`${basePath}/${slug}/${c.no}`} className={c.no === resumeCh ? 'book-toc__link--current' : ''}>
        <span className="book-toc__no">{c.no}</span>{c.title || `第 ${c.no} ${meta.sectionUnit}`}
        {c.source && <span className="book-toc__src">{c.source}</span>}
      </Link>
    </li>
  )
  const totalPoems = chapters
    ? (poemBook ? chapters.reduce((n, c) => n + (chapterAnchors(c, meta)?.length || 0), 0) : chapters.length)
    : null

  return (
    <div className="dao-home book-home">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {disclaimer && <div className="shelf-disclaimer" role="note">⚠ {disclaimer}</div>}

      <SchoolEntry corpus={corpus} />

      {meta && (
        <section className="book-home__book">
          <div className="book-home__head">
            <h2 className="book-home__title">
              <Link to={`${basePath}/${slug}`}>{meta.title}</Link>
            </h2>
            <p className="dao-text-meta">
              {[meta.era, meta.attribution, `${meta.sections} ${meta.sectionUnit}`, totalPoems && poemBook ? `${totalPoems} 首` : null]
                .filter(Boolean).join(' · ')}
              {tier && <span className={`book-tier book-tier--${tier.cls}`}>{tier.label}</span>}
            </p>
            <p className="dao-text-brief">{meta.brief}</p>
            {meta.caveat && <p className="caveat-badge">⚠ {meta.caveat}——详见撰人小传，本站作文献存疑研读。</p>}
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
        </section>
      )}

      <section className="dao-text-sections book-home__toc">
        <h2 className="dao-text-sections__title">
          目录{chapters ? (poemBook ? ` · ${chapters.length} ${meta.sectionUnit} ${totalPoems} 首` : ` · ${chapters.length} ${meta.sectionUnit || '首'}`) : ''}
        </h2>
        {!chapters ? (
          <div className="dao-section-grid" aria-label="目录载入中" aria-busy="true">
            {Array.from({ length: Math.min(meta?.sections || 8, 24) }, (_, i) => (
              <span key={i} className="dao-section-cell dao-section-cell--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : poemBook ? (
          chapters.map((c) => {
            const anchors = chapterAnchors(c, meta) || []
            const parts = chapterParts(c, meta)
            return (
              <div key={c.no} className="book-toc__group">
                <Link to={`${basePath}/${slug}/${c.no}`} className={`book-toc__head ${c.no === resumeCh ? 'book-toc__head--current' : ''}`}>
                  <span className="book-toc__no">{c.no}</span>
                  <span className="book-toc__name">{c.title}</span>
                  <span className="book-toc__count">{anchors.length} 首</span>
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

      {others.length > 0 && (
        <p className="book-home__others">
          另收：
          {others.map((t, i) => (
            <span key={t.slug}>
              {i > 0 && ' · '}
              <Link to={`${basePath}/${t.slug}`}>{t.title}</Link>
              {t.sections ? `（${t.sections} ${t.sectionUnit}）` : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
