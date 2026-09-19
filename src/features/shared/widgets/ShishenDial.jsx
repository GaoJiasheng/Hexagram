import { useState } from 'react'
import { GAN, WUXING, ganWuxing, yinYang, wuxingRelation, shishen } from '../ganzhi/index.js'
import './ShishenDial.css'

// 十神盘(kind: shishen)—— 本组最关键的一个「顿悟」。
// 十个天干按与日主的关系摆成五组(同我/我生/我克/克我/生我,每组两干:阳阴各一)。
// **十干的物理位置固定不动**(按五行 木火土金水 排列,与 WuxingWheel 同序,视觉可迁移);
// 换日主时只有「组名」与「十神名」重标——这正是要让人看见的:**丙这个字没动,名字变了**。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const REL_LABEL = { 同: '同我', 生: '我生', 克: '我克', 被克: '克我', 被生: '生我' }
const relReason = (dayWx, wx, rel) => ({
  同: `与日主同属${wx}`,
  生: `${dayWx}生${wx}`,
  克: `${dayWx}克${wx}`,
  被克: `${wx}克${dayWx}`,
  被生: `${wx}生${dayWx}`,
}[rel])

// 十干按五行分五组(每组阳干在前、阴干在后),物理顺序与 WuxingWheel 一致、永不因日主而变。
const COLUMNS = WUXING.map((wx) => GAN.filter((g) => ganWuxing(g) === wx))

function renderBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong> : s))
}

function explain(dayGan, g) {
  const dayWx = ganWuxing(dayGan), dayYY = yinYang(dayGan)
  if (g === dayGan) return `${g},${dayYY}${dayWx}。这是日主本身——其余九干的十神,都是拿它当「我」推出来的。`
  const wx = ganWuxing(g), yy = yinYang(g)
  const rel = wuxingRelation(dayWx, wx)
  const same = dayYY === yy
  const name = shishen(dayGan, g)
  return `${g},${yy}${wx}。日主${dayGan}属${dayYY}${dayWx},${relReason(dayWx, wx, rel)} → ${REL_LABEL[rel]};阴阳${same ? '相同' : '相异'} → **${name}**。`
}

export default function ShishenDial({ dayGan: initialDayGan = '甲' }) {
  const [dayGan, setDayGan] = useState(GAN.includes(initialDayGan) ? initialDayGan : '甲')
  const [pick, setPick] = useState(null)
  const dayWx = ganWuxing(dayGan)

  const pickDay = (g) => { setDayGan(g); setPick(null) }
  const togglePick = (g) => setPick((cur) => (cur === g ? null : g))

  return (
    <div className="ss">
      <div className="ss-daybar" role="group" aria-label="选日主">
        <span className="ss-daybar__label">日主</span>
        <div className="ss-daybar__list">
          {GAN.map((g) => (
            <button
              key={g}
              type="button"
              className={`ss-daybtn sz-char--${WX_CLASS[ganWuxing(g)]}${g === dayGan ? ' is-active' : ''}`}
              aria-pressed={g === dayGan}
              onClick={() => pickDay(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="ss-cols" role="group" aria-label={`十神,日主${dayGan}`}>
        {COLUMNS.map((pair, ci) => {
          const wx = WUXING[ci]
          const rel = wuxingRelation(dayWx, wx)
          return (
            <div key={wx} className={`ss-col${wx === dayWx ? ' ss-col--day' : ''}`}>
              <div className="ss-col__head">
                <span key={`${dayGan}-${wx}`} className="ss-col__rel">{REL_LABEL[rel]}</span>
              </div>
              {pair.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`ss-gan sz-char--${WX_CLASS[wx]}${pick === g ? ' is-active' : ''}`}
                  aria-pressed={pick === g}
                  aria-label={`${g}(${g === dayGan ? '日主' : shishen(dayGan, g)})`}
                  onClick={() => togglePick(g)}
                >
                  <span className="ss-gan__char">{g}</span>
                  <span key={`${dayGan}-${g}`} className="ss-gan__name">{g === dayGan ? '日主' : shishen(dayGan, g)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="ss-detail" aria-live="polite">
        {pick ? (
          <p className="ss-detail__body">{renderBold(explain(dayGan, pick))}</p>
        ) : (
          <p className="ss-detail__hint">先选日主,再点任意一个字,看十神是怎么推出来的。</p>
        )}
      </div>
      <p className="ss-foot">十神不是某个字自带的属性——换一个日主,十个名字全部重排。</p>
    </div>
  )
}
