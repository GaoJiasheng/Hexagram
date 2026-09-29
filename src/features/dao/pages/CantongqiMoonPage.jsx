import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePageTitle } from '../../yijing/hooks/usePageTitle.js'
import HexagramFigure from '../../yijing/components/HexagramFigure.jsx'
import MoonDial from '../../shared/widgets/MoonDial.jsx'
import moonData from '../../../data/dao/cantongqi-moon.json'
import trigramList from '../../../data/yijing/trigrams.json'
import { stationsOf, moonLitPath, yinYangCount, trigramChange, WUXING_FANG, MOON_STATIONS } from '../../shared/widgets/moon.js'
import { ganWuxing } from '../../shared/ganzhi/index.js'
import '../../shared/widgets/widgets.css'
import './CantongqiMoonPage.css'

// 《周易参同契》的「形状」之一:月体纳甲(design-v24 §3)。
// 大盘 + 「这一日」详情 + 六卦一览 + 凡例。原文逐句挂章,经 scripts/lib/check-cantongqi-moon.mjs 回查。
// 桥(design-v8 §2):只在道藏侧、单向指向易经卦页 /hexagram/<序号>;易经侧不回链。
// 红线:讲取象,不演火候工法,不下断语。

const BOOK = `/dao/${moonData.slug}`
const TRI = Object.fromEntries(trigramList.map((t) => [t.name, t]))
const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const wxClass = (g) => `sz-char--${WX_CLASS[ganWuxing(g)]}`
const pureBinary = (name) => TRI[name].binary + TRI[name].binary
const fullName = (name) => `${name}为${TRI[name].nature}`
const chTitle = (ch) => moonData.chapters[String(ch)] || `第${ch}章`
const STATIONS = stationsOf(moonData)

function parsePhase(sp) {
  const n = Number(sp.get('p'))
  return sp.has('p') && Number.isInteger(n) && n >= 0 && n < MOON_STATIONS ? n : 1
}

function MoonIcon({ day, size = 22 }) {
  const lit = moonLitPath(day, 9)
  return (
    <svg viewBox="-11 -11 22 22" width={size} height={size} className="ctqm-moonicon" aria-hidden="true">
      <circle r={9} className="moon-node__dark" />
      {lit && <path d={lit} className="moon-node__lit" />}
      <circle r={9} className="moon-node__rim" style={{ fill: 'none' }} />
    </svg>
  )
}

function Quote({ q, withLink = true }) {
  return (
    <p className="ctqm-quote">
      <q>{q.quote}</q>
      <span className="ctqm-quote__src">——《{chTitle(q.ch)}》</span>
      {withLink && <Link to={`${BOOK}/${q.ch}`} className="ctqm-quote__go">读第 {q.ch} 章 →</Link>}
    </p>
  )
}

function Bridge({ hex, name, named = false }) {
  return (
    <Link to={`/hexagram/${hex}`} className="ctqm-bridge">
      {named ? `到易经看${name}卦 ↗` : '到易经看此卦 ↗'} <span className="ctqm-bridge__name">《周易》第 {hex} 卦 · {fullName(name)}</span>
    </Link>
  )
}

