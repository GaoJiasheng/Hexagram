// 母题:两个人挪到桌子的同一侧,一起面对朱色的那个「结」。
//
// 《谈判力》全书的原点就是这个位移:传统谈判是两个人隔着桌子对坐,
// 中间摆着一块要分的蛋糕,你多我就少;哈佛这一套要做的,是把对手从
// 「桌子对面」请到「桌子同一侧」——人和问题分开之后,问题才第一次
// 成为共同的对手。桌子对面留着一圈虚线,那是对方原来坐的位置,
// 空着,提醒这一挪不是天然发生的,是谈判者主动做的一件事。
// 左下角那条虚线走向画外,是 BATNA:随时可以不谈的那条退路——
// 正因为退路在,才不必在桌上受制于人。
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

export default function SameSideTable() {
  return (
    <g>
      {/* 桌面:一个略带俯视的椭圆 */}
      <ellipse cx="150" cy="212" rx="104" ry="40" fill="rgba(255,255,255,0.08)" />
      <ellipse
        cx="150"
        cy="212"
        rx="104"
        ry="40"
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.32"
        strokeWidth="1.6"
      />
      {/* 桌沿的厚度 */}
      <path
        d="M46 212 A104 40 0 0 0 254 212 L254 220 A104 40 0 0 1 46 220 Z"
        fill="rgba(0,0,0,0.22)"
      />

      {/* 桌上的「结」:一个朱色的缠结,是被推到台面上的那个问题 */}
      <path
        d="M138 196 C150 182 168 190 164 202 C160 214 140 212 138 200 C136 188 156 184 164 194"
        fill="none"
        stroke={CINNABAR}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.95"
      />
      <circle cx="151" cy="199" r="17" fill="none" stroke={CINNABAR} strokeWidth="1" opacity="0.4" />

      {/* 对面那个空位:对方原本坐的地方,虚线留着 */}
      <circle
        cx="150"
        cy="150"
        r="15"
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.2"
        strokeWidth="1.2"
        strokeDasharray="3 5"
      />

      {/* 同一侧并排的两个人:头 + 肩 */}
      {[112, 188].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="272" r="14" fill="rgba(255,255,255,0.24)" />
          <circle cx={cx} cy="272" r="14" fill="none" stroke={CREAM} strokeOpacity="0.4" strokeWidth="1.2" />
          <path
            d={`M${cx - 26} 316 A26 24 0 0 1 ${cx + 26} 316 Z`}
            fill="rgba(255,255,255,0.16)"
          />
          <path
            d={`M${cx - 26} 316 A26 24 0 0 1 ${cx + 26} 316`}
            fill="none"
            stroke={CREAM}
            strokeOpacity="0.34"
            strokeWidth="1.2"
          />
          {/* 两人各自望向桌上那个结 */}
          <line
            x1={cx + (cx < 150 ? 14 : -14)}
            y1="262"
            x2={cx < 150 ? 138 : 164}
            y2="212"
            stroke={CREAM}
            strokeOpacity="0.2"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        </g>
      ))}

      {/* BATNA:一条走出画外的退路 */}
      <path
        d="M40 300 C22 308 14 322 12 342"
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.26"
        strokeWidth="1.2"
        strokeDasharray="4 6"
      />
      <circle cx="40" cy="300" r="3.2" fill={CINNABAR} opacity="0.7" />

      {/* 地平线与底部阴影 */}
      <line x1="0" y1="372" x2="300" y2="372" stroke="rgba(0,0,0,0.26)" strokeWidth="1.2" />
      <path d="M0 372 H300 V420 H0 Z" fill="rgba(0,0,0,0.16)" />
    </g>
  )
}
