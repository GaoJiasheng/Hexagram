import { useSettings } from '../SettingsContext.jsx'
import { analyzePosition, describePosition } from '../engine/positions.js'
import AnnotatedText from './AnnotatedText.jsx'

export default function LineRow({ line, pos, binary, onHover, isHighlighted, guazhu }) {
  const { settings } = useSettings()
  const analysis = analyzePosition(pos, binary)
  const { chips, desc } = describePosition(analysis)
  const isGuazhu = guazhu?.line === pos

  return (
    <div
      className={`line-row ${isHighlighted ? 'line-row--highlighted' : ''}`}
      onMouseEnter={() => onHover?.(pos)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="line-row__header">
        <span className="line-row__title">{line.title}</span>
        {isGuazhu && <span className="line-chip line-chip--guazhu" title={guazhu.note}>卦主</span>}
        <span className="line-row__chips">
          {chips.map((c, i) => (
            <span key={i} className={`line-chip ${c === '中正' ? 'line-chip--zhongzheng' : ''}`}>{c}</span>
          ))}
        </span>
      </div>
      <p className="line-row__text"><AnnotatedText text={line.original} /></p>
      {line.xiaoxiang?.original && (
        <p className="line-row__xiaoxiang">{line.xiaoxiang.original}</p>
      )}
      {settings.showTranslation && (
        <>
          {line.translation && <p className="line-row__translation">〔译〕{line.translation}</p>}
          {line.xiaoxiang?.translation && (
            <p className="line-row__translation line-row__translation--xiang">〔象〕{line.xiaoxiang.translation}</p>
          )}
        </>
      )}
      <p className="line-row__analysis">{desc}</p>
    </div>
  )
}
