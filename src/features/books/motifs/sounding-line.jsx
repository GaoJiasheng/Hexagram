// 母题:一根测深线 —— 梭罗把系着石头的绳子放进瓦尔登湖,一处一处地量,
// 量出最深一〇二英尺,推翻了「这湖没有底」的乡野传说。
// 这既是他在《湖》一章里真做过的事,也是全书的姿态:
// 别人说生活深不可测、必需品多得数不清,他把线放下去,量出了确切的一个数。
// 水面之上留一颗朱色的小星(「太阳不过是一颗晨星」),水底是一道实打实的横线 —— 有底。
const CINNABAR = '#c3272b'

export default function SoundingLine() {
  const surface = 168      // 水面
  const bottom = 366       // 湖底:线到得了的地方
  // 刻度:越往下越密,像绳子上的结
  const ticks = [200, 228, 256, 284, 312, 340]
  // 陪衬的几次测量:短线,量到一半就收了
  const probes = [
    { x: 92, y: 262 },
    { x: 116, y: 236 },
    { x: 192, y: 248 },
    { x: 216, y: 224 },
  ]
  return (
    <g>
      {/* 水体 */}
      <rect x="0" y={surface} width="300" height={420 - surface} fill="rgba(0,0,0,0.26)" />
      {/* 水面 */}
      <line x1="0" y1={surface} x2="300" y2={surface} stroke="rgba(255,255,255,0.32)" strokeWidth="1.2" />
      {/* 水面的一点微光 */}
      <line x1="46" y1={surface - 5} x2="118" y2={surface - 5} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <line x1="176" y1={surface - 5} x2="236" y2={surface - 5} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* 陪衬:几次浅浅的试探,没到底 */}
      {probes.map((p) => (
        <line
          key={p.x}
          x1={p.x}
          y1={surface}
          x2={p.x}
          y2={p.y}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
        />
      ))}

      {/* 主测深线:从水面直落到底 */}
      <line x1="150" y1={surface - 34} x2="150" y2={bottom} stroke="rgba(255,255,255,0.52)" strokeWidth="1.4" />
      {/* 绳结刻度 */}
      {ticks.map((y) => (
        <line key={y} x1="142" y1={y} x2="158" y2={y} stroke="rgba(255,255,255,0.34)" strokeWidth="1" />
      ))}
      {/* 手里的那一头:一个小小的绕圈 */}
      <circle cx="150" cy={surface - 40} r="6" fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth="1.2" />

      {/* 线头那块石头:朱色,落在底上 */}
      <path d="M143,358 L157,358 L154,370 L146,370 Z" fill={CINNABAR} opacity="0.94" />

      {/* 湖底:有底,而且量得出来 */}
      <path
        d="M18,392 C60,378 96,372 150,371 C206,370 244,376 282,390"
        fill="none"
        stroke="rgba(0,0,0,0.34)"
        strokeWidth="1.6"
      />
      <path
        d="M18,392 C60,378 96,372 150,371 C206,370 244,376 282,390"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="0.8"
        transform="translate(0,-2)"
      />

      {/* 天上那颗晨星 */}
      <circle cx="226" cy="74" r="3.2" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}
