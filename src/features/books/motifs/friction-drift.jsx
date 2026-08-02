// 母题:一条笔直的虚线(纸上的计划、政治给定的方向)穿进雾带,
// 出来时已经被推歪 —— 克劳塞维茨的「摩擦」:现实中最简单的事也变得困难。
// 朱点落在实际路径的落点上,与虚线的延长线错开,那段错开就是全书的题眼。
const CINNABAR = '#c3272b'

export default function FrictionDrift() {
  return (
    <g>
      {/* 雾带:三条横向半透明带,越往中间越浓 */}
      <rect x="0" y="150" width="300" height="34" fill="rgba(255,255,255,0.06)" />
      <rect x="0" y="184" width="300" height="42" fill="rgba(255,255,255,0.10)" />
      <rect x="0" y="226" width="300" height="34" fill="rgba(255,255,255,0.06)" />

      {/* 纸上的直线:计划、意图、理论上的极端 */}
      <path
        d="M44 205 L262 205"
        fill="none"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="1.6"
        strokeDasharray="7 6"
      />

      {/* 实际走出来的路:进雾前贴着直线,雾中被一次次推偏,出雾已在下方 */}
      <path
        d="M44 205 C 96 203, 118 216, 140 210 S 176 232, 200 240 S 240 258, 262 262"
        fill="none"
        stroke="rgba(255,255,255,0.88)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* 偏差:两个落点之间的那一段 */}
      <path
        d="M262 205 L262 262"
        fill="none"
        stroke="rgba(0,0,0,0.30)"
        strokeWidth="1.2"
        strokeDasharray="3 4"
      />

      {/* 出发点 */}
      <circle cx="44" cy="205" r="3.4" fill="rgba(255,255,255,0.85)" />
      {/* 纸上应到之处 */}
      <circle cx="262" cy="205" r="3" fill="rgba(255,255,255,0.35)" />
      {/* 实际落点 */}
      <circle cx="262" cy="262" r="6.2" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}
