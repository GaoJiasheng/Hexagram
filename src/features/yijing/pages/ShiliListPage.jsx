import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import shili from '../../../data/yijing/shili.json'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const GROUPS = ['庄闵僖', '成襄', '昭哀', '国语']
const GROUP_LABEL = {
  '庄闵僖': '庄公 · 闵公 · 僖公',
  '成襄': '宣公 · 成公 · 襄公',
  '昭哀': '昭公 · 哀公',
  '国语': '国语 · 晋语',
}

// 春秋筮例列表(v9 §2)——左传/国语占筮与引易实录,按时代分组
export default function ShiliListPage() {
  usePageTitle('春秋筮例')
  useEffect(() => { markRead('shili') }, [])

  return (
    <div className="shili-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">春秋筮例</h1>
        <p className="page-subtitle">
          《左传》《国语》保存的二十余条占筮与引易实录，是现存最早的《周易》应用现场——古人如何起卦、取象、断辞，尽在其中。
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g} className="shili-group">
          <h2 className="shili-group__title">{GROUP_LABEL[g]}</h2>
          <div className="shili-list">
            {shili.filter((s) => s.eraGroup === g).map((s) => (
              <Link key={s.id} to={`/shili/${s.id}`} className="shili-card">
                <span className="shili-card__title">{s.title}</span>
                <span className="shili-card__meta">
                  <span className="shili-card__era">{s.era}</span>
                  <span className={`shili-card__kind shili-card__kind--${s.kind}`}>{s.kind === 'shi' ? '筮占' : '引易'}</span>
                </span>
                <span className="shili-card__casts">{s.casts.map((c) => c.label).join(' · ')}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
