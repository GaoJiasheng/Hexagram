import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { allTrigrams, trigramById, TRIGRAM_ORDER } from '../data.js'
import QuizCard from '../components/QuizCard.jsx'
import { markRead } from '../storage.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const XIANTIAN_ORDER = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun']

function YaoSvg({ isYang }) {
  return (
    <svg width="72" height="13" viewBox="0 0 72 13" style={{ display: 'block' }}>
      {isYang ? (
        <rect x={0} y={0} width={72} height={13} fill="var(--ink)" />
      ) : (
        <>
          <rect x={0} y={0} width={27} height={13} fill="var(--ink)" />
          <rect x={45} y={0} width={27} height={13} fill="var(--ink)" />
        </>
      )}
    </svg>
  )
}

function TreeNode({ depth, index, expanded, onToggle, children }) {
  const LABELS = [
    ['太极'],
    ['阴', '阳'],
    ['老阴', '少阳', '少阴', '老阳'],
    TRIGRAM_ORDER.map(id => trigramById[id].name),
  ]
  const label = LABELS[depth]?.[index] || ''
  const hasChildren = depth < 3
  const isOpen = expanded[`${depth}-${index}`]
  return (
    <div className={`tree-node tree-node--depth${depth}`}>
      <button
        className={`tree-node__btn ${isOpen ? 'tree-node__btn--open' : ''}`}
        onClick={() => hasChildren && onToggle(depth, index)}
        disabled={!hasChildren}
      >
        {depth === 3 ? trigramById[TRIGRAM_ORDER[index]]?.symbol + ' ' : ''}
        {label}
      </button>
      {isOpen && children && <div className="tree-children">{children}</div>}
    </div>
  )
}

function BaguaTree() {
  const [expanded, setExpanded] = useState({ '0-0': false })
  function toggle(depth, index) {
    setExpanded(prev => ({ ...prev, [`${depth}-${index}`]: !prev[`${depth}-${index}`] }))
  }
  function renderLevel(depth, startIndex, count) {
    return Array.from({ length: count }, (_, i) => {
      const idx = startIndex + i
      return (
        <TreeNode key={idx} depth={depth} index={idx} expanded={expanded} onToggle={toggle}>
          {depth < 2 && expanded[`${depth}-${idx}`] && renderLevel(depth + 1, idx * 2, 2)}
          {depth === 2 && expanded[`${depth}-${idx}`] && renderLevel(depth + 1, idx * 2, 2)}
        </TreeNode>
      )
    })
  }
  return (
    <div className="bagua-tree">
      <TreeNode depth={0} index={0} expanded={expanded} onToggle={toggle}>
        {expanded['0-0'] && renderLevel(1, 0, 2)}
      </TreeNode>
    </div>
  )
}

function TrigramCard({ trigram }) {
  return (
    <div className="trigram-card">
      <div className="trigram-card__symbol">{trigram.symbol}</div>
      <div className="trigram-card__name">{trigram.name}</div>
      <div className="trigram-card__attrs">
        <div className="trigram-card__attr-row"><span className="attr-label">自然</span><span>{trigram.nature}</span></div>
        <div className="trigram-card__attr-row"><span className="attr-label">性情</span><span>{trigram.attribute}</span></div>
        <div className="trigram-card__attr-row"><span className="attr-label">家人</span><span>{trigram.family}</span></div>
        <div className="trigram-card__attr-row"><span className="attr-label">身体</span><span>{trigram.body}</span></div>
        <div className="trigram-card__attr-row"><span className="attr-label">动物</span><span>{trigram.animal}</span></div>
        <div className="trigram-card__attr-row"><span className="attr-label">后天</span><span>{trigram.directionHoutian}</span></div>
      </div>
    </div>
  )
}

