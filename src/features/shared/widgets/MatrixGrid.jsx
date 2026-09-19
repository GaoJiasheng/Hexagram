import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isGan, ganWuxing } from '../ganzhi/index.js'
import './MatrixGrid.css'

// 通用可点矩阵(kind: matrix)—— 《穷通宝鉴》十干×十二月调候表、《本草经》6×3 等按行列排布的表格
// 都走这一件。**通用,不写死命理/中医内容**:行列与格子内容全由 props 给。
// 点格的三种情形:只有 href → 整格直接跳转;有 note(或 quote)→ 点开下方面板讲这格为什么是这个答案,
// 面板里再给「读原文」链接(若同时有 href)——**先让人看懂,再让人跳走**;什么都没有 → 静态文字。
// colorGan:格内文字里的天干字按五行着色(《穷通宝鉴》调候表每格就是两三个天干)。

const WX_CLASS = { 木: 'mu', 火: 'huo', 土: 'tu', 金: 'jin', 水: 'shui' }
const cellKey = (r, c) => `${r}|${c}`

export default function MatrixGrid({ rows, cols, cells = {}, rowLabel, colLabel, colorGan = false, foot, linkLabel = '读原文这一节 →' }) {
  const [pick, setPick] = useState(null) // { row, col }

  const hasNotes = Object.values(cells).some((c) => c && (c.note || c.quote))
  // 格内文字:colorGan 时逐字看,是天干就套五行色
  const cellText = (text) => (!colorGan ? text : [...text].map((ch, i) => (
    isGan(ch) ? <span key={i} className={`sz-char--${WX_CLASS[ganWuxing(ch)]} mx-gan`}>{ch}</span> : ch
  )))
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
                    const explain = cell.note || cell.quote
                    if (cell.href && !explain) {
                      return (
                        <td key={c} className="mx-cell">
                          <Link to={cell.href} className="mx-cellbtn mx-cellbtn--link">{cellText(cell.text)}</Link>
                        </td>
                      )
                    }
                    const active = pick && pick.row === r && pick.col === c
                    return (
                      <td key={c} className="mx-cell">
                        {explain ? (
                          <button
                            type="button"
                            className={`mx-cellbtn${active ? ' is-active' : ''}${cell.caveat ? ' mx-cellbtn--caveat' : ''}`}
                            aria-pressed={active}
                            onClick={() => toggle(r, c)}
                          >
                            {cellText(cell.text)}
                          </button>
                        ) : (
                          <span className="mx-cellbtn mx-cellbtn--static">{cellText(cell.text)}</span>
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
          {picked && (picked.note || picked.quote) ? (
            <>
              <p className="mx-detail__head">{pick.row} × {pick.col}{picked.sub ? <span className="mx-detail__sub">{picked.sub}</span> : null}</p>
              {picked.quote && <blockquote className="mx-detail__quote">{picked.quote}</blockquote>}
              {picked.note && <p className="mx-detail__body">{picked.note}</p>}
              {picked.caveat && <p className="mx-detail__caveat"><span className="mx-detail__caveat-tag">原书此处有出入</span>{picked.caveat}</p>}
              {picked.href && <p className="mx-detail__link"><Link to={picked.href}>{linkLabel}</Link></p>}
            </>
          ) : (
            <p className="mx-detail__hint">点有内容的格,看具体解释。</p>
          )}
        </div>
      )}
      <p className="mx-foot">{foot || '横是一类,竖是另一类——交叉处才是答案。'}</p>
    </div>
  )
}
