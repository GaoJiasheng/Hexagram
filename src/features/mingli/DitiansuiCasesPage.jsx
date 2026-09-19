import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText, getMeta } from '../reader/corpus.js'
import { chapterParts } from '../reader/chapterParts.js'
import { ganWuxing } from '../shared/ganzhi/index.js'
import WidgetBlock from '../shared/widgets/WidgetBlock.jsx'
import LensCards from './LensCards.jsx'

// 《滴天髓阐微》命例走读(design-v23 §7)。
// 这本书约五百个命例,任铁樵每个例后面都有一段解说——但解说是一整段文言,读者看不出他的眼睛
// 在图上是怎么走的。这一页把精选的例拆成步:每一步高亮图上几个字、引任氏一句原话、配一句人话。
// 数据 src/data/mingli/cases/ditiansui.json,每句引文 check-data 校验逐字命中且次序不乱。
//
// 列表 /mingli/ditiansui/cases · 单例 /mingli/ditiansui/cases/:id(id = 章-段)

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }

function useCases() {
  const [state, setState] = useState({ cases: null, book: null, failed: false })
  useEffect(() => {
    let alive = true
    Promise.all([import('../../data/mingli/cases/ditiansui.json'), loadText('mingli', 'ditiansui')])
      .then(([c, book]) => alive && setState({ cases: c.default.cases, book, failed: !book }))
      .catch(() => alive && setState({ cases: null, book: null, failed: true }))
    return () => { alive = false }
  }, [])
  return state
}

const Pillars = ({ pillars }) => (
  <span className="dc-pillars">
    {pillars.map((gz, i) => (
      <span key={i} className="dc-pillars__gz">
        {[...gz].map((c, j) => <span key={j} className={j === 0 ? `sz-char--${WX_CLASS[ganWuxing(c)]} dc-pillars__gan` : 'dc-pillars__zhi'}>{c}</span>)}
      </span>
    ))}
  </span>
)

