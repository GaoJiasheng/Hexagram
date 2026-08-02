import { useParams, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { saveReadingProgress, getReadPos } from '../../yijing/storage.js'
import { loadDaoText, getDaoMeta } from '../data.js'
import { getDaoAnchors } from '../daoAnchored.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import ClassicReader from '../../reader/ClassicReader.jsx'
import { chapterParts, chapterAnchors } from '../../reader/chapterParts.js'
import YanyiBlock from '../components/YanyiBlock.jsx'
import BaihuaBlock from '../../reader/BaihuaBlock.jsx'
import { Link } from 'react-router-dom'

// 道藏逐章阅读器(v14 §3:薄包装,核心走通用 ClassicReader)
export default function DaoReadPage() {
  // 长章拆页 + 段级续读(owner 2026-07-30)。hook 必须在任何提前 return 之前——
  // 插在 `if (loading) return` 之后会 Rendered more hooks 白屏(踩过)。
  const [sp] = useSearchParams()
  const partParam = Number(sp.get('p')) || 0

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
    window.scrollTo(0, 0)
    // 仅当章存在时记进度,免越界章号污染续读
    if (book && book.chapters.some((c) => c.no === chapter)) {
      saveReadingProgress(slug, chapter)
    }
  }, [slug, chapter, book])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!book || !meta) {
    return (
      <div className="page-content">
        <p className="text-faint">没有这部经典</p>
        <Link to="/dao" className="btn btn--secondary">返回道藏</Link>
      </div>
    )
  }

  const multi = book.chapters.length > 1
  // 无显式 ?p= 时按上次读到的段号自动落屏
  const curChapter = book.chapters.find((c) => c.no === chapter)
  const savedPos = getReadPos()[slug]
  const partsCur = curChapter ? chapterParts(curChapter, meta) : null
  const resumePart = partParam || (() => {
    if (!partsCur || !savedPos || savedPos.ch !== chapter) return 1
    const i = partsCur.findIndex((pt) => savedPos.seg >= pt.from && savedPos.seg < pt.to)
    return i >= 0 ? i + 1 : 1
  })()
  const label = (c) => c.title ?? (multi ? `第${c.no}${meta.sectionUnit}` : '全文')

  return (
    <ClassicReader
      mode="paged"
      chapters={book.chapters}
      chapter={chapter}
      sectionUnit={meta.sectionUnit}
      verse={!!meta.verse}
      bookTitle={meta.title}
      tocBack={<Link to={`/dao/${slug}`} className="read-toc__back">{book.title}</Link>}
      chapterLabel={label}
      chapterHref={(no) => `/dao/${slug}/${no}`}
      getAnchors={(no, i) => getDaoAnchors(slug, no, i)}
      renderYanyi={(no) => <YanyiBlock slug={slug} chapter={no} />}
      renderBaihua={(no) => <BaihuaBlock corpus="dao" slug={slug} chapter={no} bookTitle={meta.title} sectionUnit={meta.sectionUnit || '章'} />}
      partsOf={(c) => chapterParts(c, meta)}
      anchorsOf={(c) => chapterAnchors(c, meta)}
      part={resumePart}
      partHref={(no, p) => `/dao/${slug}/${no}${p > 1 ? `?p=${p}` : ''}`}
      posCtx={{ slug }}
      markCtx={{ corpus: 'dao', slug }}
      commentCtx={{ corpus: 'dao', slug }}
    />
  )
}
