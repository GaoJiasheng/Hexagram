// 母题:一棵长错了地方的树。《中国文化要义》的核心判断是「文化早熟」——
// 梁漱溟认为中国文化不是走得慢,而是在别人还没走到的时候就先转了向:
// 它跳过了「集团生活」这一段,直接从家庭伦理里长出了一整套秩序。
//
// 所以画的不是一棵匀称的树,而是**主干在很低处就分了叉、向两侧铺开**:
// 根系极发达(家、伦理),树冠却没有往上长成森林里那种竞争性的高度。
// 朱色的那一小段是分叉点 —— 全书要解释的就是那一次转向。
// 底下横着一道虚线,是「本该继续往上的那条路」,它没有走。
const CINNABAR = '#c3272b'

export default function RootAndBranch() {
  return (
    <g>
      {/* 本该继续往上的那条路 —— 没走成,故为虚线 */}
      <path d="M150 196 L150 74" stroke="rgba(255,255,255,0.14)" strokeWidth="1"
        fill="none" strokeDasharray="4 7" />
      <path d="M150 74 l-5 9 l10 0 z" fill="rgba(255,255,255,0.14)" />

      {/* 主干:很低就分了叉 */}
      <path d="M150 300 L150 206" stroke="rgba(255,255,255,0.30)" strokeWidth="2.4" fill="none" />

      {/* 分叉点 —— 全书要解释的那一次转向 */}
      <circle cx="150" cy="200" r="5.5" fill={CINNABAR} opacity="0.95" />
      <circle cx="150" cy="200" r="12" fill={CINNABAR} opacity="0.16" />

      {/* 向两侧横铺的枝:不争高,只铺开 */}
      <path d="M150 200 C120 190,92 186,62 190" stroke="rgba(255,255,255,0.26)" strokeWidth="1.6" fill="none" />
      <path d="M150 200 C180 190,208 186,238 190" stroke="rgba(255,255,255,0.26)" strokeWidth="1.6" fill="none" />
      <path d="M150 200 C126 176,104 166,80 162" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none" />
      <path d="M150 200 C174 176,196 166,220 162" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" fill="none" />
      <path d="M150 200 C136 172,126 154,118 138" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
      <path d="M150 200 C164 172,174 154,182 138" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />

      {/* 地面 */}
      <path d="M40 300 L260 300" stroke="rgba(255,255,255,0.24)" strokeWidth="1.2" fill="none" />

      {/* 根系:比树冠更发达 —— 家与伦理 */}
      <path d="M150 300 C130 318,104 328,74 336" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" fill="none" />
      <path d="M150 300 C170 318,196 328,226 336" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" fill="none" />
      <path d="M150 300 C142 324,134 344,124 362" stroke="rgba(0,0,0,0.26)" strokeWidth="1.3" fill="none" />
      <path d="M150 300 C158 324,166 344,176 362" stroke="rgba(0,0,0,0.26)" strokeWidth="1.3" fill="none" />
      <path d="M150 300 L150 368" stroke="rgba(0,0,0,0.30)" strokeWidth="1.5" fill="none" />
      <path d="M104 330 C92 342,86 352,82 364" stroke="rgba(0,0,0,0.18)" strokeWidth="1" fill="none" />
      <path d="M196 330 C208 342,214 352,218 364" stroke="rgba(0,0,0,0.18)" strokeWidth="1" fill="none" />
    </g>
  )
}
