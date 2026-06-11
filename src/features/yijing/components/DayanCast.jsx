import { useState } from 'react'
import HexagramFigure from './HexagramFigure.jsx'
import { castLine, makeSeededRng, cryptoRng, LINE_LABELS } from '../engine/dayan.js'
import { hexagramByBinary } from '../data.js'

const DEMO_SEED = 42
const LINE_NAMES = ['初', '二', '三', '四', '五', '上']
const CHANGE_NAMES = ['一', '二', '三']

// 生成一局六爻
function generateSession(isDemo) {
  const rng = isDemo ? makeSeededRng(DEMO_SEED) : cryptoRng
  return Array.from({ length: 6 }, () => castLine(rng))
}

function StickDots({ n, yang }) {
  const count = Math.min(n, 36)
  return (
    <span className="stick-dots">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`stick-dot ${yang ? 'stick-dot--yang' : 'stick-dot--yin'}`} />
      ))}
      {n > 36 && <span className="stick-extra">…{n}</span>}
    </span>
  )
}

/**
 * 大衍揲蓍步进组件(v3 §5.1)
 * @param {boolean}  compact    工作台窄栏样式(纵向堆叠)
 * @param {Function} onResult   (hex, movingLines) => void  成卦按钮回调
 * @param {string}   resultLabel 成卦按钮文案
 */
export default function DayanCast({ compact = false, onResult, resultLabel = '在工作台打开 →' }) {
  const [mode, setMode] = useState('demo')
  const [session, setSession] = useState(null)
  // cursor: { line: 0-5, change: 0-3 }  change=0=爻未开始, 1-3=变已完成
  const [cursor, setCursor] = useState({ line: 0, change: 0 })

  function start(newMode) {
    setMode(newMode)
    setSession({ lines: generateSession(newMode === 'demo') })
    setCursor({ line: 0, change: 0 })
  }

  function restart() {
    setSession({ lines: generateSession(mode === 'demo') })
    setCursor({ line: 0, change: 0 })
  }

  function advance() {
    if (!session) { start(mode); return }
    const { line, change } = cursor
    if (change < 3) {
      setCursor({ line, change: change + 1 })
    } else if (line < 5) {
      setCursor({ line: line + 1, change: 0 })
    }
  }

  function skipCurrentLine() {
    const { line } = cursor
    if (line < 5) setCursor({ line: line + 1, change: 0 })
    else setCursor({ line: 5, change: 3 })
  }

  const isDone = session && cursor.line === 5 && cursor.change === 3

  const completedLines = !session ? [] : session.lines.slice(0, cursor.line + (cursor.change === 3 ? 1 : 0)).map(l => l.value)

  const resultBinary = isDone
    ? session.lines.map(l => (l.value === 7 || l.value === 9) ? '1' : '0').join('')
    : null
  const resultHex = resultBinary ? hexagramByBinary.get(resultBinary) : null
  const movingLines = isDone
    ? session.lines.map((l, i) => (l.value === 6 || l.value === 9) ? i + 1 : 0).filter(Boolean)
    : []

  const currentLine = session?.lines[cursor.line]
  const visibleChanges = currentLine?.steps.slice(0, cursor.change) ?? []

  const btnLabel = !session ? '开始起卦' :
    cursor.change < 3 ? `第${CHANGE_NAMES[cursor.change]}变 →` :
    cursor.line < 5 ? `起第${LINE_NAMES[cursor.line + 1]}爻 →` : null

  return (
    <div className={`dayan-cast ${compact ? 'dayan-cast--compact' : ''}`}>
      <div className="dayan-mode-bar">
        <div className="seg-control">
          <button className={`seg-btn ${mode === 'demo' ? 'seg-btn--active' : ''}`} onClick={() => start('demo')}>演示（固定例）</button>
          <button className={`seg-btn ${mode === 'real' ? 'seg-btn--active' : ''}`} onClick={() => start('real')}>实占（随机）</button>
        </div>
        {mode === 'real' && <p className="dayan-real-note text-soft">此为随机起卦，仅供体验古法</p>}
      </div>

      <div className="dayan-layout">
        {/* 左：过程展示 */}
        <div className="dayan-process">
          {session && !isDone && (
            <div className="dayan-process__label text-soft">
              第 {cursor.line + 1} / 6 爻 · 第 {cursor.change} / 3 变完成
            </div>
          )}

          {visibleChanges.map((step, i) => (
            <div key={i} className="dayan-change">
              <div className="dayan-change__title">第{CHANGE_NAMES[i]}变</div>
              <div className="dayan-change__body">
                <div className="dayan-step">四十九→分二：左 <strong>{step.left}</strong> / 右 <strong>{step.right}</strong></div>
                <div className="dayan-step">挂一→右余 <strong>{step.right - 1}</strong></div>
                <div className="dayan-step">揲四→左余 <strong>{step.leftRem}</strong>，右余 <strong>{step.rightRem}</strong></div>
                <div className="dayan-step dayan-step--result">
                  归奇 = {step.leftRem} + {step.rightRem} + 1 = <strong>{step.guiqi}</strong>
                  <span className="dayan-note">（{i === 0 ? '首变必5或9' : '二三变必4或8'}）</span>
                  → 余 <strong>{step.remaining}</strong>
                </div>
                <StickDots n={step.remaining} yang={step.remaining > 28} />
              </div>
            </div>
          ))}

          {cursor.change === 3 && currentLine && (
            <div className="dayan-line-result">
              余 {currentLine.remaining} 枚 ÷ 4 = <strong>{currentLine.value}</strong>
              <span className="dayan-line-label"> {LINE_LABELS[currentLine.value]}</span>
              {(currentLine.value === 6 || currentLine.value === 9) && <span className="dayan-moving">动爻</span>}
            </div>
          )}

          <div className="dayan-btns">
            {!isDone && btnLabel && (
              <button className="btn btn--primary" onClick={advance}>{btnLabel}</button>
            )}
            {session && !isDone && cursor.change > 0 && cursor.change < 3 && (
              <button className="btn btn--secondary" onClick={skipCurrentLine}>快进此爻</button>
            )}
            {session && (
              <button className="btn btn--secondary" onClick={restart}>重新起卦</button>
            )}
            {isDone && resultHex && onResult && (
              <button className="btn btn--primary" onClick={() => onResult(resultHex, movingLines)}>
                {resultLabel}
              </button>
            )}
          </div>
        </div>

        {/* 右：已成之爻 */}
        <div className="dayan-yao-col">
          <div className="dayan-yao-title">已成之爻（自下而上）</div>
          {[5, 4, 3, 2, 1, 0].map(pos => {
            const val = completedLines[pos]
            const isCurrent = session && !isDone && pos === cursor.line && cursor.change === 3
            return (
              <div key={pos} className={`dayan-yao-row ${isCurrent ? 'dayan-yao-row--current' : ''}`}>
                <span className="dayan-yao-pos">{LINE_NAMES[pos]}爻</span>
                {val !== undefined
                  ? <span className={`dayan-yao-label ${val === 6 || val === 9 ? 'dayan-yao-label--moving' : ''}`}>{LINE_LABELS[val]}</span>
                  : <span className="dayan-yao-label text-faint">——</span>
                }
              </div>
            )
          })}

          {isDone && resultHex && (
            <div className="dayan-final">
              <HexagramFigure binary={resultBinary} size="md" movingLines={movingLines} label={resultHex.fullName} />
              <div className="dayan-final__name">{resultHex.fullName}</div>
              {movingLines.length > 0 && (
                <div className="dayan-final__dong text-soft">动爻：{movingLines.join('、')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