function DayPanel({ st }) {
  if (st.kind === 'phase') {
    const p = st.src
    const prev = STATIONS[st.idx === 1 ? 6 : st.idx - 1].src
    const bin = TRI[p.name].binary
    const wx = ganWuxing(p.gan)
    return (
      <>
        <h2 className="ctqm-day__title">{st.label} · {p.name}<span className="ctqm-day__tri">{TRI[p.name].symbol}</span></h2>
        <div className="ctqm-day__body">
          <div className="ctqm-day__fig"><HexagramFigure key={p.hex} binary={pureBinary(p.name)} size="md" label={`${fullName(p.name)}卦画`} /></div>
          <dl className="ctqm-day__facts">
            <dt>卦</dt><dd>{fullName(p.name)}<span className="ctqm-tag">八纯卦 · 第 {p.hex} 卦</span></dd>
            <dt>纳甲</dt><dd><b className={`ctqm-gan ${wxClass(p.gan)}`}>{p.gan}</b><span className="ctqm-tag">{wx}</span></dd>
            <dt>方位</dt><dd>{p.dir}<span className="ctqm-tag">{p.dirFrom === 'text' ? '原句明写' : `由干推:${p.gan}属${wx},${wx}在${WUXING_FANG[wx]}`}</span></dd>
            <dt>见月</dt><dd>{p.seen === '昏' ? '黄昏' : '平旦'}<span className="ctqm-tag">{p.seenFrom === 'text' ? '原句「平明」' : '通行解说'}</span></dd>
            <dt>爻象</dt><dd>{yinYangCount(bin)}<span className="ctqm-tag">比上一相({prev.name}):{trigramChange(TRI[prev.name].binary, bin)}</span></dd>
          </dl>
        </div>
        <div className="ctqm-day__block">
          <p className="ctqm-day__label">原文 · 第 {p.ch} 章</p>
          <Quote q={p} />
        </div>
        <div className="ctqm-day__block">
          <p className="ctqm-day__label">对读 · 第 {p.echo.ch} 章(月相与乾卦六爻交错着写)</p>
          <Quote q={p.echo} withLink={false} />
          <Quote q={p.yao} />
        </div>
        <p className="ctqm-day__note">{p.note}</p>
        <Bridge hex={p.hex} name={p.name} />
      </>
    )
  }
  if (st.kind === 'shuo') {
    const j = st.src
    return (
      <>
        <h2 className="ctqm-day__title">{st.label} · 月隐不见</h2>
        <div className="ctqm-day__body">
          <div className="ctqm-day__fig"><MoonIcon day={j.day} size={64} /></div>
          <dl className="ctqm-day__facts">
            <dt>天干</dt>
            <dd>{j.gan.map((g) => <b key={g} className={`ctqm-gan ${wxClass(g)}`}>{g}</b>)}<span className="ctqm-tag">不配月相,随甲乙归乾坤</span></dd>
            <dt>方位</dt><dd>{WUXING_FANG[ganWuxing(j.gan[0])]}<span className="ctqm-tag">由干推;月不在北方出现</span></dd>
          </dl>
        </div>
        <div className="ctqm-day__block">
          <p className="ctqm-day__label">原文 · 第 {j.ch} 章</p>
          <Quote q={j} withLink={false} />
          <Quote q={j.also} />
        </div>
        <p className="ctqm-day__note">{j.note}</p>
        <p className="ctqm-day__note">易经卦页的纳甲表也是这样排的:乾卦内卦纳甲、外卦纳壬,坤卦内卦纳乙、外卦纳癸。</p>
        <div className="ctqm-bridges">
          {['甲', '乙'].map((g) => moonData.phases.find((p) => p.gan === g)).map((p) => <Bridge key={p.key} hex={p.hex} name={p.name} named />)}
        </div>
      </>
    )
  }
  const j = st.src
  return (
    <>
      <h2 className="ctqm-day__title">{st.label} · 坎离居中</h2>
      <div className="ctqm-day__body ctqm-day__body--pair">
        {moonData.center.map((c) => (
          <div key={c.key} className="ctqm-day__pairitem">
            <HexagramFigure key={c.hex} binary={pureBinary(c.name)} size="md" label={`${fullName(c.name)}卦画`} />
            <p>{c.name}<b className={`ctqm-gan ${wxClass(c.gan)}`}>{c.gan}</b><span className="ctqm-tag">{c.role} · 中宫</span></p>
          </div>
        ))}
      </div>
      <div className="ctqm-day__block">
        <p className="ctqm-day__label">原文 · 第 {j.ch} 章</p>
        <Quote q={j} />
      </div>
      <div className="ctqm-day__block">
        <p className="ctqm-day__label">原文 · 第 {moonData.center[0].ch} 章</p>
        {moonData.center.map((c) => <Quote key={c.key} q={c} withLink={false} />)}
        <Quote q={moonData.centerNote} />
      </div>
      <p className="ctqm-day__note">{j.note}</p>
      <div className="ctqm-bridges">
        {moonData.center.map((c) => <Bridge key={c.key} hex={c.hex} name={c.name} named />)}
      </div>
    </>
  )
}

