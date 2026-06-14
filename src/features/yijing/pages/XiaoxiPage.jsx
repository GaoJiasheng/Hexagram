import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import HexagramFigure from '../components/HexagramFigure.jsx'
import QuizCard from '../components/QuizCard.jsx'
import { markRead } from '../storage.js'
import { XIAOXI_SEQUENCE } from '../engine/xiaoxi.js'
import { usePageTitle } from '../hooks/usePageTitle.js'

const RADIUS = 130
const CENTER = 160
const SVG_SIZE = 320

function polarToCart(angleDeg, r) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

export default function XiaoxiPage() {
  usePageTitle('十二消息卦')
  const [hovered, setHovered] = useState(null)
  const hoveredItem = XIAOXI_SEQUENCE.find(h => h.id === hovered)

  useEffect(() => { markRead('xiaoxi') }, [])

  return (
    <div className="basics-page">
      <div className="basics-breadcrumb">
        <Link to="/basics" className="basics-breadcrumb__link">← 学堂</Link>
      </div>

      <section className="basics-section">
        <h2 className="basics-section__title">十二消息卦</h2>
        <div className="basics-text">
          <p>消息卦，又称「十二辟卦」。以复卦（一阳生于子月）起，阳气逐渐增长（息）至乾（六阳），再由姤卦（一阴生于午月）起，阴气逐渐增长（消）至坤（六阴），共十二卦，对应十二月与十二地支。</p>
          <p>消息卦把六十四卦与时间的流转贯通，是「卦气」学说的核心。悬停任意卦可见月份、地支与节气中气。</p>
        </div>

        <div className="xiaoxi-layout">
          <svg viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width={SVG_SIZE} height={SVG_SIZE} className="xiaoxi-svg">
            {/* 外圆 */}
            <circle cx={CENTER} cy={CENTER} r={RADIUS + 30} fill="none" stroke="var(--line)" strokeWidth="1" />
            <circle cx={CENTER} cy={CENTER} r={RADIUS - 30} fill="none" stroke="var(--line)" strokeWidth="0.5" strokeDasharray="3 4" />

            {XIAOXI_SEQUENCE.map((item, i) => {
              const angle = i * 30  // 12卦均分360°
              const { x, y } = polarToCart(angle, RADIUS)
              const isHovered = hovered === item.id
              const scale = isHovered ? 1.08 : 1

              return (
                <g
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.name}卦 ${item.month}`}
                  aria-pressed={isHovered}
                  transform={`translate(${x}, ${y}) scale(${scale})`}
                  style={{ transformOrigin: `${x}px ${y}px`, cursor: 'pointer', transition: 'transform 0.15s' }}
                  onMouseEnter={() => setHovered(item.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setHovered((h) => (h === item.id ? null : item.id))}
                  onFocus={() => setHovered(item.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHovered((h) => (h === item.id ? null : item.id)) } }}
                >
                  {/* 背景圆 */}
                  <circle
                    cx={0} cy={0} r={22}
                    fill={isHovered ? 'var(--cinnabar-bg)' : item.yinYang === '阳' ? 'var(--paper-raised)' : 'var(--paper)'}
                    stroke={isHovered ? 'var(--cinnabar)' : 'var(--line)'}
                    strokeWidth={isHovered ? 1.5 : 1}
                  />
                  {/* 卦名 */}
                  <text y={-7} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontFamily: 'var(--font-serif)', fontWeight: isHovered ? 600 : 400 }}>{item.name}</text>
                  {/* 地支 */}
                  <text y={8} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-soft)', fontFamily: 'var(--font-serif)' }}>{item.zhi}</text>
                </g>
              )
            })}

            {/* 中心 */}
            <circle cx={CENTER} cy={CENTER} r={36} fill="var(--paper-raised)" stroke="var(--line)" strokeWidth="1" />
            <text x={CENTER} y={CENTER - 5} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>阳息</text>
            <text x={CENTER} y={CENTER + 12} textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontFamily: 'var(--font-serif)' }}>阴消</text>
          </svg>

          {/* 详情面板 */}
          <div className="xiaoxi-detail">
            {hoveredItem ? (
              <div className="xiaoxi-detail__card">
                <HexagramFigure binary={hoveredItem.binary} size="md" label={hoveredItem.name} />
                <div className="xiaoxi-detail__info">
                  <div className="xiaoxi-detail__name">{hoveredItem.name}</div>
                  <div className="xiaoxi-detail__attrs">
                    <span className="xiaoxi-attr">{hoveredItem.yinYang === '阳' ? '阳息' : '阴消'}</span>
                    <span className="xiaoxi-attr">{hoveredItem.yaoCount}爻{hoveredItem.yinYang}</span>
                  </div>
                  <div className="xiaoxi-detail__row">{hoveredItem.month}·{hoveredItem.zhi}月</div>
                  <div className="xiaoxi-detail__row xiaoxi-jieqi">{hoveredItem.jieqi}</div>
                </div>
              </div>
            ) : (
              <p className="text-faint xiaoxi-hint">点选或悬停环上任意卦<br />查看月份与节气<br /><span className="text-faint" style={{ fontSize: '0.85em' }}>(下方表格亦列全部信息)</span></p>
            )}
          </div>
        </div>

        {/* 列表 */}
        <div className="xiaoxi-table-wrap">
          <table className="xiaoxi-table">
            <thead>
              <tr>
                <th>卦</th><th>名</th><th>月份</th><th>地支</th><th>节气中气</th><th>阳/阴爻数</th>
              </tr>
            </thead>
            <tbody>
              {XIAOXI_SEQUENCE.map(item => (
                <tr
                  key={item.id}
                  className={hovered === item.id ? 'xiaoxi-table-row--active' : ''}
                  onMouseEnter={() => setHovered(item.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td><Link to={`/hexagram/${item.id}`}><HexagramFigure binary={item.binary} size="sm" label={item.name} /></Link></td>
                  <td><Link to={`/hexagram/${item.id}`} className="xiaoxi-name-link">{item.name}</Link></td>
                  <td>{item.month}</td>
                  <td>{item.zhi}</td>
                  <td>{item.jieqi}</td>
                  <td>{item.yaoCount}爻{item.yinYang}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <QuizCard topic="xiaoxi" />
    </div>
  )
}
