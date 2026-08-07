// 母题:同一个刺激,两条路。
// 一条抄近道——不经过任何思考,直接把警报拉响(朱色,画得短、画得粗、先到);
// 另一条绕远路,要先经过「这到底是什么」那一站,回到同一个点时已经慢了半拍。
// 《情商》全书的心脏就是这半拍:杏仁核劫持发生在理智还没来得及开口的那个空档里。
const CINNABAR = '#b1472f'
const CREAM = '#f2ecda'

export default function HijackArc() {
  return (
    <g>
      {/* 画布 300×420。上方是刺激入口,下方是警报响起的地方。 */}
      <circle cx="150" cy="86" r="5.5" fill={CREAM} opacity="0.9" />

      {/* 长路:绕经「想清楚这是什么」那一站,路远,到得晚 */}
      <path
        d="M150,86 C262,122 276,238 234,300 C212,334 182,344 150,336"
        fill="none"
        stroke={CREAM}
        strokeOpacity="0.4"
        strokeWidth="1.6"
      />
      <circle cx="253" cy="210" r="17" fill="none" stroke={CREAM} strokeOpacity="0.34" strokeWidth="1.2" />
      <circle cx="253" cy="210" r="3" fill={CREAM} opacity="0.5" />

      {/* 短路:抄近道的那一条,先到 */}
      <path d="M150,86 C124,152 124,272 150,326" fill="none" stroke={CINNABAR} strokeWidth="2.6" />

      {/* 警报响起 */}
      <circle cx="150" cy="334" r="12" fill={CINNABAR} opacity="0.92" />
      <circle cx="150" cy="334" r="23" fill="none" stroke={CINNABAR} strokeOpacity="0.45" strokeWidth="1.4" />
      <circle cx="150" cy="334" r="34" fill="none" stroke={CINNABAR} strokeOpacity="0.18" strokeWidth="1.2" />

      {/* 一道地平线,把整幅托住 */}
      <path d="M24,392 L276,392" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
    </g>
  )
}