export default function YinYangPage() {
  usePageTitle('阴阳八卦')
  const [hovered, setHovered] = useState(null)

  useEffect(() => { markRead('yinyang') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">阴阳与爻</h2>
        <div className="yao-demo">
          <div className="yao-demo__item">
            <YaoSvg isYang />
            <p className="yao-demo__label">阳爻（—）刚健，代表积极主动之力。</p>
          </div>
          <div className="yao-demo__item">
            <YaoSvg isYang={false} />
            <p className="yao-demo__label">阴爻（--）柔顺，代表包容承载之力。</p>
          </div>
        </div>
        <div className="basics-text">
          <p>《易》以三爻成卦，象天地人「三才」：上爻为天，中爻为人，下爻为地。三阴三阳两两相应，衍生出八种基本卦象（经卦）。</p>
          <p>六十四卦由两个经卦上下相叠而成，下卦为内（贞），上卦为外（悔），合六爻以穷天下之变。</p>
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">太极生八卦</h2>
        <p className="basics-text">点击节点逐层展开，观太极→两仪→四象→八卦之生化次序。</p>
        <BaguaTree />
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">八卦取象</h2>
        <div className="trigram-cards-grid">
          {TRIGRAM_ORDER.map(id => (
            <TrigramCard key={id} trigram={trigramById[id]} />
          ))}
        </div>
      </section>

      <section className="basics-section">
        <h2 className="basics-section__title">先天与后天八卦方位</h2>
        <div className="bagua-maps">
          <div className="bagua-map">
            <h3 className="bagua-map__title">先天八卦（伏羲）</h3>
            <svg viewBox="0 0 240 240" width="240" height="240" className="bagua-svg">
              {XIANTIAN_ORDER.map((id, i) => {
                const angle = (i * 45 - 90) * (Math.PI / 180)
                const cx = 120 + 90 * Math.cos(angle)
                const cy = 120 + 90 * Math.sin(angle)
                const t = trigramById[id]
                return (
                  <g key={id} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                    <circle cx={cx} cy={cy} r={22} fill={hovered === id ? 'var(--cinnabar-bg)' : 'var(--paper-raised)'} stroke={hovered === id ? 'var(--cinnabar)' : 'var(--line)'} strokeWidth="1" />
                    <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{t.symbol}</text>
                    <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>{t.name}</text>
                  </g>
                )
              })}
              <circle cx={120} cy={120} r={20} fill="var(--paper-raised)" stroke="var(--line)" strokeWidth="1" />
              <text x={120} y={125} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>太极</text>
            </svg>
            <p className="bagua-map__desc text-soft">以乾南坤北，对待之体，象天地万物阴阳对立。</p>
          </div>

          <div className="bagua-map">
            <h3 className="bagua-map__title">后天八卦（文王）</h3>
            <svg viewBox="0 0 240 240" width="240" height="240" className="bagua-svg">
              {[
                { id: 'li',   angle: -90 },
                { id: 'kun',  angle: -45 },
                { id: 'dui',  angle: 0   },
                { id: 'qian', angle: 45  },
                { id: 'kan',  angle: 90  },
                { id: 'gen',  angle: 135 },
                { id: 'zhen', angle: 180 },
                { id: 'xun',  angle: -135 },
              ].map(({ id, angle }) => {
                const a = angle * (Math.PI / 180)
                const cx = 120 + 90 * Math.cos(a)
                const cy = 120 + 90 * Math.sin(a)
                const t = trigramById[id]
                return (
                  <g key={id} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}>
                    <circle cx={cx} cy={cy} r={22} fill={hovered === id ? 'var(--cinnabar-bg)' : 'var(--paper-raised)'} stroke={hovered === id ? 'var(--cinnabar)' : 'var(--line)'} strokeWidth="1" />
                    <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 14, fill: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>{t.symbol}</text>
                    <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>{t.name}</text>
                  </g>
                )
              })}
              <circle cx={120} cy={120} r={20} fill="var(--paper-raised)" stroke="var(--line)" strokeWidth="1" />
              <text x={120} y={125} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>中央</text>
            </svg>
            <p className="bagua-map__desc text-soft">以离南坎北，流行之用，象万物生长变化之序。</p>
          </div>
        </div>
        {hovered && (
          <p className="bagua-highlight">
            <strong>{trigramById[hovered].symbol} {trigramById[hovered].name}</strong>：
            自然—{trigramById[hovered].nature}，性情—{trigramById[hovered].attribute}，
            先天—{trigramById[hovered].directionXiantian}，后天—{trigramById[hovered].directionHoutian}
          </p>
        )}
      </section>

      <QuizCard topic="yinyang" />

      <div className="basics-cta">
        <p className="text-soft">认得八卦符号了？去工作台用上下卦拼出你的第一卦。</p>
        <Link to="/workbench?method=trigram" className="btn btn--primary">去工作台实操 →</Link>
      </div>
    </div>
  )
}
