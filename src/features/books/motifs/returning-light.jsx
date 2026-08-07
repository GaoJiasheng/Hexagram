// 母题:一道光自中心射出、绕行一周、又折回中心——「回光」。
// 这一个图形同时压住全书的三层:原典《太乙金华宗旨》讲的是让向外耗散的光回照自身;
// 荣格把它读成意识向内回转、把投射收回来;而这本书本身的命运也是如此——
// 中文的东西走出去(卫礼贤德译、荣格评述),兜了一大圈,又回到中文世界。
// 刻意不做成对称的曼陀罗(《红书》已用 mandala),此处是一条**不对称的返回轨迹**。
const CINNABAR = '#c3272b'

export default function ReturningLight() {
  return (
    <g>
      {/* 外围两道极淡的同心晕:光散出去时留下的余痕 */}
      <circle cx="150" cy="206" r="118" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <circle cx="150" cy="206" r="86" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* 散出去的那一段:自中心斜向右上冲出,越远越淡 */}
      <path
        d="M 150 206 C 178 168 214 132 252 104"
        fill="none"
        stroke="rgba(255,255,255,0.30)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* 折返:绕过外缘、沿左侧回旋而下,再收回中心 */}
      <path
        d="M 252 104 C 268 150 254 214 208 262 C 166 306 96 306 62 262 C 30 220 52 174 96 178 C 128 181 138 196 150 206"
        fill="none"
        stroke="rgba(255,255,255,0.46)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* 折返途中的三个刻度点:光是一段一段收回来的,不是一下子 */}
      <circle cx="252" cy="104" r="4" fill="rgba(255,255,255,0.62)" />
      <circle cx="196" cy="276" r="3.4" fill="rgba(255,255,255,0.42)" />
      <circle cx="66" cy="228" r="3.4" fill="rgba(255,255,255,0.42)" />

      {/* 底部一道压舱的暗弧:所有回旋落在这里 */}
      <path d="M 46 330 C 106 352 194 352 254 330" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="3" strokeLinecap="round" />

      {/* 中心:光聚拢处。一层朱色晕 + 一颗实心朱点 */}
      <circle cx="150" cy="206" r="30" fill={CINNABAR} opacity="0.14" />
      <circle cx="150" cy="206" r="16" fill={CINNABAR} opacity="0.28" />
      <circle cx="150" cy="206" r="7.5" fill={CINNABAR} opacity="0.95" />
    </g>
  )
}
