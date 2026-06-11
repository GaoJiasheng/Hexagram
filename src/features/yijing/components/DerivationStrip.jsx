import { Link } from 'react-router-dom'
import { useState } from 'react'
import HexagramFigure from './HexagramFigure.jsx'
import { getHuGua, getCuoGua, getZongGua } from '../engine/transforms.js'
import { hexagramByBinary } from '../data.js'

function DerivItem({ label, binary, desc }) {
  const [hover, setHover] = useState(false)
  const hex = hexagramByBinary.get(binary)
  if (!hex) return null
  return (
    <span className="deriv-item" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Link to={`/hexagram/${hex.id}`} className="deriv-link">
        <span className="deriv-label">{label}</span>
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

export default function DerivationStrip({ hexagram }) {
  const { binary } = hexagram
  const items = [
    { label: '错卦', binary: getCuoGua(binary), desc: '阴阳全翻，旁通之卦' },
    { label: '综卦', binary: getZongGua(binary), desc: '六爻倒序，覆卦' },
    { label: '互卦', binary: getHuGua(binary), desc: '取中四爻，卦中之卦' },
  ]
  return (
    <div className="deriv-strip">
      {items.map(item => (
        <DerivItem key={item.label} {...item} />
      ))}
    </div>
  )
}
