// 母题：一片格状的候选点阵，中间穿过一条被选中的朱色路径。
// 这是《数学之美》全书的形状——分词、语音识别、拼音输入、机器翻译，
// 化成数学模型之后都长成同一张网格：每一列是一个时刻的所有可能，
// 一遍扫过去，留下那条概率最大的路。穷举要走指数级的岔口，
// 维特比只走一遍，答案就是这条线。
const CINNABAR = '#c3272b'
const CREAM = '#f2ecda'

// 五列 × 四行；书名竖排在 x≈250，故点阵靠左
const COLS = [32, 76, 120, 164, 208]
const ROWS = [172, 218, 264, 310]
// 被选中的那条路（每列取第几行）
const PICK = [2, 1, 2, 0, 1]

export default function TrellisPath() {
  const edges = []
  for (let i = 0; i < COLS.length - 1; i++) {
    ROWS.forEach((y1, a) => {
      ROWS.forEach((y2, b) => {
        edges.push(
          <line
            key={`${i}-${a}-${b}`}
            x1={COLS[i]} y1={y1} x2={COLS[i + 1]} y2={y2}
            stroke={CREAM} strokeOpacity="0.07" strokeWidth="0.8"
          />
        )
      })
    })
  }

  const pts = PICK.map((r, i) => [COLS[i], ROWS[r]])
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ')

  return (
    <g>
      {/* 点阵所在的一带略暗，像一块黑板 */}
      <rect x="0" y="148" width="300" height="188" fill="rgba(0,0,0,0.10)" />

      {edges}

      {/* 所有候选点 */}
      {COLS.map((x, i) =>
        ROWS.map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.6" fill={CREAM} fillOpacity="0.2" />
        ))
      )}

      {/* 被选中的那条路 */}
      <path d={d} fill="none" stroke={CINNABAR} strokeOpacity="0.9" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={`p${p[0]}`} cx={p[0]} cy={p[1]} r="5" fill={CINNABAR} opacity="0.95" />
      ))}

      {/* 一道基线，像草稿纸上的横线 */}
      <line x1="0" y1="336" x2="300" y2="336" stroke="rgba(0,0,0,0.22)" strokeWidth="1.2" />
      <line x1="24" y1="356" x2="216" y2="356" stroke={CREAM} strokeOpacity="0.12" strokeWidth="0.9" />
      <line x1="24" y1="372" x2="176" y2="372" stroke={CREAM} strokeOpacity="0.09" strokeWidth="0.9" />
    </g>
  )
}
