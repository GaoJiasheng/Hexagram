import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import QuizCard from '../components/QuizCard.jsx'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'
import LearnNextLink from '../components/LearnNextLink.jsx'

// 河图：每组 { label, positions:[{cx,cy}], odd } 其中 odd=true 为阳（白点）
const HETU_GROUPS = [
  { label: '一六共宗，水居北', note: '一(阳·白)在北，六(阴·黑)在北', odd: [1], even: [6],
    positions: [{ cx: 120, cy: 200 }], ePositions: [{ cx: 120, cy: 170 }] },
  { label: '二七同道，火居南', note: '二(阴·黑)在南，七(阳·白)在南', odd: [7], even: [2],
    positions: [{ cx: 120, cy: 70 }], ePositions: [{ cx: 120, cy: 40 }] },
  { label: '三八为朋，木居东', note: '三(阳·白)在东，八(阴·黑)在东', odd: [3], even: [8],
    positions: [{ cx: 190, cy: 120 }], ePositions: [{ cx: 220, cy: 120 }] },
  { label: '四九为友，金居西', note: '四(阴·黑)在西，九(阳·白)在西', odd: [9], even: [4],
    positions: [{ cx: 50, cy: 120 }], ePositions: [{ cx: 20, cy: 120 }] },
  { label: '五十居中，土为尊', note: '五(阳·白)居中，十(阴·黑)居中', odd: [5], even: [10],
    positions: [{ cx: 120, cy: 120 }], ePositions: [{ cx: 120, cy: 145 }] },
]

// 河图 SVG 点阵
function Dot({ cx, cy, yang, r = 5 }) {
  return (
    <circle
      cx={cx} cy={cy} r={r}
      fill={yang ? 'var(--paper)' : 'var(--ink)'}
      stroke={yang ? 'var(--ink)' : 'none'}
      strokeWidth={yang ? 1 : 0}
    />
  )
}

// 生成 n 个点，以 cx,cy 为中心排成一行
function DotRow({ cx, cy, n, yang, spacing = 13 }) {
  const offset = ((n - 1) * spacing) / 2
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Dot key={i} cx={cx - offset + i * spacing} cy={cy} yang={yang} />
      ))}
    </>
  )
}

const HETU_DATA = [
  // [number, cx, cy, isYang(odd)]
  [1,  120, 205, true],
  [2,  120,  35, false],
  [3,  215, 120, true],
  [4,   25, 120, false],
  [5,  120, 120, true],
  [6,  120, 175, false],
  [7,  120,  65, true],
  [8,  215, 148, false],
  [9,   25,  92, true],
  [10, 120, 148, false],
]

function HetuSvg({ highlighted }) {
  return (
    <svg viewBox="0 0 240 240" width="240" height="240" className="hetu-svg">
      <rect x={0} y={0} width={240} height={240} fill="var(--paper-raised)" rx={4} />
      {HETU_DATA.map(([n, cx, cy, yang]) => (
        <g key={n} opacity={highlighted !== null && highlighted !== n ? 0.25 : 1}>
          <DotRow cx={cx} cy={cy} n={n} yang={yang} />
        </g>
      ))}
    </svg>
  )
}

// 洛书九宫 grid 坐标(0-indexed row,col)
const LUOSHU_GRID = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
]
// row=0 top, row=2 bottom; 戴九履一、左三右七

