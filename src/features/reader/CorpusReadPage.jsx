import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress } from '../yijing/storage.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'

// 通用逐章阅读器(v16 §1)——佛/儒共用,薄包装通用 ClassicReader 的 paged 模式。
export default function CorpusReadPage({ corpus }) {
  const site = SITE_MAP[corpus]
  const { slug, chapter: chapterParam } = useParams()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = getMeta(corpus, slug)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}${meta.sectionUnit || '章'}` : null, site?.brand)

  useEffect(() => {
    setLoading(true)
    loadText(corpus, slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [corpus, slug])

  useEffect(() => {
    if (book) {
      saveReadingProgress(slug, chapter)
      window.scrollTo(0, 0)
    }
  }, [slug, chapter, book])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典: {slug}</p>
        <Link to={site.home} className="btn btn--secondary">返回{site.portalTitle}</Link>
      </div>
    )
  }

  const multi = book.chapters.length > 1
  const label = (c) => c.title ?? (multi ? `第${c.no}${meta.sectionUnit}` : '全文')

  return (
    <ClassicReader
      mode="paged"
      chapters={book.chapters}
      chapter={chapter}
      sectionUnit={meta.sectionUnit}
      tocBack={<Link to={`${site.home}/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `${site.home}/${slug}/${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      paraLabel={corpus === 'ru' && slug === 'lunyu' ? (no, i) => String(i + 1) : undefined}
    />
  )
}
