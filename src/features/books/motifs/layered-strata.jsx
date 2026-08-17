// 母题:思想的地层。葛兆光《中国思想史》最要紧的方法主张,是不只写少数哲人的
// 「精英思想」,还要写沉在下面的「一般知识、思想与信仰世界」—— 那些人人默认、
// 无须论证的常识。所以画成**地层剖面**:上方几笔清晰的线是留下姓名的思想家,
// 下方大片沉厚的层是无名者共享的常识底子;一道朱色的竖线贯穿上下 ——
// 他要证明的正是这两层从来不是分开的。
const CINNABAR = '#c3272b'

export default function LayeredStrata() {
  return (
    <g>
      {/* 上层:留下姓名的少数 */}
      {[[70, 132], [128, 118], [186, 126], [236, 112]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="4" fill="rgba(255,255,255,0.46)" />
          <path d={`M${x} ${y + 6} L${x} ${y + 26}`} stroke="rgba(255,255,255,0.18)" strokeWidth="0.9" />
        </g>
      ))}
      <path d="M46 168 C110 158,190 158,254 168" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2" fill="none" />

      {/* 下层:无名者共享的常识,层层沉积 */}
      {[190, 214, 240, 268, 298, 330].map((y, i) => (
        <path key={y} d={`M40 ${y} C110 ${y - 8},190 ${y + 8},260 ${y - 4}`}
          stroke={`rgba(0,0,0,${0.10 + i * 0.035})`} strokeWidth={2 + i * 0.5} fill="none" />
      ))}

      {/* 贯穿上下:两层从来不是分开的 */}
      <path d="M150 108 L150 344" stroke={CINNABAR} strokeWidth="1.2" opacity="0.55" />
      <circle cx="150" cy="168" r="4" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}
