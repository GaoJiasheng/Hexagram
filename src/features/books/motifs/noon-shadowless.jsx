// 母题:正午 · 没有影子的人——
// 日头正在头顶,海天一线,一个人独自站在沙上,脚下的影子被压成一小点:
// 无处可躲,也无处藏身。沙上留着五道刻痕(一道,停顿,再四道),
// 呼应全书那个转折:先一枪,停了一下,又四枪。
const CINNABAR = '#b1472f'
const CREAM = '#f2ecda'

export default function NoonShadowless() {
  return (
    <g>
      {/* 正午的日:高悬正上方,外面几圈晒得发白的光晕 */}
      <circle cx="112" cy="118" r="42" fill="none" stroke={CREAM} strokeOpacity="0.16" strokeWidth="1.2" />
      <circle cx="112" cy="118" r="55" fill="none" stroke={CREAM} strokeOpacity="0.1" strokeWidth="1.1" />
      <circle cx="112" cy="118" r="69" fill="none" stroke={CREAM} strokeOpacity="0.06" strokeWidth="1" />
      <circle cx="112" cy="118" r="30" fill={CINNABAR} opacity="0.9" />

      {/* 海天一线 + 沙地 */}
      <path d="M0,300 L300,300 L300,420 L0,420 Z" fill="rgba(0,0,0,0.16)" />
      <line x1="0" y1="300" x2="300" y2="300" stroke={CREAM} strokeOpacity="0.42" strokeWidth="1.4" />

      {/* 一个人:一竖一点,再无更多交代 */}
      <circle cx="112" cy="240" r="8.5" fill={CREAM} fillOpacity="0.62" />
      <path d="M112,250 L112,300" stroke={CREAM} strokeOpacity="0.62" strokeWidth="4.6" strokeLinecap="round" />

      {/* 脚下的影子:正午被压成一小点 */}
      <ellipse cx="112" cy="302" rx="10" ry="2.6" fill="rgba(0,0,0,0.42)" />

      {/* 沙上的刻痕:一 · 停顿 · 四 */}
      <g stroke={CREAM} strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round">
        <line x1="40" y1="346" x2="40" y2="362" />
        <line x1="76" y1="346" x2="76" y2="362" />
        <line x1="90" y1="346" x2="90" y2="362" />
        <line x1="104" y1="346" x2="104" y2="362" />
        <line x1="118" y1="346" x2="118" y2="362" />
      </g>
    </g>
  )
}
