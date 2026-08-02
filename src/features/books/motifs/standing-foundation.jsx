// 母题:上层的柱廊断成参差的残桩,朱红一线横切其下——
// 而那条线以下的整块基座,砖缝齐整、纹丝未动。
// 呼应《旧制度与大革命》最锋利的一刀:革命砍掉了贵族的上层建筑,
// 却把旧王朝造好的那台中央行政机器,连地基一起完整地接管了过来。
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

// 断柱:[x, 断口高度] —— 高低参差,断得毫无章法
const COLUMNS = [
  [44, 152],
  [82, 226],
  [120, 178],
  [158, 246],
]

export default function StandingFoundation() {
  return (
    <g>
      {/* 地平线 */}
      <line x1="0" y1="372" x2="300" y2="372" stroke="rgba(0,0,0,0.26)" strokeWidth="1.2" />

      {/* 上层建筑:断柱 */}
      {COLUMNS.map(([x, top]) => (
        <g key={x}>
          <rect
            x={x}
            y={top}
            width="26"
            height={282 - top}
            fill="rgba(255,255,255,0.08)"
            stroke={CREAM}
            strokeOpacity="0.20"
            strokeWidth="1"
          />
          {/* 柱身凹槽 */}
          <line x1={x + 9} y1={top + 8} x2={x + 9} y2="278" stroke={CREAM} strokeOpacity="0.12" strokeWidth="0.9" />
          <line x1={x + 17} y1={top + 8} x2={x + 17} y2="278" stroke={CREAM} strokeOpacity="0.12" strokeWidth="0.9" />
          {/* 参差的断口 */}
          <path
            d={`M${x},${top + 5} L${x + 6},${top - 3} L${x + 13},${top + 4} L${x + 19},${top - 4} L${x + 26},${top + 3}`}
            fill="none"
            stroke={CREAM}
            strokeOpacity="0.30"
            strokeWidth="1.4"
          />
        </g>
      ))}

      {/* 坠落的柱头与碎块 */}
      <rect x="196" y="256" width="22" height="13" fill="rgba(255,255,255,0.10)" transform="rotate(-14 207 262)" />
      <rect x="190" y="348" width="26" height="15" fill="rgba(0,0,0,0.22)" transform="rotate(8 203 355)" />
      <rect x="60" y="264" width="12" height="8" fill="rgba(255,255,255,0.09)" transform="rotate(21 66 268)" />

      {/* 朱红一线:革命之刃切过的高度 */}
      <line x1="18" y1="282" x2="226" y2="282" stroke={CINNABAR} strokeWidth="2.1" opacity="0.92" />

      {/* 线以下:整块基座,纹丝未动 */}
      <rect x="30" y="286" width="180" height="86" fill="rgba(0,0,0,0.33)" />
      <rect x="30" y="286" width="180" height="4" fill="rgba(255,255,255,0.15)" />
      {/* 齐整的砖缝 —— 一台仍在运转的机器 */}
      <line x1="30" y1="314" x2="210" y2="314" stroke="rgba(255,255,255,0.11)" strokeWidth="0.9" />
      <line x1="30" y1="342" x2="210" y2="342" stroke="rgba(255,255,255,0.11)" strokeWidth="0.9" />
      <line x1="90" y1="290" x2="90" y2="314" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="150" y1="290" x2="150" y2="314" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="60" y1="314" x2="60" y2="342" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="120" y1="314" x2="120" y2="342" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="180" y1="314" x2="180" y2="342" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="90" y1="342" x2="90" y2="372" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
      <line x1="150" y1="342" x2="150" y2="372" stroke="rgba(255,255,255,0.09)" strokeWidth="0.9" />
    </g>
  )
}
