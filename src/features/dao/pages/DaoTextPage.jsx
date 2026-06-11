import { useParams, Link } from 'react-router-dom'
import EmptyState from '../../yijing/components/EmptyState.jsx'
import texts from '../../../data/dao/texts.json'

// 文本框架页 — 题解 + 章节占位(v4 §3.6;内容期换为章节阅读器)
export default function DaoTextPage() {
  const { slug } = useParams()
  const text = texts.find(t => t.slug === slug)

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
      </div>

      <section className="dao-text-sections">
        <h2 className="dao-text-sections__title">{text.sectionUnit}目</h2>
        <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}，整理中`}>
          {Array.from({ length: text.sections }, (_, i) => (
            <span key={i} className="dao-section-cell" aria-disabled="true">
              {text.sections > 1 ? i + 1 : '全'}
            </span>
          ))}
        </div>
        <p className="text-faint dao-section-note">经文整理中——录入后此处即为{text.sectionUnit}节阅读入口。</p>
      </section>
    </div>
  )
}
