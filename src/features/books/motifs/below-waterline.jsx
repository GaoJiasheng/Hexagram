// 母题:水线之下——说出口的那一句只是露出水面的尖,真正相撞的在下面。
// 水面上是两个人交换的一句话(细线相连的两个小尖),水面下各自坠着一整块沉体,
// 被两道横线分成三层:发生了什么 / 我有什么感受 / 这件事说明我是谁。
// 最深的一层染成朱色,两块沉体也正是在那一层最靠近、最容易挤到一起——
// 这本书的判断是:对话谈崩,多半不是崩在水面上那句话,是崩在最底下那一层。
const CINNABAR = '#b1472f'
const CREAM = '#f2ecda'

export default function BelowWaterline() {
  // 画布 300×420,水线 y=196。
  const WL = 196

  // 两块沉体的轮廓(上窄下宽,略向彼此倾斜,底部只留一道窄缝)
  const left = 'M104,196 L132,196 L146,372 L84,372 Z'
  const right = 'M168,196 L196,196 L216,372 L154,372 Z'

  // 最深的一层(身份层)单独取出来上朱色
  const leftDeep = 'M90.8,312 L141.2,312 L146,372 L84,372 Z'
  const rightDeep = 'M158.8,312 L209.2,312 L216,372 L154,372 Z'

  return (
    <g>
      {/* 水面上:两个小尖 —— 真正说出口的那一点点 */}
      <path d="M110,196 L126,196 L118,176 Z" fill={CREAM} fillOpacity="0.9" />
      <path d="M174,196 L190,196 L182,176 Z" fill={CREAM} fillOpacity="0.9" />
      {/* 交换的那一句话 */}
      <path d="M118,170 L182,170" fill="none" stroke={CREAM} strokeOpacity="0.5" strokeWidth="1" />

      {/* 水线,以及两道余波 */}
      <path d={`M24,${WL} L276,${WL}`} fill="none" stroke={CREAM} strokeOpacity="0.6" strokeWidth="1.4" />
      <path d={`M40,${WL + 7} L138,${WL + 7}`} fill="none" stroke={CREAM} strokeOpacity="0.2" strokeWidth="1" />
      <path d={`M170,${WL + 12} L262,${WL + 12}`} fill="none" stroke={CREAM} strokeOpacity="0.14" strokeWidth="1" />

      {/* 水下的两块沉体:一亮一暗,是两个不同的人 */}
      <path d={left} fill="rgba(255,255,255,0.09)" />
      <path d={right} fill="rgba(0,0,0,0.16)" />

      {/* 最深的一层:身份 */}
      <path d={leftDeep} fill={CINNABAR} fillOpacity="0.42" />
      <path d={rightDeep} fill={CINNABAR} fillOpacity="0.42" />

      {/* 三层之间的两道分界 */}
      <g fill="none" stroke={CREAM} strokeOpacity="0.3" strokeWidth="1">
        <path d="M97.4,254 L136.6,254" />
        <path d="M90.8,312 L141.2,312" />
        <path d="M163.4,254 L202.6,254" />
        <path d="M158.8,312 L209.2,312" />
      </g>

      {/* 沉体轮廓 */}
      <g fill="none" stroke={CREAM} strokeOpacity="0.55" strokeWidth="1.3">
        <path d={left} />
        <path d={right} />
      </g>

      {/* 最深处那道窄缝:两块沉体真正挤在一起的地方 */}
      <path d="M150,326 L150,372" fill="none" stroke={CINNABAR} strokeWidth="2.4" />
      <circle cx="150" cy="352" r="4.6" fill={CINNABAR} />
    </g>
  )
}
