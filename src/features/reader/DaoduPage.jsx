import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BaihuaArticle } from './BaihuaBlock.jsx'
import { loadDaodu } from './daodu.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'

// 书级导读整页(可收藏 / 分享 / 刷新保留)。抽屉里的 ⤢ 落到这里。
export default function DaoduPage({ corpus }) {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  usePageTitle(data?.title || '书级导读')

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadDaodu(corpus, slug).then((a) => { if (alive) { setData(a); setLoading(false) } })
    return () => { alive = false }
  }, [corpus, slug])

  const home = SITE_MAP[corpus]?.home || `/${corpus}`
  return (
    <div className="baihua-page">
      <div className="baihua-page__bar">
        <Link to={`${home}/${slug}`} className="baihua-page__back">← 回篇目</Link>
        <Link to={home} className="baihua-page__back">书架</Link>
      </div>
      {loading && <p className="route-loading">⋯</p>}
      {!loading && !data && <p className="baihua-page__empty">这本书还没有导读。</p>}
      {!loading && data && <BaihuaArticle data={data} />}
    </div>
  )
}
