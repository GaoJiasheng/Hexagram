// 母题:分枝的谱系 —— 全书唯一一张插图,是第四章那幅「分歧与传衍」示意图。
// 一根共同的起点向上分叉,横线是地质时间的层位;绝大多数枝条中途停住(灭绝),
// 只有极少数抵达顶端(现存物种)。朱点标出其中一支活到今天的血脉。
// 不画具体生物,只画「传衍带着改变」这件事本身。
const CINNABAR = '#c3272b'

export default function BranchingDescent() {
  const strata = [340, 292, 244, 196, 148, 100]
  return (
    <g>
      {/* 地质层位:横向时间线 */}
      {strata.map((y) => (
        <line key={y} x1="34" y1={y} x2="266" y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
      ))}

      {/* 共同起点 */}
      <path d="M150,392 L150,332" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2.2" />

      {/* 左支:一路活到顶端 */}
      <path d="M150,332 L118,286 L100,240 L86,192 L78,144 L70,96 L66,64" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.8" />
      {/* 右支:一路活到顶端 */}
      <path d="M150,332 L190,288 L214,242 L210,194 L222,146 L232,98 L238,64" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1.8" />
      {/* 中支:从右支上分出,活到顶端(朱点标记) */}
      <path d="M210,194 L176,168 L168,140 L160,100 L156,64" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.8" />

      {/* 中途停住的枝条:灭绝 */}
      <path d="M150,332 L152,302 L146,268" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M118,286 L92,262 L88,238" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M100,240 L132,216 L138,192" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M86,192 L58,172 L54,150" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M190,288 L232,264 L236,240" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M214,242 L248,218 L252,196" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M222,146 L254,126 L258,106" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />
      <path d="M168,140 L142,122 L138,104" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" />

      {/* 断口:每条死枝末端一道小横杠 */}
      {[[146, 268], [88, 238], [138, 192], [54, 150], [236, 240], [252, 196], [258, 106], [138, 104]].map(([x, y]) => (
        <line key={`${x}-${y}`} x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="rgba(0,0,0,0.30)" strokeWidth="1.6" />
      ))}

      {/* 活到今天的三支:顶端小点;其中一支点朱 */}
      <circle cx="66" cy="62" r="3" fill="rgba(255,255,255,0.55)" />
      <circle cx="238" cy="62" r="3" fill="rgba(255,255,255,0.55)" />
      <circle cx="156" cy="62" r="5" fill={CINNABAR} opacity="0.92" />
    </g>
  )
}
