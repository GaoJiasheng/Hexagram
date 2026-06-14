import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import EmptyState from '../yijing/components/EmptyState.jsx'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { SITE_MAP } from '../../sites/registry.js'
import { getMeta, loadText } from './corpus.js'
import CorpusSinglePage from './CorpusSinglePage.jsx'

// 通用文本页(v16 §1)——题解 + 章节入口;短经(singlePage)走单页阅读器。
// 篇目优先显示各章标题(图国第一、初见秦…),载入 classics 取 title;无标题则回退序号格。
// 复用道藏 dao-text-* / dao-section-* 样式(主色由 [data-site] 主题驱动)。
export default function CorpusTextPage({ corpus }) {
  const site = SITE_MAP[corpus]
  const { slug } = useParams()
  const text = getMeta(corpus, slug)
  usePageTitle(text?.title, site?.brand)
  const [chapters, setChapters] = useState(null)

  const readable = !!text && !text.singlePage && text.status !== 'pending'
  useEffect(() => {
    let alive = true
    if (readable) loadText(corpus, slug).then((b) => { if (alive) setChapters(b?.chapters || null) })
    else setChapters(null)
    return () => { alive = false }
  }, [corpus, slug, readable])

  if (text?.singlePage && text.status !== 'pending') {
    return <CorpusSinglePage corpus={corpus} slug={slug} text={text} />
  }

  if (!text) {
    return (
      <div className="dao-text-page">
        <div className="basics-breadcrumb">
          <Link to={site.home} className="basics-breadcrumb__link">← {site.portalTitle}</Link>
        </div>
        <EmptyState icon="⊘" text="没有这部经典" />
      </div>
    )
  }

  const titled = chapters && chapters.length && chapters.some((c) => c.title)

  return (
    <div className="dao-text-page">
      <div className="basics-breadcrumb">
        <Link to={site.home} className="basics-breadcrumb__link">← {site.portalTitle}</Link>
      </div>

      <div className="dao-text-header">
        <h1 className="dao-text-title">{text.title}</h1>
        <p className="dao-text-meta">{text.alias} · {text.era} · {text.attribution}</p>
        <p className="dao-text-brief">{text.brief}</p>
        {text.authorNote && <p className="dao-text-authornote">{text.authorNote}</p>}
      </div>

      <section className="dao-text-sections">
        <h2 className="dao-text-sections__title">{text.sectionUnit}目</h2>
        {text.status === 'pending' ? (
          <>
            <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}，整理中`}>
              {Array.from({ length: text.sections }, (_, i) => (
                <span key={i} className="dao-section-cell" aria-disabled="true">
                  {text.sections > 1 ? i + 1 : '全'}
                </span>
              ))}
            </div>
            <p className="text-faint dao-section-note">经文整理中——录入后此处即为{text.sectionUnit}节阅读入口。</p>
          </>
        ) : titled ? (
          <div className="dao-section-grid dao-section-grid--titled" aria-label={`共 ${text.sections} ${text.sectionUnit}`}>
            {chapters.map((c) => (
              <Link key={c.no} to={`${site.home}/${slug}/${c.no}`} className="dao-section-cell dao-section-cell--link dao-section-cell--titled">
                <span className="dao-section-cell__no">{c.no}</span>
                <span className="dao-section-cell__title">{c.title || `第${c.no}${text.sectionUnit}`}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dao-section-grid" aria-label={`共 ${text.sections} ${text.sectionUnit}`}>
            {Array.from({ length: text.sections }, (_, i) => (
              <Link key={i} to={`${site.home}/${slug}/${i + 1}`} className="dao-section-cell dao-section-cell--link">
                {text.sections > 1 ? i + 1 : '全'}
              </Link>
            ))}
          </div>
        )}
        {text.status === 'partial' && (
          <p className="text-faint dao-section-note">原文已录入，白话译注整理中。</p>
        )}
      </section>
    </div>
  )
}
