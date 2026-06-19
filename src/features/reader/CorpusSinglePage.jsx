import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'
import BaihuaBlock from './BaihuaBlock.jsx'

// 通用短经单页阅读器(v16 §1)——题解 + 全文一页铺开 + 章末延伸 + 左侧锚点。
export default function CorpusSinglePage({ corpus, slug, text }) {
  const site = SITE_MAP[corpus]
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const meta = getMeta(corpus, slug)
  usePageTitle(text?.title, site?.brand)

  useEffect(() => {
    setLoading(true)
    // 单页书整篇一页铺开,无「读到第几章」概念,不写续读进度(免书架显示误导的「读至末章」)
    loadText(corpus, slug)
      .then((data) => { setBook(data); setLoading(false) })
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

  // 长品/长分(>3 段,如坛经机缘品)段号编号,便于定位
  const paraLabel = (no, i) => {
    const c = book.chapters.find((x) => x.no === no)
    return c && c.paragraphs.length > 3 ? String(i + 1) : null
  }

  return (
    <ClassicReader
      mode="single"
      chapters={book.chapters}
      tocBack={<Link to={site.home} className="read-toc__back">← {site.portalTitle}</Link>}
      chapterLabel={label}
      anchorId={(no) => `${corpus}-ch-${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      renderBaihua={(no) => <BaihuaBlock corpus={corpus} slug={slug} chapter={no} bookTitle={meta.title} sectionUnit={meta.sectionUnit || '章'} />}
      paraLabel={paraLabel}
      markCtx={{ corpus, slug }}
      header={header}
    />
  )
}