function LuoshuSvg({ highlighted }) {
  const SIZE = 240
  const CELL = SIZE / 3
  const highlights = {
    rows: highlighted !== null ? LUOSHU_GRID.findIndex(r => r.includes(highlighted)) : -1,
    cols: highlighted !== null ? LUOSHU_GRID[0].findIndex((_, c) => LUOSHU_GRID.some(r => r[c] === highlighted)) : -1,
  }
  return (
    <svg viewBox="0 0 240 240" width="240" height="240" className="luoshu-svg">
      <rect x={0} y={0} width={240} height={240} fill="var(--paper-raised)" rx={4} />
      {LUOSHU_GRID.map((row, ri) =>
        row.map((n, ci) => {
          const cx = ci * CELL + CELL / 2
          const cy = ri * CELL + CELL / 2
          const isHighlighted = highlighted === n || highlights.rows === ri || highlights.cols === ci
          const yang = n % 2 !== 0
          return (
            <g key={n}>
              <rect
                x={ci * CELL + 2} y={ri * CELL + 2}
                width={CELL - 4} height={CELL - 4}
                fill={isHighlighted ? 'var(--cinnabar-bg)' : 'transparent'}
                rx={2}
              />
              <DotRow cx={cx} cy={cy} n={n} yang={yang} spacing={11} />
              <text x={cx} y={cy + 26} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>{n}</text>
            </g>
          )
        })
      )}
      {/* 格线 */}
      {[1, 2].map(i => (
        <g key={i}>
          <line x1={i * CELL} y1={2} x2={i * CELL} y2={238} stroke="var(--line)" strokeWidth="1" />
          <line x1={2} y1={i * CELL} x2={238} y2={i * CELL} stroke="var(--line)" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}

export default function HetuLuoshuPage() {
  usePageTitle('河图洛书')
  const [hetuHL, setHetuHL] = useState(null)
  const [luoshuHL, setLuoshuHL] = useState(null)

  useEffect(() => { markRead('hetu-luoshu') }, [])

  const hetuGroupOf = n => HETU_DATA.find(d => d[0] === n)
  const luoshuRowColSum = n => {
    for (const row of LUOSHU_GRID) if (row.includes(n)) return '该行/列/对角之和为 15'
    return ''
  }

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">河图</h2>
        <div className="basics-text">
          <p>河图以黑白圆点表示一至十数：白点为奇（阳），黑点为偶（阴）。一六居北、二七居南、三八居东、四九居西、五十居中，奇偶相配，象五方五行之生成。</p>
          <p>《系辞》："河出图，洛出书，圣人则之。"河图与先天八卦相配，象天地生成之数。</p>
        </div>
        <div className="hetu-container">
          <HetuSvg highlighted={hetuHL} />
          <div className="hetu-legend">
            {HETU_DATA.map(([n, , , yang]) => (
              <button
                key={n}
                className={`hetu-legend__item ${hetuHL === n ? 'hetu-legend__item--active' : ''}`}
                aria-pressed={hetuHL === n}
                onMouseEnter={() => setHetuHL(n)}
                onMouseLeave={() => setHetuHL(null)}
                onFocus={() => setHetuHL(n)}
                onClick={() => setHetuHL((h) => (h === n ? null : n))}
              >
                <span className={`hetu-dot ${yang ? 'hetu-dot--yang' : 'hetu-dot--yin'}`} />
                <span>{n} — {yang ? '阳' : '阴'}</span>
              </button>
            ))}
          </div>
        </div>
        {hetuHL !== null && (
          <p className="hetu-info text-soft">
            <strong>{hetuHL}</strong> — {hetuGroupOf(hetuHL)?.[3] ? '奇数·阳' : '偶数·阴'}
          </p>
        )}
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">洛书</h2>
        <div className="basics-text">
          <p>洛书以九宫排列一至九数：戴九履一（上九下一）、左三右七、二四为肩、六八为足、五居中央。任意一行、一列或对角线之和均为十五。</p>
          <p>洛书与后天八卦相配，象万物流行运化之序。点选或悬停任意格可见行列高亮。</p>
        </div>
        <div className="luoshu-container">
          <div>
            {LUOSHU_GRID.map((row, ri) => (
              <div key={ri} className="luoshu-row-hover">
                {row.map(n => (
                  <button
                    key={n}
                    className="luoshu-cell-btn"
                    onMouseEnter={() => setLuoshuHL(n)}
                    onMouseLeave={() => setLuoshuHL(null)}
                    onFocus={() => setLuoshuHL(n)}
                    onClick={() => setLuoshuHL((h) => (h === n ? null : n))}
                    aria-label={`洛书第 ${n} 格`}
                    aria-pressed={luoshuHL === n}
                  />
                ))}
              </div>
            ))}
            <LuoshuSvg highlighted={luoshuHL} />
          </div>
        </div>
        {luoshuHL !== null && (
          <p className="hetu-info text-soft">
            <strong>{luoshuHL}</strong> — {luoshuHL % 2 !== 0 ? '奇·阳' : '偶·阴'}；{luoshuRowColSum(luoshuHL)}
          </p>
        )}
      </section>

      <QuizCard topic="hetu-luoshu" />

      <div className="basics-cta">
        <p className="text-soft">这套数字正是梅花易数取数的依据——先天卦数即由此而来。</p>
        <Link to="/basics/meihua" className="btn btn--primary">学梅花易数 →</Link>
      </div>
      <LearnNextLink id="hetu-luoshu" />
    </div>
  )
}
