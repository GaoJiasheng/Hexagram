import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BaihuaArticle } from './BaihuaBlock.jsx'
import { loadDaodu } from './daodu.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'

// 书级导读整页(可收藏 / 分享 / 刷新保留)。抽屉里的 ⤢ 落到这里。
// back:易经没有篇目页与书架(一书即一站),由路由传回链 {to,label};其余站照旧回 /<组>/<slug>
// slug:易经的导读路由是写死的 /yijing/zhouyi/daodu(没有 :slug 段,一站一书),由路由直接传 slug;其余站仍从 URL 取
export default function DaoduPage({ corpus, back, slug: slugProp }) {
  const { slug: slugParam } = useParams()
  const slug = slugProp || slugParam
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  usePageTitle(data?.title || '书级导读', SITE_MAP[corpus]?.brand)   // 各组缀各自的品牌(原先一律落到默认的「观象」)

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
        {back ? (
          <>
            <Link to={back.to} className="baihua-page__back">{back.label}</Link>
            <Link to={home} className="baihua-page__back">首页</Link>
          </>
        ) : (
          <>
            <Link to={`${home}/${slug}`} className="baihua-page__back">← 回篇目</Link>
            <Link to={home} className="baihua-page__back">书架</Link>
          </>
        )}
      </div>
      {loading && <p className="route-loading">⋯</p>}
      {!loading && !data && <p className="baihua-page__empty">这本书还没有导读。</p>}
      {!loading && data && <BaihuaArticle data={data} />}
    </div>
  )
}
