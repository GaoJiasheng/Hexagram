import { useParams, Link } from 'react-router-dom'
import EmptyState from '../../yijing/components/EmptyState.jsx'
import texts from '../../../data/dao/texts.json'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'

// 文本页 — 题解 + 章节入口(v4 §3.6 框架;v6 §3 内容期:status≠pending 时网格即阅读入口)
export default function DaoTextPage() {
  const { slug } = useParams()
  const text = texts.find(t => t.slug === slug)
  usePageTitle(text?.title, '观道')

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

  return (
    <div className="dao-text-page">
      <div className="basics-breadcrumb">
        <Link to="/dao" className="basics-breadcrumb__link">← 道藏</Link>
      </div>

      <div className="dao-text-header">
        <h1 className="dao-text-title">{text.title}</h1>
        <p className="dao-text-meta">{text.alias} · {text.era} · {text.attribution}</p>
        <p className="dao-text-brief">{text.brief}</p>
        {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
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
        ) : (
          <>
            <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}`}>
              {Array.from({ length: text.sections }, (_, i) => (
                <Link key={i} to={`/dao/${text.slug}/${i + 1}`} className="dao-section-cell dao-section-cell--link">
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
