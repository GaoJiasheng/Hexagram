// 母题：一整面机构式的窗格里，只有一扇亮着，窗内有一株活物。
// 《最好的告别》最核心的对立——为安全而建的格子 vs. 仍要过自己日子的人。
const CINNABAR = '#c3272b'

export default function LitWindowInGrid() {
  const cols = [56, 108, 160, 212]
  const rows = [120, 170, 220, 270, 320]
  const litX = 108
  const litY = 270
  return (
    <g>
      {/* 楼体：一整块沉下去的面 */}
      <rect x="40" y="100" width="224" height="272" rx="3" fill="rgba(0,0,0,0.16)" />
      {/* 地平线：楼体落在一条淡光上 */}
      <path d="M20 372 L280 372" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" fill="none" />

      {/* 窗格阵列：一律一样、一律暗 */}
      {rows.map((y) =>
        cols.map((x) => {
          const isLit = x === litX && y === litY
          if (isLit) return null
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="40"
              height="36"
              fill="rgba(0,0,0,0.22)"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="0.8"
            />
          )
        })
      )}

      {/* 唯一亮着的那一扇 */}
      <rect x={litX} y={litY} width="40" height="36" fill="rgba(255,255,255,0.22)" />
      <rect
        x={litX}
        y={litY}
        width="40"
        height="36"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.2"
      />
      {/* 窗内：一株活物 */}
      <path
        d="M128 303 L128 285"
        stroke={CINNABAR}
        strokeWidth="1.6"
        fill="none"
        opacity="0.95"
      />
      <path
        d="M128 294 C120 293 117 287 123 285 C127 284 128 290 128 294 Z"
        fill={CINNABAR}
        opacity="0.85"
      />
      <path
        d="M128 290 C136 289 139 283 133 281 C129 280 128 286 128 290 Z"
        fill={CINNABAR}
        opacity="0.7"
      />
      <circle cx="128" cy="282" r="3" fill={CINNABAR} opacity="0.95" />
      {/* 窗台上洒出来的一点光 */}
      <path d="M108 306 L148 306" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />
    </g>
  )
}
