import { useMemo, useRef, useState } from 'react'
import moonData from '../../../data/dao/cantongqi-moon.json'
import trigramList from '../../../data/yijing/trigrams.json'
import HexagramFigure from '../../yijing/components/HexagramFigure.jsx'
import { GAN, ganWuxing } from '../ganzhi/index.js'
import { stationsOf, stationOfGan, ganFang, moonLitPath, yinYangCount, trigramChange, MOON_STATIONS } from './moon.js'
import './widgets.css'
import './MoonDial.css'

// 参同契月相纳甲盘(`moon`,design-v24 §3)。
//
// 盘是一张**方位图**:上南下北、左东右西。月亮在固定时刻看去,一天天往东挪——
//   内圈 = 前半月黄昏所见:初三在西、初八在南、十五在东(震 → 兑 → 乾,阳爻自下一根根长上去);
//   外圈 = 后半月平旦所见:十六在西、二十三在南、三十在东(巽 → 艮 → 坤,阴爻自下一根根替上来)。
// 两回都是西 → 南 → 东,所以同一方位坐着两卦、纳一对天干:庚辛在西、丙丁在南、甲乙在东。
// 剩下戊己归坎离、居中宫;壬癸在北,那里没有月相,原文让它们随甲乙归乾坤。十干就这样分完。
//
// 位置由数据推出(dir → 方位角、seen → 内外圈),引文一字不改取自数据;件内不写规则表。
// 点(或拖)一个月相、点一个天干、或按 ← →,都是换相。

const TRI = Object.fromEntries(trigramList.map((t) => [t.name, t]))
const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }

const VB = 330, C = 165
const R_IN = 80, R_OUT = 112, R_GAN = 138, R_RIM = 156, R_ICON = 9, R_MID = 25
// 日名:内圈往里挂、外圈往外挂(沿半径),指向天干的虚线便不会压到字
const MID_Y = C - 12                                   // 中宫(坎离)小圆的圆心
const FANG_DEG = { 西: 0, 南: -90, 东: -180, 北: 90 }  // 屏幕角:右 0°,顺时针为正
const rad = (d) => (d * Math.PI) / 180
const at = (r, deg) => ({ x: C + r * Math.cos(rad(deg)), y: C + r * Math.sin(rad(deg)) })
const ganDeg = (g) => FANG_DEG[ganFang(g)] + (GAN.indexOf(g) % 2 === 0 ? -14 : 14)
const f1 = (n) => Math.round(n * 10) / 10

const pureBinary = (name) => TRI[name].binary + TRI[name].binary
const chTitle = (ch) => moonData.chapters[String(ch)] || `第${ch}章`

// 两条轨道的锚点(日 → 方位角),由数据的 dir/seen 推出;中间的日子线性插值,仅作示意。
function buildOrbits(phases) {
  const orbit = (seen) => phases.filter((p) => p.seen === seen).map((p) => ({ day: p.day, deg: FANG_DEG[p.dir] }))
  return { inner: orbit('昏'), outer: orbit('旦') }
}
function dayDeg(anchors, day) {
  const a = anchors
  if (day <= a[0].day) return a[0].deg + ((a[1].deg - a[0].deg) / (a[1].day - a[0].day)) * (day - a[0].day)
  for (let i = 1; i < a.length; i++) {
    if (day <= a[i].day) return a[i - 1].deg + ((a[i].deg - a[i - 1].deg) / (a[i].day - a[i - 1].day)) * (day - a[i - 1].day)
  }
  return a[a.length - 1].deg
}

// 阳干 / 阴干的五行色钩子
const wxClass = (g) => `sz-char--${WX_CLASS[ganWuxing(g)]}`

