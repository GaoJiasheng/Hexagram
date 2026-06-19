import { useParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress } from '../yijing/storage.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { loadText, getMeta, getAnchors } from './corpus.js'
import ClassicReader from './ClassicReader.jsx'
import YanyiBlock from './YanyiBlock.jsx'
import BaihuaBlock from './BaihuaBlock.jsx'

// 通用逐章阅读器(v16 §1)——佛/儒共用,薄包装通用 ClassicReader 的 paged 模式。
export default function CorpusReadPage({ corpus }) {
  const site = SITE_MAP[corpus]
  const navigate = useNavigate()
  const { slug, chapter: chapterParam } = useParams()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = getMeta(corpus, slug)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}${meta.sectionUnit || '章'}` : null, site?.brand)

  // 单页书被章路由深链命中(如 /fo/jingangjing/5):重定向到单页阅读器,保单一阅读形态
  useEffect(() => {
    if (meta?.singlePage) navigate(`${site.home}/${slug}`, { replace: true })
  }, [meta, site, slug, navigate])

  useEffect(() => {
    setLoading(true)
    loadText(corpus, slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [corpus, slug])

  useEffect(() => {
    window.scrollTo(0, 0)
    // 仅当章存在时记进度,避免越界章号(/x/slug/999)污染续读
    if (book && book.chapters.some((c) => c.no === chapter)) {
      saveReadingProgress(slug, chapter)
    }
  }, [slug, chapter, book])

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
  // 段号:论语逐章语录素来编号;其余书的长章(>3 段,如伤寒论/坛经)默认编号,便于定位/引用
  const isLunyu = corpus === 'ru' && slug === 'lunyu'
  const curChapter = book.chapters.find((c) => c.no === chapter)
  const numberParas = isLunyu || (curChapter && curChapter.paragraphs.length > 3)

  return (
    <ClassicReader
      mode="paged"
      chapters={book.chapters}
      chapter={chapter}
      sectionUnit={meta.sectionUnit}
      verse={!!meta.verse}
      bookTitle={meta.title}
      tocBack={<Link to={`${site.home}/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `${site.home}/${slug}/${no}`}
      getAnchors={(no, i) => getAnchors(corpus, slug, no, i)}
      renderYanyi={(no) => <YanyiBlock corpus={corpus} slug={slug} chapter={no} />}
      renderBaihua={(no) => <BaihuaBlock corpus={corpus} slug={slug} chapter={no} bookTitle={meta.title} sectionUnit={meta.sectionUnit || '章'} />}
      paraLabel={numberParas ? (no, i) => String(i + 1) : undefined}
      markCtx={{ corpus, slug }}
    />
  )
}
