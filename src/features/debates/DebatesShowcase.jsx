import { Link } from 'react-router-dom'
import { TOPICS, DIVISIONS, EPIGRAPH, pickDailyDebate, groupAccent, schoolSeal } from './debates.js'

// 首页的「赛博 · 百家争鸣」段(owner 2026-09-30:提成与「诸学门户」平行的大标题,在首页展开)。
// 与书架同一套页头样式、同一条 1120px 网格线:左 2 列是今日一辩(日期 hash 定题,与 /debates 弹窗同一算法),
// 右 3 列是义理四门(点进去即带筛选的辩题列表)+ 全部辩题 / 诸子拓扑图两个出口。
// 只在 `/` 出;/hexagram 仍是原来那条紧凑横幅(那儿是换书的地方,不铺开)。
export default function DebatesShowcase() {
  const today = pickDailyDebate()
  if (!today) return null
  const d = new Date()
  const dateTag = `${d.getMonth() + 1} 月 ${d.getDate()} 日`
  const divItems = DIVISIONS.map((x) => ({ ...x, count: TOPICS.filter((t) => t.division === x.key).length }))
  return (
    <section className="dshow" aria-label="赛博 · 百家争鸣">
      <header className="master-portal__head">
        <h2 className="master-portal__title">赛博 · 百家争鸣</h2>
        <p className="master-portal__sub">{TOPICS.length} 场跨派对辩 · 四门八类 · 会讲而已，不评输赢 · 每句引文逐字校过是原文</p>
      </header>
      <p className="dshow__epigraph">{EPIGRAPH.text} ——《{EPIGRAPH.source}》</p>
      <div className="dshow__grid">
        <Link to={`/debates/${today.id}`} className="dshow__today">
          <span className="dshow__eyebrow">今日一辩 · {dateTag}</span>
          <span className="dshow__title">{today.title}</span>
          <span className="dshow__q">{today.question}</span>
          <span className="dshow__seals">
            {today.schools.map((s, i) => (
              <span key={i} className="dshow__side">
                <span className="dshow__seal" style={{ background: groupAccent(s.group) }}>{schoolSeal(s.group)}</span>
                <span className="dshow__who">{s.label}<span className="dshow__stance">{s.stance}</span></span>
              </span>
            ))}
          </span>
          <span className="dshow__go">进去看 ›</span>
        </Link>
        <div className="dshow__right">
          <div className="dshow__doors">
            {divItems.map((x) => (
              <Link key={x.key} to={`/debates?div=${x.key}`} className="dshow__door">
                <span className="dshow__door-head"><span className="dshow__door-name">{x.label}</span><span className="dshow__door-n">{x.count} 辩</span></span>
                <span className="dshow__door-desc">{x.desc}</span>
              </Link>
            ))}
          </div>
          <div className="dshow__links">
            <Link to="/debates" className="dshow__link">全部 {TOPICS.length} 辩 ›</Link>
            <Link to="/debates/map" className="dshow__link">诸子拓扑图 · 他们历史上真的怎么说彼此 ›</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
