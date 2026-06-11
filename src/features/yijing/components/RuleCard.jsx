import { useState } from 'react'
import ClassicText from './ClassicText.jsx'
import TermTip from './TermTip.jsx'

// 断法名称到 glossary key 的映射（动爻数 → 涉及核心术语）
const RULE_TERM_MAP = {
  '无动爻': 'bengua',
  '一爻变': 'dongyao',
  '二爻变': 'dongyao',
  '三爻变': 'zhenhui',
  '四爻变': 'dongyao',
  '五爻变': 'dongyao',
  '六爻变': 'dongyao',
  '用九': 'dongyao',
  '用六': 'dongyao',
}

export default function RuleCard({ result }) {
  const [expanded, setExpanded] = useState({})
  if (!result) return null
  const { ruleName, ruleNote, primaryTexts, secondaryTexts } = result
  const termKey = RULE_TERM_MAP[ruleName]

  const toggle = (label) => setExpanded(e => ({ ...e, [label]: !e[label] }))

  return (
    <div className="rule-card">
      <div className="rule-card__header">
        <span className="rule-card__name">
          断法·{termKey
            ? <TermTip term={termKey}>{ruleName}</TermTip>
            : ruleName
          }
        </span>
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
