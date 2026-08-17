// 母题:十九级石阶。牟宗三《中国哲学十九讲》是课堂录音整理,十九讲一级一级往上,
// 讲的是「中国哲学何以为哲学」——他要把儒释道各家安放进一个能与西方哲学对话的架子里。
// 所以画一道**向上收窄的阶梯**:越往上越窄(问题越收越紧),
// 顶端一点朱是那个最终要立住的位置。阶梯左侧留一道虚线,是没走完的部分 ——
// 这套讲法至今仍有争论。
const CINNABAR = '#c3272b'

export default function NineteenSteps() {
  const steps = Array.from({ length: 9 }, (_, i) => {
    const y = 320 - i * 24
    const half = 96 - i * 8
    return { y, x1: 150 - half, x2: 150 + half }
  })
  return (
    <g>
      {steps.map(({ y, x1, x2 }, i) => (
        <path key={i} d={`M${x1} ${y} L${x2} ${y}`}
          stroke={`rgba(255,255,255,${0.14 + i * 0.02})`} strokeWidth="2" fill="none" />
      ))}
      {/* 侧沿 */}
      <path d="M54 320 L126 128" stroke="rgba(255,255,255,0.16)" strokeWidth="1" fill="none" />
      <path d="M246 320 L174 128" stroke="rgba(255,255,255,0.16)" strokeWidth="1" fill="none" />
      {/* 没走完的那一段 */}
      <path d="M150 124 L150 92" stroke="rgba(255,255,255,0.14)" strokeWidth="1"
        fill="none" strokeDasharray="3 6" />
      {/* 顶端要立住的位置 */}
      <circle cx="150" cy="120" r="11" fill={CINNABAR} opacity="0.16" />
      <circle cx="150" cy="120" r="4.6" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}
