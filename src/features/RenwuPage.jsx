import { useEffect, useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import renwu from '../data/renwu.json'
import yijingRenwu from '../data/yijing/renwu.json'
import timeline from '../data/timeline.json'
import { ALL_BOOKS } from './reader/booksIndex.js'
import { SITE_MAP } from '../sites/registry.js'
import { usePageTitle } from './yijing/hooks/usePageTitle.js'

// 全站人物志(2026-09-25,owner:「做全站人物志」)——站内诸书的撰人、译者、注家、编者,一人一条小传。
// 数据 src/data/renwu.json(时间轴的人物层也读它);易学十家的小传复用 src/data/yijing/renwu.json(`yijing` 字段指过去),
// 不写两份。与时间轴互为出入口:时间轴点人 → /renwu#<id>;这里每条「在时间轴上看 ↗」→ /timeline#tl-p-<id>。
// 中立外壳,门户可达;portalHidden 的组不露出。

const YJ = Object.fromEntries(yijingRenwu.map((p) => [p.id, p]))
const SCHOOLS = new Set(Object.keys(import.meta.glob('../data/*/school.json')).map((k) => k.split('/')[2]))
const GROUP_LABEL = (site) => site.portalTitle.replace(/(研读|研习|典籍)$/, '')
const accentOf = (site) => (site.accent === 'cinnabar' ? 'var(--cinnabar-pure)' : `var(--${site.accent})`)
const yearText = (y) => (y < 0 ? `前${-y}` : String(y))

// 页面是懒加载的,浏览器自带的 #锚点 定位赶在内容渲染之前——挂载后自己滚一次(时间轴同理)
export function useHashScroll(deps = []) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    if (el) el.scrollIntoView({ block: 'start' })
  }, [hash, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function RenwuPage() {
  usePageTitle('人物志')
  const [params, setParams] = useSearchParams()
  const selGroups = (params.get('g') || '').split(',').filter(Boolean)

  const people = useMemo(() => renwu.people.map((p) => {
    const site = SITE_MAP[p.group]
    if (!site || site.portalHidden) return null
    const yj = p.yijing ? YJ[p.yijing] : null
    const books = p.group === 'yijing'
      ? [ALL_BOOKS.find((b) => b.corpus === 'yijing')].filter(Boolean)
      : (p.books || []).map((slug) => ALL_BOOKS.find((b) => b.corpus === p.group && b.slug === slug)).filter(Boolean)
    return {
      ...p, site, group: GROUP_LABEL(site), accent: accentOf(site), books,
      paragraphs: yj ? yj.paragraphs : (p.paragraphs || []),
      extraLinks: yj ? [{ to: `/basics/yuanliu#${yj.id}`, label: '易学源流 · 十家' }, ...(yj.links || [])] : [],
      school: SCHOOLS.has(p.group) ? `/${p.group}/school` : null,
    }
  }).filter(Boolean), [])

  useHashScroll([people.length])

  const groups = useMemo(() => {
    const m = new Map()
    for (const p of people) { const g = m.get(p.site.key) || { key: p.site.key, label: p.group, accent: p.accent, count: 0 }; g.count++; m.set(p.site.key, g) }
    return [...m.values()]
  }, [people])
  const visible = people.filter((p) => !selGroups.length || selGroups.includes(p.site.key))
  const sections = timeline.bands
    .map((b) => ({ band: b, items: visible.filter((p) => p.from >= b.from && p.from < b.to).sort((a, c) => a.from - c.from || a.to - c.to) }))
    .filter((s) => s.items.length)
  const toggleGroup = (k) => {
    const next = selGroups.includes(k) ? selGroups.filter((x) => x !== k) : [...selGroups, k]
    const p = new URLSearchParams(params); if (next.length) p.set('g', next.join(',')); else p.delete('g'); setParams(p, { replace: true })
  }

  return (
    <div className="renwu-page page-content">
      <div className="basics-breadcrumb">
        <Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">人物志 · 诸书背后的人</h1>
        <p className="page-subtitle text-soft">站内诸书的撰人、译者、注家、编者 {people.length} 人,一人一篇小传:他是谁,与哪几部书有关,哪些说法靠得住、哪些只是相传。</p>
      </div>

      <div className="tl-filters">
        <div className="debates-facet">
          <span className="debates-facet__label">分组</span>
          <div className="debates-facet__chips">
            {groups.map((g) => (
              <button key={g.key} type="button" className={`debates-chip ${selGroups.includes(g.key) ? 'debates-chip--on' : ''}`} onClick={() => toggleGroup(g.key)} aria-pressed={selGroups.includes(g.key)} style={selGroups.includes(g.key) ? { borderColor: g.accent } : undefined}>
                <span className="debates-chip__dot" style={{ background: g.accent }} />{g.label}<span className="debates-chip__n">{g.count}</span>
              </button>
            ))}
            {selGroups.length > 0 && <button type="button" className="debates-chip debates-chip--more" onClick={() => { const p = new URLSearchParams(params); p.delete('g'); setParams(p, { replace: true }) }}>全部</button>}
          </div>
        </div>
      </div>

      {sections.map(({ band, items }) => (
        <section key={band.key} className="tl-section">
          <h2 className="tl-section__head">
            <span className="tl-section__era">{band.label}</span>
            <span className="tl-section__years text-faint">{yearText(band.from)} — {yearText(band.to)}</span>
            <span className="tl-section__n text-faint">{items.length} 人</span>
          </h2>
          {items.map((p) => (
            <article key={p.id} id={p.id} className={`renwu-entry ${p.c === 'disputed' ? 'renwu-entry--disputed' : ''}`}>
              <div className="renwu-entry__head">
                <span className="renwu-entry__name">{p.name}</span>
                <span className="renwu-entry__era">{p.label}</span>
                <span className="tl-item__group" style={{ color: p.accent, borderColor: p.accent }}>{p.group}</span>
                {p.c === 'disputed' && <span className="tl-item__flag">生卒不详</span>}
                <Link to={`/timeline#tl-p-${p.id}`} className="renwu-entry__tl">在时间轴上看 ↗</Link>
              </div>
              {p.paragraphs.length
                ? p.paragraphs.map((t, i) => <p key={i} className="renwu-entry__para">{t}</p>)
                : <p className="renwu-entry__para text-faint">{p.note}(小传整理中)</p>}
              <div className="renwu-entry__links">
                {p.books.map((b) => <Link key={b.slug || 'yijing'} to={b.href} className="tl-item__book">《{b.title}》</Link>)}
                {p.school && <Link to={p.school} className="tl-item__book">{p.group} · 一家之来路</Link>}
                {p.extraLinks.map((l) => <Link key={l.to} to={l.to} className="tl-item__book">{l.label}</Link>)}
              </div>
            </article>
          ))}
        </section>
      ))}

      <p className="concepts-page__note text-faint">
        小传守站内四级分级:共识直写,有考证的标出处,存疑的明示,拿不准的不写;不引 20 世纪以后注家的评注。生卒不详者只给活动年代。
      </p>
    </div>
  )
}
