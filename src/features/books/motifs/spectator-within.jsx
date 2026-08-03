// 母题:胸中的旁观者——一个实体的侧影,与它对面一个虚线勾出的、镜像的同一个人。
// 《道德情操论》的核心装置是「想象中的位置互换」:我把自己放进你的处境,才生出共感;
// 而当我判断我自己的时候,我又把自己分成两个人——一个是被打量的当事人,
// 一个是站在旁边打量的看客。两道目光在中轴上相交,交点处生出第三样东西:
// 那个不偏不倚、知情而与此事无涉的公正的旁观者,他就是良心。
// 中轴是一道虚线,因为那道「界」并不真的存在——它是想象力划出来的。
const CINNABAR = '#c3272b'

export default function SpectatorWithin() {
  // 画布 300×420。中轴偏左,右侧留给竖排书名。
  const axis = 128
  const eye = 196 // 两个侧影的头心高度,也是两道目光相交的高度

  // 左:实体的我。右:我想象自己站过去的那个位置(虚线)。
  const lx = 76
  const rx = axis * 2 - lx // 180

  const shoulder = (cx, dir) =>
    `M${cx - 44 * dir},300 Q${cx - 44 * dir},242 ${cx},234 Q${cx + 44 * dir},242 ${cx + 44 * dir},300`

  return (
    <g>
      {/* 想象力划出的那道界 */}
      <line
        x1={axis}
        y1={62}
        x2={axis}
        y2={352}
        stroke="rgba(255,255,255,0.20)"
        strokeWidth="1.1"
        strokeDasharray="3 7"
      />

      {/* 左:实体的我 —— 有面、有轮廓 */}
      <g>
        <circle cx={lx} cy={eye} r="25" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.34)" strokeWidth="1.3" />
        <path d={shoulder(lx, 1)} fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.30)" strokeWidth="1.3" />
      </g>

      {/* 右:想象中的那个位置 —— 只有虚线,没有实体 */}
      <g fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.1" strokeDasharray="4 5">
        <circle cx={rx} cy={eye} r="25" />
        <path d={shoulder(rx, -1)} />
      </g>

      {/* 两道目光 */}
      <line x1={lx + 25} y1={eye} x2={rx - 25} y2={eye} stroke="rgba(255,255,255,0.24)" strokeWidth="1" />

      {/* 交点上生出的第三个人:公正的旁观者 */}
      <circle cx={axis} cy={eye} r="19" fill="none" stroke={CINNABAR} strokeWidth="1.5" opacity="0.85" />
      <circle cx={axis} cy={eye} r="7" fill={CINNABAR} opacity="0.95" />

      {/* 一道很浅的地平线,把两个人托在同一个世界里 */}
      <path d="M24,344 L232,344" fill="none" stroke="rgba(0,0,0,0.20)" strokeWidth="1.2" />
    </g>
  )
}