export default function CantongqiMoonPage() {
  usePageTitle('月相纳甲盘 · 周易参同契', '观道')
  const [sp, setSp] = useSearchParams()
  const cur = parsePhase(sp)
  const dialRef = useRef(null)
  const setCur = (n) => setSp((prev) => { const next = new URLSearchParams(prev); next.set('p', String(n)); return next }, { replace: true })
  const pick = (n) => {
    setCur(n)
    const el = dialRef.current
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
  }
  const st = STATIONS[cur]

  return (
    <div className="ctqm-page">
      <div className="basics-breadcrumb">
        <Link to={BOOK} className="basics-breadcrumb__link">← {moonData.title}</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">月相纳甲盘</h1>
        <p className="page-subtitle">《周易参同契》· {chTitle(4)} · {chTitle(18)}</p>
      </div>

      <p className="ctqm-lead">{moonData.intro}</p>
      <p className="ctqm-how">
        <b>怎么看:</b>点盘上的月亮(可以拖着走),或点一个天干,或按 ← →,换一个日子。
        看三样东西一起变——卦里的阳爻怎样从下往上一根根长满、又怎样被阴爻一根根替下;那一天的月亮在哪个方位;它纳的是哪个天干。
        前半月看黄昏、后半月看平旦,月亮两回都是从西走到南、再到东,所以一个方位上坐着两卦、纳一对天干:庚辛在西,丙丁在南,甲乙在东。
        戊己留给居中的坎离,壬癸随乾坤——十个天干就这样分完了。
      </p>

      <div className="ctqm-main">
        <div className="ctqm-dial" ref={dialRef}>
          <MoonDial value={cur} onChange={setCur} detail={false} />
        </div>
        <aside className="ctqm-day" aria-live="polite" aria-label="这一日">
          <p className="ctqm-day__eyebrow">这一日</p>
          <DayPanel st={st} />
        </aside>
      </div>

      <section className="ctqm-sec">
        <h2 className="ctqm-sec__title">六卦一览</h2>
        <table className="ctqm-table">
          <thead>
            <tr><th>日</th><th>卦</th><th>纳甲</th><th>方位</th><th>见月</th><th>原文(第四章)</th><th>对读(第十八章)</th><th>易经</th></tr>
          </thead>
          <tbody>
            {STATIONS.filter((s) => s.kind === 'phase').map((s) => {
              const p = s.src
              return (
                <tr key={s.key} className={s.idx === cur ? 'is-on' : undefined}>
                  <td data-label="日">
                    <button type="button" className="ctqm-table__day" onClick={() => pick(s.idx)} aria-pressed={s.idx === cur}>
                      <MoonIcon day={p.day} /> {s.label}
                    </button>
                  </td>
                  <td data-label="卦">
                    <span className="ctqm-table__hex"><HexagramFigure binary={pureBinary(p.name)} size="sm" label={`${p.name}卦画`} />{p.name}<span className="ctqm-table__tri">{TRI[p.name].symbol}</span></span>
                  </td>
                  <td data-label="纳甲"><span><b className={`ctqm-gan ${wxClass(p.gan)}`}>{p.gan}</b></span></td>
                  <td data-label="方位"><span>{p.dir}{p.dirFrom === 'gan' && <span className="ctqm-table__mark" title="原句未写方位,由天干推出">*</span>}</span></td>
                  <td data-label="见月"><span>{p.seen === '昏' ? '黄昏' : '平旦'}</span></td>
                  <td data-label="原文" className="ctqm-table__q"><span><q>{p.quote}</q></span></td>
                  <td data-label="对读" className="ctqm-table__q"><span><q>{p.echo.quote}</q> <q>{p.yao.quote}</q></span></td>
                  <td data-label="易经"><span><Link to={`/hexagram/${p.hex}`} className="ctqm-table__go">第 {p.hex} 卦 ↗</Link></span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="ctqm-sec__foot">
          <span className="ctqm-table__mark">*</span> 原句未写方位,依天干五方补出。居中:
          {moonData.center.map((c, i) => (
            <span key={c.key}>{i > 0 && '、'}{c.name}<b className={`ctqm-gan ${wxClass(c.gan)}`}>{c.gan}</b>({c.role})</span>
          ))}
          ——<q>{moonData.centerNote.quote}</q>(第 {moonData.centerNote.ch} 章)。
        </p>
      </section>

      <section className="ctqm-sec ctqm-fanli">
        <h2 className="ctqm-sec__title">凡例</h2>
        <ul>
          {moonData.caveats.map((c, i) => <li key={i}>{c}</li>)}
          <li>页上每一句引文都取自站内《周易参同契》该章原文(第二章《{chTitle(2)}》、第四章《{chTitle(4)}》、第十八章《{chTitle(18)}》),逐字回查过。</li>
        </ul>
      </section>
    </div>
  )
}
