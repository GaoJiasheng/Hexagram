import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import {
  TOPICS, PLANNED, EPIGRAPH, DIVISIONS, FORMATS, SCHOOL_GROUPS, THINKERS, HAS_ARTICLE,
  categoriesOf, groupsOf, thinkersOf, groupAccent, schoolSeal,
} from './debates.js'

// 《赛博:百家争鸣》辩题库——议题按「义理四门 → 类目」两级铺开;
// 阵营/形态与议题正交(一辩跨 2–4 家),故走多选筛选而非树。筛选态存 URL,可分享可刷新。
function Chips({ title, items, active, onToggle, extra = null }) {
  return (
    <div className="debates-facet">
      <span className="debates-facet__label">{title}</span>
      <div className="debates-facet__chips">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`debates-chip ${active.includes(it.key) ? 'debates-chip--on' : ''}`}
            onClick={() => onToggle(it.key)}
            aria-pressed={active.includes(it.key)}
            style={it.accent && active.includes(it.key) ? { borderColor: it.accent } : undefined}
          >
            {it.accent && <span className="debates-chip__dot" style={{ background: it.accent }} />}
            {it.label}
            <span className="debates-chip__n">{it.count}</span>
          </button>
        ))}
        {extra}
      </div>
    </div>
  )
}

export default function DebateListPage() {
  usePageTitle('百家争鸣')
  const [params, setParams] = useSearchParams()
  const [whoOpen, setWhoOpen] = useState(false)
  const sel = (k) => (params.get(k) || '').split(',').filter(Boolean)
  const divs = sel('div'), schools = sel('school'), fmts = sel('fmt'), who = sel('who')
  const anyFilter = divs.length || schools.length || fmts.length || who.length

  const toggle = (key, value) => {
    const cur = sel(key)
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]
    const p = new URLSearchParams(params)
    if (next.length) p.set(key, next.join(',')); else p.delete(key)
    setParams(p, { replace: true })
  }

  // 同类筛选取并集、跨类取交集(常规分面语义)
  const shown = useMemo(() => TOPICS.filter((t) => (
    (!divs.length || divs.includes(t.division))
    && (!schools.length || groupsOf(t).some((g) => schools.includes(g)))
    && (!fmts.length || fmts.includes(t.format))
    && (!who.length || thinkersOf(t).some((n) => who.includes(n)))
  )), [params])

  // 计数用全集,不随筛选变——空档(如纵横 2)一眼可见,正是补辩题的指引
  const divItems = DIVISIONS.map((d) => ({ ...d, count: TOPICS.filter((t) => t.division === d.key).length }))
  const schoolItems = SCHOOL_GROUPS.map((g) => ({
    key: g, label: schoolSeal(g), accent: groupAccent(g),
    count: TOPICS.filter((t) => groupsOf(t).includes(g)).length,
  }))
  const fmtItems = FORMATS.map((f) => ({ ...f, count: TOPICS.filter((t) => t.format === f.key).length }))
  // 参辩家有 40+ 位、长尾多为一两场,全铺成 chip 太吵:默认只出常客(≥3 场)与已选中的,其余折起。
  const thinkerItems = THINKERS.map((t) => ({ key: t.label, label: t.label, accent: groupAccent(t.group), count: t.count }))
  const regulars = thinkerItems.filter((t) => t.count >= 3 || who.includes(t.key))
  const shownThinkers = whoOpen ? thinkerItems : regulars
  const hiddenCount = thinkerItems.length - regulars.length

  return (
    <div className="debates-list page-content">
      <div className="basics-breadcrumb"><Link to="/hexagram" className="basics-breadcrumb__link">← 诸学门户</Link></div>
      <div className="page-header">
        <h1 className="page-title">赛博 · 百家争鸣</h1>
        <p className="page-subtitle text-soft">诸家就同一题目各执一词,点入看其对辩。会讲而已,不评输赢。</p>
      </div>
      <p className="debates-epigraph">{EPIGRAPH.text} ——《{EPIGRAPH.source}》</p>

      <div className="debates-facets">
        <Chips title="义理" items={divItems} active={divs} onToggle={(v) => toggle('div', v)} />
        <Chips title="阵营" items={schoolItems} active={schools} onToggle={(v) => toggle('school', v)} />
        <Chips
          title="参辩家"
          items={shownThinkers}
          active={who}
          onToggle={(v) => toggle('who', v)}
          extra={hiddenCount > 0 && (
            <button type="button" className="debates-chip debates-chip--more" onClick={() => setWhoOpen(!whoOpen)}>
              {whoOpen ? '收起' : `+${hiddenCount} 位`}
            </button>
          )}
        />
        <Chips title="形态" items={fmtItems} active={fmts} onToggle={(v) => toggle('fmt', v)} />
        {!!anyFilter && (
          <div className="debates-facet__clear">
            <span className="text-soft">筛出 {shown.length} 辩</span>
            <button type="button" className="debates-chip" onClick={() => setParams(new URLSearchParams(), { replace: true })}>清除筛选</button>
          </div>
        )}
      </div>

      {shown.length === 0 && <p className="debates-empty text-soft">这一组条件下暂无辩题——换个阵营或义理门试试。</p>}

      {DIVISIONS.map((d) => {
        const cats = categoriesOf(d.key, shown)
        if (!cats.length) return null
        return (
          <section key={d.key} className="debates-division">
            <div className="debates-division__head">
              <h2 className="debates-division__name">{d.label}</h2>
              <p className="debates-division__desc text-soft">{d.desc}</p>
            </div>
            {cats.map(({ category, topics }) => (
              <div key={category} className="debates-cat-block">
                <div className="debates-cat-block__name">{category}</div>
                <div className="debates-grid">
                  {topics.map((t) => (
                    // 卡片本身是 Link,不能嵌 Link,故导读入口作兄弟节点挂在卡内底部
                    <div key={t.id} className="debate-card-wrap">
                      <Link to={`/debates/${t.id}`} className="debate-card">
                        <div className="debate-card__title">{t.title}</div>
                        <div className="debate-card__q">{t.question}</div>
                        <div className="debate-card__seals">
                          {t.schools.map((s, i) => (
                            <span key={i} className="debate-card__seal" style={{ background: groupAccent(s.group) }} title={`${s.label}·${s.stance}`}>{schoolSeal(s.group)}</span>
                          ))}
                        </div>
                        <div className="debate-card__meta">{t.schools.map((s) => s.label).join(' · ')} · {t.turns} 轮</div>
                      </Link>
                      {HAS_ARTICLE.has(t.id) && (
                        <Link to={`/debates/${t.id}/article`} className="debate-card__guide">白话导读 · 他们在辩什么 ›</Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {PLANNED.length > 0 && (
        <>
          <h2 className="debates-roadmap-title">辩题库 · 陆续上线</h2>
          <div className="debates-roadmap">
            {PLANNED.map((cat) => (
              <div key={cat.category} className="debates-cat">
                <div className="debates-cat__name">{cat.category}</div>
                <ul className="debates-cat__items">
                  {cat.items.map((it, i) => (
                    <li key={i} className="debates-planned"><span className="debates-planned__t">{it.title}</span><span className="debates-planned__p"> · {it.parties}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
