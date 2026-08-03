// 母题：一架返航轰炸机的弹孔分布图，以及那两块**没有**弹孔的地方。
// 二战时军方数着返航飞机身上的弹孔，想给挨弹最多的部位加装甲；
// 统计学家沃德说，该加的恰恰是没有弹孔的那两处——
// 因为打中那里的飞机根本没回来，你数的是幸存者。
// 全书的第一课就是这张图：最要紧的信息，常常在数据的空白处。
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

// 画布 300×420，书名竖排在右侧，故机身居中偏左（cx = 128）
const CX = 128

// 弹孔：机翼、后机身、尾翼上密布，机头与两处发动机位空着
const HOLES = [
  // 机翼
  [52, 256, 3.2], [64, 250, 2.6], [46, 259, 2.2], [60, 244, 2.2],
  [112, 224, 3.0], [126, 229, 2.4], [146, 224, 2.8], [120, 243, 2.8],
  [140, 247, 2.4], [192, 250, 2.6], [200, 253, 3.0], [212, 255, 2.4],
  [204, 244, 2.2],
  // 后机身
  [126, 198, 2.4], [133, 212, 2.2], [124, 264, 3.0], [131, 279, 2.4],
  [127, 293, 2.6], [134, 308, 2.2], [125, 322, 2.6],
  // 尾翼
  [100, 331, 2.4], [158, 331, 2.2], [130, 318, 2.4],
]

// 两处「没有弹孔」的地方 —— 打中这里的飞机没有回来
const GAPS = [
  [CX - 42, 240],
  [CX + 42, 240],
]

export default function MissingHoles() {
  const wing = '44,252 116,212 140,212 212,252 212,265 140,239 116,239 44,265'
  const tail = '86,327 116,307 140,307 170,327 170,336 140,321 116,321 86,336'

  return (
    <g>
      {/* 机身：一块半透明的浅色剪影 */}
      <rect x={CX - 12} y="150" width="24" height="192" rx="12" fill={CREAM} fillOpacity="0.16" />
      <polygon points={wing} fill={CREAM} fillOpacity="0.16" />
      <polygon points={tail} fill={CREAM} fillOpacity="0.16" />

      {/* 轮廓 */}
      <g fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.1">
        <rect x={CX - 12} y="150" width="24" height="192" rx="12" />
        <polygon points={wing} />
        <polygon points={tail} />
      </g>

      {/* 数得见的弹孔 */}
      {HOLES.map(([x, y, r]) => (
        <circle key={`h${x}-${y}`} cx={x} cy={y} r={r} fill="rgba(0,0,0,0.42)" />
      ))}

      {/* 数不见的那两处：虚线圈出的空白 */}
      {GAPS.map(([x, y]) => (
        <g key={`g${x}`}>
          <circle cx={x} cy={y} r="15" fill={CINNABAR} opacity="0.14" />
          <circle
            cx={x} cy={y} r="15"
            fill="none" stroke={CINNABAR} strokeWidth="2" strokeDasharray="4 3.4" opacity="0.95"
          />
        </g>
      ))}

      {/* 一道地平线，把机形托住 */}
      <line x1="20" y1="384" x2="280" y2="384" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
      <line x1="20" y1="396" x2="196" y2="396" stroke={CREAM} strokeOpacity="0.10" strokeWidth="0.9" />
    </g>
  )
}
