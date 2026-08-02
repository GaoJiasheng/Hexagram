// 母题:一间绝无窗户的铁屋——屋身实心、铆钉封死,只有一道裂缝里逸出一线朱红的声音。
// 呼应《呐喊·自序》里的铁屋子:喊出去未必有用,但那一声还是出去了。
const CINNABAR = '#c3272b'

export default function IronHouse() {
  const rivets = []
  for (let i = 0; i < 9; i += 1) {
    const x = 78 + i * 18
    rivets.push(<circle key={`t${i}`} cx={x} cy={170} r="2.3" fill="rgba(255,255,255,0.16)" />)
    rivets.push(<circle key={`b${i}`} cx={x} cy={330} r="2.3" fill="rgba(0,0,0,0.30)" />)
  }
  return (
    <g>
      {/* 地平线 */}
      <path d="M0 352 H300" stroke="rgba(0,0,0,0.28)" strokeWidth="1" fill="none" />
      {/* 屋身:一整块铁,没有窗 */}
      <rect x="66" y="158" width="168" height="194" fill="rgba(0,0,0,0.32)" />
      <rect x="66" y="158" width="168" height="194" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
      {/* 屋顶一线天光,照不进去 */}
      <rect x="66" y="158" width="168" height="5" fill="rgba(255,255,255,0.11)" />
      {rivets}
      {/* 裂缝:自屋内向上撕开 */}
      <path
        d="M150 306 L145 262 L153 234 L147 202 L152 176 L149 158"
        stroke="rgba(255,255,255,0.20)"
        strokeWidth="1.6"
        fill="none"
      />
      {/* 逸出的那一声 */}
      <path d="M149 158 L153 128 L147 102 L151 76" stroke={CINNABAR} strokeWidth="2" fill="none" opacity="0.95" />
      <circle cx="151" cy="68" r="4.5" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}
