// 母题:一根打进水里的桩 —— 桩顶压着一小片朱色的纸(有人把仇家的名字写在了上面),
// 涟漪自那一点向外推开,越远越淡,直到推满整幅画面。
// 呼应《叫魂》的起点:1768 年浙江德清水门桥下的木桩,以及从这一点扩散到十二省的恐慌。
const CINNABAR = '#c3272b'

export default function PileInWater() {
  const water = 300
  // 涟漪:半径越大越淡
  const ripples = [
    { r: 40, o: 0.34 },
    { r: 78, o: 0.26 },
    { r: 120, o: 0.19 },
    { r: 166, o: 0.13 },
    { r: 214, o: 0.08 },
  ]
  // 陪衬的桩:短、暗、沉默
  const piles = [
    { x: 78, top: 262 },
    { x: 112, top: 256 },
    { x: 188, top: 258 },
    { x: 222, top: 266 },
  ]
  return (
    <g>
      {/* 水体 */}
      <rect x="0" y={water} width="300" height={420 - water} fill="rgba(0,0,0,0.24)" />
      {/* 水面 */}
      <line x1="0" y1={water} x2="300" y2={water} stroke="rgba(255,255,255,0.30)" strokeWidth="1.2" />

      {/* 涟漪:从主桩那一点推开 */}
      {ripples.map((w) => (
        <path
          key={w.r}
          d={`M${150 - w.r},${water} Q150,${water + 15} ${150 + w.r},${water}`}
          fill="none"
          stroke={`rgba(255,255,255,${w.o})`}
          strokeWidth="1"
        />
      ))}

      {/* 陪衬的四根桩 */}
      {piles.map((p) => (
        <g key={p.x}>
          <rect x={p.x} y={p.top} width="6" height={392 - p.top} fill="rgba(0,0,0,0.32)" />
          <rect x={p.x} y={p.top} width="6" height={water - p.top} fill="rgba(255,255,255,0.12)" />
        </g>
      ))}

      {/* 主桩:高出一截,水上一段亮、水下一段暗 */}
      <rect x="146" y="230" width="8" height="162" fill="rgba(0,0,0,0.34)" />
      <rect x="146" y="230" width="8" height={water - 230} fill="rgba(255,255,255,0.20)" />

      {/* 桩顶那一片朱色的纸:一个被写上去的名字 */}
      <rect x="139" y="210" width="22" height="16" fill={CINNABAR} opacity="0.94" />
      <line x1="150" y1="226" x2="150" y2="232" stroke={CINNABAR} strokeWidth="1.4" opacity="0.8" />

      {/* 桩底:落在河床上,一道淡影 */}
      <line x1="60" y1="392" x2="240" y2="392" stroke="rgba(0,0,0,0.30)" strokeWidth="1.2" />
    </g>
  )
}
