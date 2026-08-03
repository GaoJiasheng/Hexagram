// 母题:一个灭点 —— 一片地砖向远处收拢,所有的线交在同一颗朱色的点上。
// 这是文艺复兴解决掉的那道题:在一张平的东西上,把深度做出来。
// 灭点之上悬着同一只圆盘的两种画法:左边是正圆(我知道它是圆的),
// 右边是被压扁的椭圆(我看见它是这样的)。「所知」与「所见」的拉锯,
// 贡布里希用它串起了从埃及到印象派的整条线。
const CINNABAR = '#c3272b'

export default function VanishingPoint() {
  const vx = 150      // 灭点
  const vy = 206
  const floorBottom = 424
  // 正交线:从灭点射向画面下缘
  const rays = [-40, 20, 78, 150, 222, 280, 340]
  // 横线:越近越疏,越远越密 —— 深度就是这样被造出来的
  const bands = [232, 258, 294, 344, 424]
  const halfAt = (y) => (176 * (y - vy)) / (floorBottom - vy)

  return (
    <g>
      {/* 地面:一块比背景稍暗的梯形 */}
      <path
        d={`M${vx},${vy} L${vx - halfAt(floorBottom)},${floorBottom} L${vx + halfAt(floorBottom)},${floorBottom} Z`}
        fill="rgba(0,0,0,0.22)"
      />
      {/* 地平线 */}
      <line x1="26" y1={vy} x2="274" y2={vy} stroke="rgba(255,255,255,0.28)" strokeWidth="1.1" />

      {/* 正交线,全部收向灭点 */}
      {rays.map((x) => (
        <line key={x} x1={vx} y1={vy} x2={x} y2={floorBottom} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
      ))}
      {/* 横向的砖缝 */}
      {bands.map((y) => (
        <line
          key={y}
          x1={vx - halfAt(y)}
          y1={y}
          x2={vx + halfAt(y)}
          y2={y}
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1"
        />
      ))}

      {/* 同一只圆盘的两种画法 */}
      <circle cx="92" cy="126" r="27" fill="none" stroke="rgba(255,255,255,0.46)" strokeWidth="1.4" />
      <ellipse cx="208" cy="126" rx="27" ry="9.5" fill="none" stroke="rgba(255,255,255,0.46)" strokeWidth="1.4" />
      {/* 中间一道短线:两者是同一件东西 */}
      <line x1="128" y1="126" x2="172" y2="126" stroke="rgba(255,255,255,0.16)" strokeWidth="0.9" strokeDasharray="3 4" />

      {/* 灭点:整张图唯一的一点朱 */}
      <circle cx={vx} cy={vy} r="12" fill={CINNABAR} opacity="0.16" />
      <circle cx={vx} cy={vy} r="4.2" fill={CINNABAR} opacity="0.95" />
    </g>
  )
}
