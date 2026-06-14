import { Link } from 'react-router-dom'
import { LEARN_TOPICS } from '../learnTopics.js'

// 学堂篇间接力(Tier 1):各教学页底部「下一篇 → X」,把 12 篇散页缝成一条路。
// 数据取 LEARN_TOPICS 有序数组的 i+1;末篇无下一篇则不渲染。
export default function LearnNextLink({ id }) {
  const i = LEARN_TOPICS.findIndex((t) => t.id === id)
  const next = i >= 0 ? LEARN_TOPICS[i + 1] : null
  if (!next) return null
  return (
    <div className="learn-next">
      <Link to={next.to} className="learn-next__link">下一篇 · {next.title} →</Link>
    </div>
  )
}
