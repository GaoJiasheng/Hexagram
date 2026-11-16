import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getReadingProgress } from '../yijing/storage.js'
import { SITE_MAP } from '../../sites/registry.js'
import { sizeTier } from './bookSizes.js'
import SchoolEntry from './SchoolEntry.jsx'
import { agoLabel, recentBooks } from '../../shell/recent.js'
import PLANS from '../../data/reading-home.json'
import './ShelfHome.css'

// 读经站组首页的新版(docs/reading-home-proposal.md;2026-11-15 儒、道两组先上,11-16 推到佛 / 兵 / 法 / 中医 / 谋略):
// 平铺书架回答不了「从哪本读起」,本组的交互件与索引又散在各处。这里自上而下四段——
//   接着读(本组最近读的书,落到段)· 从哪里读起(主线带箭头,道藏主线后分三路)· 再往外读 · 这一家的门道。
// 路径数据在 src/data/reading-home.json(闸 check-reading-home:理由凡标出处的必须是站内导读原文);
// 那里没有条目的组不走这里,仍是 ScriptureShelf 的平铺书架。不做随机 / 每日 / 热门——那是替读者挑。
// 谋略组不排次序(杂纂,书与书之间没有先后):数据里没有 main,只有 zones——真书一区、托名伪书一区,伪书卡带「⚠ 托名」。
export const homePlan = (corpus) => PLANS[corpus] || null

const unit = (t) => t.sectionUnit || '章'

function StepCard({ t, basePath, no, why, cited, progress }) {
  const tier = sizeTier(t.slug)
  const done = progress[t.slug] || 0
  return (
    <Link to={`${basePath}/${t.slug}`} className="shelf-step">
      <span className="shelf-step__no">{no}</span>
      <span className="shelf-step__title">{t.title}</span>
      <span className={`shelf-step__why ${cited ? 'shelf-step__why--cited' : ''}`}>{cited ? `「${why}」` : why}</span>
      <span className="shelf-step__meta">
        <span>{t.sections} {unit(t)}</span>
        {tier && <span className={`book-tier book-tier--${tier.cls}`}>{tier.label}</span>}
        {done > 0 && t.sections > 1 && <span className="shelf-step__done">读至第 {done} {unit(t)}</span>}
      </span>
    </Link>
  )
}

function MiniCard({ t, basePath, progress }) {
  const tier = sizeTier(t.slug)
  const done = progress[t.slug] || 0
  return (
    <Link to={`${basePath}/${t.slug}`} className="shelf-mini">
      <span className="shelf-mini__title">{t.title}</span>
      <span className="shelf-mini__brief">{t.brief}</span>
      <span className="shelf-mini__meta">
        <span>{t.era}</span>
        {tier && <span className={`book-tier book-tier--${tier.cls}`}>{tier.label}</span>}
        {t.dubious && <span className="shelf-mini__dubious">⚠ 托名</span>}
        {t.caveat && !t.dubious && <span className="shelf-mini__caveat">存疑</span>}
        {done > 0 && t.sections > 1 && <span className="shelf-step__done">读至第 {done} {unit(t)}</span>}
      </span>
    </Link>
  )
}

