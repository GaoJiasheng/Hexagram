import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { TOPICS, PLANNED, EPIGRAPH, groupAccent } from './debates.js'

// 《赛博:百家争鸣》辩题库——已开辩题成卡(可点),46 题路线图按类列出(陆续上线)。
export default function DebateListPage() {
  usePageTitle('百家争鸣')
  return (
    <div className="debates-list page-content">
      <div className="basics-breadcrumb"><Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link></div>
      <div className="page-header">
        <h1 className="page-title">赛博 · 百家争鸣</h1>
        <p className="page-subtitle text-soft">诸家就同一题目各执一词,点入看其对辩。会讲而已,不评输赢。</p>
      </div>
      <p className="debates-epigraph">{EPIGRAPH.text} ——《{EPIGRAPH.source}》</p>

      <div className="debates-grid">
        {TOPICS.map((t) => (
          <Link key={t.id} to={`/debates/${t.id}`} className="debate-card">
            <div className="debate-card__title">{t.title}</div>
            <div className="debate-card__q">{t.question}</div>
            <div className="debate-card__seals">
              {t.schools.map((s, i) => (
                <span key={i} className="debate-card__seal" style={{ background: groupAccent(s.group) }} title={`${s.label}·${s.stance}`}>{s.seal}</span>
              ))}
            </div>
            <div className="debate-card__meta">{t.schools.map((s) => s.label).join(' · ')} · {t.turns} 轮</div>
          </Link>
        ))}
      </div>

      {PLANNED.length > 0 && (
        <>
          <h2 className="debates-roadmap-title">辩题库 · 陆续上线</h2>
          <div className="debates-roadmap">
            {PLANNED.map((cat) => (
              <div key={cat.category} className="debates-cat">
                <div className="debates-cat__name">{cat.category}</div>
                <ul className="debates-cat__items">
                  {cat.items.map((it, i) => (
                    <li key={i} className="debates-planned"><span className="debates-planned__t">{it.title}</span><span className="debates-planned__p"> · {it.parties}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
