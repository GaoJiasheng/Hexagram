import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { allHexagrams } from '../data.js'
import { circleAngle, squarePos, xiantianIndex } from '../engine/xiantian.js'

// 先天方圆图(v10 §5):外环圆图(邵雍次序,上南下北左东右西)+ 内嵌方图(行下卦列上卦)
// 角度/行列由 engine/xiantian.js 计算,本组件只做几何与交互

const VB = 1000              // viewBox 边长
const CX = 500, CY = 500
const RING_R = 442           // 圆图卦画中心半径
const CELL = 52              // 方图格边
const SQ0 = CX - CELL * 4    // 方图左上角

function MiniHex({ binary, w = 30, highlight }) {
  const barH = 2.8
  const gap = 2
  const totalH = 6 * barH + 5 * gap
  const fill = highlight ? 'var(--cinnabar)' : 'var(--ink)'
  return (
    <g transform={`translate(${-w / 2}, ${-totalH / 2})`}>
      {Array.from({ length: 6 }, (_, i) => {
        const y = (5 - i) * (barH + gap)   // 下标 0 = 初爻在最下
        return binary[i] === '1'
          ? <rect key={i} x={0} y={y} width={w} height={barH} fill={fill} />
          : (
            <g key={i}>
              <rect x={0} y={y} width={w * 0.42} height={barH} fill={fill} />
              <rect x={w * 0.58} y={y} width={w * 0.42} height={barH} fill={fill} />
            </g>
          )
      })}
    </g>
  )
}

function nodePositions(hex) {
  const deg = circleAngle(hex.binary)
  const rad = (deg * Math.PI) / 180
  // 顺时针为正、自正上方起:x = cx + r·sin,y = cy - r·cos(负角即偏东/左)
  const circle = { x: CX + RING_R * Math.sin(rad), y: CY - RING_R * Math.cos(rad) }
  const { row, col } = squarePos(hex.binary)
  // 行自下而上,列自右向左
  const square = { x: SQ0 + (8 - col) * CELL + CELL / 2, y: SQ0 + (8 - row) * CELL + CELL / 2 }
  return { circle, square }
}

export default function FangyuanView() {
  const [hovered, setHovered] = useState(null)
  const navigate = useNavigate()

  const hoveredHex = hovered != null ? allHexagrams.find(h => h.id === hovered) : null

  return (
    <div className="fangyuan-view">
      <svg viewBox={`0 0 ${VB} ${VB}`} className="fangyuan-svg" role="img" aria-label="伏羲六十四卦方位图(方圆图)">
        {/* 参考圆环 */}
        <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={RING_R - 34} fill="none" stroke="var(--line)" strokeWidth="0.5" opacity="0.6" />
        {/* 方图网格 */}
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} stroke="var(--line)" strokeWidth="0.6">
            <line x1={SQ0} y1={SQ0 + i * CELL} x2={SQ0 + 8 * CELL} y2={SQ0 + i * CELL} />
            <line x1={SQ0 + i * CELL} y1={SQ0} x2={SQ0 + i * CELL} y2={SQ0 + 8 * CELL} />
          </g>
        ))}

        {allHexagrams.map(h => {
          const { circle, square } = nodePositions(h)
          const hl = hovered === h.id
          return (
            <g key={h.id}>
              {/* 圆图节点 */}
              <g
                className="fangyuan-node"
                transform={`translate(${circle.x}, ${circle.y})`}
                onMouseEnter={() => setHovered(h.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/hexagram/${h.id}`)}
              >
                <title>{`${h.fullName}(第 ${h.id} 卦 · 先天第 ${xiantianIndex(h.binary)})`}</title>
                {hl && <circle r="20" fill="var(--cinnabar)" opacity="0.12" />}
                <MiniHex binary={h.binary} highlight={hl} />
                <rect x="-19" y="-17" width="38" height="34" fill="transparent" />
              </g>
              {/* 方图节点 */}
              <g
                className="fangyuan-node"
                transform={`translate(${square.x}, ${square.y})`}
                onMouseEnter={() => setHovered(h.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/hexagram/${h.id}`)}
              >
                <title>{`${h.fullName}(第 ${h.id} 卦)`}</title>
                {hl && <rect x={-CELL / 2} y={-CELL / 2} width={CELL} height={CELL} fill="var(--cinnabar)" opacity="0.12" />}
                <MiniHex binary={h.binary} w={28} highlight={hl} />
                <rect x={-CELL / 2} y={-CELL / 2} width={CELL} height={CELL} fill="transparent" />
              </g>
            </g>
          )
        })}

        {/* 方位标注:上南下北左东右西 */}
        <text x={CX} y={26} className="fangyuan-compass" textAnchor="middle">南</text>
        <text x={CX} y={VB - 12} className="fangyuan-compass" textAnchor="middle">北</text>
        <text x={16} y={CY + 5} className="fangyuan-compass" textAnchor="middle">东</text>
        <text x={VB - 16} y={CY + 5} className="fangyuan-compass" textAnchor="middle">西</text>

        {/* 悬停信息 */}
        {hoveredHex && (
          <text x={CX} y={CY - CELL * 4 - 22} className="fangyuan-hover-label" textAnchor="middle">
            {hoveredHex.fullName} · 第 {hoveredHex.id} 卦 · 先天第 {xiantianIndex(hoveredHex.binary)}
          </text>
        )}
      </svg>
      <p className="text-faint fangyuan-note">
        伏羲六十四卦方位图,见朱熹《周易本义》卷首,传出
        <Link to="/basics/yuanliu#shaoyong" className="related-shili-link">邵雍先天之学</Link>。
        圆图象天:阳半(乾至复)居东,阴半(姤至坤)居西;方图象地:行为下卦、列为上卦,对角线即八纯卦。点击任意卦进入卦页。
      </p>
    </div>
  )
}
