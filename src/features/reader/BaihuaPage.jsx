import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { loadBaihua } from './baihua.js'
import { BaihuaArticle } from './BaihuaBlock.jsx'
import { SITE_MAP } from '../../sites/registry.js'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'

// 白话「整页研读」（design-v22 §2 / A2）——独立路由 /<corpus>/:slug/baihua/:chapter，
// 整屏阅读、可收藏/分享/深链、刷新仍在。复用 BaihuaArticle（与抽屉同一渲染）。
export default function BaihuaPage({ corpus }) {
  const params = useParams()
  // 易经:卦 /hexagram/:id/baihua(slug=hexagrams、ch=:id)、经传 /classics/:book/:chapter/baihua(slug=:book、ch=:chapter);
  // 其余 corpus 走 /<corpus>/:slug/baihua/:chapter
  const isYijing = corpus === 'yijing'
  const isJingzhuan = isYijing && !!params.book   // 经传整页路由带 :book
  const slug = isJingzhuan ? params.book : isYijing ? 'hexagrams' : params.slug
  const ch = Number(isJingzhuan ? params.chapter : isYijing ? params.id : params.chapter) || 1
  const [data, setData] = useState(undefined)
  const site = SITE_MAP[corpus]
  usePageTitle(data?.title || '白话', site?.brand)

  useEffect(() => { window.scrollTo(0, 0) }, [slug, ch])

  useEffect(() => {
    let alive = true
    setData(undefined)
    loadBaihua(corpus, slug, ch).then((article) => { if (alive) setData(article) })
    return () => { alive = false }
  }, [corpus, slug, ch])

  const backToChapter = isJingzhuan ? `/classics/${slug}/${ch}` : isYijing ? `/hexagram/${ch}` : `${site?.home || ''}/${slug}/${ch}`
  if (data === undefined) {
    return (
      <div className="page-content">
        <p className="text-faint">正在载入白话…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="page-content">
        <p className="text-faint">这一章还没有白话。</p>
        <Link to={backToChapter} className="btn btn--secondary">返回原文</Link>
      </div>
    )
  }

  return (
    <div className="baihua-page">
      <div className="baihua-page__bar">
        <Link to={backToChapter} className="baihua-page__back">← 回原文</Link>
        {site?.brand && <span className="baihua-page__seal">{site.brand}</span>}
        <span className="baihua-page__title">{data.title}</span>
      </div>
      <article className="baihua-page__body">
        <BaihuaArticle data={data} />
      </article>
    </div>
  )
}
