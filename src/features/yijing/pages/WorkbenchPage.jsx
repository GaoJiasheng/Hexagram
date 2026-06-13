import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import HexagramFigure from '../components/HexagramFigure.jsx'
import TrigramBadge from '../components/TrigramBadge.jsx'
import RuleCard from '../components/RuleCard.jsx'
import EmptyState from '../components/EmptyState.jsx'
import DayanCast from '../components/DayanCast.jsx'
import TermTip from '../components/TermTip.jsx'
import XianTianTable from '../components/XianTianTable.jsx'
import GuideTour from '../components/GuideTour.jsx'
import { allHexagrams, trigramById, TRIGRAM_ORDER, hexagramById, hexagramByBinary } from '../data.js'
import { getBianGua, getHuGua, getCuoGua, getZongGua, lineTitle } from '../engine/transforms.js'
import { getDivinationResult } from '../engine/divination.js'
import { analyzePosition, describePosition, analyzeAllPositions } from '../engine/positions.js'
import { qiGuaByTime, qiGuaByNumber, calcTiYong, paramDuan, hourToShiZhi } from '../engine/meihua.js'
import { castHexagram, cryptoRng, LINE_LABELS } from '../engine/dayan.js'
import { tossLine, tossHexagram, linesToGua, COIN_LABELS, COIN_CHOICES } from '../engine/jinqian.js'
import { saveDivination, markMethodUsed } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const LINE_NAMES = ['初', '二', '三', '四', '五', '上']

// 各方法对应的教学页(v3 §7.1)
const LEARN_LINKS = {
  trigram: ['/basics/yinyang', '不认识这些符号？学阴阳八卦'],
  line: ['/basics/yinyang', '学阴阳与爻'],
  meihua: ['/basics/meihua', '学梅花易数'],
  dayan: ['/basics/shicao', '学揲蓍成卦'],
  jinqian: ['/basics/jinqian', '学金钱卦'],
}

// 起卦六法分两类:已知卦直接输入 / 现场起卦占问;每法一句白话用法(新手引导)
const METHOD_GROUPS = [
  {
    label: '① 已经知道是哪一卦',
    methods: [
      ['trigram', '上下卦', '分别点上卦、下卦两个三爻符号，拼成一卦。'],
      ['line', '逐爻', '从初爻到上爻逐条点阴/阳，调成你要的卦。'],
      ['search', '检索', '输入卦名、拼音或卦序，直接找到那一卦。'],
    ],
  },
  {
    label: '② 现场起一卦来占问',
    methods: [
      ['meihua', '梅花', '梅花易数：按时间或数字起卦，自带一个动爻。'],
      ['dayan', '大衍', '大衍揲蓍：模拟四十九根蓍草十八变，古法正宗。'],
      ['jinqian', '金钱', '金钱卦：六次掷三枚铜钱，背面记数定爻。'],
    ],
  },
]
const METHOD_HINT = Object.fromEntries(METHOD_GROUPS.flatMap(g => g.methods.map(([k, , hint]) => [k, hint])))

