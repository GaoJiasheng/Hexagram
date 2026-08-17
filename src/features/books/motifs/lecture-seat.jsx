// 母题:一张讲席。《论语别裁》是南怀瑾的讲录 —— 不是著作,是他坐在那里,
// 把《论语》一句一句讲给底下的人听,记录整理而成。所以画的不是书,是**讲的场面**:
// 上方一方矮席(讲者的位置),下方散开一圈更小的位置(听的人),
// 中间一条朱线自上而下 —— 那是话语落下来的路径。
// 讲席空着:讲的人已经不在了,留下的只是记录。
const CINNABAR = '#c3272b'

export default function LectureSeat() {
  const seats = [[92, 250], [150, 258], [208, 250], [64, 288], [122, 296], [178, 296], [236, 288]]
  return (
    <g>
      {/* 讲席:空着 */}
      <path d="M108 150 L192 150 L200 178 L100 178 Z" fill="rgba(255,255,255,0.16)" />
      <path d="M108 150 L192 150" stroke="rgba(255,255,255,0.34)" strokeWidth="1.4" fill="none" />
      {/* 话语落下来的路径 */}
      <path d="M150 182 L150 232" stroke={CINNABAR} strokeWidth="1.4" opacity="0.7" strokeDasharray="3 4" />
      <circle cx="150" cy="238" r="3.4" fill={CINNABAR} opacity="0.9" />
      {/* 听的人:更小、更散 */}
      {seats.map(([x, y], i) => (
        <path key={i} d={`M${x - 13} ${y} L${x + 13} ${y} L${x + 9} ${y + 16} L${x - 9} ${y + 16} Z`}
          fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.20)" strokeWidth="0.9" />
      ))}
      {/* 上方一线天光 */}
      <path d="M60 116 C110 104,190 104,240 116" stroke="rgba(255,255,255,0.14)" strokeWidth="1" fill="none" />
    </g>
  )
}
