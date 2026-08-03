// 母题:三层同心的圈,越往外分格越密 —— 圈是市场的范围,格是分工的细度。
// 《国富论》的第一块砖是两句连着说的话:分工使劳动多产;而分工受市场范围的限制。
// 所以圈小的时候只分得出几格(一个村子里,一个人得又做屠夫又做面包师),
// 圈大了才养得起十八道工序。最外一圈是虚线 —— 范围还能再开。
// 正中那枚朱色的针,是圈开到足够大之后才做得出来的那件东西。
const CINNABAR = '#c3272b'

export default function WideningMarket() {
  const cx = 134
  const cy = 228
  const r1 = 44
  const r2 = 82
  const r3 = 120
  const r4 = 136

  // 环带里的分隔辐条:内环 6 条,中环 12 条,外环 24 条 —— 圈越大,格越密
  const spokes = (rIn, rOut, n, opacity, width) => {
    const out = []
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2
      out.push(
        <line
          key={`${rIn}-${i}`}
          x1={cx + Math.cos(a) * rIn}
          y1={cy + Math.sin(a) * rIn}
          x2={cx + Math.cos(a) * rOut}
          y2={cy + Math.sin(a) * rOut}
          stroke={`rgba(255,255,255,${opacity})`}
          strokeWidth={width}
        />,
      )
    }
    return out
  }

  return (
    <g>
      {/* 三圈边界 */}
      <circle cx={cx} cy={cy} r={r1} fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="1.3" />
      <circle cx={cx} cy={cy} r={r2} fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={r3} fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1.1" />
      {/* 还能再开的那一圈 */}
      <circle
        cx={cx}
        cy={cy}
        r={r4}
        fill="none"
        stroke="rgba(255,255,255,0.13)"
        strokeWidth="1"
        strokeDasharray="4 6"
      />

      {/* 环带越靠外越暗,像光照不到的边缘 */}
      <circle cx={cx} cy={cy} r={r1} fill="rgba(255,255,255,0.045)" />

      {/* 分格:6 → 12 → 24;最内圈从 16 起,给正中的针留出干净的地方 */}
      {spokes(16, r1, 6, 0.16, 0.9)}
      {spokes(r1, r2, 12, 0.14, 0.9)}
      {spokes(r2, r3, 24, 0.12, 0.8)}

      {/* 正中的针:针鼻、针身、针尖 */}
      <ellipse
        cx={cx}
        cy={cy - 34}
        rx="5.2"
        ry="8"
        fill="none"
        stroke={CINNABAR}
        strokeWidth="2.4"
        opacity="0.95"
      />
      <rect x={cx - 1.3} y={cy - 26} width="2.6" height="50" rx="1.3" fill={CINNABAR} opacity="0.95" />
      <path
        d={`M${cx - 1.3},${cy + 24} L${cx + 1.3},${cy + 24} L${cx},${cy + 40} Z`}
        fill={CINNABAR}
        opacity="0.95"
      />

      {/* 底部一道浅浅的水线:市场范围最早是被水路撑开的 */}
      <path
        d="M40,378 C74,370 100,384 134,378 C168,372 196,386 230,379 C246,376 254,374 262,373"
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.2"
      />
      <path
        d="M40,392 C76,385 102,398 136,392 C170,386 198,399 232,393"
        fill="none"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1.1"
      />
    </g>
  )
}
