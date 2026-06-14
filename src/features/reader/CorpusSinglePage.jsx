import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress } from '../yijing/storage.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'

// 通用短经单页阅读器(v16 §1)——题解 + 全文一页铺开 + 章末延伸 + 左侧锚点。
export default function CorpusSinglePage({ corpus, slug, text }) {
  const site = SITE_MAP[corpus]
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const meta = getMeta(corpus, slug)
  usePageTitle(text?.title, site?.brand)

  useEffect(() => {
    setLoading(true)
    loadText(corpus, slug)
      .then((data) => { setBook(data); setLoading(false); saveReadingProgress(slug, data.chapters.length) })
      .catch(() => setLoading(false))
  }, [corpus, slug])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典</p>
        <Link to={site.home} className="btn btn--secondary">返回{site.portalTitle}</Link>
      </div>
    )
  }

  const multi = book.chapters.length > 1
  const label = (c) => c.title ?? (multi ? `第${c.no}${meta.sectionUnit}` : '全文')

  const header = (
    <div className="dao-text-header">
      <h1 className="dao-text-title">{text.title}</h1>
      <p className="dao-text-meta">{text.alias} · {text.era} · {text.attribution}</p>
      <p className="dao-text-brief">{text.brief}</p>
      {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
    </div>
  )

  return (
    <ClassicReader
      mode="single"
      chapters={book.chapters}
      tocBack={<Link to={site.home} className="read-toc__back">← {site.portalTitle}</Link>}
      chapterLabel={label}
      anchorId={(no) => `${corpus}-ch-${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      header={header}
    />
  )
}
