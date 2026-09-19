import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import { pillarsFromDate, daYun } from '../shared/ganzhi/calendar.js'
import { yinYang } from '../shared/ganzhi/index.js'
import LensCards from './LensCards.jsx'

// 排盘台(design-v23 §9)—— 学堂之后的**练手工具**,不上首屏。
// 学完「四柱怎么排」,自己排一个,用学到的东西读它的结构。
//
// 铁律:**止于结构**。只给四柱、藏干、十神、五行分布、大运排列;不出任何吉凶、性格、运势文字。
// 体系内部自己没统一的两处(子时换日、真太阳时)**给开关,不替用户拍板**。
// 隐私:输入只在本页内存里,不存 localStorage、不进 URL、不上传。

const pad = (n) => String(n).padStart(2, '0')

// 按经度把钟表时间校成「平太阳时」:每偏离东经 120° 一度,差 4 分钟。
// 未计均时差(一年内 ±16 分钟的周期摆动)——如实写在界面上,不装精确。
function shiftByLongitude(t, lng) {
  const d = new Date(t.year, t.month - 1, t.day, t.hour, t.minute)
  d.setMinutes(d.getMinutes() + Math.round((lng - 120) * 4))
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() }
}

export default function PaipanPage() {
  usePageTitle('排盘台', '观数')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('12:00')
  const [gender, setGender] = useState('男')
  const [sect, setSect] = useState(2)
  const [useLng, setUseLng] = useState(false)
  const [lng, setLng] = useState('120')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  async function run(e) {
    e.preventDefault()
    setErr('')
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    const tm = /^(\d{2}):(\d{2})$/.exec(time)
    if (!m || !tm) return setErr('请填完整的出生日期与时间。')
    const year = Number(m[1])
    if (year < 1900 || year > 2100) return setErr('年份请在 1900–2100 之间。')
    let t = { year, month: Number(m[2]), day: Number(m[3]), hour: Number(tm[1]), minute: Number(tm[2]) }
    let shifted = null
    if (useLng) {
      const L = Number(lng)
      if (!Number.isFinite(L) || L < 70 || L > 140) return setErr('经度请填 70–140 之间的数(东经,度)。')
      shifted = shiftByLongitude(t, L)
      t = shifted
    }
    setBusy(true)
    try {
      const [p, yun] = await Promise.all([pillarsFromDate(t, { sect }), daYun(t, gender, { sect })])
      setResult({ ...p, yun, shifted, gender })
    } catch {
      setErr('排盘失败——历法库没能载入,刷新再试一次。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="paipan-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/learn" className="basics-breadcrumb__link">← 学堂</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">排盘台</h1>
        <p className="page-subtitle">学完「四柱怎么排」,自己排一个——然后用学堂里学到的东西,读它的结构。</p>
      </div>

      <div className="shelf-disclaimer">
        ⚠ 这是规则演示,不是预言。本页只把一个时刻按干支历法翻译成四柱、藏干、十神与大运的<strong>排列</strong>,
        不给任何吉凶、性格或运势的判断。你填的时间只在本页内存里,不保存、不上传。
      </div>

      <form className="paipan-form" onSubmit={run}>
        <label className="paipan-field">
          <span>出生日期(公历)</span>
          <input type="date" value={date} min="1900-01-01" max="2100-12-31" onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="paipan-field">
          <span>出生时间(北京时间)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <fieldset className="paipan-field paipan-field--seg">
          <legend>性别 <em>只用来定大运顺逆</em></legend>
          {['男', '女'].map((g) => (
            <button key={g} type="button" className={`paipan-seg${gender === g ? ' is-on' : ''}`} aria-pressed={gender === g} onClick={() => setGender(g)}>{g}</button>
          ))}
        </fieldset>

        <details className="paipan-opts">
          <summary>两处分歧(体系内部自己就没统一,这里只给开关)</summary>
          <fieldset className="paipan-field paipan-field--seg">
            <legend>夜里 23 点到 24 点出生,日柱算哪天?</legend>
            <button type="button" className={`paipan-seg${sect === 2 ? ' is-on' : ''}`} aria-pressed={sect === 2} onClick={() => setSect(2)}>算当天</button>
            <button type="button" className={`paipan-seg${sect === 1 ? ' is-on' : ''}`} aria-pressed={sect === 1} onClick={() => setSect(1)}>算次日</button>
          </fieldset>
          <label className="paipan-check">
            <input type="checkbox" checked={useLng} onChange={(e) => setUseLng(e.target.checked)} />
            <span>按出生地经度校正钟表时间(平太阳时,未计均时差)</span>
          </label>
          {useLng && (
            <label className="paipan-field">
              <span>出生地东经(度)—— 北京约 116.4,上海约 121.5,乌鲁木齐约 87.6</span>
              <input type="number" inputMode="decimal" step="0.1" min="70" max="140" value={lng} onChange={(e) => setLng(e.target.value)} />
            </label>
          )}
        </details>

        {err && <p className="paipan-err" role="alert">{err}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? '排盘中…' : '排盘'}</button>
      </form>

      {result && (
        <section className="paipan-result" aria-live="polite">
          <h2 className="paipan-result__title">四柱</h2>
          <p className="paipan-result__meta">
            农历 {result.lunarText}
            {result.shifted && <> · 已按经度校正为 {pad(result.shifted.hour)}:{pad(result.shifted.minute)}</>}
          </p>
          <WidgetBlock block={{ type: 'widget', kind: 'sizhu', props: { pillars: result.pillars, show: ['shishen', 'canggan', 'nayin', 'changsheng', 'count'] } }} />

          <h2 className="paipan-result__title">大运</h2>
          <p className="paipan-result__meta">
            年干{result.pillars[0][0]}属{yinYang(result.pillars[0][0])},{result.gender}命——大运<strong>{result.yun.forward ? '顺行' : '逆行'}</strong>;
            出生后约 {result.yun.start.years} 年 {result.yun.start.months} 个月起运。
          </p>
          <ol className="paipan-yun">
            {result.yun.list.map((d) => (
              <li key={d.ganzhi + d.startAge}><b>{d.ganzhi}</b><span>{d.startAge} 岁起 · {d.startYear}</span></li>
            ))}
          </ol>
          <p className="paipan-note">
            大运从月柱起,一步管十年。顺逆的规矩出自《三命通会·论大运》:「阳男阴女,大运以生日后未来节气日时为数,顺而行之;
            阴男阳女,大运以生日前过去节气日时为数,逆而行之。」起运岁数按「折除以三日为年」折算。
            ——这里只排出次序;大运「怎么看」,各书说法不同,请去读书。
          </p>
          <h2 className="paipan-result__title">从这张盘去读书</h2>
          <p className="paipan-result__meta">
            同一个八字,三本书会从三个不同的地方下手。下面三格<strong>不是结论,是三本书的目录</strong>:
            告诉你拿着这张盘,该翻到哪一章去读。后两格完全按各书的规则算出,没有一个字的判断;三家说法未必一致,本站不替它们裁断。
          </p>
          <LensCards
            pillars={result.pillars}
            self={(
              <>
                <p className="dc-lens__tag">旺衰 · 《滴天髓》</p>
                <p className="dc-lens__main">先掂量日主</p>
                <p className="dc-lens__body">这一路不查表:先看日主{result.pillars[2][0]}在月令{result.pillars[1][1]}上得不得时,再看四柱里有没有根、有没有帮扶——得自己读。</p>
                <Link to="/mingli/ditiansui/15">《月令》→</Link>
                <Link to="/mingli/ditiansui/17">《衰旺》→</Link>
                <Link to="/mingli/ditiansui/cases">看任铁樵怎么读一张盘 →</Link>
              </>
            )}
          />
          <p className="paipan-next"><Link to="/mingli">回到读书路径 →</Link></p>
        </section>
      )}
    </div>
  )
}
