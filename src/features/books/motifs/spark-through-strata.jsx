// 母题:一束朱色的火线斜穿过层层堆叠的「库存知识」——被它穿过的那几层才亮起来,
// 其余仍是沉睡的横条。对应《教育的目的》开宗明义的那句:全书是对呆滞思想的抗议。
// 知识堆在那里,和知识被真正点着、被使用,是两回事。
const CINNABAR = '#c3272b'

const STRATA = [
  { y: 118, x1: 92, x2: 208, lit: false },
  { y: 148, x1: 78, x2: 222, lit: false },
  { y: 178, x1: 66, x2: 234, lit: true },
  { y: 208, x1: 60, x2: 240, lit: false },
  { y: 238, x1: 66, x2: 234, lit: true },
  { y: 268, x1: 74, x2: 226, lit: false },
  { y: 298, x1: 86, x2: 214, lit: true },
  { y: 328, x1: 100, x2: 200, lit: false },
]

export default function SparkThroughStrata() {
  return (
    <g>
      {/* 沉睡的知识层:一条条平躺、互不相干 */}
      {STRATA.map((s) => (
        <rect
          key={s.y}
          x={s.x1}
          y={s.y}
          width={s.x2 - s.x1}
          height="9"
          rx="4.5"
          fill={s.lit ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.12)'}
        />
      ))}
      {/* 被穿过的那几层,底下留一道阴影,显出被「抬」起来 */}
      {STRATA.filter((s) => s.lit).map((s) => (
        <rect
          key={`sh-${s.y}`}
          x={s.x1 + 6}
          y={s.y + 11}
          width={s.x2 - s.x1 - 12}
          height="4"
          rx="2"
          fill="rgba(0,0,0,0.16)"
        />
      ))}
      {/* 火线:自下而上斜穿全部层次 */}
      <path
        d="M 66 374 C 104 322 116 254 148 204 C 178 156 206 116 230 84"
        fill="none"
        stroke={CINNABAR}
        strokeWidth="3.2"
        strokeLinecap="round"
        opacity="0.95"
      />
      {/* 火线尽头的那一点 */}
      <circle cx="230" cy="84" r="17" fill={CINNABAR} opacity="0.22" />
      <circle cx="230" cy="84" r="7.5" fill={CINNABAR} opacity="0.95" />
    </g>
  )
}
