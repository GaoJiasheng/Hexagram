import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BaihuaArticle } from '../reader/BaihuaBlock.jsx'
import { TOPICS, loadDebateArticle } from './debates.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'

// 辩题白话讲解整页(owner 2026-07-29)。辩论页保持原样不动,本页是另开的一篇文章:
// 解释这场辩到底在辩什么,而不是替读者判谁对——「会讲不评输赢」的红线在此同样适用。
export default function DebateArticlePage() {
  const { id } = useParams()
  const topic = TOPICS.find((t) => t.id === id)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  usePageTitle(topic ? `${topic.title} · 白话讲解` : '白话讲解', '百家争鸣')

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadDebateArticle(id).then((d) => { if (alive) { setData(d); setLoading(false) } })
    return () => { alive = false }
  }, [id])

  return (
    <div className="baihua-page">
      <div className="baihua-page__bar">
        <Link to={`/debates/${id}`} className="baihua-page__back">← 回到这场辩</Link>
        <Link to="/debates" className="baihua-page__back">辩题一览</Link>
      </div>
      {loading && <p className="route-loading">⋯</p>}
      {!loading && !data && <p className="baihua-page__empty">这场辩还没有白话讲解。</p>}
      {!loading && data && <BaihuaArticle data={data} />}
    </div>
  )
}
