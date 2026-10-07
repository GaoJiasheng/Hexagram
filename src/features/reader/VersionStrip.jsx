import { useId, useState, useSyncExternalStore } from 'react'
import './VersionStrip.css'

// 横向小时间轴:几个节点各带一段话(《道德经》版本流变是第一个用户,形状是通用的)。
//
// data = { title, intro, nodes: [{ id, label, era, text, cites: [{ quote }] }], note }
//
// 交互只认点击 / 键盘(节点是 <button>,Enter 与空格天然可用),不挂 hover——
// 触屏没有 hover,且 CLAUDE.md 规矩「互动信息勿仅挂 hover」。
// 再点已展开的节点即收起;默认展开第一个,让人一眼看出这条轴是能点开的。
//
// 窄屏(≤480px)横排挤不下 label,改竖排列表,展开内容跟在所点节点下面;
// 宽屏展开内容统一落在轴下方。用 matchMedia 而非 CSS 双份渲染,免得同一段话在 DOM 里出现两次。

const NARROW_QUERY = '(max-width: 480px)'

function subscribeNarrow(cb) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(NARROW_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getNarrow = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW_QUERY).matches : false)
const getNarrowServer = () => false

function Panel({ id, labelId, node }) {
  const cites = (node.cites || []).filter((c) => c && c.quote)
  return (
    <div className="version-strip__panel" id={id} role="region" aria-labelledby={labelId}>
      <p className="version-strip__text">{node.text}</p>
      {cites.length > 0 && (
        <div className="version-strip__cites">
          <span className="version-strip__cite-label">引自站内导读</span>
          {cites.map((c, i) => (
            <q key={i} className="version-strip__quote">{c.quote}</q>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VersionStrip({ data }) {
  const uid = useId()
  const nodes = data?.nodes || []
  const [openId, setOpenId] = useState(() => (nodes[0] ? nodes[0].id : null))
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer)

  if (nodes.length === 0) return null

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id))
  const btnId = (i) => `${uid}-n${i}`
  const panelId = (i) => `${uid}-p${i}`
  const openIdx = nodes.findIndex((n) => n.id === openId)

  return (
    <section className={`version-strip${narrow ? ' version-strip--narrow' : ''}`}>
      {data.title && <h3 className="version-strip__title">{data.title}</h3>}
      {data.intro && <p className="version-strip__intro">{data.intro}</p>}

      <ol className="version-strip__track" style={{ '--vs-n': nodes.length }}>
        {nodes.map((n, i) => {
          const isOn = i === openIdx
          return (
            <li key={n.id} className={`version-strip__node${isOn ? ' version-strip__node--on' : ''}`}>
              <button
                type="button"
                id={btnId(i)}
                className="version-strip__btn"
                aria-expanded={isOn}
                aria-controls={isOn ? panelId(i) : undefined}
                onClick={() => toggle(n.id)}
              >
                <span className="version-strip__dot" aria-hidden="true" />
                <span className="version-strip__label">{n.label}</span>
                {n.era && <span className="version-strip__era">{n.era}</span>}
              </button>
              {narrow && isOn && <Panel id={panelId(i)} labelId={btnId(i)} node={n} />}
            </li>
          )
        })}
      </ol>

      {!narrow && openIdx >= 0 && <Panel id={panelId(openIdx)} labelId={btnId(openIdx)} node={nodes[openIdx]} />}

      {data.note && <p className="version-strip__note">{data.note}</p>}
    </section>
  )
}
