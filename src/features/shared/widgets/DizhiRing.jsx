import { useState } from 'react'
import {
  ZHI, zhiWuxing, yinYang, cangGan,
  ZHI_LIUHE, ZHI_SANHE, ZHI_SANHUI, ZHI_LIUCHONG, ZHI_XING, ZHI_LIUHAI,
} from '../ganzhi/index.js'
import './DizhiRing.css'

// 十二支盘 —— 子在正下方(北)顺时针排到午在正上方(南)。
// 几何本身就是知识:六冲是过圆心的直径、三合是等边三角形、三会是相邻三支的弧、
// 六合是一组互相平行的弦。点一个支,看它的藏干与它牵动的每一种关系。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const CANG_LABEL = ['本气', '中气', '余气']

const VB = 300, CX = 150, CY = 150, R = 112, NODE_R = 16
const posOf = (i) => {
  const rad = ((90 + i * 30) * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}
const POS = ZHI.map((_, i) => posOf(i))
const MONTH_NAME = ['十一月', '十二月', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月']
const CARDINAL = { 0: '北', 3: '东', 6: '南', 9: '西' }

const KIND_LABEL = { chong: '六冲', sanhe: '三合', sanhui: '三会', liuhe: '六合', xing: '三刑', hai: '六害' }
const KIND_ORDER = ['chong', 'sanhe', 'sanhui', 'liuhe', 'xing', 'hai']
const KIND_DESC = {
  chong: '过圆心的直径 —— 正对面',
  sanhe: '等边三角形 —— 三支会成一局',
  sanhui: '相邻三支的弧 —— 同一季会成一方',
  liuhe: '一组互相平行的弦',
  xing: '刑而不合,形状不一',
  hai: '穿—— 邻位相犯',
}

const EDGES = [
  ...ZHI_LIUCHONG.map((pair) => ({ kind: 'chong', zhi: pair })),
  ...ZHI_SANHE.map((e) => ({ kind: 'sanhe', zhi: e.zhi, meta: `${e.ju}局` })),
  ...ZHI_SANHUI.map((e) => ({ kind: 'sanhui', zhi: e.zhi, meta: `${e.fang}方` })),
  ...ZHI_LIUHE.map((e) => ({ kind: 'liuhe', zhi: e.pair, meta: e.hua ? `合化${e.hua}` : e.note })),
  ...ZHI_XING.map((e) => ({ kind: 'xing', zhi: e.zhi, self: !!e.self, name: e.name })),
  ...ZHI_LIUHAI.map((pair) => ({ kind: 'hai', zhi: pair })),
]

function otherOf(pair, z) { return pair.find((x) => x !== z) }

function edgeTitle(edge) {
  const names = edge.zhi.join('、')
  if (edge.kind === 'sanhe') return `三合 ${names} · ${edge.meta}`
  if (edge.kind === 'sanhui') return `三会 ${names} · ${edge.meta}`
  if (edge.kind === 'liuhe') return `六合 ${names}${edge.meta ? ` · ${edge.meta}` : ''}`
  if (edge.kind === 'xing') return `三刑 ${names} · ${edge.name}`
  if (edge.kind === 'chong') return `六冲 ${names}`
  return `六害 ${names}`
}

function EdgeShape({ edge, dim }) {
  if (edge.self) return null
  const pts = edge.zhi.map((z) => POS[ZHI.indexOf(z)])
  const cls = `dz-edge dz-edge--${edge.kind}${dim ? ' is-dim' : ''}`
  if (edge.kind === 'sanhui' && pts.length === 3) {
    return (
      <path className={cls} d={`M ${pts[0].x} ${pts[0].y} A ${R} ${R} 0 0 1 ${pts[2].x} ${pts[2].y}`} fill="none">
        <title>{edgeTitle(edge)}</title>
      </path>
    )
  }
  if (pts.length === 3) {
    return (
      <path className={cls} d={`M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} Z`} fill="none">
        <title>{edgeTitle(edge)}</title>
      </path>
    )
  }
  return (
    <line className={cls} x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y}>
      <title>{edgeTitle(edge)}</title>
    </line>
  )
}

export default function DizhiRing({ show, focus = [] }) {
  const [showSet, setShowSet] = useState(() => new Set((show && show.length ? show : ['chong']).filter((k) => KIND_ORDER.includes(k))))
  const [selected, setSelected] = useState(null)

  const toggleKind = (k) => setShowSet((cur) => { const next = new Set(cur); next.has(k) ? next.delete(k) : next.add(k); return next })
  const toggleSelect = (z) => setSelected((cur) => (cur === z ? null : z))

  const focusSet = new Set(focus)
  const visibleEdges = EDGES.filter((e) => showSet.has(e.kind))
  const selfGroup = EDGES.find((e) => e.self)
  const selfMarks = showSet.has('xing') ? selfGroup.zhi : []

  let detail = null
  if (selected) {
    const wx = zhiWuxing(selected)
    const cg = cangGan(selected)
    const cangText = cg.map((g, i) => `${g}(${CANG_LABEL[i]})`).join('、')
    const liuhe = ZHI_LIUHE.find((e) => e.pair.includes(selected))
    const chong = ZHI_LIUCHONG.find((p) => p.includes(selected))
    const hai = ZHI_LIUHAI.find((p) => p.includes(selected))
    const sanhe = ZHI_SANHE.find((e) => e.zhi.includes(selected))
    const sanhui = ZHI_SANHUI.find((e) => e.zhi.includes(selected))
    const xing = ZHI_XING.find((e) => e.zhi.includes(selected))
    detail = {
      head: `${selected} · ${yinYang(selected)}${wx}`,
      cang: `藏干:${cangText}。地支不像天干那样纯,一个支里可以同时含着两三种气。`,
      rels: [
        `六合:${liuhe ? `与${otherOf(liuhe.pair, selected)}相合${liuhe.hua ? `(合化${liuhe.hua})` : ''}` : '不与谁相合'}。`,
        `六冲:${chong ? `与${otherOf(chong, selected)}正对相冲` : '不与谁相冲'}。`,
        `三合局:${sanhe ? `与${sanhe.zhi.filter((x) => x !== selected).join('、')}共成${sanhe.ju}局` : '不在三合局中'}。`,
        `三会方:${sanhui ? `与${sanhui.zhi.filter((x) => x !== selected).join('、')}共会${sanhui.fang}方` : '不在三会方中'}。`,
        `三刑:${xing ? (xing.self ? '自刑——不须遇谁,见本支自成其刑' : `与${xing.zhi.filter((x) => x !== selected).join('、')}相刑(${xing.name})`) : '不在三刑之中'}。`,
        `六害:${hai ? `与${otherOf(hai, selected)}相害` : '不与谁相害'}。`,
      ],
    }
  }

  return (
    <div className="dz">
      <div className="dz-toggles" role="group" aria-label="选择显示的关系">
        {KIND_ORDER.map((k) => (
          <button
            key={k} type="button"
            className={`dz-toggle dz-toggle--${k}${showSet.has(k) ? ' is-on' : ''}`}
            aria-pressed={showSet.has(k)}
            title={KIND_DESC[k]}
            onClick={() => toggleKind(k)}
          >
            <span className={`dz-swatch dz-swatch--${k}`} aria-hidden="true" />
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB} ${VB}`} className="dz-svg" role="img" aria-label="十二地支圆盘:子在下、顺时针排列、午在上">
        <circle cx={CX} cy={CY} r={R} fill="none" className="dz-rim" />

        {visibleEdges.map((e, i) => {
          const dim = !!selected && !e.zhi.includes(selected)
          return <EdgeShape key={i} edge={e} dim={dim} />
        })}

        {selfMarks.map((z) => {
          const p = POS[ZHI.indexOf(z)]
          const dim = !!selected && selected !== z
          return <circle key={`self-${z}`} className={`dz-self${dim ? ' is-dim' : ''}`} cx={p.x} cy={p.y} r={NODE_R + 8} fill="none" />
        })}

        {ZHI.map((z, i) => {
          const p = POS[i]
          if (CARDINAL[i]) {
            const lp = { x: CX + (R + 30) * Math.cos(((90 + i * 30) * Math.PI) / 180), y: CY + (R + 30) * Math.sin(((90 + i * 30) * Math.PI) / 180) }
            return (
              <text key={`c-${z}`} x={lp.x} y={lp.y} className="dz-compass" textAnchor="middle" dominantBaseline="middle">{CARDINAL[i]}</text>
            )
          }
          return null
        })}
        {ZHI.map((z, i) => {
          const lp = { x: CX + (R + 24) * Math.cos(((90 + i * 30) * Math.PI) / 180), y: CY + (R + 24) * Math.sin(((90 + i * 30) * Math.PI) / 180) }
          return <text key={`m-${z}`} x={lp.x} y={lp.y} className="dz-month" textAnchor="middle" dominantBaseline="middle">{MONTH_NAME[i]}</text>
        })}

        {ZHI.map((z, i) => {
          const p = POS[i]
          const wx = zhiWuxing(z)
          const isSel = selected === z
          const isFocus = focusSet.has(z)
          const cls = [
            'dz-node', `sz-char--${WX_CLASS[wx]}`,
            isSel && 'is-active', isFocus && 'is-focus',
          ].filter(Boolean).join(' ')
          return (
            <g
              key={z}
              className={cls}
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={`${z},${yinYang(z)}${wx}`}
              transform={`translate(${p.x}, ${p.y})`}
              onClick={() => toggleSelect(z)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSelect(z) } }}
            >
              <title>{`${z} · ${yinYang(z)}${wx}`}</title>
              <circle r={NODE_R} className="dz-node__disc" />
              <text className="dz-node__ch" textAnchor="middle" dominantBaseline="central">{z}</text>
              <circle r={NODE_R + 6} fill="transparent" />
            </g>
          )
        })}
      </svg>

      <div className="dz-detail" aria-live="polite">
        {detail ? (
          <>
            <p className="dz-detail__head">{detail.head}</p>
            <p className="dz-detail__cang">{detail.cang}</p>
            <ul className="dz-detail__rels">
              {detail.rels.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </>
        ) : (
          <p className="dz-detail__hint">点一个地支,看它的藏干与它牵动的合冲刑害。</p>
        )}
      </div>
      <p className="dz-foot">冲是正对面,三合是等边三角,六合是一组平行线——关系全写在位置里。</p>
    </div>
  )
}
