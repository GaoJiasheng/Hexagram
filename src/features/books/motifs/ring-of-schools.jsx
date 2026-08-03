// 母题:诸子环列成一圈——长短不齐的笔画各自站着,却被一个圆收拢成一张总图;
// 圆心一点朱砂是「内圣」,外面那道细环是「外王」。呼应《中国哲学简史》:
// 冯友兰把散落两千年的各家,第一次排进了一张现代人看得懂的图里。
const CINNABAR = '#c3272b'

const CX = 150
const CY = 196
const COUNT = 28 // 原书二十八章,也是环上的二十八道笔画

export default function RingOfSchools() {
  const strokes = []
  for (let i = 0; i < COUNT; i += 1) {
    const a = (i / COUNT) * Math.PI * 2 - Math.PI / 2
    // 长短不齐:各家分量本就不同
    const len = 14 + ((i * 7) % 5) * 4
    const r0 = 74
    const r1 = r0 + len
    strokes.push(
      <line
        key={i}
        x1={CX + Math.cos(a) * r0}
        y1={CY + Math.sin(a) * r0}
        x2={CX + Math.cos(a) * r1}
        y2={CY + Math.sin(a) * r1}
        stroke="rgba(255,255,255,0.20)"
        strokeWidth="2"
        strokeLinecap="round"
      />,
    )
  }
  return (
    <g>
      {/* 地平线:图仍落在人世间 */}
      <path d="M0 352 H300" stroke="rgba(0,0,0,0.28)" strokeWidth="1" fill="none" />
      {/* 收拢诸家的那一圈 */}
      <circle cx={CX} cy={CY} r="66" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />
      {strokes}
      {/* 外王:一道细环 */}
      <circle cx={CX} cy={CY} r="34" fill="none" stroke={CINNABAR} strokeWidth="1.6" opacity="0.85" />
      {/* 内圣:一点朱 */}
      <circle cx={CX} cy={CY} r="13" fill={CINNABAR} opacity="0.92" />
      {/* 一线自内向外:内圣通向外王 */}
      <path d={`M${CX} ${CY - 13} L${CX} ${CY - 34}`} stroke={CINNABAR} strokeWidth="1.4" opacity="0.7" fill="none" />
      {/* 底部一抹阴影,压住画面 */}
      <path d="M0 352 H300 V420 H0 Z" fill="rgba(0,0,0,0.16)" />
    </g>
  )
}
