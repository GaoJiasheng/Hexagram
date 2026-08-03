// 母题:一条自上而下越流越宽的江河——细流从两侧不断汇入,河身随之加宽,
// 到底部散开成入海的一片。源头一点朱砂,是最初那个小小的「中原」。
// 呼应《万古江河》:中国文化不是一条单线的纯血统传承,而是支流不断汇入、
// 愈往下游愈宽阔的一条大河;每一次变宽,都是因为有外来的水进来了。
const CINNABAR = '#c3272b'

// 河身:上窄下宽的一条带子(左右两条边界线,中间填充)
const RIVER = [
  // 左岸:自 x=142 一路外扩到 x=52
  'M142 62 C138 130 128 178 116 226 C104 274 84 310 52 344',
  // 到底部横过去接右岸
  'L248 344',
  // 右岸回上:自 x=248 收回到 x=158
  'C216 310 196 274 184 226 C172 178 162 130 158 62 Z',
].join(' ')

// 汇入的支流:[起点x, 起点y, 控制x, 控制y, 汇入x, 汇入y]
const BRANCHES = [
  [16, 96, 74, 104, 140, 128],
  [284, 118, 226, 128, 160, 150],
  [10, 168, 70, 180, 126, 202],
  [290, 196, 232, 210, 176, 232],
  [18, 246, 74, 258, 112, 276],
  [286, 268, 232, 282, 190, 296],
]

export default function ConvergingRiver() {
  return (
    <g>
      {/* 天光下的一道远山轮廓,交代这条河流在人世间 */}
      <path
        d="M0 74 L58 50 L104 70 L150 40 L206 68 L252 46 L300 72"
        fill="none"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="1.2"
      />

      {/* 河身 */}
      <path d={RIVER} fill="rgba(255,255,255,0.13)" />
      <path d={RIVER} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.1" />

      {/* 河心的两道水纹,示意「一直在流」 */}
      <path
        d="M150 96 C146 160 138 232 118 322"
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.9"
      />
      <path
        d="M152 108 C154 172 158 244 176 326"
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="0.9"
      />

      {/* 不断汇入的支流 */}
      {BRANCHES.map(([x0, y0, cx, cy, x1, y1], i) => (
        <path
          key={i}
          d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`}
          fill="none"
          stroke="rgba(255,255,255,0.26)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}

      {/* 入海:底部散开的一片 */}
      <path d="M0 344 H300 V420 H0 Z" fill="rgba(0,0,0,0.20)" />
      <path d="M0 344 H300" stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none" />
      <path d="M24 366 H120" stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
      <path d="M168 380 H272" stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
      <path d="M60 394 H210" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />

      {/* 源头一点朱:最初那个很小的「中国」 */}
      <circle cx="150" cy="62" r="8.5" fill={CINNABAR} opacity="0.92" />
      <circle cx="150" cy="62" r="17" fill="none" stroke={CINNABAR} strokeWidth="1.1" opacity="0.55" />
    </g>
  )
}
