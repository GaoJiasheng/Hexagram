import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isGan, ganWuxing } from '../ganzhi/index.js'
import './MatrixGrid.css'

// 通用可点矩阵(kind: matrix)—— 《穷通宝鉴》十干×十二月调候表、《本草经》6×3 等按行列排布的表格
// 都走这一件。**通用,不写死命理/中医内容**:行列与格子内容全由 props 给。
// 有 href 的格整格可点跳转;无 href 有 note 的格点开面板讲这格为什么是这个答案。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const cellKey = (r, c) => `${r}|${c}`

export default function MatrixGrid({ rows, cols, cells = {}, rowLabel, colLabel }) {
  const [pick, setPick] = useState(null) // { row, col }

  const hasNotes = Object.values(cells).some((c) => c && c.note)
  const picked = pick ? cells[cellKey(pick.row, pick.col)] : null
  const wide = cols.length > 6

  const toggle = (r, c) => setPick((cur) => (cur && cur.row === r && cur.col === c ? null : { row: r, col: c }))

  return (
    <div className={`mx${wide ? ' mx--wide' : ''}`}>
      {(rowLabel || colLabel) && (
        <div className="mx-axis">
          {rowLabel && <span className="mx-axis__item">↓ {rowLabel}</span>}
          {colLabel && <span className="mx-axis__item">→ {colLabel}</span>}
        </div>
      )}

      <div className="mx-scroll">
        <table className="mx-table">
          <thead>
            <tr>
              <th className="mx-corner" scope="col" />
              {cols.map((c) => (
                <th key={c} className="mx-colhead" scope="col">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowWx = isGan(r) ? WX_CLASS[ganWuxing(r)] : null
              return (
                <tr key={r}>
                  <th className={`mx-rowhead${rowWx ? ` sz-char--${rowWx}` : ''}`} scope="row">{r}</th>
                  {cols.map((c) => {
                    const cell = cells[cellKey(r, c)]
                    if (!cell) return <td key={c} className="mx-cell mx-cell--empty" aria-hidden="true" />
                    if (cell.href) {
                      return (
                        <td key={c} className="mx-cell">
                          <Link to={cell.href} className="mx-cellbtn mx-cellbtn--link">{cell.text}</Link>
                        </td>
                      )
                    }
                    const active = pick && pick.row === r && pick.col === c
                    return (
                      <td key={c} className="mx-cell">
                        {cell.note ? (
                          <button
                            type="button"
                            className={`mx-cellbtn${active ? ' is-active' : ''}`}
                            aria-pressed={active}
                            onClick={() => toggle(r, c)}
                          >
                            {cell.text}
                          </button>
                        ) : (
                          <span className="mx-cellbtn mx-cellbtn--static">{cell.text}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {hasNotes && (
        <div className="mx-detail" aria-live="polite">
          {picked && picked.note ? (
            <>
              <p className="mx-detail__head">{pick.row} × {pick.col}</p>
              <p className="mx-detail__body">{picked.note}</p>
            </>
          ) : (
            <p className="mx-detail__hint">点有内容的格,看具体解释。</p>
          )}
        </div>
      )}
      <p className="mx-foot">横是一类,竖是另一类——交叉处才是答案。</p>
    </div>
  )
}
