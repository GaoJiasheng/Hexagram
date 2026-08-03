// 母题:一张自己长自己的格架。
// 最底下只有三个朱点 —— 那是被「捕获」的自然现象(热胀、电磁感应、半导体能隙……),
// 技术真正的地基不在人身上,在自然那边。往上每一个节点都由下面两个节点连出来,
// 没有一个是凭空冒出来的:新技术几乎总是既有技术的重新组合。
// 越往上层数越宽 —— 元件越多,可组的花样越多,于是技术自己给自己造出下一层。
// 这正是《技术的本质》的全书主张:技术是一个用自己搭建自己的集合。
const CINNABAR = '#c3272b'

export default function CombinatorialLattice() {
  // 画布 300×420。自下而上五层,层层加宽。
  // 整体偏左布置,右侧 x≳220 留给 BookCover 的竖排书名。
  const rows = [
    { n: 3, y: 336, span: 62 },
    { n: 4, y: 292, span: 90 },
    { n: 5, y: 248, span: 116 },
    { n: 6, y: 204, span: 142 },
    { n: 7, y: 160, span: 166 },
  ]
  const cx = 124
  const pos = rows.map(({ n, y, span }) => {
    const step = n > 1 ? span / (n - 1) : 0
    return Array.from({ length: n }, (_, i) => ({ x: cx - span / 2 + i * step, y }))
  })

  // 每个上层节点由正下方偏左、偏右的两个下层节点「组合」而来
  const links = []
  for (let r = 1; r < rows.length; r++) {
    const lower = pos[r - 1]
    pos[r].forEach((p, i) => {
      const a = lower[Math.max(0, Math.min(lower.length - 1, i - 1))]
      const b = lower[Math.max(0, Math.min(lower.length - 1, i))]
      links.push([a, p], [b, p])
    })
  }

  return (
    <g>
      {links.map(([a, b], i) => (
        <path
          key={`l${i}`}
          d={`M${a.x.toFixed(1)} ${a.y} L${b.x.toFixed(1)} ${b.y}`}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.9"
          fill="none"
        />
      ))}

      {pos.map((row, r) =>
        row.map((p, i) => {
          const seed = r === 0
          return (
            <rect
              key={`n${r}-${i}`}
              x={(p.x - (seed ? 4.4 : 3.6)).toFixed(2)}
              y={(p.y - (seed ? 4.4 : 3.6)).toFixed(2)}
              width={seed ? 8.8 : 7.2}
              height={seed ? 8.8 : 7.2}
              transform={seed ? `rotate(45 ${p.x.toFixed(2)} ${p.y})` : undefined}
              fill={seed ? CINNABAR : 'rgba(255,255,255,0.34)'}
              opacity={seed ? 0.95 : 0.62 + r * 0.09}
            />
          )
        })
      )}

      {/* 地平线:朱点之下就是自然,技术止步于此 */}
      <path d="M40 356 L208 356" stroke="rgba(0,0,0,0.26)" strokeWidth="1.2" fill="none" />

      {/* 顶上仍在长,画布只是截断了它 */}
      <path d="M40 138 L70 138" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" fill="none" />
      <path d="M178 138 L208 138" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" fill="none" />
    </g>
  )
}
