// 母题:一格落下,长出一整片没人画过的图案。
// 顶端只有一个黑格(朱),往下每一行都由同一条极短的局部规则算出来
// ——「看左邻和右邻,不一样就活」(元胞自动机的规则 90)。
// 规则短到一行写得完,谁也没有画过下面那片三角,可它就是长出来了。
// 这正是《复杂》要讲的那件事:简单规则 + 大量部件 + 没有指挥官 = 无法预料的整体。
const CINNABAR = '#c3272b'

export default function CellularCascade() {
  const COLS = 31
  const ROWS = 23
  const CELL = 8.2
  const x0 = (300 - COLS * CELL) / 2
  const y0 = 126

  // 规则 90:新格 = 左邻 XOR 右邻(越界当作 0)
  let row = new Array(COLS).fill(0)
  row[(COLS - 1) / 2] = 1
  const cells = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (row[c]) cells.push({ r, c })
    }
    const next = new Array(COLS).fill(0)
    for (let c = 0; c < COLS; c++) {
      next[c] = ((c > 0 ? row[c - 1] : 0) ^ (c < COLS - 1 ? row[c + 1] : 0)) ? 1 : 0
    }
    row = next
  }

  return (
    <g>
      {/* 那一格落下来的痕迹 */}
      <path d={`M150 62 L150 ${y0 - 6}`} stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />

      {cells.map(({ r, c }, i) => {
        const seed = r === 0
        return (
          <rect
            key={i}
            x={(x0 + c * CELL + 0.5).toFixed(2)}
            y={(y0 + r * CELL + 0.5).toFixed(2)}
            width={(CELL - 1).toFixed(2)}
            height={(CELL - 1).toFixed(2)}
            fill={seed ? CINNABAR : 'rgba(255,255,255,0.30)'}
            opacity={seed ? 0.95 : 1 - r * 0.012}
          />
        )
      })}

      {/* 底线:图案还在往下长,画布只是截断了它 */}
      <path
        d={`M${x0.toFixed(1)} ${(y0 + ROWS * CELL + 8).toFixed(1)} L${(x0 + COLS * CELL).toFixed(1)} ${(y0 + ROWS * CELL + 8).toFixed(1)}`}
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="1.2"
        fill="none"
      />
    </g>
  )
}
