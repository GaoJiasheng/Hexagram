import { Link } from 'react-router-dom'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import { LEARN_TOPICS } from './mingliLearnTopics.js'

// 观数 · 学堂总览——读进书架之前必须先会的六件事,复用 yijing 学堂的 basics-index-* 样式
// (通用样式走 var(--cinnabar),换到 [data-site="mingli"] 下自动披本组主色,无需另写 CSS)。
export default function MingliLearnIndexPage() {
  usePageTitle('学堂', '观数')
  return (
    <div className="basics-index-page">
      <div className="page-header">
        <h1 className="page-title">学堂</h1>
        <p className="page-subtitle">
          读这些书之前必须会的六件事：干支、节气、五行、排柱、十神、藏干——读完再进书架。
        </p>
      </div>
      <div className="basics-index-list">
        {LEARN_TOPICS.map((t, i) => (
          <Link key={t.key} to={`/mingli/learn/${t.key}`} className="basics-index-card">
            <span className="basics-index-card__num">{i + 1}</span>
            <div className="basics-index-card__body">
              <div className="basics-index-card__title">{t.title}</div>
              <div className="basics-index-card__desc">{t.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
