import { trigramById } from '../data.js'

export default function TrigramBadge({ trigramId, size = 'sm' }) {
  const t = trigramById[trigramId]
  if (!t) return null
  return (
    <span className={`trigram-badge trigram-badge--${size}`} title={`${t.name}（${t.nature}）`}>
      <span className="trigram-badge__symbol">{t.symbol}</span>
      <span className="trigram-badge__name">{t.name}</span>
      <span className="trigram-badge__nature">·{t.nature}</span>
    </span>
  )
}
