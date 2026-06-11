import { Link } from 'react-router-dom'
import HexagramFigure from './HexagramFigure.jsx'

export default function HexagramCard({ hexagram, showSummary = true }) {
  if (!hexagram) return null
  return (
    <Link to={`/hexagram/${hexagram.id}`} className="hexagram-card" aria-label={`${hexagram.name}卦，第${hexagram.id}卦`}>
      <HexagramFigure binary={hexagram.binary} size="sm" label={hexagram.fullName} />
      <div className="hexagram-card__info">
        <div className="hexagram-card__name">{hexagram.name}</div>
        <div className="hexagram-card__no">第{hexagram.id}卦</div>
        {showSummary && hexagram.summary && (
          <div className="hexagram-card__summary">{hexagram.summary}</div>
        )}
      </div>
    </Link>
  )
}
