import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BaihuaArticle } from './BaihuaBlock.jsx'
import { loadSchool } from './school.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'

// 家级导读整页(可收藏 / 分享 / 刷新保留)。抽屉里的 ⤢ 落到这里。
export default function SchoolPage({ corpus }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  usePageTitle(data?.title || '一家之来路')

  useEffect(() => {
    let alive = true
    setLoading(true)
    loadSchool(corpus).then((a) => { if (alive) { setData(a); setLoading(false) } })
    return () => { alive = false }
  }, [corpus])

  const home = SITE_MAP[corpus]?.home || `/${corpus}`
  return (
    <div className="baihua-page">
      <div className="baihua-page__bar">
        <Link to={home} className="baihua-page__back">← 回书架</Link>
      </div>
      {loading && <p className="route-loading">⋯</p>}
      {!loading && !data && <p className="baihua-page__empty">这一组还没有家级导读。</p>}
      {!loading && data && <BaihuaArticle data={data} />}
    </div>
  )
}
