import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { loadClassics, CLASSICS_META } from '../data.js'
import { saveReadingProgress } from '../storage.js'
import { getClassicAnchors } from '../zhushiAnchored.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import ClassicReader from '../../reader/ClassicReader.jsx'
import BaihuaBlock from '../../reader/BaihuaBlock.jsx'

// 经传阅读器(v14 §3:薄包装,核心走通用 ClassicReader)
export default function ClassicsReadPage() {
  const { book, chapter: chapterParam } = useParams()
  const [classics, setClassics] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapter = Number(chapterParam) || 1
  const meta = CLASSICS_META.find(m => m.key === book)
  usePageTitle(meta ? `${meta.title}·第${chapterParam}章` : null)

  useEffect(() => {
    setLoading(true)
    loadClassics(book)
      .then(data => { setClassics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book])

  useEffect(() => {
    if (classics) {
      saveReadingProgress(book, chapter)
      window.scrollTo(0, 0)
    }
  }, [book, chapter, classics])

  if (loading) return <div className="page-loading">加载中…</div>
  if (!classics) return <div className="page-content"><p className="text-faint">经传文件未找到: {book}</p></div>

  return (
    <ClassicReader
      mode="paged"
      chapters={classics.chapters}
      chapter={chapter}
      bookTitle={meta?.title || classics.title}
      tocBack={meta?.title || classics.title}
      chapterLabel={(c) => `第${c.no}章`}
      chapterHref={(no) => `/classics/${book}/${no}`}
      getAnchors={(no, i) => getClassicAnchors(book, no, i)}
      renderBaihua={(no) => (
        <BaihuaBlock
          corpus="yijing"
          slug={book}
          chapter={no}
          bookTitle={`易经·${meta?.title || classics.title}`}
          sectionUnit="章"
          chapterLabel={`第${no}章`}
        />
      )}
    />
  )
}
