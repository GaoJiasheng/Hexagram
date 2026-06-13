import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress } from '../../yijing/storage.js'
import { loadDaoText, getDaoMeta } from '../data.js'
import { getDaoAnchors } from '../daoAnchored.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import ClassicReader from '../../reader/ClassicReader.jsx'
import YanyiBlock from '../components/YanyiBlock.jsx'
import { Link } from 'react-router-dom'

// 道藏逐章阅读器(v14 §3:薄包装,核心走通用 ClassicReader)
export default function DaoReadPage() {
  const { slug, chapter: chapterParam } = useParams()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = getDaoMeta(slug)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}${meta.sectionUnit || '章'}` : null, '观道')

  useEffect(() => {
    setLoading(true)
    loadDaoText(slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

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
        <Link to="/dao" className="btn btn--secondary">返回道藏</Link>
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
      tocBack={<Link to={`/dao/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `/dao/${slug}/${no}`}
      getAnchors={(no, i) => getDaoAnchors(slug, no, i)}
      renderYanyi={(no) => <YanyiBlock slug={slug} chapter={no} />}
    />
  )
}
