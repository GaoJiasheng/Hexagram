import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadDebate, groupAccent, schoolSeal, EPIGRAPH } from './debates.js'
import { bookBySlug, chapterHref } from '../reader/booksIndex.js'
import { SITE_MAP } from '../../sites/registry.js'
import concepts from '../../data/concepts.json'

// 概念页只收了少数几个跨派聚类;命中才给「义理专题」出链,不硬凑
const CONCEPT_TERMS = new Set(concepts.clusters.map((c) => c.term))

// 引文/导读指向的阅读路由。易经分两路(卦/经传),其余走各站 home + slug + 章。
function readHref({ corpus, slug, ch }) {
  if (corpus === 'yijing') return slug === 'hexagrams' ? `/hexagram/${ch}` : `/classics/${slug}/${ch}`
  const b = bookBySlug(slug)
  return b ? chapterHref(b, ch) : null
}

// A·导读:折在题解之下,默认收起——它是给看不懂「这一驳为什么驳得到」的人备的,
// 不该在读者还没看对辩时就占版面(喧宾夺主正是要避的)。
function Guide({ guide }) {
  const [open, setOpen] = useState(false)
  if (!guide?.length) return null
  return (
    <div className="debate-guide">
      <button className="debate-guide__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="debate-guide__chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
        导读 · 这场在争什么
      </button>
      {open && (
        <div className="debate-guide__body">
          {guide.map((b, i) => {
            if (b.type === 'terms') {
              return (
                <dl key={i} className="debate-guide__terms">
                  {(b.items || []).map((t, j) => (
                    <div key={j} className="debate-guide__term">
                      <dt>{t.t}</dt><dd>{t.g}</dd>
                    </div>
                  ))}
                </dl>
              )
            }
            const href = b.ref ? readHref(b.ref) : null
            return (
              <p key={i} className="debate-guide__p">
                {b.text}
                {href && <Link to={href} className="debate-guide__ref">→ {b.ref.label}</Link>}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

// B·逐句 gloss:折在论点之下。默认收起,免得把「诸家各执一词」的对辩读成带旁白的讲解。
function Gloss({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className="debate-gloss">
      <button className="debate-gloss__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '收起' : '这一句在驳什么'}
      </button>
      {open && <p className="debate-gloss__text">{text}</p>}
    </div>
  )
}

// 圆桌节点坐标:n 家匀布于圆周(自顶部顺时针)
function nodePositions(n, cx, cy, r) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180)
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

// 论辩图谱的一条诘难边(F→T),端点缩到节点边缘,中点垂直微弯(让对向边不重叠)
function edgePath(F, T, sign) {
  const dx = T.x - F.x, dy = T.y - F.y, len = Math.hypot(dx, dy) || 1
  const ux = dx / len, uy = dy / len, pad = 30
  const fx = F.x + ux * pad, fy = F.y + uy * pad
  const tx = T.x - ux * pad, ty = T.y - uy * pad
  const mx = (fx + tx) / 2 + -uy * 16 * sign, my = (fy + ty) / 2 + ux * 16 * sign
  return `M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`
}

export default function DebatePage() {
  const { id } = useParams()
  const [d, setD] = useState(null)
  const [revealed, setRevealed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const timer = useRef(null)

  usePageTitle(d?.title, '百家争鸣')

  useEffect(() => {
    let alive = true
    setD(null); setRevealed(1); setPlaying(false)
    loadDebate(id).then((x) => { if (alive) setD(x) })
    return () => { alive = false }
  }, [id])

  const turns = d ? d.rounds.flatMap((r) => r.turns.map((t) => ({ ...t, phase: r.phase }))) : []
  const total = turns.length

  useEffect(() => {
    if (!playing) return
    if (revealed >= total) { setPlaying(false); return }
    timer.current = setTimeout(() => setRevealed((r) => Math.min(r + 1, total)), 2200)
    return () => clearTimeout(timer.current)
  }, [playing, revealed, total])

  if (!d) {
    return (
      <div className="debate-page page-content">
        <div className="basics-breadcrumb"><Link to="/debates" className="basics-breadcrumb__link">← 百家争鸣</Link></div>
        <p className="text-faint">载入中…</p>
      </div>
    )
  }

  const schools = d.schools
  const byKey = Object.fromEntries(schools.map((s) => [s.key, s]))
  const pos = nodePositions(schools.length, 200, 158, 110)
  const nodeOf = Object.fromEntries(schools.map((s, i) => [s.key, pos[i]]))
  const activeKey = turns[revealed - 1]?.school
  const done = revealed >= total

  // 收束处的出链:读完对辩正想深入某一方,而被引各章几乎都有白话深读(实测 459/459 皆有)。
  // 路由按 corpus/slug 直接构造(与 BaihuaBlock 同一套规则)——不能拿阅读页 href 改写:
  // 单页书(心经/大学/中庸等 9 部被引)的 href 带 #锚点,易经又另走 /hexagram|/classics 两路。
  const deeper = (() => {
    const seen = new Map()
    for (const t of turns) {
      const { corpus, slug, ch, label } = t.cite
      const href = corpus === 'yijing'
        ? (slug === 'hexagrams' ? `/hexagram/${ch}/baihua` : `/classics/${slug}/${ch}/baihua`)
        : `${SITE_MAP[corpus]?.home || ''}/${slug}/baihua/${ch}`
      if (!seen.has(href)) seen.set(href, { href, label })
    }
    return [...seen.values()].slice(0, 6)
  })()
  const conceptHit = CONCEPT_TERMS.has(d.concept) ? d.concept : null

  let lastPhase = null

  return (
    <div className="debate-page page-content">
      <div className="basics-breadcrumb"><Link to="/debates" className="basics-breadcrumb__link">← 百家争鸣</Link></div>

      <div className="debate-head">
        <h1 className="debate-title">{d.title}</h1>
        <p className="debate-question">{d.question}</p>
        <p className="debate-framing text-soft">{d.framing}</p>
        <Guide guide={d.guide} />
      </div>

      {/* 圆桌布阵 + 论辩图谱(合一):印章环坐,诘难成朱线 */}
      {/* viewBox 高度按**实际最低标签**算,不写死:标签在节点 y+42(家名)、y+58(立场),
          再留 8 余量。原本写死 300 —— 4/5 家时最底那圈节点在 y=268,立场小字落到 326、
          出了画布被控制条压掉;而写死成 336 又会让 3 家(最低节点才 213)白多出一截。 */}
      <svg className="debate-graph" viewBox={`0 0 400 ${Math.ceil(Math.max(...pos.map((p) => p.y)) + 66)}`} role="img" aria-label="论辩图谱:各家环坐,诘难关系以朱线相连">
        <defs>
          <marker id="dbt-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" style={{ fill: 'var(--cinnabar)' }} />
          </marker>
        </defs>
        {turns.map((t, i) => {
          if (!t.rebut || !nodeOf[t.rebut]) return null
          const sign = schools.findIndex((s) => s.key === t.rebut) < schools.findIndex((s) => s.key === t.school) ? 1 : -1
          return (
            <path key={`e${i}`} className={`debate-edge ${i < revealed ? 'debate-edge--on' : ''}`}
              d={edgePath(nodeOf[t.rebut], nodeOf[t.school], sign)}
              markerEnd="url(#dbt-arrow)" pathLength="1" />
          )
        })}
        {schools.map((s, i) => (
          <g key={s.key} className={`debate-node ${activeKey === s.key ? 'debate-node--active' : ''}`}
            style={{ animationDelay: `${180 + i * 110}ms` }} transform={`translate(${pos[i].x},${pos[i].y})`}>
            {activeKey === s.key && <circle className="debate-node__ring" r="30" />}
            <rect x="-24" y="-24" width="48" height="48" rx="9" style={{ fill: groupAccent(s.group) }} />
            <text className="debate-node__seal" textAnchor="middle" dominantBaseline="central" y="1">{schoolSeal(s.group)}</text>
            <text className="debate-node__name" textAnchor="middle" y="42">{s.label}</text>
            <text className="debate-node__stance" textAnchor="middle" y="58">{s.stance}</text>
          </g>
        ))}
      </svg>

      {/* 控制条 */}
      <div className="debate-controls">
        <button className="btn btn--secondary" onClick={() => setPlaying((p) => !p)} disabled={done}>
          {playing ? '⏸ 暂停' : '▶ 自动展开'}
        </button>
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setRevealed((r) => Math.min(r + 1, total)) }} disabled={done}>下一句 →</button>
        {/* 「跳到收束」原名易被当作「只看结论」而略过,实为一次铺开全部对辩——想通读的人该点它 */}
        <button className="btn btn--ghost" onClick={() => { setPlaying(false); setRevealed(total) }} disabled={done}>全部展开</button>
        {done && <button className="btn btn--ghost" onClick={() => setRevealed(1)}>↺ 重看</button>}
        <span className="debate-progress">{Math.min(revealed, total)} / {total}</span>
      </div>

      {/* 回合流 */}
      <div className="debate-stream">
        {turns.slice(0, revealed).map((t, i) => {
          const s = byKey[t.school]
          const header = t.phase !== lastPhase
          lastPhase = t.phase
          // 易经经传(系辞/说卦…)在 booksIndex 里只有「易经」一条总目(slug 为 null),
          // 按 slug 查不到书 → 直接走经传阅读路由,否则易经引文没有「读原文」入口。
          const book = bookBySlug(t.cite.slug)
          const srcHref = book ? chapterHref(book, t.cite.ch)
            : t.cite.corpus === 'yijing' ? `/classics/${t.cite.slug}/${t.cite.ch}` : null
          return (
            <div key={i}>
              {header && <div className="debate-phase">{t.phase}</div>}
              <div className="debate-turn" style={{ '--seat': groupAccent(s.group) }}>
                <div className="debate-turn__head">
                  <span className="debate-turn__seal" style={{ background: groupAccent(s.group) }}>{schoolSeal(s.group)}</span>
                  <span className="debate-turn__name">{s.label}</span>
                  {t.rebut && <span className="debate-turn__rebut">驳 · {byKey[t.rebut]?.label}</span>}
                </div>
                <p className="debate-turn__point">{t.point}</p>
                <Gloss text={t.gloss} />
                <div className="debate-turn__cite">
                  <span className="debate-turn__quote">「{t.cite.quote}」</span>
                  {srcHref && <Link to={srcHref} className="debate-turn__src">{t.cite.label} · 读原文 →</Link>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {done && (
        <div className="debate-coda">
          <div className="debate-coda__tag">会讲 · 殊途</div>
          <p className="debate-coda__text">{d.coda}</p>
          {deeper.length > 0 && (
            <div className="debate-deeper">
              <span className="debate-deeper__label">接着深读</span>
              <div className="debate-deeper__links">
                {deeper.map((x) => (
                  <Link key={x.href} to={x.href} className="debate-deeper__link">白话 · {x.label}</Link>
                ))}
                {conceptHit && <Link to="/concepts" className="debate-deeper__link">义理专题 · {d.concept || conceptHit}</Link>}
              </div>
            </div>
          )}
          <p className="debate-coda__epigraph">{EPIGRAPH.text} ——《{EPIGRAPH.source}》</p>
          <Link to="/debates" className="btn btn--secondary">换一辩 →</Link>
        </div>
      )}
    </div>
  )
}