export default function ShelfHome({ corpus, texts, title, subtitle, basePath, disclaimer }) {
  const plan = PLANS[corpus]
  const progress = getReadingProgress()
  const by = (slug) => texts.find((t) => t.slug === slug)
  const recent = recentBooks(40).filter((r) => r.book.corpus === corpus).slice(0, 4)
  const [first, ...others] = recent

  // 门道行的三个计数(名句 / 人物志 / 时间轴)按需取:名句数据 260 KB,不该压在组首页的首屏上
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    let alive = true
    Promise.all([import('../../data/mingju.json'), import('../../data/renwu.json'), import('../../data/timeline.json')])
      .then(([mj, rw, tl]) => {
        if (!alive) return
        const list = mj.default || mj
        setCounts({
          mingju: list.filter((m) => m.corpus === corpus).length,
          renwu: ((rw.default || rw).people || []).filter((p) => p.group === corpus).length,
          timeline: ((tl.default || tl).items || []).filter((x) => x.corpus === corpus && x.c !== 'pseudo').length,   // 托名伪作不上轴,不计
        })
      }).catch(() => {})
    return () => { alive = false }
  }, [corpus])

  // 本组的交互件:各书的 shape(同一个页面多本书共用的只列一次)+ 分站导航里首页以外的栏目
  const site = SITE_MAP[corpus]
  const doors = []
  const seen = new Set([basePath])
  for (const n of site?.nav || []) if (!seen.has(n.to)) { seen.add(n.to); doors.push({ to: n.to, label: n.label, tag: '专题' }) }
  for (const t of texts) if (t.shape && !seen.has(t.shape.href)) { seen.add(t.shape.href); doors.push({ to: t.shape.href, label: t.shape.label, tag: t.title.replace(/[内外杂]篇$/, '') }) }

  return (
    <div className="dao-home shelf-home">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      {disclaimer && <div className="shelf-disclaimer" role="note">⚠ {disclaimer}</div>}

      {first && (
        <section className="shelf-resume" aria-label="接着读">
          <Link to={first.href} className="shelf-resume__main">
            <span className="shelf-resume__cap">接着读</span>
            <span className="shelf-resume__book">{first.book.title}</span>
            <span className="shelf-resume__where">
              第 {first.ch} {unit(first.book)}{first.seg ? ` · 第 ${first.seg + 1} 段` : ''}{first.t ? ` · ${agoLabel(first.t)}` : ''}
            </span>
            <span className="shelf-resume__go">继续 →</span>
          </Link>
          {others.length > 0 && (
            <p className="shelf-resume__more">
              最近还看过
              {others.map((r) => <Link key={r.book.slug} to={r.href}>{r.book.title} · 第 {r.ch} {unit(r.book)}</Link>)}
            </p>
          )}
        </section>
      )}

      <SchoolEntry corpus={corpus} />

      {plan.main?.length > 0 && (
        <section className="shelf-sec" aria-label="从哪里读起">
          <h2 className="shelf-sec__title">从哪里读起</h2>
          <div className="shelf-path" style={{ '--n': plan.main.length }}>
            {plan.main.map((s, i) => {
              const t = by(s.slug)
              return t ? <StepCard key={s.slug} t={t} basePath={basePath} no={i + 1} why={s.why} cited={!!s.cite} progress={progress} /> : null
            })}
          </div>
          <p className="shelf-basis">
            <span className="shelf-basis__label">{plan.basis.label}</span>
            {plan.basis.quote && (
              <>
                {plan.basis.quote}
                <Link to={`${basePath}/${plan.basis.cite}/daodu`} className="shelf-basis__src">见《{by(plan.basis.cite)?.title}》导读 →</Link>
              </>
            )}
            {!plan.basis.quote && (plan.basis.note || '这个次序是本站排的，不是古人成说；想先读哪本，直接点进去就是。')}
          </p>
        </section>
      )}

      {plan.branches?.length > 0 && (
        <section className="shelf-sec" aria-label="主线之后">
          <h2 className="shelf-sec__title">{plan.branchesTitle || '主线之外'}</h2>
          <div className="shelf-branches" style={{ '--n': plan.branches.length }}>
            {plan.branches.map((b) => (
              <div key={b.title} className="shelf-branch">
                <h3 className="shelf-branch__title">{b.title}</h3>
                {b.note && <p className="shelf-branch__note">{b.note}</p>}
                <div className="shelf-branch__books">
                  {b.slugs.map((slug) => { const t = by(slug); return t ? <MiniCard key={slug} t={t} basePath={basePath} progress={progress} /> : null })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {plan.zones?.length > 0 && (
        <section className="shelf-sec" aria-label="分区">
          <h2 className="shelf-sec__title">{plan.zonesTitle || '分开读'}</h2>
          {plan.basis?.note && <p className="shelf-basis shelf-basis--top"><span className="shelf-basis__label">{plan.basis.label}</span>{plan.basis.note}</p>}
          {plan.zones.map((z) => (
            <div key={z.title} className={`shelf-zone ${z.dubious ? 'shelf-zone--dubious' : ''}`}>
              <h3 className="shelf-zone__title">{z.title}</h3>
              {z.note && <p className="shelf-zone__note">{z.note}</p>}
              <div className="shelf-more">
                {z.slugs.map((slug) => { const t = by(slug); return t ? <MiniCard key={slug} t={t} basePath={basePath} progress={progress} /> : null })}
              </div>
            </div>
          ))}
        </section>
      )}

      {plan.more?.slugs?.length > 0 && (
        <section className="shelf-sec" aria-label="再往外读">
          <h2 className="shelf-sec__title">再往外读</h2>
          {plan.more.note && <p className="shelf-sec__note">{plan.more.note}</p>}
          <div className="shelf-more">
            {plan.more.slugs.map((slug) => { const t = by(slug); return t ? <MiniCard key={slug} t={t} basePath={basePath} progress={progress} /> : null })}
          </div>
        </section>
      )}

      {(doors.length > 0 || !counts || counts.mingju + counts.renwu + counts.timeline > 0) && (
      <section className="shelf-sec" aria-label="这一家的门道">
        <h2 className="shelf-sec__title">这一家的门道</h2>
        <nav className="book-shapes shelf-doors">
          {doors.map((d) => (
            <Link key={d.to} to={d.to} className="book-shapes__item">
              <span className="book-shapes__tag">{d.tag}</span>
              <span className="book-shapes__label">{d.label}</span>
            </Link>
          ))}
          {counts?.mingju > 0 && <Link to={`/mingju?group=${corpus}`} className="book-shapes__item"><span className="book-shapes__tag">名句</span><span className="book-shapes__label">{counts.mingju} 条</span></Link>}
          {counts?.renwu > 0 && <Link to={`/renwu?g=${corpus}`} className="book-shapes__item"><span className="book-shapes__tag">人物志</span><span className="book-shapes__label">{counts.renwu} 人</span></Link>}
          {counts?.timeline > 0 && <Link to={`/timeline?g=${corpus}`} className="book-shapes__item"><span className="book-shapes__tag">时间轴</span><span className="book-shapes__label">{counts.timeline} 部</span></Link>}
        </nav>
      </section>
      )}
    </div>
  )
}
