// 母题:一只被劈成两半读法的车轮 ——
// 左半是实心剪影(浪漫的看法:形状、质感、当下的样子),
// 右半是拆开的构造线(古典的看法:轮辋、辐条、轴承、公差),
// 同一只轮子,两种看世界的方式,都不完整。
// 两半相交的那条缝上按一颗朱点:那就是「良质」——
// 它在主客、内外、感受与分析被切开之前就在那儿。
// 底下一道横线是路:全书是在路上想的。
const CINNABAR = '#c3272b'

export default function WheelHalved() {
  const cx = 150
  const cy = 196
  const R = 92 // 轮辋外圈
  const r = 74 // 轮辋内圈
  const hub = 20

  // 右半的辐条:从轮毂射向轮辋
  const spokes = [-78, -52, -26, 0, 26, 52, 78].map((deg) => {
    const a = (deg * Math.PI) / 180
    return {
      k: deg,
      x1: cx + Math.sin(a) * (hub + 3),
      y1: cy - Math.cos(a) * (hub + 3),
      x2: cx + Math.sin(a) * r,
      y2: cy - Math.cos(a) * r,
    }
  })

  return (
    <g>
      {/* 左半:实心剪影 —— 只看得见"它长什么样" */}
      <path
        d={`M${cx},${cy - R} A${R},${R} 0 0 0 ${cx},${cy + R} Z`}
        fill="rgba(0,0,0,0.30)"
      />
      <path
        d={`M${cx},${cy - R} A${R},${R} 0 0 0 ${cx},${cy + R} Z`}
        fill="rgba(255,255,255,0.10)"
      />

      {/* 右半:构造线 —— 只看得见"它怎么运作" */}
      <path
        d={`M${cx},${cy - R} A${R},${R} 0 0 1 ${cx},${cy + R}`}
        fill="none"
        stroke="rgba(255,255,255,0.44)"
        strokeWidth="1.3"
      />
      <path
        d={`M${cx},${cy - r} A${r},${r} 0 0 1 ${cx},${cy + r}`}
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
      />
      {spokes.map((s) => (
        <line
          key={s.k}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="rgba(255,255,255,0.30)"
          strokeWidth="1"
        />
      ))}
      {/* 拆下来搁在一旁的两个零件:一枚垫片、一颗螺丝 */}
      <circle cx="262" cy="132" r="7" fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      <circle cx="262" cy="132" r="2.6" fill="none" stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      <line x1="258" y1="262" x2="272" y2="262" stroke="rgba(255,255,255,0.34)" strokeWidth="1.4" />
      <line x1="265" y1="262" x2="265" y2="278" stroke="rgba(255,255,255,0.30)" strokeWidth="1" />

      {/* 轮毂:两半共有的中心 */}
      <circle cx={cx} cy={cy} r={hub} fill="rgba(0,0,0,0.24)" stroke="rgba(255,255,255,0.34)" strokeWidth="1" />

      {/* 中缝:切开两种读法的那一刀 */}
      <line
        x1={cx}
        y1={cy - R - 26}
        x2={cx}
        y2={cy + R + 26}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1"
        strokeDasharray="5 6"
      />

      {/* 朱点:良质 —— 在这一刀落下之前就在的东西 */}
      <circle cx={cx} cy={cy} r="6.4" fill={CINNABAR} opacity="0.95" />

      {/* 路 */}
      <line x1="16" y1="340" x2="284" y2="340" stroke="rgba(0,0,0,0.30)" strokeWidth="1.6" />
      <line x1="40" y1="344" x2="96" y2="344" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <line x1="128" y1="344" x2="184" y2="344" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <line x1="216" y1="344" x2="262" y2="344" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
    </g>
  )
}
