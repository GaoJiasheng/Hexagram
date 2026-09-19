import { useEffect, useRef, useState } from 'react'
import { ganWuxing, zhiWuxing } from '../ganzhi/index.js'
import './JieqiRing.css'

// 节气年轮 —— 初学者头号误区:八字的「年」从立春换,不从元旦、也不从春节(农历初一)换;
// 「月」从每个「节」换,不从初一换。拖动时间轴,亲眼看见年柱/月柱在哪一刻跳。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const STEP_MIN = 30                 // 拖动步长(分钟)
const DEBOUNCE_MS = 70

let _calendar = null
async function calendar() {
  if (!_calendar) _calendar = await import('../ganzhi/calendar.js')
  return _calendar
}

function parseYmdHms(s) {
  const m = String(s).match(/(\d+)-(\d+)-(\d+)(?:[ T](\d+):(\d+):(\d+))?/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
}
function fieldsFromMs(ms) {
  const d = new Date(ms)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}
function fmtDate(ms) {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
}
function fmtTime(ms) {
  const d = new Date(ms)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
function fmtFull(ms) {
  const d = new Date(ms)
  return `${fmtDate(ms)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`
}

function PillarChars({ gz }) {
  const gan = gz[0], zhi = gz[1]
  return (
    <span className="jq-pillar__gz">
      <span className={`jq-pillar__ch sz-char--${WX_CLASS[ganWuxing(gan)]}`}>{gan}</span>
      <span className={`jq-pillar__ch sz-char--${WX_CLASS[zhiWuxing(zhi)]}`}>{zhi}</span>
    </span>
  )
}

export default function JieqiRing({ year: yearProp }) {
  const [year, setYear] = useState(() => (Number.isInteger(yearProp) ? yearProp : new Date().getFullYear()))
  const [meta, setMeta] = useState(null)       // { marks:[{kind,name,ms}], start, end }
  const [metaError, setMetaError] = useState(false)
  const [metaTry, setMetaTry] = useState(0)
  const [current, setCurrent] = useState(null) // ms(UTC 计算钟)
  const [result, setResult] = useState(null)   // { pillars, lunarText }
  const [pillarError, setPillarError] = useState(false)
  const [flash, setFlash] = useState({ year: false, month: false })

  const reqRef = useRef(0)
  const prevPillars = useRef(null)

  // ── 元数据:十二节交接 + 元旦/春节/立春(含次年立春,补进轴末) ──
  useEffect(() => {
    let alive = true
    setMeta(null); setMetaError(false)
    const start = Date.UTC(year, 0, 1, 0, 0)
    const end = Date.UTC(year + 1, 1, 20, 0, 0)
    calendar().then(async (cal) => {
      const [jb, ny, jbNext] = await Promise.all([cal.jieBoundaries(year), cal.newYearMarks(year), cal.jieBoundaries(year + 1)])
      if (!alive) return
      const lichunNext = jbNext.find((x) => x.name === '立春')
      const jieMarks = jb.map((t) => ({ kind: t.name === '立春' ? 'lichun' : 'jie', name: t.name, ms: parseYmdHms(t.at) }))
      if (lichunNext) jieMarks.push({ kind: 'lichun', name: '立春', ms: parseYmdHms(lichunNext.at) })
      const yuandanMs = parseYmdHms(`${ny.yuandan} 00:00:00`)
      const chunjieMs = parseYmdHms(`${ny.chunjie} 00:00:00`)
      const lichunMs = parseYmdHms(ny.lichun)
      const marks = [
        ...jieMarks,
        { kind: 'yuandan', name: '元旦', ms: yuandanMs },
        { kind: 'chunjie', name: '春节', ms: chunjieMs },
      ]
      setMeta({ marks, start, end, yuandanMs, chunjieMs, lichunMs })
      prevPillars.current = null
      setCurrent(start)
    }).catch(() => { if (alive) setMetaError(true) })
    return () => { alive = false }
  }, [year, metaTry])

  // ── 当前时刻 → 四柱(防抖 + 丢弃过期结果)──
  useEffect(() => {
    if (current == null) return
    const id = ++reqRef.current
    const timer = setTimeout(() => {
      calendar().then((cal) => cal.pillarsFromDate(fieldsFromMs(current))).then((res) => {
        if (reqRef.current !== id) return
        setResult(res)
        setPillarError(false)
      }).catch(() => { if (reqRef.current === id) setPillarError(true) })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [current])

  // ── 跨节/跨立春那一刻,短暂高亮 ──
  useEffect(() => {
    if (!result) return
    const prev = prevPillars.current
    prevPillars.current = result.pillars
    if (!prev) return
    const fy = prev[0] !== result.pillars[0]
    const fm = prev[1] !== result.pillars[1]
    if (fy || fm) {
      setFlash({ year: fy, month: fm })
      const t = setTimeout(() => setFlash({ year: false, month: false }), 900)
      return () => clearTimeout(t)
    }
  }, [result])

  if (metaError) {
    return (
      <div className="jq jq--error">
        <p>历法数据载入失败。</p>
        <button type="button" className="jq-btn" onClick={() => setMetaTry((n) => n + 1)}>重试</button>
      </div>
    )
  }
  if (!meta || current == null) {
    return <div className="jq jq--loading" aria-busy="true"><p>载入历法数据…</p></div>
  }

  const { start, end, yuandanMs, chunjieMs, lichunMs } = meta
  const steps = Math.round((end - start) / (STEP_MIN * 60000))
  const sliderVal = Math.max(0, Math.min(steps, Math.round((current - start) / (STEP_MIN * 60000))))
  const pct = (ms) => Math.min(100, Math.max(0, ((ms - start) / (end - start)) * 100))

  const setCurrentClamped = (ms) => setCurrent(Math.max(start, Math.min(end, ms)))
  const onSlide = (e) => setCurrent(start + Number(e.target.value) * STEP_MIN * 60000)

  // 位置说明:元旦永远最早;春节与立春谁先谁后每年不同。
  const chunjieFirst = chunjieMs < lichunMs
  const second = chunjieFirst ? { key: 'chunjie', ms: chunjieMs } : { key: 'lichun', ms: lichunMs }
  const third = chunjieFirst ? { key: 'lichun', ms: lichunMs } : { key: 'chunjie', ms: chunjieMs }
  let posText
  if (current < yuandanMs) posText = '还没到这一年的元旦。'
  else if (current < second.ms) {
    posText = second.key === 'lichun'
      ? '已过元旦,是新的公历年了,但还没到立春——八字的年柱仍是上一年的。'
      : '已过元旦,是新的公历年了,但农历还是上一年,农历新年(春节)还没到。'
  } else if (current < third.ms) {
    posText = second.key === 'chunjie'
      ? '农历已经是新的一年,但还没到立春——八字的年柱仍是上一年的。'
      : '已过立春,八字年柱已换到新一年,但农历新年(春节)还没到。'
  } else {
    posText = '元旦、春节、立春都已过去,公历年、农历年、干支年三者都已经换到新一年。'
  }
  const curPct = pct(current)

  return (
    <div className="jq">
      <div className="jq-year">
        <button type="button" className="jq-btn jq-btn--sm" onClick={() => setYear((y) => y - 1)} aria-label="上一年">◀</button>
        <span className="jq-year__num">{year} 年</span>
        <button type="button" className="jq-btn jq-btn--sm" onClick={() => setYear((y) => y + 1)} aria-label="下一年">▶</button>
      </div>
      <p className="jq-year__hint">试试 2024 年(立春 2/4 早于春节 2/10)与 2025 年(春节 1/29 早于立春 2/3)。</p>

      <div className="jq-display">
        <div className="jq-now">
          <span className="jq-now__date">{fmtDate(current)} {fmtTime(current)}</span>
          <span className="jq-now__lunar">{result ? `农历${result.lunarText}` : (pillarError ? '农历换算失败' : '换算中…')}</span>
        </div>
        <div className="jq-pillars">
          <div className={`jq-pillar${flash.year ? ' is-flash' : ''}`}>
            <span className="jq-pillar__label">年柱</span>
            {result ? <PillarChars gz={result.pillars[0]} /> : <span className="jq-pillar__gz">--</span>}
          </div>
          <div className={`jq-pillar${flash.month ? ' is-flash' : ''}`}>
            <span className="jq-pillar__label">月柱</span>
            {result ? <PillarChars gz={result.pillars[1]} /> : <span className="jq-pillar__gz">--</span>}
          </div>
        </div>
      </div>

      <div className="jq-ruler">
        <div className="jq-ruler__row jq-ruler__row--year" role="group" aria-label="元旦、春节标记">
          {meta.marks.filter((m) => m.kind === 'yuandan' || m.kind === 'chunjie').map((m, i) => (
            <button
              key={i}
              type="button"
              className={`jq-mark jq-mark--${m.kind}`}
              style={{ left: `${pct(m.ms)}%` }}
              onClick={() => setCurrentClamped(m.ms)}
              title={`${m.name} · ${fmtFull(m.ms)}`}
              aria-label={`跳到${m.name},${fmtFull(m.ms)}`}
            >
              <span className="jq-mark__label">{m.name}</span>
            </button>
          ))}
        </div>
        <div className="jq-cursor-track"><span className="jq-cursor" style={{ left: `${curPct}%` }} /></div>
        <div className="jq-ruler__row jq-ruler__row--jie" role="group" aria-label="十二节与立春标记">
          {meta.marks.filter((m) => m.kind === 'jie' || m.kind === 'lichun').map((m, i) => (
            <button
              key={i}
              type="button"
              className={`jq-mark jq-mark--${m.kind}`}
              style={{ left: `${pct(m.ms)}%` }}
              onClick={() => setCurrentClamped(m.ms)}
              title={`${m.name} · ${fmtFull(m.ms)}`}
              aria-label={`跳到${m.name},${fmtFull(m.ms)}`}
            >
              {m.kind === 'lichun' && <span className="jq-mark__label">{m.name}</span>}
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        className="jq-slider"
        min={0}
        max={steps}
        step={1}
        value={sliderVal}
        onChange={onSlide}
        aria-label="拖动选择公历时刻(1 月 1 日 → 次年立春后)"
      />

      <div className="jq-quick">
        <button type="button" className="jq-btn" onClick={() => setCurrentClamped(yuandanMs)}>跳到元旦</button>
        <button type="button" className="jq-btn" onClick={() => setCurrentClamped(chunjieMs)}>跳到春节</button>
        <button type="button" className="jq-btn" onClick={() => setCurrentClamped(lichunMs - 3600000)}>立春前一小时</button>
        <button type="button" className="jq-btn" onClick={() => setCurrentClamped(lichunMs + 3600000)}>立春后一小时</button>
      </div>

      <div className="jq-detail" aria-live="polite">
        <p>{posText}</p>
      </div>
      <p className="jq-foot">年从立春换,月从「节」换——八字用的是太阳走到哪,不是月亮圆几回。</p>
    </div>
  )
}
