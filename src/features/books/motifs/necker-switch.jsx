// 母题:内克尔立方体——同一组线,两种读法。
// 十二条边一根没变,可你要么把左下那个正方形看成前面,要么把右上那个看成前面;
// 中间没有过渡,也没有第三种可能,而且你无法同时看见两种。
// 这正是库恩说的「格式塔转换」:革命前后的科学家面对同一批线条,
// 看见的却是两个不同的立体——朱色标出的那一面,是其中一种读法。
const CINNABAR = '#b1472f'
const CREAM = '#f2ecda'

export default function NeckerSwitch() {
  // 画布 300×420。前后两个正方形错开,构成经典的双稳态立方体。
  const s = 108      // 边长
  const o = 54       // 错位
  const ax = 56, ay = 256          // 读法 A 的正方形(左下)
  const bx = ax + o, by = ay - o   // 读法 B 的正方形(右上)

  const sq = (x, y) => `M${x},${y} L${x + s},${y} L${x + s},${y + s} L${x},${y + s} Z`
  const links = [
    [ax, ay, bx, by],
    [ax + s, ay, bx + s, by],
    [ax + s, ay + s, bx + s, by + s],
    [ax, ay + s, bx, by + s],
  ]
    .map(([x1, y1, x2, y2]) => `M${x1},${y1} L${x2},${y2}`)
    .join(' ')

  return (
    <g>
      {/* 两种读法各自的「前面」,用半透明面暗示两个不同的立体 */}
      <path d={sq(bx, by)} fill="rgba(255,255,255,0.08)" />
      <path d={sq(ax, ay)} fill={CINNABAR} opacity="0.16" />

      {/* 十二条边:一根没变 */}
      <g fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.2">
        <path d={sq(ax, ay)} />
        <path d={sq(bx, by)} />
        <path d={links} />
      </g>

      {/* 读法 B:白线的那一面在前 */}
      <path d={sq(bx, by)} fill="none" stroke={CREAM} strokeOpacity="0.85" strokeWidth="2.1" />
      {/* 读法 A:朱线的那一面在前 */}
      <path d={sq(ax, ay)} fill="none" stroke={CINNABAR} strokeWidth="2.4" />

      {/* 切换点:八个顶点里唯一一个两种读法都落在最前的角 */}
      <circle cx={ax + s} cy={ay} r="4.2" fill={CINNABAR} />

      {/* 底下一道地平线,把立方体托住,免得整幅悬空 */}
      <path
        d={`M22,${ay + s + 46} L278,${ay + s + 46}`}
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="1.2"
      />
    </g>
  )
}