export default function MoonDial({ phase, showHex = true, value, onChange, detail = true }) {
  const stations = useMemo(() => stationsOf(moonData), [])
  const orbits = useMemo(() => buildOrbits(moonData.phases), [])
  const innerMax = orbits.inner[orbits.inner.length - 1].day

  const [inner, setInner] = useState(() => (Number.isInteger(phase) && phase >= 0 && phase < MOON_STATIONS ? phase : 1))
  const cur = Number.isInteger(value) ? value : inner
  const select = (i) => {
    const n = ((i % MOON_STATIONS) + MOON_STATIONS) % MOON_STATIONS
    setInner(n)
    if (onChange && n !== cur) onChange(n)
  }
  const st = stations[cur]

  // 每格在盘上的锚点
  const anchor = (s) => {
    if (s.kind === 'hefu') return { x: C, y: MID_Y }
    const isInner = s.day <= innerMax
    const deg = dayDeg(isInner ? orbits.inner : orbits.outer, s.day)
    return { ...at(isInner ? R_IN : R_OUT, deg), deg, r: isInner ? R_IN : R_OUT }
  }
  const anchors = stations.map(anchor)

  // ── 拖动 / 点选 ─────────────────────────────────────────
  const svgRef = useRef(null)
  const dragging = useRef(false)
  const toLocal = (ev) => {
    const svg = svgRef.current
    const m = svg && svg.getScreenCTM && svg.getScreenCTM()
    if (!m) return null
    return new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse())
  }
  const nearest = (p, max = Infinity) => {
    let best = -1, bd = max
    anchors.forEach((a, i) => { const d = Math.hypot(a.x - p.x, a.y - p.y); if (d < bd) { bd = d; best = i } })
    return best
  }
  const onPointerDown = (ev) => {
    const p = toLocal(ev)
    if (!p) return
    const i = nearest(p, 28)
    if (i < 0) return
    select(i)
    dragging.current = true
    try { svgRef.current.setPointerCapture(ev.pointerId) } catch { /* 不支持即退回点选 */ }
  }
  const onPointerMove = (ev) => {
    if (!dragging.current) return
    const p = toLocal(ev)
    if (!p) return
    const i = nearest(p)
    if (i >= 0 && i !== cur) select(i)
  }
  const endDrag = () => { dragging.current = false }

  const onKeyDown = (ev) => {
    const k = ev.key
    if (k === 'ArrowRight' || k === 'ArrowDown') { ev.preventDefault(); select(cur + 1) }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { ev.preventDefault(); select(cur - 1) }
    else if (k === 'Home') { ev.preventDefault(); select(0) }
    else if (k === 'End') { ev.preventDefault(); select(MOON_STATIONS - 1) }
  }

  // ── 当前格的展示内容 ────────────────────────────────────
  const litGan = new Set(st.gan)
  const valueText = st.kind === 'phase'
    ? `${st.label},${st.src.name}卦,纳${st.src.gan},${st.src.dir}方`
    : st.kind === 'shuo' ? `${st.label},月隐不见` : `${st.label},坎离居中`

  const orbitArc = (r, fromDeg, toDeg) => {
    const a = at(r, fromDeg), b = at(r, toDeg)
    return `M ${f1(a.x)} ${f1(a.y)} A ${r} ${r} 0 0 0 ${f1(b.x)} ${f1(b.y)}`
  }
  const innerFirst = dayDeg(orbits.inner, 1)

  return (
    <div className="moon" onKeyDown={onKeyDown}>
      <div
        className="moon-dial"
        role="slider"
        tabIndex={0}
        aria-label="月相纳甲盘(← → 换相)"
        aria-valuemin={0}
        aria-valuemax={MOON_STATIONS - 1}
        aria-valuenow={cur}
        aria-valuetext={valueText}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB} ${VB}`}
          className="moon-svg"
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <circle cx={C} cy={C} r={R_RIM} className="moon-rim" style={{ fill: 'none' }} />

          {/* 两条轨道:内圈前半月(昏)、外圈后半月(旦);朔在西方地平之下,虚线 */}
          <path d={orbitArc(R_IN, 0, -180)} className="moon-orbit moon-orbit--hun" style={{ fill: 'none' }} />
          <path d={orbitArc(R_OUT, 0, -180)} className="moon-orbit moon-orbit--dan" style={{ fill: 'none' }} />
          <path d={orbitArc(R_IN, innerFirst, 0)} className="moon-orbit moon-orbit--hidden" style={{ fill: 'none' }} />
          <text {...(() => { const p = at(R_IN - 14, -45); return { x: f1(p.x), y: f1(p.y) } })()} className="moon-orbit-tag" textAnchor="middle" dominantBaseline="central">昏</text>
          <text {...(() => { const p = at(R_OUT - 14, -45); return { x: f1(p.x), y: f1(p.y) } })()} className="moon-orbit-tag" textAnchor="middle" dominantBaseline="central">旦</text>

          {/* 一月三十日的刻度(非节点日) */}
          {Array.from({ length: 30 }, (_, i) => i + 1)
            .filter((d) => !stations.some((s) => s.day === d))
            .map((d) => {
              const isInner = d <= innerMax
              const p = at(isInner ? R_IN : R_OUT, dayDeg(isInner ? orbits.inner : orbits.outer, d))
              return <circle key={d} cx={f1(p.x)} cy={f1(p.y)} r={1.6} className="moon-tick" />
            })}

          {/* 十干方位环:甲乙东、丙丁南、庚辛西、壬癸北(戊己在中宫) */}
          {['东', '南', '西', '北'].map((f) => {
            const p = at(R_RIM, FANG_DEG[f])
            const on = (st.kind === 'phase' && st.src.dir === f) || (st.kind === 'shuo' && f === '北')
            return (
              <g key={f} className={`moon-fang${on ? ' is-on' : ''}`} transform={`translate(${f1(p.x)}, ${f1(p.y)})`}>
                <circle r={7.5} className="moon-fang__disc" />
                <text className="moon-fang__ch" textAnchor="middle" dominantBaseline="central">{f}</text>
              </g>
            )
          })}
          {GAN.filter((g) => ganFang(g) !== '中').map((g) => {
            const p = at(R_GAN, ganDeg(g))
            const on = litGan.has(g)
            const target = stationOfGan(stations, g)
            return (
              <g
                key={g}
                className={`moon-gan ${wxClass(g)}${on ? ' is-on' : ''}`}
                transform={`translate(${f1(p.x)}, ${f1(p.y)})`}
                onClick={() => target >= 0 && select(target)}
              >
                <title>{`${g}·${ganWuxing(g)}·${ganFang(g)}方`}</title>
                <circle r={10} className="moon-gan__disc" />
                <text className="moon-gan__ch" textAnchor="middle" dominantBaseline="central">{g}</text>
              </g>
            )
          })}

          {/* 当前月相 → 它所纳天干:一条虚线,方位与天干一眼对上 */}
          {st.kind === 'phase' && (() => {
            const a = anchors[cur]
            const g = at(R_GAN - 13, ganDeg(st.src.gan))
            return <line x1={f1(a.x)} y1={f1(a.y)} x2={f1(g.x)} y2={f1(g.y)} className="moon-pointer" />
          })()}

          {/* 中宫:坎戊(月)· 离己(日),常显 */}
          <g className={`moon-mid${st.kind === 'hefu' ? ' is-on' : ''}`} onClick={() => select(7)}>
            <circle cx={C} cy={MID_Y} r={R_MID} className="moon-mid__disc" />
            {moonData.center.map((c, i) => (
              <text key={c.key} x={C} y={MID_Y + (i === 0 ? -7 : 8)} className="moon-mid__txt" textAnchor="middle" dominantBaseline="central">
                <tspan>{c.name}</tspan><tspan className={`moon-mid__gan ${wxClass(c.gan)}`}>{c.gan}</tspan>
              </text>
            ))}
          </g>

          {/* 月相节点 */}
          {stations.filter((s) => s.kind !== 'hefu').map((s) => {
            const a = anchors[s.idx]
            const lit = moonLitPath(s.day, R_ICON)
            const on = s.idx === cur
            const lab = s.kind === 'shuo'
              ? { x: a.x + R_ICON + 6, y: a.y + 1, anchor: 'start' }
              : { ...at(a.r === R_IN ? R_IN - 25 : R_OUT + 23, a.deg), anchor: 'middle' }
            return (
              <g key={s.key} className={`moon-node${on ? ' is-on' : ''}`}>
                <g transform={`translate(${f1(a.x)}, ${f1(a.y)})`}>
                  {on && <circle r={R_ICON + 4.5} className="moon-node__sel" />}
                  <circle r={R_ICON} className="moon-node__dark" />
                  {lit && <path d={lit} className="moon-node__lit" />}
                  <circle r={R_ICON} className="moon-node__rim" style={{ fill: 'none' }} />
                  <circle r={19} className="moon-node__hit" style={{ fill: 'transparent' }} />
                </g>
                <text x={f1(lab.x)} y={f1(lab.y)} className="moon-node__label" textAnchor={lab.anchor} dominantBaseline="central">{s.label}</text>
              </g>
            )
          })}

          {/* 下半盘(北):当前这一格的卦画、卦名、纳甲、方位 */}
          <CenterReadout st={st} showHex={showHex} />
        </svg>
      </div>

      <div className="moon-step">
        <button type="button" className="moon-step__btn" onClick={() => select(cur - 1)} aria-label="上一相">‹</button>
        <span className="moon-step__now">{st.kind === 'phase' ? `${st.label} · ${st.src.name}` : st.label}</span>
        <button type="button" className="moon-step__btn" onClick={() => select(cur + 1)} aria-label="下一相">›</button>
      </div>

      {/* 六相一排:西南东 | 西南东 —— 方位两回重复,天干因此成对 */}
      <div className="moon-strip" role="group" aria-label="六个月相">
        {[['昏', '前半月 · 黄昏看 · 阳自下长'], ['旦', '后半月 · 平旦看 · 阴自下长']].map(([seen, cap]) => (
          <div key={seen} className="moon-strip__half">
            <p className="moon-strip__cap">{cap}</p>
            <div className="moon-strip__cells">
              {stations.filter((s) => s.kind === 'phase' && s.src.seen === seen).map((s) => (
                <button
                  key={s.key} type="button"
                  className={`moon-strip__cell${s.idx === cur ? ' is-on' : ''}`}
                  aria-pressed={s.idx === cur}
                  onClick={() => select(s.idx)}
                >
                  <span className="moon-strip__tri" aria-hidden="true">{TRI[s.src.name].symbol}</span>
                  <span className="moon-strip__name">{s.src.name}<b className={wxClass(s.src.gan)}>{s.src.gan}</b></span>
                  <span className="moon-strip__dir">{s.src.dir}</span>
                  <span className="moon-strip__day">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {detail && <MoonDetail st={st} stations={stations} />}

      <p className="moon-foot">盘为方位图:上南下北、左东右西。月轮按真实盈亏示意,卦画按原文取象;昏旦之分是通行解说,原文只在巽一相写明「平明」。</p>
    </div>
  )
}

// 下半盘读数。六画卦画复用 HexagramFigure(嵌在 SVG 里);key 用卦序,换相即重挂,不走它的逐爻动画。
function CenterReadout({ st, showHex }) {
  const X = C + 2   // 文字列起点
  if (st.kind === 'hefu') {
    return (
      <g className="moon-read">
        {moonData.center.map((c, i) => {
          const x0 = i === 0 ? C - 50 : C + 10
          return (
            <g key={c.key}>
              {showHex
                ? <g transform={`translate(${x0}, ${C + 30})`} style={{ fill: 'var(--ink)' }}><HexagramFigure key={c.hex} binary={pureBinary(c.name)} size="sm" label={`${c.name}卦`} /></g>
                : <text x={x0 + 20} y={C + 62} className="moon-read__sym" textAnchor="middle" dominantBaseline="central">{TRI[c.name].symbol}</text>}
              <text x={x0 + 20} y={C + 102} className="moon-read__sub" textAnchor="middle" dominantBaseline="central">
                {c.name} · <tspan className={`moon-read__gan ${wxClass(c.gan)}`}>{c.gan}</tspan> · {c.role}
              </text>
            </g>
          )
        })}
      </g>
    )
  }
  if (st.kind === 'shuo') {
    return (
      <g className="moon-read">
        <circle cx={C - 30} cy={C + 62} r={18} className="moon-read__newmoon" />
        <text x={X} y={C + 50} className="moon-read__name" dominantBaseline="central">{st.label}</text>
        <text x={X} y={C + 79} className="moon-read__sub" dominantBaseline="central">月隐不见</text>
        <text x={X} y={C + 97} className="moon-read__sub" dominantBaseline="central">
          {st.gan.map((g) => <tspan key={g} className={`moon-read__gan ${wxClass(g)}`}>{g}</tspan>)} 随甲乙
        </text>
      </g>
    )
  }
  const p = st.src
  return (
    <g className="moon-read">
      {showHex
        ? <g transform={`translate(${C - 50}, ${C + 34})`} style={{ fill: 'var(--ink)' }}><HexagramFigure key={p.hex} binary={pureBinary(p.name)} size="sm" label={`${p.name}卦`} /></g>
        : <text x={C - 30} y={C + 62} className="moon-read__sym" textAnchor="middle" dominantBaseline="central">{TRI[p.name].symbol}</text>}
      <text x={X} y={C + 48} className="moon-read__name" dominantBaseline="central">
        {p.name}{showHex && <tspan className="moon-read__tri" dx="4">{TRI[p.name].symbol}</tspan>}
      </text>
      <text x={X} y={C + 79} className="moon-read__sub" dominantBaseline="central">
        纳 <tspan className={`moon-read__gan ${wxClass(p.gan)}`}>{p.gan}</tspan>
      </text>
      <text x={X} y={C + 97} className="moon-read__sub" dominantBaseline="central">{p.dir}方 · {p.seen === '昏' ? '昏见' : '旦见'}</text>
    </g>
  )
}

// 件自带的「这一格」说明(页面另有详情栏时传 detail={false})。只有原文与取象,不下断语。
function MoonDetail({ st, stations }) {
  let head, sub = null, quotes, note
  if (st.kind === 'phase') {
    const p = st.src
    const prev = stations[st.idx === 1 ? 6 : st.idx - 1].src
    const bin = TRI[p.name].binary
    head = `${st.label} · ${p.name}${TRI[p.name].symbol} · 纳${p.gan} · ${p.dir}方`
    sub = `${yinYangCount(bin)};比上一相(${prev.name}),${trigramChange(TRI[prev.name].binary, bin)}。`
    quotes = [p]
    note = p.note
  } else if (st.kind === 'shuo') {
    head = `${st.label} · 月隐不见 · ${st.gan.join('')}`
    quotes = [st.src, st.src.also]
    note = st.src.note
  } else {
    head = `${st.label} · ${moonData.center.map((c) => c.name + c.gan).join(' ')} 居中`
    quotes = [st.src, ...moonData.center, moonData.centerNote]
    note = st.src.note
  }
  return (
    <div className="moon-detail" aria-live="polite">
      <p className="moon-detail__head">{head}</p>
      {sub && <p className="moon-detail__sub">{sub}</p>}
      <ul className="moon-detail__quotes">
        {quotes.map((q, i) => (
          <li key={i}><q className="moon-detail__q">{q.quote}</q><span className="moon-detail__src">——《{chTitle(q.ch)}》</span></li>
        ))}
      </ul>
      {note && <p className="moon-detail__note">{note}</p>}
    </div>
  )
}
