import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import HexagramFigure from './HexagramFigure.jsx'
import TermTip from './TermTip.jsx'
import { getHuGua, getCuoGua, getZongGua } from '../engine/transforms.js'
import { getPalace, getAllPalaces, PALACE_ELEMENT } from '../engine/bagong.js'
import { hexagramByBinary } from '../data.js'

function DerivItem({ label, termKey, binary, desc }) {
  const [hover, setHover] = useState(false)
  const hex = hexagramByBinary.get(binary)
  if (!hex) return null
  return (
    <span className="deriv-item" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link to={`/hexagram/${hex.id}`} className="deriv-link">
        <TermTip term={termKey}><span className="deriv-label">{label}</span></TermTip>
        <span className="deriv-name">{hex.name}</span>
      </Link>
      {hover && (
        <span className="deriv-popover" role="tooltip">
          <HexagramFigure binary={hex.binary} size="sm" label={hex.fullName} />
          <span className="deriv-popover__info">
            <strong>{hex.fullName}</strong>
            <span>{desc}</span>
          </span>
        </span>
      )}
    </span>
  )
}

function PalaceChip({ binary }) {
  const [hover, setHover] = useState(false)
  const navigate = useNavigate()
  const palace = getPalace(binary)
  if (!palace) return null

  const { palaceTrigram, palaceName, generation, element, sequence } = palace

  return (
    <span
      className="deriv-item deriv-item--palace"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        className="deriv-link deriv-link--btn"
        onClick={() => navigate(`/hexagrams?view=bagong&palace=${palaceTrigram}`)}
        title={`${palaceName}${generation}，点击查看八宫视图`}
      >
        <span className="deriv-label">宫</span>
        <span className="deriv-name">{palaceName.replace('宫', '')}·{generation}</span>
      </button>
      {hover && (
        <span className="deriv-popover deriv-popover--palace" role="tooltip">
          <span className="deriv-palace-header">
            <strong>{palaceName}</strong>
            <span className="deriv-palace-element">· {element}</span>
          </span>
          <span className="deriv-palace-seq">
            {sequence.map((b, i) => (
              <span
                key={i}
                className={`deriv-palace-cell ${b === binary ? 'deriv-palace-cell--current' : ''}`}
              >
                <HexagramFigure
                  binary={b}
                  size="xs"
                  label={hexagramByBinary.get(b)?.fullName ?? b}
                />
                <span className="deriv-palace-cell__name">{hexagramByBinary.get(b)?.name ?? '?'}</span>
              </span>
            ))}
          </span>
        </span>
      )}
    </span>
  )
}

export default function DerivationStrip({ hexagram }) {
  const { binary } = hexagram
  const items = [
    { label: '错卦', termKey: 'cuogua', binary: getCuoGua(binary), desc: '阴阳全翻，旁通之卦' },
    { label: '综卦', termKey: 'zonggua', binary: getZongGua(binary), desc: '六爻倒序，覆卦' },
    { label: '互卦', termKey: 'hugua', binary: getHuGua(binary), desc: '取中四爻，卦中之卦' },
  ]
  return (
    <div className="deriv-strip">
      {items.map(item => (
        <DerivItem key={item.label} {...item} />
      ))}
      <PalaceChip binary={binary} />
    </div>
  )
}
