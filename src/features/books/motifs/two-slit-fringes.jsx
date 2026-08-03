// 母题:双缝干涉——量子力学唯一的谜。
// 一个源、两道缝、下面铺开的波前,最后落在屏上的却不是两道亮斑,
// 而是一整排明暗相间的条纹;更要命的是,这些条纹是由一个一个孤立的点
// 慢慢累积出来的——每个点单独看都是粒子,合起来看又是波。
// 中央那根朱色的条纹是概率最高处:骰子掷得再随机,分布本身是铁律。
const CINNABAR = '#b1472f'
const CREAM = '#f2ecda'

export default function TwoSlitFringes() {
  // 画布 300×420,原点左上。
  const cx = 150
  const barrierY = 178
  const slitL = 132
  const slitR = 168
  const screenY = 358

  // 缝后的波前:两组同心半圆,向下铺开
  const arcs = []
  for (const sx of [slitL, slitR]) {
    for (let r = 26; r <= 150; r += 26) {
      arcs.push(`M${sx - r},${barrierY} A${r},${r} 0 0 0 ${sx + r},${barrierY}`)
    }
  }

  // 屏上的条纹:逐列算强度,再把强度画成一摞点(粒子一个个打上去)
  const dots = []
  for (let x = 44; x <= 256; x += 7.6) {
    const d = x - cx
    const fringe = Math.cos((Math.PI * d) / 26) ** 2      // 双缝干涉项
    const envelope = Math.exp(-((d / 64) ** 2))            // 单缝包络
    const n = Math.round(fringe * envelope * 7)
    for (let k = 0; k < n; k++) {
      dots.push({ x, y: screenY - 8 - k * 7.4, center: Math.abs(d) < 6 })
    }
  }

  return (
    <g>
      {/* 光源 */}
      <circle cx={cx} cy="74" r="4.6" fill={CREAM} opacity="0.85" />
      <g fill="none" stroke={CREAM} strokeOpacity="0.28" strokeWidth="1">
        <path d={`M${cx},78 L${slitL},${barrierY}`} />
        <path d={`M${cx},78 L${slitR},${barrierY}`} />
      </g>

      {/* 缝后波前 */}
      <g fill="none" stroke={CREAM} strokeOpacity="0.2" strokeWidth="1">
        {arcs.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* 挡板:留两道缝 */}
      <g stroke={CREAM} strokeOpacity="0.75" strokeWidth="3.4" strokeLinecap="square">
        <path d={`M34,${barrierY} L${slitL - 4},${barrierY}`} />
        <path d={`M${slitL + 4},${barrierY} L${slitR - 4},${barrierY}`} />
        <path d={`M${slitR + 4},${barrierY} L266,${barrierY}`} />
      </g>

      {/* 屏上的点:一个一个落下,合起来成了条纹 */}
      <g>
        {dots.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.center ? 2.5 : 2.1}
            fill={p.center ? CINNABAR : CREAM}
            opacity={p.center ? 0.95 : 0.5}
          />
        ))}
      </g>

      {/* 屏 */}
      <path
        d={`M34,${screenY} L266,${screenY}`}
        fill="none"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="2"
      />
    </g>
  )
}
