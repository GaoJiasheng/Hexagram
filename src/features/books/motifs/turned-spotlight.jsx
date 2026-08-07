// 母题:转过去的聚光灯——一盏灯原本照着自己(虚线的那束),被转了半圈,
// 去照对面那个人(实线的那束,灯下的人被朱色点亮),而握灯的自己退进暗处。
// 卡耐基全书三十条原则,归根到底只有这一个动作:把注意力从「我要说什么」
// 转到「他是谁、他想要什么」。灯是转的,不是关的——光的来源仍在你手里,
// 所以这套技艺既可以是真诚的关照,也可以是精确的操纵;虚线那束光留在画面上,
// 提醒这是同一盏灯。
const CREAM = '#f2ecda'
const CINNABAR = '#c3272b'

export default function TurnedSpotlight() {
  // 画布 300×420,灯悬在中上,两个人立在下方地线上。
  const lamp = { x: 150, y: 218 }

  const figure = (cx, headY, r) =>
    `M${cx - r - 12},${headY + r + 46} Q${cx - r - 12},${headY + r + 8} ${cx},${headY + r + 2} Q${cx + r + 12},${headY + r + 8} ${cx + r + 12},${headY + r + 46}`

  return (
    <g>
      {/* 从前:灯照着自己(只剩一束虚光) */}
      <path
        d={`M${lamp.x},${lamp.y + 12} L64,352 L118,372 Z`}
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeDasharray="4 6"
      />

      {/* 现在:灯转过去,照住对面那个人 */}
      <path d={`M${lamp.x},${lamp.y + 12} L182,374 L252,344 Z`} fill={CREAM} fillOpacity="0.11" />
      <path
        d={`M${lamp.x},${lamp.y + 12} L182,374 M${lamp.x},${lamp.y + 12} L252,344`}
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.4"
        strokeWidth="1.1"
      />

      {/* 转过去的那半圈 */}
      <path
        d={`M${lamp.x - 44},${lamp.y + 30} A46,46 0 0 1 ${lamp.x + 44},${lamp.y + 30}`}
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.3"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <path d={`M${lamp.x + 34},${lamp.y + 22} L${lamp.x + 46},${lamp.y + 31} L${lamp.x + 33},${lamp.y + 38}`} fill="none" stroke={CREAM} strokeOpacity="0.45" strokeWidth="1.2" />

      {/* 灯本身:握在自己手里 */}
      <path d={`M${lamp.x - 20},${lamp.y - 12} L${lamp.x + 20},${lamp.y - 12} L${lamp.x + 13},${lamp.y + 12} L${lamp.x - 13},${lamp.y + 12} Z`} fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.3" />
      <circle cx={lamp.x} cy={lamp.y + 10} r="4.5" fill={CINNABAR} opacity="0.9" />

      {/* 自己:退进暗处 */}
      <circle cx="92" cy="318" r="13" fill={CREAM} fillOpacity="0.16" />
      <path d={figure(92, 318, 13)} fill={CREAM} fillOpacity="0.1" stroke={CREAM} strokeOpacity="0.24" strokeWidth="1.1" />

      {/* 对面那个人:被照亮 */}
      <circle cx="212" cy="310" r="15" fill={CINNABAR} opacity="0.9" />
      <path d={figure(212, 310, 15)} fill={CREAM} fillOpacity="0.2" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1.3" />

      {/* 一道很浅的地线,把两个人放在同一个场子里 */}
      <path d="M40,376 L266,376" fill="none" stroke="rgba(0,0,0,0.20)" strokeWidth="1.2" />
    </g>
  )
}