// 常驻步骤条(v12 §1):按 hex/动爻 状态点亮,纯指示不可点
function StepBar({ hex, movingLines }) {
  const steps = ['起卦', '标动爻', '读断法']
  return (
    <ol className="wb-steps" aria-label="推演三步">
      {steps.map((s, i) => {
        // ① 无卦时进行中、有卦打勾;②③ 有卦即可进行
        const state = i === 0 ? (hex ? 'done' : 'cur') : hex ? 'cur' : 'todo'
        return (
          <li key={s} className={`wb-step wb-step--${state}`}>
            <span className="wb-step__no">{state === 'done' ? '✓' : i + 1}</span>
            <span className="wb-step__label">{s}{i === 1 ? '·可选' : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

// 「示范一卦」走查:乾·九五动(乾之大有,一爻变,爻辞「飞龙在天」)
const DEMO_GUA = 1
const DEMO_DONG = [5]
const DEMO_TOUR = [
  { selector: '.workbench-gua', title: '① 这是本卦', body: '示范起出的是乾卦。卦画上标红的「九五」就是动爻——动爻是占断的关键。' },
  { selector: '.bianhua-row', title: '② 动则成变卦', body: '九五一动，乾就变成了大有。右边那一卦即变卦，箭头上标着是哪一爻动的。' },
  { selector: '.rule-card', title: '③ 读断法', body: '一爻变，依《易学启蒙》以变爻之辞占——这里取乾九五「飞龙在天」。下面还附小象传与字词注疏，悬停即看。' },
]

// 时间输入行
function TimeField({ label, value, onChange, min, max }) {
  return (
    <label className="meihua-field">
      <span className="meihua-field__label">{label}</span>
      <input
        className="meihua-field__input"
        type="number" min={min} max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  )
}

// 算式展示
function Formula({ items }) {
  return (
    <div className="meihua-formula">
      {items.map((item, i) => (
        <span key={i} className="meihua-formula__item">
          {i > 0 && <span className="meihua-formula__op"> + </span>}
          <span className="meihua-formula__num">{item.val}</span>
          <span className="meihua-formula__label">{item.label}</span>
        </span>
      ))}
    </div>
  )
}

// 引导向导外壳
function GuideWizard({ steps, step, setStep, onFinish, finishLabel }) {
  const cur = steps[step]
  const isLast = step === steps.length - 1
  return (
    <div className="guide-wizard">
      <div className="guide-wizard__header">
        <span className="guide-wizard__step text-soft">第 {step + 1} / {steps.length} 步</span>
        <span className="guide-wizard__title">{cur.title}</span>
      </div>
      <div className="guide-wizard__body">{cur.body}</div>
      <div className="guide-wizard__nav">
        {step > 0 && <button className="btn btn--secondary" onClick={() => setStep(step - 1)}>← 上一步</button>}
        {!isLast && <button className="btn btn--primary" onClick={() => setStep(step + 1)}>下一步 →</button>}
        {isLast && <button className="btn btn--primary" onClick={onFinish}>{finishLabel}</button>}
      </div>
      <div className="guide-wizard__dots">
        {steps.map((_, i) => (
          <button key={i} className={`guide-dot ${i === step ? 'guide-dot--active' : ''}`} onClick={() => setStep(i)} aria-label={`第${i + 1}步`} />
        ))}
      </div>
    </div>
  )
}

// 梅花面板
function MeihuaPanel({ onQiGua }) {
  const [subMethod, setSubMethod] = useState('time')
  const [panelMode, setPanelMode] = useState('quick')
  const [guideStep, setGuideStep] = useState(0)
  const [lunarDisplay, setLunarDisplay] = useState('')
  const [nianZhi, setNianZhi] = useState(1)
  const [yue, setYue] = useState(1)
  const [ri, setRi] = useState(1)
  const [shiZhi, setShiZhi] = useState(1)
  const [shu1, setShu1] = useState(3)
  const [shu2, setShu2] = useState(5)
  const [loading, setLoading] = useState(false)

  // 首次加载时获取当前农历
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    import('../engine/lunarAdapter.js').then(({ dateToMeihuaInput }) => {
      return dateToMeihuaInput(new Date())
    }).then(data => {
      if (cancelled) return
      setNianZhi(data.nianZhi)
      setYue(data.yue)
      setRi(data.ri)
      setShiZhi(data.shiZhi)
      setLunarDisplay(data.displayStr)
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // 时间法结果
  const timeResult = qiGuaByTime({ nianZhi, yue, ri, shiZhi })
  // 数字法结果
  const numResult = qiGuaByNumber({ shu1, shu2 })

  const result = subMethod === 'time' ? timeResult : numResult
  const upperName = trigramById[result.upper]?.name ?? result.upper
  const lowerName = trigramById[result.lower]?.name ?? result.lower

  function handleQiGua() {
    const binary = trigramById[result.lower].binary + trigramById[result.upper].binary
    const hex = hexagramByBinary.get(binary)
    if (!hex) return
    const origin = {
      method: subMethod === 'time' ? 'meihua-time' : 'meihua-number',
      upper: result.upper,
      lower: result.lower,
      dongYao: result.dongYao,
      inputs: subMethod === 'time' ? { nianZhi, yue, ri, shiZhi } : { shu1, shu2 },
    }
    onQiGua(hex, [result.dongYao], origin)
  }

  function switchSub(m) { setSubMethod(m); setGuideStep(0) }
  function switchMode(m) { setPanelMode(m); setGuideStep(0) }

  const tf = timeResult.formula
  const tR8a = tf.sum3 % 8 || 8
  const tR8b = tf.sum4 % 8 || 8
  const tR6 = tf.sum4 % 6 || 6
  const nR8a = shu1 % 8 || 8
  const nR8b = shu2 % 8 || 8
  const nR6 = (shu1 + shu2) % 6 || 6

  const timeFields = (
    <div className="meihua-fields">
      <TimeField label="年支数" value={nianZhi} onChange={setNianZhi} min={1} max={12} />
      <TimeField label="农历月" value={yue} onChange={setYue} min={1} max={12} />
      <TimeField label="农历日" value={ri} onChange={setRi} min={1} max={30} />
      <TimeField label="时支数" value={shiZhi} onChange={setShiZhi} min={1} max={12} />
    </div>
  )

  const timeSteps = [
    {
      title: '取数',
      body: (
        <>
          {loading ? <p className="text-soft">获取农历…</p> : lunarDisplay && <p className="meihua-lunar-display text-soft">{lunarDisplay}</p>}
          <p className="guide-text">梅花时间起卦只用四个数：年支序数（子=1 丑=2 … 亥=12）、农历月、农历日、时支序数。已按当前时间自动换算好，也可手动修改。</p>
          {timeFields}
          <p className="guide-text text-soft">出处：《梅花易数》年月日时起例。</p>
        </>
      ),
    },
    {
      title: '求上卦',
      body: (
        <>
          <p className="guide-text">年支、月、日三数相加，除以八取余数。<strong>余数为〇时取八</strong>——梅花的通用约定。</p>
          <div className="meihua-formula__eq">{tf.nianZhi} + {tf.yue} + {tf.ri} = {tf.sum3}，÷ 8 余 <strong>{tR8a}</strong></div>
          <XianTianTable highlight={tR8a} />
          <p className="guide-text">余数对照先天卦数（乾一兑二离三震四巽五坎六艮七坤八），得上卦 <strong>{upperName}</strong>。<Link to="/basics/meihua" className="learn-inline">为什么用先天数 →</Link></p>
        </>
      ),
    },
    {
      title: '求下卦',
      body: (
        <>
          <p className="guide-text">在前面的和上再加时支数，除以八取余，同法得下卦。</p>
          <div className="meihua-formula__eq">{tf.sum3} + {tf.shiZhi}<span className="text-soft">（时支）</span> = {tf.sum4}，÷ 8 余 <strong>{tR8b}</strong></div>
          <XianTianTable highlight={tR8b} />
          <p className="guide-text">下卦为 <strong>{lowerName}</strong>。上下相叠，本卦已现。</p>
        </>
      ),
    },
    {
      title: '定动爻',
      body: (
        <>
          <p className="guide-text">总和除以六取余（余〇取六），定<TermTip term="dongyao">动爻</TermTip>之位。</p>
          <div className="meihua-formula__eq">{tf.sum4} ÷ 6 余 <strong>{tR6}</strong> → 第 {tR6} 爻动</div>
          <p className="guide-text">动者为用、静者为体：动爻在{tR6 <= 3 ? '下卦，故下卦为用、上卦为体' : '上卦，故上卦为用、下卦为体'}。入卦后体用卡会自动展开断法。</p>
        </>
      ),
    },
    {
      title: '成卦',
      body: (
        <>
          <p className="guide-text">四步已毕。本卦、动爻俱得，起卦后可在右侧看卦变、断辞与体用。</p>
          <div className="meihua-preview">预览：上{upperName} 下{lowerName} · 第{result.dongYao}爻动</div>
        </>
      ),
    },
  ]

  const numSteps = [
    {
      title: '取数',
      body: (
        <>
          <p className="guide-text">数字起卦的两数可以来自报数、字的笔画、所见所闻之数——心动即取，先得为上卦之数，后得为下卦之数。</p>
          <div className="meihua-fields">
            <TimeField label="数一" value={shu1} onChange={setShu1} min={1} max={999} />
            <TimeField label="数二" value={shu2} onChange={setShu2} min={1} max={999} />
          </div>
        </>
      ),
    },
    {
      title: '求上卦',
      body: (
        <>
          <div className="meihua-formula__eq">数一 {shu1} ÷ 8 余 <strong>{nR8a}</strong></div>
          <XianTianTable highlight={nR8a} />
          <p className="guide-text">余数对照先天卦数，上卦为 <strong>{upperName}</strong>（余〇取八）。</p>
        </>
      ),
    },
    {
      title: '求下卦与动爻',
      body: (
        <>
          <div className="meihua-formula__eq">数二 {shu2} ÷ 8 余 <strong>{nR8b}</strong> → 下卦 <strong>{lowerName}</strong></div>
          <div className="meihua-formula__eq">{shu1} + {shu2} = {shu1 + shu2}，÷ 6 余 <strong>{nR6}</strong> → 第 {nR6} 爻动</div>
          <XianTianTable highlight={nR8b} />
        </>
      ),
    },
    {
      title: '成卦',
      body: (
        <>
          <p className="guide-text">两数起卦毕。流派差异（如加时辰）各家不一，本站取最通行两数版以示算法。</p>
          <div className="meihua-preview">预览：上{upperName} 下{lowerName} · 第{result.dongYao}爻动</div>
        </>
      ),
    },
  ]

  return (
    <div className="meihua-panel">
      <div className="seg-control meihua-subtabs">
        <button className={`seg-btn ${subMethod === 'time' ? 'seg-btn--active' : ''}`} onClick={() => switchSub('time')}>时间起卦</button>
        <button className={`seg-btn ${subMethod === 'number' ? 'seg-btn--active' : ''}`} onClick={() => switchSub('number')}>数字起卦</button>
      </div>
      <div className="seg-control panel-mode-toggle">
        <button className={`seg-btn ${panelMode === 'quick' ? 'seg-btn--active' : ''}`} onClick={() => switchMode('quick')}>快速</button>
        <button className={`seg-btn ${panelMode === 'guide' ? 'seg-btn--active' : ''}`} onClick={() => switchMode('guide')}>引导</button>
      </div>

      {panelMode === 'guide' && (
        <GuideWizard
          steps={subMethod === 'time' ? timeSteps : numSteps}
          step={guideStep}
          setStep={setGuideStep}
          onFinish={handleQiGua}
          finishLabel="起卦 →"
        />
      )}

      {panelMode === 'quick' && subMethod === 'time' && (
        <div className="meihua-time">
          {loading ? <p className="text-soft">获取农历…</p> : lunarDisplay && <p className="meihua-lunar-display text-soft">{lunarDisplay}</p>}
          {timeFields}
          <div className="meihua-hint text-soft">年支：{ZHI_NAMES.map((z, i) => `${z}=${i + 1}`).join(' ')}</div>
          <div className="meihua-hint text-soft">时支：{ZHI_NAMES.map((z, i) => `${z}=${i + 1}`).join(' ')}</div>

          <div className="meihua-formula-section">
            <Formula items={[
              { val: nianZhi, label: '年支' },
              { val: yue, label: '月' },
              { val: ri, label: '日' },
            ]} />
            <div className="meihua-formula__eq">÷ 8 余 {tR8a} → 上卦 <strong>{upperName}</strong></div>
            <Formula items={[
              { val: nianZhi, label: '年支' },
              { val: yue, label: '月' },
              { val: ri, label: '日' },
              { val: shiZhi, label: '时支' },
            ]} />
            <div className="meihua-formula__eq">÷ 8 余 {tR8b} → 下卦 <strong>{lowerName}</strong></div>
            <div className="meihua-formula__eq">÷ 6 余 {tR6} → 动爻 <strong>第 {timeResult.dongYao} 爻</strong></div>
          </div>
        </div>
      )}

      {panelMode === 'quick' && subMethod === 'number' && (
        <div className="meihua-number">
          <div className="meihua-fields">
            <TimeField label="数一" value={shu1} onChange={setShu1} min={1} max={999} />
            <TimeField label="数二" value={shu2} onChange={setShu2} min={1} max={999} />
          </div>
          <div className="meihua-hint text-soft">两数起卦：数一定上卦，数二定下卦，两数之和定动爻。</div>
          <div className="meihua-formula-section">
            <div className="meihua-formula__eq">数一 {shu1} ÷ 8 余 {nR8a} → 上卦 <strong>{upperName}</strong></div>
            <div className="meihua-formula__eq">数二 {shu2} ÷ 8 余 {nR8b} → 下卦 <strong>{lowerName}</strong></div>
            <div className="meihua-formula__eq">({shu1} + {shu2}) = {shu1 + shu2} ÷ 6 余 {nR6} → 动爻 <strong>第 {numResult.dongYao} 爻</strong></div>
          </div>
        </div>
      )}

      {panelMode === 'quick' && (
        <>
          <div className="meihua-preview text-soft">
            预览：上{upperName} 下{lowerName} · 第{result.dongYao}爻动
          </div>
          <button className="btn btn--primary meihua-qigua-btn" onClick={handleQiGua}>
            起卦 →
          </button>
          <p className="meihua-note text-soft">数字起卦取最通行两数版；流派差异（加时辰等）各家不一，本站取此版以示算法。</p>
        </>
      )}
    </div>
  )
}

// 大衍面板(v3 §5.2)
function DayanPanel({ onQiGua }) {
  const [subMode, setSubMode] = useState('quick')
  const [result, setResult] = useState(null)

  function castOnce() {
    setResult(castHexagram(cryptoRng))
  }

  function enter() {
    if (!result) return
    const hex = hexagramByBinary.get(result.binary)
    if (!hex) return
    onQiGua(hex, result.movingLines, { method: 'dayan', inputs: { values: result.lines } })
  }

  return (
    <div className="dayan-panel">
      <div className="seg-control panel-mode-toggle">
        <button className={`seg-btn ${subMode === 'quick' ? 'seg-btn--active' : ''}`} onClick={() => setSubMode('quick')}>一键成卦</button>
        <button className={`seg-btn ${subMode === 'guide' ? 'seg-btn--active' : ''}`} onClick={() => setSubMode('guide')}>逐步引导</button>
      </div>

      {subMode === 'quick' && (
        <div className="cast-quick">
          <p className="guide-text text-soft">四十九蓍三变成爻、十八变成卦，此处一次掷毕。<Link to="/basics/shicao" className="learn-inline">看每一变怎么来 →</Link></p>
          <button className="btn btn--primary" onClick={castOnce}>{result ? '重掷' : '掷蓍成卦'}</button>
          {result && (
            <div className="cast-result">
              {[5, 4, 3, 2, 1, 0].map(i => (
                <div key={i} className="cast-result__row">
                  <span className="cast-result__pos">{LINE_NAMES[i]}爻</span>
                  <span className={`cast-result__label ${result.lines[i] === 6 || result.lines[i] === 9 ? 'cast-result__label--moving' : ''}`}>{LINE_LABELS[result.lines[i]]}</span>
                </div>
              ))}
              <div className="cast-result__name">
                {hexagramByBinary.get(result.binary)?.fullName}
                {result.movingLines.length > 0 && <span className="text-soft"> · 动 {result.movingLines.join('、')}</span>}
              </div>
              <button className="btn btn--primary" onClick={enter}>入卦 →</button>
            </div>
          )}
        </div>
      )}

      {subMode === 'guide' && (
        <DayanCast
          compact
          resultLabel="入卦 →"
          onResult={(hex, movingLines) => onQiGua(hex, movingLines, { method: 'dayan' })}
        />
      )}
    </div>
  )
}

// 金钱卦面板(v3 §3.3)
function JinqianPanel({ onQiGua }) {
  const [subMode, setSubMode] = useState('auto')
  const [result, setResult] = useState(null)          // 一键
  const [stepLines, setStepLines] = useState([])      // 逐掷
  const [manual, setManual] = useState(Array(6).fill(null))  // 录入

  function enterValues(values, inputs) {
    const { binary, movingLines } = linesToGua(values)
    const hex = hexagramByBinary.get(binary)
    if (!hex) return
    onQiGua(hex, movingLines, { method: 'jinqian', inputs: inputs ?? { values } })
  }

  function coinGlyphs(coins) {
    return coins.map((c, i) => (
      <span key={i} className={`coin ${c ? 'coin--back' : 'coin--front'}`}>{c ? '背' : '字'}</span>
    ))
  }

  return (
    <div className="jinqian-panel">
      <div className="seg-control panel-mode-toggle">
        <button className={`seg-btn ${subMode === 'auto' ? 'seg-btn--active' : ''}`} onClick={() => setSubMode('auto')}>一键</button>
        <button className={`seg-btn ${subMode === 'step' ? 'seg-btn--active' : ''}`} onClick={() => setSubMode('step')}>逐掷引导</button>
        <button className={`seg-btn ${subMode === 'manual' ? 'seg-btn--active' : ''}`} onClick={() => setSubMode('manual')}>实物录入</button>
      </div>

      {subMode === 'auto' && (
        <div className="cast-quick">
          <p className="guide-text text-soft">三枚铜钱掷六次，背计 3 字计 2。<Link to="/basics/jinqian" className="learn-inline">学取数规则 →</Link></p>
          <button className="btn btn--primary" onClick={() => setResult(tossHexagram(cryptoRng))}>{result ? '重掷' : '掷钱成卦'}</button>
          {result && (
            <div className="cast-result">
              {[5, 4, 3, 2, 1, 0].map(i => (
                <div key={i} className="cast-result__row">
                  <span className="cast-result__pos">{LINE_NAMES[i]}爻</span>
                  <span className="cast-result__coins">{coinGlyphs(result.lines[i].coins)}</span>
                  <span className={`cast-result__label ${result.values[i] === 6 || result.values[i] === 9 ? 'cast-result__label--moving' : ''}`}>{COIN_LABELS[result.values[i]]}</span>
                </div>
              ))}
              <div className="cast-result__name">
                {hexagramByBinary.get(result.binary)?.fullName}
                {result.movingLines.length > 0 && <span className="text-soft"> · 动 {result.movingLines.join('、')}</span>}
              </div>
              <button className="btn btn--primary" onClick={() => enterValues(result.values)}>入卦 →</button>
            </div>
          )}
        </div>
      )}

      {subMode === 'step' && (
        <div className="jinqian-step">
          {stepLines.length === 0 && (
            <p className="guide-text">三枚铜钱合掌摇匀后掷出，一掷得一爻，自下而上记六爻。背面计 3、字面计 2，三枚之和定爻：9 老阳○动、8 少阴、7 少阳、6 老阴✕动。</p>
          )}
          {stepLines.map((l, i) => (
            <div key={i} className="cast-result__row">
              <span className="cast-result__pos">{LINE_NAMES[i]}爻</span>
              <span className="cast-result__coins">{coinGlyphs(l.coins)}</span>
              <span className="cast-result__eq text-soft">{l.coins.map(c => c ? 3 : 2).join('+')}={l.value}</span>
              <span className={`cast-result__label ${l.value === 6 || l.value === 9 ? 'cast-result__label--moving' : ''}`}>{COIN_LABELS[l.value]}</span>
            </div>
          ))}
          <div className="dayan-btns">
            {stepLines.length < 6 && (
              <button className="btn btn--primary" onClick={() => setStepLines([...stepLines, tossLine(cryptoRng)])}>
                掷第{LINE_NAMES[stepLines.length]}爻 →
              </button>
            )}
            {stepLines.length > 0 && (
              <button className="btn btn--secondary" onClick={() => setStepLines([])}>重新起卦</button>
            )}
            {stepLines.length === 6 && (
              <button className="btn btn--primary" onClick={() => enterValues(stepLines.map(l => l.value))}>入卦 →</button>
            )}
          </div>
          {stepLines.length === 6 && (
            <div className="cast-result__name">
              {hexagramByBinary.get(linesToGua(stepLines.map(l => l.value)).binary)?.fullName}
            </div>
          )}
        </div>
      )}

      {subMode === 'manual' && (
        <div className="jinqian-manual">
          <p className="guide-text text-soft">自掷实物铜钱后逐爻录入（自下而上）。</p>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="manual-row">
              <span className="cast-result__pos">{LINE_NAMES[i]}爻</span>
              <div className="manual-choices">
                {COIN_CHOICES.map(v => (
                  <button
                    key={v}
                    className={`manual-choice ${manual[i] === v ? 'manual-choice--active' : ''}`}
                    title={COIN_LABELS[v]}
                    onClick={() => setManual(m => m.map((x, j) => j === i ? v : x))}
                  >
                    {v === 9 ? '三背○' : v === 8 ? '两背一字' : v === 7 ? '一背两字' : '三字✕'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="dayan-btns">
            <button
              className="btn btn--primary"
              disabled={manual.some(v => v === null)}
              onClick={() => enterValues(manual)}
            >
              入卦 →
            </button>
            <button className="btn btn--secondary" onClick={() => setManual(Array(6).fill(null))}>清空</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 体用卡(仅梅花起卦且单动爻)
function TiYongCard({ hex, movingLines, origin }) {
  if (!origin || !String(origin.method || '').startsWith('meihua') || movingLines.length !== 1) return null
  const { upper, lower, dongYao } = origin
  const { ti, yong, tiEl, yongEl, relation, text } = calcTiYong(upper, lower, dongYao)

  // 互卦参断
  const huBinary = getHuGua(hex.binary)
  const huHex = hexagramByBinary.get(huBinary)
  const huUpper = huHex ? trigramById[huHex.upperTrigram] : null
  const huLower = huHex ? trigramById[huHex.lowerTrigram] : null
  const huUpperDuan = huUpper ? paramDuan(huHex.upperTrigram, tiEl) : null
  const huLowerDuan = huLower ? paramDuan(huHex.lowerTrigram, tiEl) : null

  // 变卦参断（用方所变）
  const bianBinary = getBianGua(hex.binary, movingLines)
  const bianHex = hexagramByBinary.get(bianBinary)
  const bianYongTrigram = dongYao <= 3 ? bianHex?.lowerTrigram : bianHex?.upperTrigram
  const bianDuan = bianYongTrigram ? paramDuan(bianYongTrigram, tiEl) : null

  return (
    <div className="result-card tiyong-card">
      <div className="result-card__title"><TermTip term="tiyong">体用</TermTip></div>
      <p className="tiyong-note text-soft">梅花起卦，单动爻 → 体用断</p>
      <div className="tiyong-main">
        <div className="tiyong-side">
          <div className="tiyong-label">体</div>
          <TrigramBadge trigramId={ti} />
          <div className="tiyong-el">{tiEl}</div>
        </div>
        <div className="tiyong-relation">
          <div className="tiyong-relation__text">{relation}</div>
          <div className="tiyong-relation__verdict">{text}</div>
          <div className="tiyong-source text-soft">传统断法谓之「{text}」（出处：《梅花易数·体用总诀》）</div>
        </div>
        <div className="tiyong-side">
          <div className="tiyong-label">用</div>
          <TrigramBadge trigramId={yong} />
          <div className="tiyong-el">{yongEl}</div>
        </div>
      </div>

      {/* 参断 */}
      <div className="tiyong-shen">
        <div className="tiyong-shen__title">参断</div>
        {huUpperDuan && (
          <div className="tiyong-shen__row">
            互卦上 {huUpper?.name}（{huUpperDuan.el}）→ 与体 {tiEl}：{huUpperDuan.relation} — <span className="text-soft">事之中，{huUpperDuan.text}</span>
          </div>
        )}
        {huLowerDuan && (
          <div className="tiyong-shen__row">
            互卦下 {huLower?.name}（{huLowerDuan.el}）→ 与体 {tiEl}：{huLowerDuan.relation} — <span className="text-soft">事之中，{huLowerDuan.text}</span>
          </div>
        )}
        {bianDuan && bianYongTrigram && (
          <div className="tiyong-shen__row">
            变卦用方 {trigramById[bianYongTrigram]?.name}（{bianDuan.el}）→ 与体 {tiEl}：{bianDuan.relation} — <span className="text-soft">事之终，{bianDuan.text}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const VALID_METHODS = ['trigram', 'line', 'search', 'meihua', 'dayan', 'jinqian']

function originBadge(method) {
  if (!method) return null
  if (String(method).startsWith('meihua')) return '梅花'
  if (method === 'dayan') return '大衍'
  if (method === 'jinqian') return '金钱'
  return null
}

export default function WorkbenchPage() {
  usePageTitle('推演工作台')
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const initGua = Number(params.get('gua')) || null
  const initDong = params.get('dong') ? params.get('dong').split(',').map(Number).filter(n => n >= 1 && n <= 6) : []
  const initMethod = VALID_METHODS.includes(params.get('method')) ? params.get('method') : 'trigram'

  const [hex, setHex] = useState(() => initGua ? hexagramById.get(initGua) : null)
  const [movingLines, setMovingLines] = useState(initDong)
  const [method, setMethod] = useState(initMethod)
  const [upperTrigram, setUpperTrigram] = useState(hex?.upperTrigram || '')
  const [lowerTrigram, setLowerTrigram] = useState(hex?.lowerTrigram || '')
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [noteText, setNoteText] = useState('')
  const [savedMsg, setSavedMsg] = useState(false)
  const [origin, setOrigin] = useState(null)  // null | { method, upper?, lower?, dongYao?, inputs }
  const [tourOn, setTourOn] = useState(false)  // 「示范一卦」走查

  useEffect(() => {
    const p = {}
    if (hex) p.gua = hex.id
    if (movingLines.length) p.dong = movingLines.join(',')
    setParams(p, { replace: true })
  }, [hex, movingLines])

  useEffect(() => {
    if (upperTrigram && lowerTrigram) {
      const binary = trigramById[lowerTrigram].binary + trigramById[upperTrigram].binary
      const found = hexagramByBinary.get(binary)
      if (found) {
        setHex(prev => {
          if (prev?.id !== found.id) setMovingLines([])
          return found
        })
      }
    }
  }, [upperTrigram, lowerTrigram])

  useEffect(() => {
    function onKey(e) {
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 6 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        toggleMoving(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [movingLines, hex])

  function toggleMoving(pos) {
    setMovingLines(prev => prev.includes(pos) ? prev.filter(x => x !== pos) : [...prev, pos])
  }

  function handleFigureClick(pos) { toggleMoving(pos) }

  function handleSearch(q) {
    setSearchQ(q)
    if (!q) { setSearchResults([]); return }
    const lower = q.toLowerCase()
    setSearchResults(allHexagrams.filter(h =>
      h.name.includes(q) || h.fullName.includes(q) || h.pinyin?.toLowerCase().includes(lower) || String(h.id) === q
    ).slice(0, 8))
  }

  function selectHex(h, lines = [], newOrigin = null) {
    setHex(h)
    setMovingLines(lines)
    setUpperTrigram(h.upperTrigram)
    setLowerTrigram(h.lowerTrigram)
    setSearchQ('')
    setSearchResults([])
    setOrigin(newOrigin)
    if (newOrigin?.method) markMethodUsed(newOrigin.method)
  }

  function randomHex() {
    const r = allHexagrams[Math.floor(Math.random() * 64)]
    selectHex(r)
  }

  // 「示范一卦」:载入乾·九五动并启动走查
  function startDemo() {
    selectHex(hexagramById.get(DEMO_GUA), DEMO_DONG)
    setMethod('trigram')
    setTourOn(true)
  }

  function saveHistory() {
    if (!hex) return
    const bianBinary = movingLines.length ? getBianGua(hex.binary, movingLines) : hex.binary
    const bianHex = hexagramByBinary.get(bianBinary)
    saveDivination({
      gua: hex.id, dong: movingLines, bianGua: bianHex?.id, note: noteText,
      ...(origin ? { method: origin.method, inputs: origin.inputs } : {}),
    })
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  const bianBinary = hex && movingLines.length ? getBianGua(hex.binary, movingLines) : hex?.binary
  const bianHex = hex && movingLines.length ? hexagramByBinary.get(bianBinary) : null
  const huHex = hex ? hexagramByBinary.get(getHuGua(hex.binary)) : null
  const cuoHex = hex ? hexagramByBinary.get(getCuoGua(hex.binary)) : null
  const zongHex = hex ? hexagramByBinary.get(getZongGua(hex.binary)) : null
  const divinationResult = hex ? getDivinationResult(hex, movingLines, hexagramByBinary) : null
  const positions = hex ? analyzeAllPositions(hex.binary) : []

  const METHODS = [['trigram', '上下卦'], ['line', '逐爻'], ['search', '检索'], ['meihua', '梅花'], ['dayan', '大衍'], ['jinqian', '金钱']]
  const learnLink = LEARN_LINKS[method]

  return (
    <div className="workbench-page">
      <aside className="workbench-left">
        <div className="workbench-left__inner">
          <div className="workbench-section-title">起卦</div>
          <StepBar hex={hex} movingLines={movingLines} />
          <p className="workbench-howto">
            这里帮你<strong>推演一卦</strong>：选定一个<strong><TermTip term="bengua">本卦</TermTip></strong>，点卦画上的爻标出<strong><TermTip term="dongyao">动爻</TermTip></strong>（也可不标），右侧便自动给出卦变与断法。先在下面挑一种起卦方式——
          </p>
          <div className="workbench-howto-actions">
            <button className="btn-text" onClick={startDemo}>示范一卦 →</button>
            <Link to="/basics/tuiyan" className="btn-text">第一次用？读推演入门 →</Link>
          </div>
          {METHOD_GROUPS.map(group => (
            <div key={group.label} className="workbench-method-group">
              <div className="workbench-method-group__label">{group.label}</div>
              <div className="seg-control workbench-methods">
                {group.methods.map(([k, v]) => (
                  <button key={k} className={`seg-btn ${method === k ? 'seg-btn--active' : ''}`} onClick={() => setMethod(k)}>{v}</button>
                ))}
              </div>
            </div>
          ))}
          {METHOD_HINT[method] && !(method === 'line' && !hex) && (
            <p className="workbench-method-hint">{METHOD_HINT[method]}</p>
          )}
          {learnLink && (
            <div className="workbench-learn-row">
              <Link to={learnLink[0]} className="learn-link">{learnLink[1]} →</Link>
            </div>
          )}

          {method === 'trigram' && (
            <div className="trigram-picker">
              <div className="trigram-picker__row">
                <span className="trigram-picker__label">上卦</span>
                <div className="trigram-picker__options">
                  {TRIGRAM_ORDER.map(id => (
                    <button key={id} className={`trigram-btn ${upperTrigram === id ? 'trigram-btn--active' : ''}`} onClick={() => setUpperTrigram(id)} title={trigramById[id].name}>{trigramById[id].symbol}</button>
                  ))}
                </div>
              </div>
              <div className="trigram-picker__row">
                <span className="trigram-picker__label">下卦</span>
                <div className="trigram-picker__options">
                  {TRIGRAM_ORDER.map(id => (
                    <button key={id} className={`trigram-btn ${lowerTrigram === id ? 'trigram-btn--active' : ''}`} onClick={() => setLowerTrigram(id)} title={trigramById[id].name}>{trigramById[id].symbol}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {method === 'line' && !hex && (
            <p className="workbench-method-hint text-soft">逐爻是在一卦的基础上微调。先用上面的「上下卦」或「检索」起出一卦，再切回逐爻调整。</p>
          )}
          {method === 'line' && hex && (
            <div className="line-picker">
              {[6, 5, 4, 3, 2, 1].map(pos => {
                const isYang = hex.binary[pos - 1] === '1'
                const isDong = movingLines.includes(pos)
                return (
                  <div key={pos} className="line-picker__row">
                    <span className="line-picker__title">{lineTitle(pos, isYang)}</span>
                    <button className={`line-yin-yang ${isYang ? 'line-yin-yang--yang' : 'line-yin-yang--yin'}`} onClick={() => {
                      const arr = hex.binary.split('')
                      arr[pos - 1] = isYang ? '0' : '1'
                      const newHex = hexagramByBinary.get(arr.join(''))
                      if (newHex) { setHex(newHex); setMovingLines([]) }
                    }}>{isYang ? '阳' : '阴'}</button>
                    <label className="line-picker__dong"><input type="checkbox" checked={isDong} onChange={() => toggleMoving(pos)} /> 动</label>
                  </div>
                )
              })}
            </div>
          )}

          {method === 'search' && (
            <div className="workbench-search">
              <input className="workbench-search__input" value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="卦名 / 拼音 / 卦序…" />
              {searchResults.length > 0 && (
                <ul className="workbench-search__results">
                  {searchResults.map(h => (
                    <li key={h.id}><button className="workbench-search__item" onClick={() => selectHex(h)}>{h.fullName} 第{h.id}卦</button></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {method === 'meihua' && (
            <MeihuaPanel onQiGua={(h, lines, o) => selectHex(h, lines, o)} />
          )}

          {method === 'dayan' && (
            <DayanPanel onQiGua={(h, lines, o) => selectHex(h, lines, o)} />
          )}

          {method === 'jinqian' && (
            <JinqianPanel onQiGua={(h, lines, o) => selectHex(h, lines, o)} />
          )}

          {hex && (
            <div className="workbench-gua">
              <HexagramFigure binary={hex.binary} size="lg" movingLines={movingLines} interactive="toggle-moving" onLineClick={handleFigureClick} label={`${hex.fullName}，单击爻标记动爻`} />
              <div className="workbench-gua__info">
                <Link to={`/hexagram/${hex.id}`} className="workbench-gua__name">{hex.fullName}</Link>
                {originBadge(origin?.method) && <span className="workbench-gua__badge">{originBadge(origin?.method)}</span>}
                <p className="workbench-gua__dong">
                  {movingLines.length ? `动爻：${movingLines.sort((a, b) => a - b).map(p => lineTitle(p, hex.binary[p - 1] === '1')).join('、')}` : '无动爻'}
                </p>
              </div>
              <div className="workbench-gua__btns">
                {movingLines.length > 0 && <button className="btn-text" onClick={() => setMovingLines([])}>清空动爻</button>}
                <button className="btn-text" onClick={randomHex}>随机一卦</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="workbench-right">
        {!hex ? (
          <EmptyState icon="☲" text="先在左侧选定本卦" />
        ) : (
          <div className="workbench-results">
            {/* 卡1: 卦变图 */}
            <div className="result-card">
              <div className="result-card__title">卦变</div>
              <div className="bianhua-row">
                <div className="bianhua-item">
                  <HexagramFigure binary={hex.binary} size="md" movingLines={movingLines} label={hex.fullName} />
                  <Link to={`/hexagram/${hex.id}`} className="bianhua-item__name">{hex.name}·本卦</Link>
                </div>
                {bianHex && movingLines.length > 0 && (
                  <>
                    <div className="bianhua-arrow">
                      <div className="bianhua-arrow__line" />
                      <div className="bianhua-arrow__label">{movingLines.sort((a, b) => a - b).map(p => lineTitle(p, hex.binary[p - 1] === '1')).join('·')}动</div>
                    </div>
                    <div className="bianhua-item">
                      <HexagramFigure binary={bianHex.binary} size="md" label={bianHex.fullName} />
                      <Link to={`/hexagram/${bianHex.id}`} className="bianhua-item__name">{bianHex.name}·变卦</Link>
                    </div>
                  </>
                )}
                {!bianHex && movingLines.length === 0 && <p className="bianhua-hint">标记动爻以观其变</p>}
              </div>
              <div className="deriv-row">
                {[{ label: '互卦', hex: huHex }, { label: '错卦', hex: cuoHex }, { label: '综卦', hex: zongHex }].map(({ label, hex: dh }) => dh && (
                  <Link key={label} to={`/hexagram/${dh.id}`} className="deriv-chip">
                    <HexagramFigure binary={dh.binary} size="sm" label={dh.fullName} />
                    <span>{label}·{dh.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* 卡2: 断辞依据 */}
            <RuleCard result={divinationResult} />

            {/* 体用卡（仅梅花单动爻时） */}
            <TiYongCard hex={hex} movingLines={movingLines} origin={origin} />

            {/* 卡3: 爻位分析 */}
            <div className="result-card">
              <div className="result-card__title">卦象与爻位分析</div>
              {hex.imagery && <p className="analysis-imagery">{hex.imagery}</p>}
              <p className="analysis-zhenhui">
                内卦{trigramById[hex.lowerTrigram]?.name}为<TermTip term="zhenhui">贞</TermTip>（主），外卦{trigramById[hex.upperTrigram]?.name}为<TermTip term="zhenhui">悔</TermTip>（客）——内{trigramById[hex.lowerTrigram]?.attribute}而外{trigramById[hex.upperTrigram]?.attribute}。
              </p>
              {movingLines.length > 0 ? (
                <div className="analysis-positions">
                  {movingLines.sort((a, b) => a - b).map(pos => {
                    const a = analyzePosition(pos, hex.binary)
                    const { chips, desc } = describePosition(a)
                    return (
                      <div key={pos} className="analysis-line">
                        <span className="analysis-line__title">{a.title}</span>
                        <span className="analysis-line__chips">{chips.map((c, i) => <span key={i} className={`line-chip ${c === '中正' ? 'line-chip--zhongzheng' : ''}`}>{c}</span>)}</span>
                        <p className="analysis-line__desc">{desc}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="analysis-overview">
                  {positions.map(a => {
                    const { chips } = describePosition(a)
                    return (
                      <div key={a.pos} className="analysis-overview-row">
                        <span className="analysis-overview-row__title">{a.title}</span>
                        {chips.map((c, i) => <span key={i} className={`line-chip ${c === '中正' ? 'line-chip--zhongzheng' : ''}`}>{c}</span>)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 卡4: 存为记录 */}
            <div className="result-card">
              <div className="result-card__title">存为记录</div>
              <div className="save-row">
                <input className="save-input" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="所研之事（可选）" />
                <button className="btn btn--secondary" onClick={saveHistory}>{savedMsg ? '已保存 ✓' : '存入推演历史'}</button>
              </div>
            </div>
          </div>
        )}
      </main>
      {tourOn && <GuideTour steps={DEMO_TOUR} onClose={() => setTourOn(false)} />}
    </div>
  )
}
