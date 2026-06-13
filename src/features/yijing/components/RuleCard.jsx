import { useState } from 'react'
import ClassicText from './ClassicText.jsx'
import TermTip from './TermTip.jsx'
import { getHexAnchors } from '../zhushiAnchored.js'

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

// 所占经文:卦辞/爻辞挂词典模式字词注释(annotate),传文挂锚定注疏(anchorRef)
function ScriptureText({ item, emphasis = false }) {
  const anchors = item.anchorRef
    ? getHexAnchors(item.anchorRef.hexId, item.anchorRef.section, item.anchorRef.key)
    : null
  return (
    <ClassicText
      original={item.text?.original || ''}
      translation={item.text?.translation}
      emphasis={emphasis}
      annotate={!!item.annotate}
      anchors={anchors}
    />
  )
}

// 断卦传文(彖/小象):只释卦象不断吉凶;原文挂逐句锚定注疏
function Commentary({ commentary }) {
  if (!commentary) return null
  const anchors = getHexAnchors(
    commentary.hexId,
    commentary.kind === 'tuan' ? 'tuan' : 'xiaoxiang',
    commentary.key,
  )
  return (
    <div className="rule-card__commentary">
      <span className="rule-card__commentary-tag">
        {commentary.kind === 'tuan' ? '彖传释卦' : '小象释爻'}
      </span>
      <ClassicText
        original={commentary.original}
        translation={commentary.translation}
        anchors={anchors}
        className="classic-text--commentary"
      />
    </div>
  )
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
          <ScriptureText item={item} emphasis />
          <Commentary commentary={item.commentary} />
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
                <>
                  <ScriptureText item={item} />
                  <Commentary commentary={item.commentary} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
