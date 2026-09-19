import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GAN, ZHI, ganWuxing } from '../ganzhi/index.js'
import { determineGeju, SHUN_NI_QUOTE, GEJU_NOTES as NOTE } from '../ganzhi/geju.js'
import './GejuFlow.css'

// 格局判定流程图(kind: geju)—— 《子平真诠》全书的「入口」。
// 沈孝瞻取格只问一件事:「八字用神,专求月令,以日干配月令地支」。
// 这里把这句话拆成四步让人亲手走一遍:选日主 → 选月令 → 看月令里藏着谁、各是什么十神
// → 谁透出来谁作主 → 得出格名,并指向讲这一格的那一章。
// **到格名为止**:格局成败高低要看整个八字,书里用了四十章去讲,不是一个件答得了的。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
// 月支 → 月份(以节气分月,寅 = 正月)
const MONTH_OF = { 寅: '正月', 卯: '二月', 辰: '三月', 巳: '四月', 午: '五月', 未: '六月', 申: '七月', 酉: '八月', 戌: '九月', 亥: '十月', 子: '十一月', 丑: '十二月' }
const MONTH_ZHI = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']
const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' }

const BASE = '/mingli/zhenquan'
const REASON = {
  'benqi-default': '没有标透干 → 按月令本气论',
  'benqi-tou': '本气透出 → 本气作主',
  'other-tou': '本气未透、它透了 → 它作主',
}

export default function GejuFlow({ dayGan: d0 = '甲', monthZhi: z0 = '辰', tou: t0 = [] }) {
  const [dayGan, setDayGan] = useState(GAN.includes(d0) ? d0 : '甲')
  const [monthZhi, setMonthZhi] = useState(ZHI.includes(z0) ? z0 : '辰')
  const [tou, setTou] = useState(t0)

  // 换日主/月令后,旧的透干未必还在新月令的藏干里 → 一并清掉
  const pickDay = (g) => { setDayGan(g); setTou([]) }
  const pickZhi = (z) => { setMonthZhi(z); setTou([]) }
  const toggleTou = (g) => setTou((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]))

  const r = determineGeju(dayGan, monthZhi, tou)
  const quote = SHUN_NI_QUOTE[r.geju.name]

  return (
    <div className="gj">
      <div className="gj-step">
        <p className="gj-step__head"><span className="gj-step__no">一</span>日主是谁</p>
        <div className="gj-picks" role="group" aria-label="选日主">
          {GAN.map((g) => (
            <button key={g} type="button" aria-pressed={g === dayGan}
              className={`gj-pick sz-char--${WX_CLASS[ganWuxing(g)]}${g === dayGan ? ' is-active' : ''}`}
              onClick={() => pickDay(g)}>{g}</button>
          ))}
        </div>
      </div>

      <div className="gj-step">
        <p className="gj-step__head"><span className="gj-step__no">二</span>生在哪个月<span className="gj-step__aside">月支就是「月令」</span></p>
        <div className="gj-picks gj-picks--zhi" role="group" aria-label="选月令">
          {MONTH_ZHI.map((z) => (
            <button key={z} type="button" aria-pressed={z === monthZhi}
              className={`gj-pick gj-pick--zhi sz-char--${WX_CLASS[ZHI_WX[z]]}${z === monthZhi ? ' is-active' : ''}`}
              onClick={() => pickZhi(z)}>
              {z}<small>{MONTH_OF[z]}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="gj-step">
        <p className="gj-step__head"><span className="gj-step__no">三</span>{monthZhi}里藏着谁<span className="gj-step__aside">点一下 = 它透到了年、月、时干上</span></p>
        <div className="gj-cang">
          {r.cang.map((c) => (
            <button key={c.gan} type="button" aria-pressed={c.tou}
              className={`gj-cangbtn sz-char--${WX_CLASS[ganWuxing(c.gan)]}${c.tou ? ' is-tou' : ''}${c === r.main ? ' is-main' : ''}`}
              onClick={() => toggleTou(c.gan)}>
              <span className="gj-cangbtn__role">{c.role}</span>
              <span className="gj-cangbtn__gan">{c.gan}</span>
              <span className="gj-cangbtn__ss">{c.shishen}</span>
              <span className="gj-cangbtn__tou">{c.tou ? '已透' : '未透'}</span>
            </button>
          ))}
        </div>
        <p className="gj-reason">
          {REASON[r.reason]}:<b>{r.main.gan}</b>,对日主{dayGan}是<b>{r.main.shishen}</b>。
          {r.kind === 'yangren' && <> 而{monthZhi}正是{dayGan}的「禄前一位」——阳干到了这个位置,原书不叫劫、叫<b>刃</b>。</>}
        </p>
      </div>

      <div className="gj-result" aria-live="polite">
        <p className="gj-step__head"><span className="gj-step__no">四</span>所以这一格叫</p>
        <p className="gj-result__name">{r.geju.name}
          <span className={`gj-result__use gj-result__use--${r.geju.use === '顺' ? 'shun' : 'ni'}`}>{r.geju.use}用</span>
        </p>
        {r.jian.length > 0 && (
          <p className="gj-result__jian">兼:{r.jian.map((c) => `${c.gan}(${c.shishen})`).join('、')}</p>
        )}
        <blockquote className="gj-quote">
          {quote}
          <cite>《论用神》· 原书语,照录</cite>
        </blockquote>
        <p className="gj-result__link"><Link to={`${BASE}/${r.geju.ch}`}>去读讲这一格的那一章 →</Link></p>
      </div>

      {r.notes.length > 0 && (
        <ul className="gj-notes">
          {r.notes.map((k) => NOTE[k] && (
            <li key={k} className="gj-note">
              <p className="gj-note__say">{NOTE[k].say}</p>
              <p className="gj-note__quote">「{NOTE[k].quote}」<Link to={`${BASE}/${NOTE[k].ch}`}>《{NOTE[k].title}》</Link></p>
            </li>
          ))}
        </ul>
      )}

      <p className="gj-foot">
        到格名为止。地支三合会局也会让用神变化(《论用神变化》「丁生亥月，本为正官，支全卯未，则化为印」),
        格局的成败、救应、高低更要看整个八字——原书用了四十章去讲,请去读书。
      </p>
    </div>
  )
}
