import { Link } from 'react-router-dom'
import { getProgress } from '../storage.js'
import { LEARN_TOPICS, topicStatus } from '../learnTopics.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

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
  usePageTitle('学堂')
  const progress = getProgress()
  const total = LEARN_TOPICS.length
  const readN = LEARN_TOPICS.filter((t) => progress.read[t.id]).length
  const quizTopics = LEARN_TOPICS.filter((t) => t.quiz)
  const quizN = quizTopics.filter((t) => progress.quiz[t.id]?.passed).length
  const usedTopics = LEARN_TOPICS.filter((t) => t.usedKeys)
  const usedN = usedTopics.filter((t) => t.usedKeys.some((k) => progress.used[k])).length
  const nextTopic = LEARN_TOPICS.find((t) => !progress.read[t.id]) || null
  return (
    <div className="basics-index-page">
      <div className="page-header">
        <h1 className="page-title">学堂</h1>
        <p className="page-subtitle">从阴阳基础到象数占法，按推荐次序渐进——每篇读完可以练一练，占法篇还能直接去工作台实操。</p>
      </div>
      <div className="basics-progress-summary">
        <span className="basics-progress-stat">已读 <strong>{readN}</strong>/{total}</span>
        <span className="basics-progress-stat">已练 <strong>{quizN}</strong>/{quizTopics.length}</span>
        <span className="basics-progress-stat">已用 <strong>{usedN}</strong>/{usedTopics.length}</span>
        {nextTopic && (
          <Link to={nextTopic.to} className="basics-progress-next">
            {readN === 0 ? '从这里开始' : '继续学习'}：{nextTopic.title} →
          </Link>
        )}
      </div>
      <div className="basics-index-list">
        {LEARN_TOPICS.map((s, i) => (
          <Link key={s.to} to={s.to} className={`basics-index-card ${nextTopic && s.id === nextTopic.id ? 'basics-index-card--next' : ''}`}>
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
