import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageTitle } from '../yijing/hooks/usePageTitle.js'
import { loadText } from '../reader/corpus.js'
import DATA from '../../data/zhongyi/shanghan-liujing.json'
import { liujingIndex } from './shapes.js'
import './ZhongyiShapes.css'

// I3 · 《伤寒论》六经目录(design-v24 §13)。二十二篇原书本就按「六经 + 治法」排:
// 前四篇讲脉法与总例,中间八篇是太阳(上中下)/ 阳明 / 少阳 / 太阴 / 少阴 / 厥阴,再两篇六经之外,末八篇按可 / 不可(汗吐下)排。
// 这一页把它摆成六块,各挂篇与条文数;受病次第引《伤寒例》原文。**只是目录**,不画「传变路径」,不当诊疗图——研习不诊疗。

const SRC = DATA.source
const paraHref = (para) => `/zhongyi/${SRC.slug}/${SRC.ch}#p${para + 1}`

function JingCard({ ch }) {
  return (
    <article className={`zy-jing${ch.yin ? ' zy-jing--yin' : ''}`} aria-labelledby={`zy-jing-${ch.key}`}>
      <div className="zy-jing__head">
        <span id={`zy-jing-${ch.key}`} className="zy-jing__name">{ch.label}</span>
        <span className="zy-jing__count">{ch.list.length} 篇 · {ch.count} 条</span>
      </div>
      <p className="zy-jing__quote">
        <q>{ch.quote}</q>
        <Link to={paraHref(ch.para)}>《{SRC.title}》→</Link>
      </p>
      <ul className="zy-jing__list">
        {ch.list.map((c) => (
          <li key={c.no}>
            <Link to={`/zhongyi/${SRC.slug}/${c.no}`}>
              <span>{c.title}</span>
              <small>{c.count} 条</small>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  )
}

export default function ShanghanLiujingPage() {
  usePageTitle('六经目录 · 伤寒论', '观和')
  const [state, setState] = useState({ book: null, failed: false })
  useEffect(() => {
    let alive = true
    loadText('zhongyi', SRC.slug)
      .then((book) => alive && setState({ book, failed: !book }))
      .catch(() => alive && setState({ book: null, failed: true }))
    return () => { alive = false }
  }, [])

  const idx = useMemo(() => (state.book ? liujingIndex(state.book, DATA) : null), [state.book])
  const yang = idx ? idx.channels.filter((c) => !c.yin) : []
  const yin = idx ? idx.channels.filter((c) => c.yin) : []

  return (
    <div className="zy-shape">
      <div className="basics-breadcrumb">
        <Link to={`/zhongyi/${SRC.slug}`} className="basics-breadcrumb__link">← 伤寒论</Link>
        <span className="zy-shape__crumb-sep" aria-hidden="true">·</span>
        <Link to="/zhongyi" className="basics-breadcrumb__link">中医典籍</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">六经目录</h1>
        <p className="page-subtitle">《伤寒论》二十二篇,原书自己的骨架是「六经」加「治法」。</p>
      </div>

      <p className="zy-shape__intro">
        通行本《伤寒论》二十二篇:前四篇讲脉法与总例;中间从「辨太阳病脉证并治」到「辨厥阴病脉证并治」是<strong>六经</strong>,
        太阳一经就占了上、中、下三篇,条文最多;再往后两篇是六经之外的病;末八篇不按经、按<strong>法</strong>——可发汗、不可发汗、可吐、不可吐、可下、不可下——
        是原书自己另立的一套目录。<strong>六块各挂着篇与条文数</strong>,受病次第一句引自《伤寒例》;点篇名读原文。
      </p>

      <div className="shelf-disclaimer">
        ⚠ 这一页<strong>只是目录</strong>:哪一经在哪几篇、各有多少条。不画「传变路径」,不作辨证图解;
        《伤寒论》的方证是原典记载,本站作医史文献研习,不构成任何医疗建议。
      </div>

      {state.failed && <p className="mingli-topic-placeholder">原文没能载入,刷新再试一次。</p>}
      {!idx && !state.failed && <div className="mingli-topic-loading" aria-busy="true" />}
      {idx && (
        <>
          <div className="zy-liujing">
            <p className="zy-liujing__row-label">
              <b>{DATA.sanyang.label}</b>
              <q>{DATA.sanyang.quote}</q>
              <Link to={paraHref(DATA.sanyang.para)}>《{SRC.title}》→</Link>
            </p>
            {yang.map((c) => <JingCard key={c.key} ch={c} />)}
            <p className="zy-liujing__row-label">
              <b>{DATA.sanyin.label}</b>
              <q>{DATA.sanyin.quote}</q>
              <Link to={paraHref(DATA.sanyin.para)}>《{SRC.title}》→</Link>
            </p>
            {yin.map((c) => <JingCard key={c.key} ch={c} />)}
          </div>

          <section className="zy-shape__section">
            <h2 className="zy-shape__h2">六经之外的篇</h2>
            <div className="zy-groups">
              {idx.groups.map((g) => (
                <article key={g.key} className="zy-group">
                  <h3 className="zy-group__name">{g.label}</h3>
                  <p className="zy-group__note">{g.note}</p>
                  <ul className="zy-jing__list">
                    {g.list.map((c) => (
                      <li key={c.no}>
                        <Link to={`/zhongyi/${SRC.slug}/${c.no}`}><span>{c.title}</span><small>{c.count} 条</small></Link>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      <p className="zy-shape__fanli">
        <b>凡例</b> 篇题与条文数从站内原文取,六经各挂哪几篇由篇题派生,二十二篇各归一处、不重不漏,check-data 复核;
        六句「受病」引文是《伤寒例》第 {DATA.channels[0].para + 1}–{DATA.channels[5].para + 1} 段原文的逐字摘录。「条」按本站分段计,与各家条文编号(如宋本 398 条)不同。
      </p>
      <p className="zy-shape__next"><Link to={`/zhongyi/${SRC.slug}/1`}>从「辨脉法」读起 →</Link></p>
    </div>
  )
}
