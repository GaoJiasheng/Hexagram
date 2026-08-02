// 母题:三扇关着的门,门缝下透着光——格里高尔的房间通向三个方向,
// 变形那天早晨,母亲、父亲、妹妹分别在三扇门外敲;门始终关着,
// 门内地上那一点朱色,是后来嵌进背里、没人敢取的苹果。
// (卡夫卡本人不许在封面上画那只虫,哪怕从远处画也不行——所以这里画门,不画虫。)
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

// 三扇门靠左排布,右侧留给 BookCover 的竖排书名(书名排在 x≈250)
const DOORS = [20, 90, 160]
const W = 58

export default function ThreeDoors() {
  return (
    <g>
      {/* 门所在的那一带墙面略暗 */}
      <rect x="0" y="152" width="300" height="179" fill="rgba(0,0,0,0.10)" />

      {DOORS.map((x) => (
        <g key={x}>
          {/* 门框投影 */}
          <rect x={x - 4} y="166" width={W + 8} height="165" fill="rgba(0,0,0,0.14)" />
          {/* 门板 */}
          <rect x={x} y="170" width={W} height="161" fill="rgba(255,255,255,0.09)" stroke={CREAM} strokeOpacity="0.22" strokeWidth="1" />
          {/* 门心板(上下两格) */}
          <rect x={x + 11} y="186" width={W - 22} height="55" fill="none" stroke={CREAM} strokeOpacity="0.16" strokeWidth="0.9" />
          <rect x={x + 11} y="255" width={W - 22} height="55" fill="none" stroke={CREAM} strokeOpacity="0.16" strokeWidth="0.9" />
          {/* 门把手 */}
          <circle cx={x + W - 8} cy="250" r="2.4" fill={CREAM} fillOpacity="0.34" />
          {/* 门缝里透进来的光 */}
          <rect x={x + 3} y="328" width={W - 6} height="3" fill={CREAM} fillOpacity="0.5" />
          {/* 光落在地上的一小片 */}
          <path d={`M${x + 3},331 L${x + W - 3},331 L${x + W + 6},356 L${x - 6},356 Z`} fill={CREAM} fillOpacity="0.06" />
        </g>
      ))}

      {/* 地平线 */}
      <line x1="0" y1="331" x2="300" y2="331" stroke="rgba(0,0,0,0.24)" strokeWidth="1.2" />

      {/* 那只苹果 */}
      <circle cx="119" cy="362" r="5.5" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}
