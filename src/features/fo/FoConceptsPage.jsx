import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import RingChart from '../shared/widgets/RingChart.jsx'
import concepts from '../../data/fo/concepts.json'
import ringData from '../../data/fo/rings.json'
import texts from '../../data/fo/texts.json'
import './FoConceptsPage.css'

// 释典 · 名相索引(design-v24 §4)。
// 十部经用的是同一套名相——五蕴、空、无住、不二——却散在各经各品里,而且各经的用法未必一致
// (「自性」在坛经是要见的,在维摩诘经是要破的)。这一页按名相横切:点进去就是那一章。
// 顶部两件环(十二因缘 / 八正道)数据在 src/data/fo/rings.json,每条引文由脚本从原文切片、check-data 回查。
// 研习不宣化:释义只讲「这个词在经里指什么、哪几部经怎么用」,不劝信、不下果报断语。

const SHORT = {
  xinjing: '心经', jingangjing: '金刚', tanjing: '坛经', weimojie: '维摩', amituojing: '弥陀',
  sishierzhang: '四十二章', yijiaojing: '遗教', badaren: '八大人觉', xinxinming: '信心铭', zhengdaoge: '证道歌',
}
const SINGLE = new Set(texts.filter((t) => t.singlePage).map((t) => t.slug))
const hrefOf = (slug, ch) => (SINGLE.has(slug) ? `/fo/${slug}#fo-ch-${ch}` : `/fo/${slug}/${ch}`)

// rings.json 的一项 → RingChart 的一项
function toItem(e) {
  const out = { label: e.label }
  if (e.note) out.note = e.note
  if (e.src) Object.assign(out, { quote: e.src.quote, cite: e.src.label, href: hrefOf(e.src.slug, e.src.ch) })
  return out
}
function ringProps(ring) {
  const p = { items: ring.items.map(toItem), arrows: !!ring.arrows }
  if (ring.loop !== undefined) p.loop = ring.loop
  if (ring.center) p.center = typeof ring.center === 'string' ? ring.center : toItem(ring.center)
  if (ring.foot) p.foot = ring.foot
  return p
}

// 搜索:名相本身命中排前,只在释义 / 落点里提到的排后
function filterClusters(q) {
  const all = concepts.clusters
  if (!q) return { hits: all, also: [] }
  const hits = all.filter((c) => c.term.includes(q))
  const also = all.filter((c) => !c.term.includes(q) && (c.gloss.includes(q) || c.loci.some((l) => l.kw.includes(q) || l.label.includes(q))))
  return { hits, also }
}

function ConceptItem({ c }) {
  const books = new Set(c.loci.map((l) => l.slug)).size
  return (
    <li id={`c-${c.term}`} className="mc-item foc-item">
      <h2 className="mc-item__term">
        {c.term}
        <span className="foc-item__count">{books} 部经 · {c.loci.length} 处</span>
      </h2>
      <p className="mc-item__gloss">{c.gloss}</p>
      <div className="mc-item__loci">
        {c.loci.map((l) => (
          <Link key={`${l.slug}-${l.ch}`} to={hrefOf(l.slug, l.ch)} className="mc-locus foc-locus" title={`原文:「${l.kw}」`}>
            <span className="mc-locus__book">{SHORT[l.slug]}</span>
            {l.label.split('·')[1]}
          </Link>
        ))}
      </div>
    </li>
  )
}

export default function FoConceptsPage() {
  usePageTitle('名相索引', '观空')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const { hits, also } = useMemo(() => filterClusters(q), [q])
  const rings = ringData.rings
  const shown = [...hits, ...also]

  return (
    <div className="foc-page">
      <div className="basics-breadcrumb">
        <Link to="/fo" className="basics-breadcrumb__link">← 释典</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">名相索引</h1>
        <p className="page-subtitle">同一个名相,十部经各在哪一章讲、怎么讲。</p>
      </div>
      <p className="foc-intro">
        先看两个环:<strong>点环上任一支</strong>,看它在经里怎么被说到;顺着十二因缘的箭头走一圈——
        从无明到老死,是一支引出下一支的次第;八正道的八支则并列成环,没有先后箭头。带小点的节点引有经文,
        不带的是十经里查不到专论之句、只释字义。下面的索引按名相横切十部经:<strong>点进去就是那一章</strong>。
        同一个词,各经的用法未必一样——「自性」在坛经是要见的,在维摩诘经是要破的;读完一处再点另一处,分歧自己就看出来了。
      </p>

      <section className="foc-rings" aria-label="名相环">
        {rings.map((ring) => (
          <figure key={ring.id} className="foc-ring" id={`ring-${ring.id}`}>
            <figcaption className="foc-ring__title">{ring.title}</figcaption>
            <RingChart {...ringProps(ring)} />
          </figure>
        ))}
      </section>

      <section className="foc-index" aria-label="名相索引">
        <div className="foc-search">
          <label htmlFor="foc-q" className="foc-search__label">搜名相</label>
          <input
            id="foc-q"
            type="search"
            className="foc-search__input"
            placeholder="如:空、无住、布施"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          {q && (
            <span className="foc-search__stat" aria-live="polite">
              {hits.length ? `名相 ${hits.length} 条` : '无同名名相'}{also.length ? ` · 另有 ${also.length} 条释义或落点提到「${q}」` : ''}
            </span>
          )}
        </div>

        <nav className="mc-jump" aria-label="名相速跳">
          {shown.map((c) => <a key={c.term} href={`#c-${c.term}`} className="mc-jump__item">{c.term}</a>)}
        </nav>

        {shown.length ? (
          <ul className="mc-list">
            {hits.map((c) => <ConceptItem key={c.term} c={c} />)}
            {also.length > 0 && hits.length > 0 && <li className="foc-divider" aria-hidden="true">释义或落点中提到「{q}」的</li>}
            {also.map((c) => <ConceptItem key={c.term} c={c} />)}
          </ul>
        ) : (
          <p className="foc-empty">没有找到「{q}」。可以试试更短的字,如「空」「定」「忍」。</p>
        )}
      </section>

      <p className="foc-fanli">
        凡例:落点均指向该经该品(分)原文,每处都挂有该章原文中确有的字样,由校验逐条回查。释义只讲名相在经中所指与各经用法,
        各经立场不同处(如净土、念佛、四谛)如实并陈,不作裁断;不宣化,不劝信,不下果报断语。环上八正道的八支名目依通行说法
        (十经只提总名「八圣道」);十二因缘、八正道各支凡查不到专论之句的,只释字义、不引经文。
      </p>
    </div>
  )
}
