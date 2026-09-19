import { useState } from 'react'
import { GAN, ZHI, GAN_HE, ganWuxing, monthGan, hourGan } from '../ganzhi/index.js'
import './QizhuDemo.css'

// 起柱演示(kind: qizhu)—— 五虎遁(年上起月)/ 五鼠遁(日上起时)。
// 选一个年干(或日干)→ 十二格自动顺推出十二个干支;旁边亮出对应口诀的那一句,
// 并把口诀翻成「人话」:起头定了,后面只是顺着天干一格一格数下去。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }

const MONTH_ORDER = [...ZHI.slice(2), ...ZHI.slice(0, 2)] // 寅…丑,正月建寅
const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const HOUR_RANGE = ['23–1', '1–3', '3–5', '5–7', '7–9', '9–11', '11–13', '13–15', '15–17', '17–19', '19–21', '21–23']

// 口诀取《三命通会·论遁月时》原文(与 ganzhi/index.js 的引用一致,不用坊间通行的异文)。
const WUHU = ['甲己之年丙作首', '乙庚之岁戊为头', '丙辛之岁寻庚上', '丁壬壬位顺行流', '更有戊癸何处起,甲寅之上好追求']
const WUSHU = ['甲己还加甲', '乙庚丙作初', '丙辛从戊起', '丁壬庚子居', '戊癸何方发,壬子是直途']

function renderBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong> : s))
}

function explainCell(idx, headGan, gz, isMonth) {
  const unit = isMonth ? '月' : '时'
  if (idx === 0) return `口诀给的起头就是这一格:**${gz}**——后面十一格,都从它顺着天干往下数。`
  return `距起头已过 ${idx} 位${unit},天干从起头顺数 ${idx} 步 → **${gz}**。`
}

export default function QizhuDemo({ which: initialWhich = 'month', gan: initialGan = '甲' }) {
  const [which, setWhich] = useState(initialWhich === 'hour' ? 'hour' : 'month')
  const [gan, setGan] = useState(GAN.includes(initialGan) ? initialGan : '甲')
  const [pick, setPick] = useState(null)

  const isMonth = which === 'month'
  const order = isMonth ? MONTH_ORDER : ZHI
  const labels = isMonth ? MONTH_NAMES : ZHI.map((z, i) => `${z}时 ${HOUR_RANGE[i]}`)
  const verses = isMonth ? WUHU : WUSHU
  const compute = (zhi) => (isMonth ? monthGan(gan, zhi) : hourGan(gan, zhi))
  const heIdx = GAN_HE.findIndex(({ pair }) => pair.includes(gan))

  const switchWhich = (w) => { if (w !== which) { setWhich(w); setPick(null) } }
  const pickGan = (g) => { setGan(g); setPick(null) }
  const toggleCell = (i) => setPick((cur) => (cur === i ? null : i))

  return (
    <div className="qz">
      <div className="qz-tabs" role="tablist" aria-label="起柱方式">
        <button type="button" role="tab" aria-selected={isMonth} className={`qz-tab${isMonth ? ' is-active' : ''}`} onClick={() => switchWhich('month')}>
          年上起月<span className="qz-tab__sub">五虎遁</span>
        </button>
        <button type="button" role="tab" aria-selected={!isMonth} className={`qz-tab${!isMonth ? ' is-active' : ''}`} onClick={() => switchWhich('hour')}>
          日上起时<span className="qz-tab__sub">五鼠遁</span>
        </button>
      </div>

      <div className="qz-ganbar" role="group" aria-label={isMonth ? '选年干' : '选日干'}>
        <span className="qz-ganbar__label">{isMonth ? '年干' : '日干'}</span>
        <div className="qz-ganbar__list">
          {GAN.map((g) => (
            <button
              key={g}
              type="button"
              className={`qz-ganbtn sz-char--${WX_CLASS[ganWuxing(g)]}${g === gan ? ' is-active' : ''}`}
              aria-pressed={g === gan}
              onClick={() => pickGan(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="qz-grid" role="group" aria-label={isMonth ? '十二月干支' : '十二时干支'}>
        {order.map((zhi, i) => {
          const g = compute(zhi)
          const gz = g + zhi
          const active = pick === i
          return (
            <button
              key={zhi}
              type="button"
              className={`qz-cell${active ? ' is-active' : ''}${i === 0 ? ' qz-cell--head' : ''}`}
              aria-pressed={active}
              aria-label={`${labels[i]}:${gz}${i === 0 ? '(口诀起头)' : ''}`}
              onClick={() => toggleCell(i)}
            >
              {i === 0 && <span className="qz-cell__flag">起</span>}
              <span className="qz-cell__gz">{gz}</span>
              <span className="qz-cell__label">{labels[i]}</span>
            </button>
          )
        })}
      </div>

      <div className="qz-detail" aria-live="polite">
        {pick !== null ? (
          <p className="qz-detail__body">{renderBold(explainCell(pick, gan, compute(order[pick]) + order[pick], isMonth))}</p>
        ) : (
          <p className="qz-detail__hint">点一格,看这个干支是怎么顺数出来的。</p>
        )}
      </div>

      <div className="qz-verse" aria-label="口诀">
        {verses.map((line, i) => (
          <p key={i} className={`qz-verse__line${i === heIdx ? ' is-active' : ''}`}>{line}</p>
        ))}
      </div>
      <p className="qz-plain">
        人话:起头的干定了,后面只是顺着天干一格一格往下排;<b>甲与己、乙与庚、丙与辛、丁与壬、戊与癸</b>——
        这五对「天干五合」起的是同一个头,所以口诀只有五句,不是十句。
      </p>
      <p className="qz-foot">口诀背后只是一个取余:十个年干,只有五种起法。</p>
    </div>
  )
}
