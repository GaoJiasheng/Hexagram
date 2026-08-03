// 母题:积淀 —— 一层层压实的地层,底下埋着具体的形象,越往上越简、越抽象,
// 最后浮出地面的是一条纯粹的几何纹样。那条看上去只是装饰的线,
// 是下面所有具体内容压出来的。李泽厚全书的关键词就是这个动作:
// 社会内容沉进审美形式,形式于是「有了意味」。
const CINNABAR = '#c3272b'

export default function SedimentedPattern() {
  // 五道地层,自上而下越来越古老
  const strata = [
    { y: 236, h: 34, o: 0.06 },
    { y: 272, h: 34, o: 0.1 },
    { y: 308, h: 34, o: 0.14 },
    { y: 344, h: 34, o: 0.19 },
    { y: 380, h: 44, o: 0.26 },
  ]

  return (
    <g>
      {/* 地层:越深越暗 */}
      {strata.map((s) => (
        <rect key={s.y} x="0" y={s.y} width="300" height={s.h} fill={`rgba(0,0,0,${s.o})`} />
      ))}
      {/* 层缝 */}
      {strata.map((s) => (
        <line
          key={`l${s.y}`}
          x1="0"
          y1={s.y}
          x2="300"
          y2={s.y}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.8"
        />
      ))}

      {/* 最底层:一条还看得出是鱼的形象 */}
      <g stroke="rgba(255,255,255,0.42)" strokeWidth="1.3" fill="none">
        <path d="M108,402 C126,388 174,388 192,402 C174,416 126,416 108,402 Z" />
        <path d="M192,402 l16,-11 l0,22 Z" />
        <circle cx="128" cy="399" r="2.4" fill="rgba(255,255,255,0.42)" stroke="none" />
      </g>

      {/* 上一层:鱼被压成一个带尾的菱形 */}
      <g stroke="rgba(255,255,255,0.38)" strokeWidth="1.3" fill="none">
        <path d="M120,361 L150,350 L180,361 L150,372 Z" />
        <path d="M180,361 l14,-9 l0,18 Z" />
      </g>

      {/* 再上一层:只剩菱形 */}
      <path
        d="M124,325 L150,314 L176,325 L150,336 Z"
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.3"
      />

      {/* 再上一层:菱形连成一串 */}
      <g fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2">
        <path d="M96,289 L114,280 L132,289 L114,298 Z" />
        <path d="M132,289 L150,280 L168,289 L150,298 Z" />
        <path d="M168,289 L186,280 L204,289 L186,298 Z" />
      </g>

      {/* 最上一层:菱形化成一条纯折线,再也认不出是鱼 */}
      <polyline
        points="72,262 96,246 120,262 144,246 168,262 192,246 216,262 228,254"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.3"
      />

      {/* 一条细线,把最深处的那条鱼一直牵到地面之上 */}
      <path
        d="M150,394 L150,236"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.9"
        strokeDasharray="3 6"
      />

      {/* 浮出地面的纹样:一条纯粹的形式,唯一的一点朱 */}
      <polyline
        points="66,148 96,124 126,148 156,124 186,148 216,124 240,143"
        fill="none"
        stroke={CINNABAR}
        strokeWidth="2.2"
        opacity="0.92"
      />
      <circle cx="150" cy="176" r="3.4" fill={CINNABAR} opacity="0.85" />
      <line x1="26" y1="200" x2="274" y2="200" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9" />
    </g>
  )
}
