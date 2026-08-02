// 母题:一方是实心的,另一方只是从场地里剪出来的空缺 —— 呼应全书的地基「他者」:
// 男性被设为标准与主体(左侧实心的圆,朱点是它自己给自己定的零点),
// 女性不被当作另一个同等的主体,而是相对于他被定义的那一方(右侧那块场地里的空洞,
// 它没有自己的填充,轮廓由外面的东西界定,朱线只描出边缘)。
// 一条虚线从他的中心量过去,穿过空洞 —— 一切尺度都以他为起点。
// 不画任何人形,只画「谁被设成默认值」这个结构本身。
const CREAM = '#f2ecda'
const CINNABAR = '#b1472f'

export default function DefinedByOutline() {
  // 空洞:用 evenodd 在场地上挖一个圆
  const field = 'M146,252 H250 V356 H146 Z M156,304 a42,42 0 1,0 84,0 a42,42 0 1,0 -84,0 Z'
  return (
    <g>
      {/* 以他为零点的量尺:虚线从实心一方的中心横穿过去 */}
      <line x1="86" y1="304" x2="252" y2="304" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 5" />

      {/* 右:一块场地,中间是被剪出的空缺 —— 她只以「不是他」的形状出现 */}
      <path d={field} fill={CREAM} fillOpacity="0.15" fillRule="evenodd" />
      <circle cx="198" cy="304" r="42" fill="none" stroke={CINNABAR} strokeOpacity="0.85" strokeWidth="1.6" />

      {/* 左:实心、自足的一方 —— 被当作标准 */}
      <circle cx="86" cy="304" r="42" fill={CREAM} fillOpacity="0.42" />
      <circle cx="86" cy="304" r="5.5" fill={CINNABAR} />
    </g>
  )
}