export default function DitiansuiCasesPage() {
  const { id } = useParams()
  const { cases, book, failed } = useCases()
  const cur = id && cases ? cases.find((c) => c.id === id) : null
  usePageTitle(cur ? `${cur.title} · 命例走读` : '命例走读 · 滴天髓阐微', '观数')

  if (failed) return <div className="qt-matrix-page"><p className="mingli-topic-placeholder">没能载入,刷新再试一次。</p></div>
  if (!cases || !book) return <div className="qt-matrix-page"><div className="mingli-topic-loading" aria-busy="true" /></div>
  if (id) return cur ? <CaseWalk key={cur.id} c={cur} book={book} cases={cases} /> : (
    <div className="qt-matrix-page">
      <p className="mingli-topic-placeholder">没有这个命例。<Link to="/mingli/ditiansui/cases">回走读目录</Link></p>
    </div>
  )

  return (
    <div className="qt-matrix-page">
      <div className="basics-breadcrumb">
        <Link to="/mingli/ditiansui" className="basics-breadcrumb__link">← 滴天髓阐微</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">命例走读</h1>
        <p className="page-subtitle">跟着任铁樵的眼睛,在一张四柱图上走一遍。</p>
      </div>
      <p className="qt-matrix-intro">
        《滴天髓阐微》里有五百来个命例,每个例后面任铁樵都写了一段解说。难处在于:那是一整段文言,
        你看不出他<strong>先看了哪个字、再看了哪个字</strong>。这里挑了 {cases.length} 个讲理清楚的例,
        把他的解说拆成几步——每一步在图上点亮他正在看的字,引他一句原话,再配一句人话。
      </p>
      <div className="shelf-disclaimer">
        ⚠ 走读教的是<strong>怎么读懂书里的命例</strong>,不是怎么给人断命。任氏记下的某人生平(中没中举、做到什么官)
        是原书的内容,照录而已,本站不为之背书;同一个八字换一本书来看,入手处和说法都可能不同——每例末尾的「换个镜头」就是给你看这个的。
      </div>
      <ul className="dc-list">
        {cases.map((c) => {
          const p = book.chapters.find((x) => x.no === c.ch).paragraphs[c.para]
          return (
            <li key={c.id}>
              <Link to={`/mingli/ditiansui/cases/${c.id}`} className="dc-card">
                <span className="dc-card__concept">{c.concept}</span>
                <span className="dc-card__title">{c.title}</span>
                <Pillars pillars={p.pillars} />
                <span className="dc-card__why">{c.why}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CaseWalk({ c, book, cases }) {
  const ch = book.chapters.find((x) => x.no === c.ch)
  const pillars = ch.paragraphs[c.para].pillars
  const [step, setStep] = useState(0)
  const cur = c.steps[step]
  const meta = getMeta('mingli', 'ditiansui')

  const srcHref = useMemo(() => {
    const parts = chapterParts(ch, meta)
    const pi = parts ? parts.findIndex((pt) => c.para >= pt.from && c.para < pt.to) : -1
    return `/mingli/ditiansui/${c.ch}${pi > 0 ? `?p=${pi + 1}` : ''}#p${c.para + 1}`
  }, [ch, c, meta])

  const block = { type: 'widget', kind: 'sizhu', props: { pillars, focus: cur.focus || [] } }
  const idx = cases.findIndex((x) => x.id === c.id)
  const prev = cases[idx - 1], next = cases[idx + 1]

  return (
    <div className="qt-matrix-page dc-walk">
      <div className="basics-breadcrumb">
        <Link to="/mingli/ditiansui/cases" className="basics-breadcrumb__link">← 命例走读</Link>
      </div>
      <div className="page-header">
        <p className="dc-walk__concept">{c.concept}</p>
        <h1 className="page-title">{c.title}</h1>
        <p className="page-subtitle">{c.why} <Link to={srcHref} className="dc-walk__src">出自《{ch.title.replace(/^[一二三四五六七八九十百]+、/, '')}》→</Link></p>
      </div>

      <WidgetBlock block={block} />

      <ol className="dc-steps">
        {c.steps.map((s, i) => (
          <li key={i} className={`dc-step${i === step ? ' is-cur' : ''}${s.kind === 'record' ? ' dc-step--record' : ''}`}>
            <button type="button" className="dc-step__btn" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
              <span className="dc-step__no">{s.kind === 'record' ? '记' : i + 1}</span>
              <span className="dc-step__body">
                <span className="dc-step__quote">「{s.quote}」</span>
                {s.kind === 'record'
                  ? <span className="dc-step__say dc-step__say--record">原书所记其人生平——照录,非本站判断。</span>
                  : <span className="dc-step__say">{s.say}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="dc-nav">
        <button type="button" className="dc-nav__btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← 上一步</button>
        <span className="dc-nav__pos" aria-live="polite">第 {step + 1} / {c.steps.length} 步</span>
        <button type="button" className="dc-nav__btn dc-nav__btn--next" disabled={step === c.steps.length - 1} onClick={() => setStep(step + 1)}>下一步 →</button>
      </div>

      <section className="dc-lens">
        <h2 className="dc-lens__title">换个镜头</h2>
        <p className="dc-lens__intro">同一个八字,另外两本书会从别的地方下手。下面两格<strong>完全是按各书的规则算出来的</strong>,没有一个字的判断;三家说法未必一致,这里不替它们裁断。</p>
        <LensCards
          pillars={pillars}
          self={(
            <>
              <p className="dc-lens__tag">旺衰 · 《滴天髓》</p>
              <p className="dc-lens__main">上面走的就是这个镜头</p>
              <p className="dc-lens__body">任铁樵先掂量日主与各字的强弱、有根无根,再谈取舍。</p>
              <Link to={srcHref}>回原文读整段 →</Link>
            </>
          )}
        />
      </section>

      <div className="read-nav">
        {prev ? <Link to={`/mingli/ditiansui/cases/${prev.id}`} className="read-nav__prev">← {prev.title}</Link> : <span />}
        {next && <Link to={`/mingli/ditiansui/cases/${next.id}`} className="read-nav__next">{next.title} →</Link>}
      </div>
    </div>
  )
}
