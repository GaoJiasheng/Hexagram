import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import EmptyState from '../../yijing/components/EmptyState.jsx'
import texts from '../../../data/dao/texts.json'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import { loadDaoText } from '../data.js'
import { tocTitle, tocTitleOf } from '../../reader/tocTitle.js'
import { getReadingProgress } from '../../yijing/storage.js'
import DaoSinglePage from './DaoSinglePage.jsx'

// 文本页 — 题解 + 章节入口(v4 §3.6 框架;v6 §3 内容期:status≠pending 时网格即阅读入口)
// 篇目优先显示各章标题(逍遥游、大易总叙章第一…);道德经为纯序数(一章/二章)回退序号格。
// 短经(singlePage)走单页阅读器(v13 §1):题解+全文一页铺开
export default function DaoTextPage() {
  const { slug } = useParams()
  const text = texts.find(t => t.slug === slug)
  usePageTitle(text?.title, '观道')
  const [chapters, setChapters] = useState(null)

  const readable = !!text && !text.singlePage && text.status !== 'pending'
  useEffect(() => {
    let alive = true
    if (readable) loadDaoText(slug).then((b) => { if (alive) setChapters(b?.chapters || null) })
    else setChapters(null)
    return () => { alive = false }
  }, [slug, readable])

  if (text?.singlePage && text.status !== 'pending') {
    return <DaoSinglePage slug={slug} text={text} />
  }

  if (!text) {
    return (
      <div className="dao-text-page">
        <div className="basics-breadcrumb">
          <Link to="/dao" className="basics-breadcrumb__link">← 道藏</Link>
        </div>
        <EmptyState icon="⊘" text="没有这部经典" />
      </div>
    )
  }

  const resumeCh = (text.sections > 1 && getReadingProgress()[slug]) || 0  // 续读章号(0=无)

  return (
    <div className="dao-text-page">
      <div className="basics-breadcrumb">
        <Link to="/dao" className="basics-breadcrumb__link">← 道藏</Link>
      </div>

      <div className="dao-text-header">
        <h1 className="dao-text-title">{text.title}</h1>
        <p className="dao-text-meta">{text.alias} · {text.era} · {text.attribution}</p>
        <p className="dao-text-brief">{text.brief}</p>
        {text.caveat && <p className="caveat-badge">⚠ {text.caveat}——详见撰人小传，本站作文献存疑研读。</p>}
        {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
        {resumeCh > 0 && (
          <Link to={`/dao/${text.slug}/${resumeCh}`} className="dao-text-resume">
            继续读 · 第 {resumeCh} {text.sectionUnit} →
          </Link>
        )}
      </div>

      <section className="dao-text-sections">
        <h2 className="dao-text-sections__title">{text.sectionUnit}目</h2>
        {text.status === 'pending' ? (
          <>
            <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}，整理中`}>
              {Array.from({ length: text.sections }, (_, i) => (
                <span key={i} className="dao-section-cell" aria-disabled="true">
                  {text.sections > 1 ? i + 1 : '全'}
                </span>
              ))}
            </div>
            <p className="text-faint dao-section-note">经文整理中——录入后此处即为{text.sectionUnit}节阅读入口。</p>
          </>
        ) : chapters && chapters.length && chapters.some((c) => tocTitleOf(c, text)) ? (
          <>
            <div className="dao-section-grid dao-section-grid--titled" aria-label={`共 ${text.sections} ${text.sectionUnit}`}>
              {chapters.map((c) => (
                <Link key={c.no} to={`/dao/${text.slug}/${c.no}`} className={`dao-section-cell dao-section-cell--link dao-section-cell--titled ${c.no === resumeCh ? 'dao-section-cell--current' : ''}`}>
                  <span className="dao-section-cell__no">{c.no}</span>
                  <span className="dao-section-cell__title">{tocTitleOf(c, text)}</span>
                </Link>
              ))}
            </div>
            {text.status === 'partial' && (
              <p className="text-faint dao-section-note">原文已录入，白话译注整理中。</p>
            )}
          </>
        ) : (
          <>
            <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}`}>
              {Array.from({ length: text.sections }, (_, i) => (
                <Link key={i} to={`/dao/${text.slug}/${i + 1}`} className={`dao-section-cell dao-section-cell--link ${i + 1 === resumeCh ? 'dao-section-cell--current' : ''}`}>
                  {text.sections > 1 ? i + 1 : '全'}
                </Link>
              ))}
            </div>
            {text.status === 'partial' && (
              <p className="text-faint dao-section-note">原文已录入，白话译注整理中。</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
