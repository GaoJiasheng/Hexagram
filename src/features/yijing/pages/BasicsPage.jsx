import { Link } from 'react-router-dom'
import { getProgress } from '../storage.js'
import { LEARN_TOPICS, topicStatus } from '../learnTopics.js'

function ProgressDots({ topic, progress }) {
  const st = topicStatus(topic, progress)
  const dots = [
    ['读', st.read],
    ...(st.quiz !== null ? [['练', st.quiz]] : []),
    ...(st.used !== null ? [['用', st.used]] : []),
  ]
  return (
    <span className="topic-dots" aria-label={dots.map(([l, on]) => `${l}${on ? '已完成' : '未完成'}`).join('，')}>
      {dots.map(([label, on]) => (
        <span key={label} className={`topic-dot ${on ? 'topic-dot--on' : ''}`}>{label}</span>
      ))}
    </span>
  )
}

export default function BasicsPage() {
  const progress = getProgress()
  return (
    <div className="basics-index-page">
      <div className="page-header">
        <h1 className="page-title">学堂</h1>
        <p className="page-subtitle">从阴阳基础到象数占法，按推荐次序渐进——每篇读完可以练一练，占法篇还能直接去工作台实操。</p>
      </div>
      <div className="basics-index-list">
        {LEARN_TOPICS.map((s, i) => (
          <Link key={s.to} to={s.to} className="basics-index-card">
            <span className="basics-index-card__num">{i + 1}</span>
            <div className="basics-index-card__body">
              <div className="basics-index-card__title">{s.title}</div>
              <div className="basics-index-card__desc">{s.desc}</div>
            </div>
            <div className="basics-index-card__meta">
              <ProgressDots topic={s} progress={progress} />
              <span className="basics-index-card__time">{s.time}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
