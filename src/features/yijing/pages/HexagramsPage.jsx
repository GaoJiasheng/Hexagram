import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import HexagramFigure from '../components/HexagramFigure.jsx'
import TrigramBadge from '../components/TrigramBadge.jsx'
import { allHexagrams, allTrigrams, TABLE, TRIGRAM_ORDER, trigramById } from '../data.js'
import { getZongGua, getCuoGua } from '../engine/transforms.js'
import { hexagramByBinary } from '../data.js'
import { getAllPalaces, GENERATION_NAMES } from '../engine/bagong.js'

const hexById = Object.fromEntries(allHexagrams.map(h => [h.id, h]))

// 自综卦(综卦=自身): 乾坤坎离颐大过中孚小过
const SELF_ZONG = new Set()
for (const h of allHexagrams) {
  if (getZongGua(h.binary) === h.binary) SELF_ZONG.add(h.id)
}

function getPairLabel(h1, h2) {
  if (h1.id === h2.id) return '自综'
  const z = getZongGua(h1.binary)
  if (z === h2.binary) return '综'
  const c = getCuoGua(h1.binary)
  if (c === h2.binary) return '错'
  return '综'
}

function MatrixView({ filterUpper, filterLower }) {
  const [hoveredRow, setHoveredRow] = useState(null)
  const [hoveredCol, setHoveredCol] = useState(null)
  const [tooltipCell, setTooltipCell] = useState(null)

  return (
    <div className="matrix-scroll">
      <table className="matrix-table" role="grid">
        <thead>
          <tr>
            <th className="matrix-th matrix-th--corner" scope="col">上↓ 下→</th>
            {TRIGRAM_ORDER.map(id => {
              const t = trigramById[id]
              return (
                <th
                  key={id}
                  scope="col"
                  className={`matrix-th ${hoveredCol === id || filterLower === id ? 'matrix-th--active' : ''}`}
                  onMouseEnter={() => setHoveredCol(id)}
                  onMouseLeave={() => setHoveredCol(null)}
                >
                  <TrigramBadge trigramId={id} />
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {TRIGRAM_ORDER.map(upperId => {
            if (filterUpper && filterUpper !== upperId) return null
            return (
              <tr
                key={upperId}
                onMouseEnter={() => setHoveredRow(upperId)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <th scope="row" className={`matrix-th ${hoveredRow === upperId || filterUpper === upperId ? 'matrix-th--active' : ''}`}>
                  <TrigramBadge trigramId={upperId} />
                </th>
                {TRIGRAM_ORDER.map(lowerId => {
                  if (filterLower && filterLower !== lowerId) return null
                  const hex = TABLE[upperId]?.[lowerId]
                  if (!hex) return <td key={lowerId} />
                  const isRowActive = hoveredRow === upperId || filterUpper === upperId
                  const isColActive = hoveredCol === lowerId || filterLower === lowerId
                  return (
                    <td
                      key={lowerId}
                      className={`matrix-cell ${isRowActive || isColActive ? 'matrix-cell--active' : ''}`}
                      onMouseEnter={() => setTooltipCell(hex.id)}
                      onMouseLeave={() => setTooltipCell(null)}
                    >
                      <Link to={`/hexagram/${hex.id}`} className="matrix-cell__link" aria-label={`${hex.name}卦`}>
                        <HexagramFigure binary={hex.binary} size="sm" label={hex.fullName} />
                        <span className="matrix-cell__name">{hex.name}</span>
                        <span className="matrix-cell__no">{hex.id}</span>
                      </Link>
                      {tooltipCell === hex.id && hex.judgment?.original && (
                        <div className="matrix-tooltip" role="tooltip">
                          {hex.judgment.original.slice(hex.name.length + 1, 50)}
                        </div>
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
  )
}

function SequenceView() {
  const pairs = []
  let i = 0
  const hexs = [...allHexagrams].sort((a, b) => a.id - b.id)
  while (i < hexs.length) {
    const h1 = hexs[i]
    if (SELF_ZONG.has(h1.id)) {
      pairs.push({ h1, h2: null })
      i++
    } else {
      const h2 = hexs[i + 1]
      pairs.push({ h1, h2 })
      i += 2
    }
  }
  const upperSection = pairs.filter(p => p.h1.id <= 30)
  const lowerSection = pairs.filter(p => p.h1.id > 30)

  const PairRow = ({ h1, h2 }) => {
    const label = h2 ? getPairLabel(h1, h2) : '自综'
    return (
      <div className="seq-pair">
        <Link to={`/hexagram/${h1.id}`} className="seq-item">
          <span className="seq-item__no">{String(h1.id).padStart(2, '0')}</span>
          <HexagramFigure binary={h1.binary} size="sm" label={h1.fullName} />
          <span className="seq-item__name">{h1.name}</span>
        </Link>
        <span className="seq-pair__rel" title={label === '综' ? '倒转覆卦' : label === '错' ? '阴阳旁通' : label}>{label}</span>
        {h2 ? (
          <Link to={`/hexagram/${h2.id}`} className="seq-item seq-item--right">
            <span className="seq-item__name">{h2.name}</span>
            <HexagramFigure binary={h2.binary} size="sm" label={h2.fullName} />
            <span className="seq-item__no">{String(h2.id).padStart(2, '0')}</span>
          </Link>
        ) : (
          <span className="seq-item seq-item--right seq-item--empty" />
        )}
      </div>
    )
  }

  return (
    <div className="seq-view">
      <div className="seq-section-title">上经（一至三十卦）</div>
      {upperSection.map(({ h1, h2 }) => <PairRow key={h1.id} h1={h1} h2={h2} />)}
      <div className="seq-section-title">下经（三十一至六十四卦）</div>
      {lowerSection.map(({ h1, h2 }) => <PairRow key={h1.id} h1={h1} h2={h2} />)}
    </div>
  )
}

const PALACES = getAllPalaces()

function BagongView({ highlightPalace }) {
  const rowRefs = useRef({})

  useEffect(() => {
    if (highlightPalace && rowRefs.current[highlightPalace]) {
      rowRefs.current[highlightPalace].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightPalace])

  return (
    <div className="bagong-scroll">
      <table className="bagong-table">
        <thead>
          <tr>
            <th className="bagong-th bagong-th--head">宫</th>
            {GENERATION_NAMES.map(g => (
              <th key={g} className="bagong-th">{g}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PALACES.map(({ trigram, name, element, sequence }) => (
            <tr
              key={trigram}
              ref={el => rowRefs.current[trigram] = el}
              className={`bagong-row ${highlightPalace === trigram ? 'bagong-row--active' : ''}`}
            >
              <td className="bagong-head">
                <span className="bagong-name">{name}</span>
                <span className="bagong-element">· {element}</span>
              </td>
              {sequence.map((binary, i) => {
                const hex = hexagramByBinary.get(binary)
                if (!hex) return <td key={i} />
                return (
                  <td key={i} className="bagong-cell">
                    <Link to={`/hexagram/${hex.id}`} className="bagong-cell__link">
                      <HexagramFigure binary={hex.binary} size="sm" label={hex.fullName} />
                      <span className="bagong-cell__name">{hex.name}</span>
                    </Link>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function HexagramsPage() {
  const [params, setParams] = useSearchParams()
  const viewParam = params.get('view') ?? 'matrix'
  const palaceParam = params.get('palace') ?? ''
  const [filterUpper, setFilterUpper] = useState('')
  const [filterLower, setFilterLower] = useState('')

  function setView(v) {
    const p = {}
    if (v !== 'matrix') p.view = v
    setParams(p, { replace: true })
  }

  const view = viewParam

  return (
    <div className="hexagrams-page">
      <div className="page-header">
        <h1 className="page-title">六十四卦</h1>
        <div className="page-controls">
          <div className="seg-control">
            <button className={`seg-btn ${view === 'matrix' ? 'seg-btn--active' : ''}`} onClick={() => setView('matrix')}>卦象矩阵</button>
            <button className={`seg-btn ${view === 'sequence' ? 'seg-btn--active' : ''}`} onClick={() => setView('sequence')}>序卦次序</button>
            <button className={`seg-btn ${view === 'bagong' ? 'seg-btn--active' : ''}`} onClick={() => setView('bagong')}>八宫</button>
          </div>
          {view === 'matrix' && (
            <div className="filter-row">
              <select className="filter-select" value={filterUpper} onChange={e => setFilterUpper(e.target.value)}>
                <option value="">含上卦</option>
                {TRIGRAM_ORDER.map(id => <option key={id} value={id}>{trigramById[id].name}</option>)}
              </select>
              <select className="filter-select" value={filterLower} onChange={e => setFilterLower(e.target.value)}>
                <option value="">含下卦</option>
                {TRIGRAM_ORDER.map(id => <option key={id} value={id}>{trigramById[id].name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {view === 'matrix' && <MatrixView filterUpper={filterUpper} filterLower={filterLower} />}
      {view === 'sequence' && <SequenceView />}
      {view === 'bagong' && <BagongView highlightPalace={palaceParam} />}
    </div>
  )
}
