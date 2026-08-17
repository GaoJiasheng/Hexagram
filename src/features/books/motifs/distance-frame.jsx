// 母题:一段距离。朱光潜《谈美》开篇即讲那棵古松 —— 木商看见木料、植物学家
// 看见叶为针状,画家什么也不图,只是看。美感的前提是**把实用的念头放下**,
// 与对象拉开一段距离(他讲的「心理的距离」)。
// 所以画一棵极简的松,与观看者之间隔着一道朱色的细线 —— 那道距离不是隔阂,
// 是它之所以能被看成美的条件。
const CINNABAR = '#c3272b'

export default function DistanceFrame() {
  return (
    <g>
      {/* 观看的人 */}
      <circle cx="66" cy="228" r="13" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.2" />
      {/* 那一段距离 */}
      <path d="M88 228 L196 228" stroke={CINNABAR} strokeWidth="1.2" opacity="0.7" strokeDasharray="5 5" />
      <path d="M120 214 L120 242 M164 214 L164 242" stroke={CINNABAR} strokeWidth="0.9" opacity="0.4" />
      {/* 松 */}
      <path d="M226 300 L226 190" stroke="rgba(255,255,255,0.34)" strokeWidth="2" fill="none" />
      <path d="M226 206 C206 196,192 186,180 172" stroke="rgba(255,255,255,0.26)" strokeWidth="1.3" fill="none" />
      <path d="M226 226 C248 216,262 206,272 192" stroke="rgba(255,255,255,0.26)" strokeWidth="1.3" fill="none" />
      <path d="M226 250 C204 242,192 234,182 222" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" fill="none" />
      <path d="M226 186 C214 172,208 158,206 142" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" fill="none" />
      <path d="M180 300 L272 300" stroke="rgba(255,255,255,0.22)" strokeWidth="1.1" fill="none" />
    </g>
  )
}
