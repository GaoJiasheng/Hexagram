import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import shishi from '../../../data/yijing/shishi.json'
import { getHexagram } from '../data.js'
import { markRead } from '../storage.js'
import { lineTitle } from '../engine/transforms.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

function refLabel(ref) {
  if (ref.label) return ref.label
  const h = getHexagram(ref.hex)
  if (ref.line == null) return `${h.name}卦辞`
  return `${h.name}${lineTitle(ref.line, h.binary[ref.line - 1] === '1')}`
}

// 爻辞中的商周史事(v9 §3)——学堂篇,脱锚史实照 v9 §4 分级规范撰写
export default function ShishiPage() {
  usePageTitle('爻辞中的商周史事')
  const { hash } = useLocation()

  useEffect(() => { markRead('shishi') }, [])

  // 从 hash 锚点定位(卦页回链跳入);路由切换后 smooth 滚动会被渲染
  // 取消,延迟一帧用 instant 定位
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
    }, 50)
    return () => clearTimeout(t)
  }, [hash])

  return (
    <div className="shili-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>
      <div className="page-header">
        <h1 className="page-title">爻辞中的商周史事</h1>
        <p className="page-subtitle">
          王亥、高宗、帝乙、箕子、康侯——卦爻辞里嵌着的人名与战事，是商周之际的历史化石。本篇取王国维、顾颉刚以来学界较有共识的考证。
        </p>
      </div>

      {shishi.map((s) => (
        <section key={s.id} id={s.id} className="detail-section">
          <h2 className="detail-section__title">{s.title}</h2>
          {s.hexRefs.length > 0 && (
            <p className="shishi-refs">
              {s.hexRefs.map((r, i) => (
                <Link key={i} to={`/hexagram/${r.hex}`} className="shishi-ref">{refLabel(r)}</Link>
              ))}
            </p>
          )}
          {s.paragraphs.map((p, i) => (
            <p key={i} className="shili-reading">{p}</p>
          ))}
        </section>
      ))}
    </div>
  )
}
