import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import { BaihuaArticle } from '../../reader/BaihuaBlock.jsx'
import QuizCard from '../../yijing/components/QuizCard.jsx'
import { LEARN_TOPICS, topicByKey, topicIndex } from './mingliLearnTopics.js'

// 六篇正文是**数据**不是组件:`src/data/mingli/learn/<key>.json`,与白话同一个块模型
// (lead/h2/p/list/callout/table/pull/steps + widget)。这样正文走同一个渲染器、
// widget 块走同一道 check-data 校验,交互件也能原样搬进任何一篇白话里。
// 按篇懒加载:每篇一个 chunk,进哪篇才下哪篇。
const ARTICLES = import.meta.glob('../../../data/mingli/learn/*.json')
const loaderOf = (key) => ARTICLES[`../../../data/mingli/learn/${key}.json`]

function useArticle(key) {
  const [state, setState] = useState({ key: null, data: null, failed: false })
  useEffect(() => {
    const load = loaderOf(key)
    if (!load) return undefined
    let alive = true
    load().then((m) => alive && setState({ key, data: m.default, failed: false }))
      .catch(() => alive && setState({ key, data: null, failed: true }))
    return () => { alive = false }
  }, [key])
  // 换篇时旧数据立刻作废,免得闪一下上一篇的正文
  return state.key === key ? state : { key, data: null, failed: false }
}

export default function MingliLearnTopicPage() {
  const { topic: key } = useParams()
  const topic = topicByKey(key)
  usePageTitle(topic ? topic.title : '学堂', '观数')
  const article = useArticle(key)   // Hook 须在下面的提前 return 之前

  if (!topic) {
    return (
      <div className="basics-index-page">
        <div className="page-header">
          <h1 className="page-title">没有这一篇</h1>
          <p className="page-subtitle">学堂六篇里没有「{key}」这一篇。</p>
        </div>
        <Link to="/mingli/learn" className="btn btn--secondary">← 返回学堂</Link>
      </div>
    )
  }

  const i = topicIndex(key)
  const prev = i > 0 ? LEARN_TOPICS[i - 1] : null
  const next = i < LEARN_TOPICS.length - 1 ? LEARN_TOPICS[i + 1] : null
  const hasArticle = !!loaderOf(key)

  return (
    <div className="basics-index-page">
      <div className="page-header">
        <p className="mingli-topic-num">学堂 · 第 {i + 1} 篇</p>
        <h1 className="page-title">{topic.title}</h1>
        <p className="page-subtitle">{topic.desc}</p>
      </div>

      {!hasArticle && (
        <p className="mingli-topic-placeholder">
          本篇整理中——正文与交互演示还没写好，先看看别的几篇，或直接去书架翻书。
        </p>
      )}
      {hasArticle && article.failed && <p className="mingli-topic-placeholder">这一篇没能载入，刷新再试一次。</p>}
      {hasArticle && !article.data && !article.failed && <div className="mingli-topic-loading" aria-busy="true" />}
      {article.data && (
        <div className="mingli-topic-body">
          <BaihuaArticle data={{ ...article.data, foot: false }} />
          {article.data.quiz?.length > 0 && (
            <QuizCard topic={`mingli:${key}`} quiz={{ title: topic.title, questions: article.data.quiz }} />
          )}
        </div>
      )}

      <div className="learn-next learn-next--between">
        {prev
          ? <Link to={`/mingli/learn/${prev.key}`} className="learn-next__link">← 上一篇 · {prev.title}</Link>
          : <span />}
        {next
          ? <Link to={`/mingli/learn/${next.key}`} className="learn-next__link">下一篇 · {next.title} →</Link>
          : <Link to="/mingli" className="learn-next__link">进书架 →</Link>}
      </div>
    </div>
  )
}
