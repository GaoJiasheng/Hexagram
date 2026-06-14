import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { loadDaoText, getDaoMeta } from '../data.js'
import { getDaoAnchors } from '../daoAnchored.js'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import ClassicReader from '../../reader/ClassicReader.jsx'
import YanyiBlock from '../components/YanyiBlock.jsx'

// 短经单页阅读器(v14 §3:薄包装,核心走通用 ClassicReader 的 single 模式)
// 题解 + 全文一页铺开 + 章末延伸 + 左侧章节锚点
export default function DaoSinglePage({ slug, text }) {
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const meta = getDaoMeta(slug)
  usePageTitle(text?.title, '观道')

  useEffect(() => {
    setLoading(true)
    // 单页短经整篇铺开,不写续读进度(免书架显示误导的「读至末章」)
    loadDaoText(slug)
      .then((data) => { setBook(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

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
      tocBack={<Link to="/dao" className="read-toc__back">← 道藏</Link>}
      chapterLabel={label}
      anchorId={(no) => `dao-ch-${no}`}
      getAnchors={(no, i) => getDaoAnchors(slug, no, i)}
      renderYanyi={(no) => <YanyiBlock slug={slug} chapter={no} />}
      header={header}
    />
  )
}
