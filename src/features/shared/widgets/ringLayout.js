// RingChart 的几何:纯函数,单测守「3–24 项节点互不重叠、都落在画布内、字放得下」。
// 第 0 项在正上方,顺时针排开(SVG 坐标 y 向下,角度增大即顺时针)。

export const VB = 320
export const CX = 160
export const CY = 160

export function ringLayout(n, arrows = false) {
  const R = n <= 8 ? 108 : n <= 12 ? 116 : 124
  const step = (2 * Math.PI) / n
  // 相邻两节点圆心的弦长 = 2R·sin(step/2)。节点半径取弦长的 0.41 倍;
  // 要画箭头时再让出至少 18 的空当给弧与箭头(项多时节点随之变小,最小 11)
  const chord = 2 * R * Math.sin(step / 2)
  const r = Math.max(11, Math.min(26, chord * 0.41, arrows ? (chord - 18) / 2 : Infinity))
  const nodes = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + i * step
    return { a, x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
  })
  const centerR = Math.max(0, Math.min(54, R - r - 18))
  return { R, r, step, nodes, centerR }
}

// 节点里的字:≤3 字一行,4–6 字折两行;字号按节点直径与每行字数取小
export function labelLines(label, r) {
  const chars = [...label]
  const lines = chars.length <= 3 ? [label] : [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')]
  const maxLen = Math.max(...lines.map((l) => [...l].length))
  const avail = 2 * r - 6
  const fs = Math.min(15, avail / maxLen, lines.length > 1 ? avail / (lines.length * 1.15) : Infinity)
  return { lines, fs }
}

// 第 i 项到下一项的顺时针弧(两端各让出节点半径 + 2),以及终点处的箭头三角
export function arcBetween(i, layout) {
  const { R, r, step, nodes } = layout
  const d = (r + 2) / R
  const a0 = nodes[i].a + d
  const a1 = nodes[i].a + step - d
  const p = (a) => ({ x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) })
  const s = p(a0), e = p(a1)
  const t = { x: -Math.sin(a1), y: Math.cos(a1) }       // 顺时针切向
  const nr = { x: Math.cos(a1), y: Math.sin(a1) }       // 径向
  const back = { x: e.x - 6 * t.x, y: e.y - 6 * t.y }
  const head = [e, { x: back.x + 3.2 * nr.x, y: back.y + 3.2 * nr.y }, { x: back.x - 3.2 * nr.x, y: back.y - 3.2 * nr.y }]
  const f = (v) => v.toFixed(2)
  return {
    d: `M ${f(s.x)} ${f(s.y)} A ${R} ${R} 0 0 1 ${f(e.x)} ${f(e.y)}`,
    head: head.map((q) => `${f(q.x)},${f(q.y)}`).join(' '),
  }
}

// 中心标题:≤5 字一行,更长折两行;字号按中心圆直径取小,上限 17
export function centerLabelLines(label, cr) {
  const chars = [...label]
  const lines = chars.length <= 5 ? [label] : [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')]
  const maxLen = Math.max(...lines.map((l) => [...l].length))
  const fs = Math.min(17, (2 * cr - 14) / maxLen, lines.length > 1 ? (2 * cr - 14) / (lines.length * 1.2) : Infinity)
  return { lines, fs }
}
