import { useEffect, useState } from 'react'
import { GAN, ZHI, yinYang, nayin } from '../ganzhi/index.js'
import './JiaziGrid.css'

// 六十甲子盘 —— 十天干(竖,10 行)× 十二地支(横,12 列)共 120 格,
// 只有阴阳相配(同奇偶)的六十格「存在」,其余六十格永远走不到。
// 交互:①点任意格看为什么(不)存在 ②「走一遍」播放器沿对角线走六十步,
// 天干每步下移一格、地支每步右移一格,亲眼看见它绕圈六十次才回到甲子。

// TABLE[g][z] = 六十甲子序号(0..59),g/z 为 GAN/ZHI 下标;不相配处留 null。
const TABLE = Array.from({ length: 10 }, () => Array(12).fill(null))
for (let i = 0; i < 60; i++) TABLE[i % 10][i % 12] = i

const STEP_MS = 650

function boldify(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) => (s.startsWith('**') ? <strong key={i}>{s.slice(2, -2)}</strong> : s))
}

export default function JiaziGrid({ highlight = [] }) {
  const [step, setStep] = useState(-1)     // -1 未开始;0..59 当前步(= 六十甲子序号)
  const [playing, setPlaying] = useState(false)
  const [pick, setPick] = useState(null)   // { g, z } 手动点选的格(优先于播放头)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setStep((s) => (s >= 59 ? s : s + 1))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [playing])

  useEffect(() => {
    if (playing && step >= 59) setPlaying(false)
  }, [playing, step])

  const goto = (s) => { setPlaying(false); setPick(null); setStep(Math.max(-1, Math.min(59, s))) }
  const togglePlay = () => { setPick(null); setPlaying((p) => !p) }
  const pickCell = (g, z) => { setPlaying(false); setPick({ g, z }) }

  const highlightSet = new Set(highlight)
  const active = pick || (step >= 0 ? { g: step % 10, z: step % 12 } : null)

  let detail = null
  if (active) {
    const { g, z } = active
    const idx = TABLE[g][z]
    const gan = GAN[g], zhi = ZHI[z]
    if (idx !== null) {
      const gz = gan + zhi
      detail = {
        head: `第 ${idx + 1} 位 · ${gz}`,
        body: `纳音**${nayin(gz)}**;${gan}${yinYang(gan)}、${zhi}${yinYang(zhi)},阴阳相配。`,
      }
    } else {
      const gy = yinYang(gan), zy = yinYang(zhi)
      detail = {
        head: `${gan}${zhi} 不存在`,
        body: `${gan}属${gy}、${zhi}属${zy}。天干地支同步各走一格,${gy}干永远只会碰上${gy}支。`,
      }
    }
  }

  const headerCells = [
    <div key="corner" className="jz-corner" aria-hidden="true" />,
    ...ZHI.map((z) => <div key={`h-${z}`} className="jz-head">{z}</div>),
  ]
  const bodyCells = GAN.flatMap((g, gi) => [
    <div key={`l-${g}`} className="jz-label">{g}</div>,
    ...ZHI.map((z, zi) => {
      const idx = TABLE[gi][zi]
      const valid = idx !== null
      const gz = valid ? g + z : null
      const isCurrent = valid && idx === step
      const isTrail = valid && step >= 0 && idx < step
      const isFocus = valid && highlightSet.has(gz)
      const isActive = !!active && active.g === gi && active.z === zi
      const cls = [
        'jz-cell', valid ? 'jz-cell--valid' : 'jz-cell--empty',
        isCurrent && 'is-current', isTrail && 'is-trail', isFocus && 'is-focus', isActive && 'is-active',
      ].filter(Boolean).join(' ')
      return (
        <button
          key={`${g}${z}`}
          type="button"
          className={cls}
          aria-pressed={isActive}
          aria-label={valid ? `${gz},六十甲子第 ${idx + 1} 位` : `${g}${z},阴阳不配、不存在`}
          onClick={() => pickCell(gi, zi)}
        >
          {valid && <span className="jz-cell__idx">{idx + 1}</span>}
          {valid && <span className="jz-cell__gz">{gz}</span>}
        </button>
      )
    }),
  ])

  const progress = step < 0
    ? '点「走一遍」开始,或直接点任意格'
    : step < 59
      ? `第 ${step + 1} 位 / 60 · ${GAN[step % 10]}${ZHI[step % 12]}`
      : '第 60 位 / 60 · 癸亥 —— 下一步回到甲子'

  return (
    <div className="jz">
      <div className="jz-grid" role="group" aria-label="六十甲子盘:十天干(竖)配十二地支(横)">
        {headerCells}
        {bodyCells}
      </div>

      <div className="jz-player" role="group" aria-label="走一遍播放器">
        <button type="button" className="jz-btn" onClick={() => goto(step - 1)} disabled={step <= -1}>⏮ 上一步</button>
        <button type="button" className={`jz-btn${playing ? ' is-playing' : ''}`} aria-pressed={playing} onClick={togglePlay}>
          {playing ? '⏸ 暂停' : '▶ 走一遍'}
        </button>
        <button type="button" className="jz-btn" onClick={() => goto(step + 1)} disabled={step >= 59}>下一步 ⏭</button>
        <span className="jz-player__progress" aria-live="polite">{progress}</span>
      </div>

      <div className="jz-detail" aria-live="polite">
        {detail ? (
          <>
            <p className="jz-detail__head">{detail.head}</p>
            <p className="jz-detail__body">{boldify(detail.body)}</p>
          </>
        ) : (
          <p className="jz-detail__hint">点任意一格,看它是第几位、为什么(不)存在。</p>
        )}
      </div>
      <p className="jz-foot">十与十二各走一格,要走六十步才同时回到起点——所以是六十甲子。</p>
    </div>
  )
}
