import { useState } from 'react'
import ClassicText from './ClassicText.jsx'

export default function RuleCard({ result }) {
  const [expanded, setExpanded] = useState({})
  if (!result) return null
  const { ruleName, ruleNote, primaryTexts, secondaryTexts } = result

  const toggle = (label) => setExpanded(e => ({ ...e, [label]: !e[label] }))

  return (
    <div className="rule-card">
      <div className="rule-card__header">
        <span className="rule-card__name">断法·{ruleName}</span>
      </div>
      <p className="rule-card__note">{ruleNote}</p>
      {primaryTexts.map((item, i) => (
        <div key={i} className="rule-card__primary">
          <div className="rule-card__item-label">{item.label}</div>
          <ClassicText
            original={item.text?.original || ''}
            translation={item.text?.translation}
            emphasis
          />
        </div>
      ))}
      {secondaryTexts.length > 0 && (
        <div className="rule-card__secondary">
          {secondaryTexts.map((item, i) => (
            <div key={i} className="rule-card__collapsible">
              <button className="rule-card__toggle" onClick={() => toggle(item.label)}>
                <span>▸ {item.label}</span>
                <span>{expanded[item.label] ? '收起' : '展开'}</span>
              </button>
              {expanded[item.label] && (
                <ClassicText
                  original={item.text?.original || ''}
                  translation={item.text?.translation}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
