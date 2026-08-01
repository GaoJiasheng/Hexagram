import DATA from '../../data/zhuzi-topology.json'
import { bookBySlug, chapterHref } from '../reader/booksIndex.js'

export const topology = DATA

// ── 布局常量 ───────────────────────────────────────────────
// 横轴=时代(4 列)、纵轴=学派(6 行)。同一格里若有多人则竖向堆叠。
// 这是确定性布局:力导向图每次刷新位置都不同,做不了时间线、也固定不了分享链接。
export const GUTTER = 58        // 左侧学派标签栏
export const ERA_W = 192        // 每个时代带的宽度
export const END_W = 138        // 右侧「终局」带
export const NODE_W = 88
export const NODE_H = 30
export const STACK = 38         // 同格内竖向间距
export const ROW_GAP = 16
export const HEADER_H = 46

/** 算出每个节点的坐标 + 每行/每列的边界。纯函数,同一份数据永远同一个结果。 */
export function computeLayout(data = DATA) {
  const rows = data.schools.map((school) => {
    const cells = data.eras.map((e) => data.nodes.filter((n) => n.school === school.key && n.era === e.key))
    return { school, cells, stack: Math.max(1, ...cells.map((c) => c.length)) }
  })

  const pos = {}
  let y = HEADER_H
  for (const r of rows) {
    const contentH = (r.stack - 1) * STACK + NODE_H
    r.top = y
    r.h = contentH + 20
    r.cells.forEach((cell, ei) => {
      const cx = GUTTER + ei * ERA_W + ERA_W / 2
      const cellH = (cell.length - 1) * STACK + NODE_H
      const y0 = r.top + 10 + (contentH - cellH) / 2
      cell.forEach((n, k) => { pos[n.id] = { x: cx, y: y0 + k * STACK + NODE_H / 2, node: n } })
    })
    y += r.h + ROW_GAP
  }

  const width = GUTTER + data.eras.length * ERA_W + END_W
  const height = y - ROW_GAP + 16
  return { rows, pos, width, height }
}

// 从 a 的边框上取朝向 b 的锚点,连线才不会插进方块里。
function anchor(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  if (!dx && !dy) return { x: a.x, y: a.y }
  const hw = NODE_W / 2 + 4, hh = NODE_H / 2 + 4
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  return { x: a.x + dx * t, y: a.y + dy * t }
}

/** 同一对人之间可能有多条不同类型的边(取用 + 批评),按序错开弧度免得叠成一根。 */
export function edgeGeometry(edges, pos) {
  const seen = {}
  return edges.map((e) => {
    const a = pos[e.from], b = pos[e.to]
    if (!a || !b) return null
    const key = [e.from, e.to].sort().join('~')
    const idx = (seen[key] = (seen[key] ?? -1) + 1)
    const p = anchor(a, b), q = anchor(b, a)
    const dx = q.x - p.x, dy = q.y - p.y
    const len = Math.hypot(dx, dy) || 1
    const sign = idx % 2 === 0 ? 1 : -1
    const bend = (Math.min(Math.max(len * 0.12, 16), 44) + Math.floor(idx / 2) * 18) * sign
    const mx = (p.x + q.x) / 2 - (dy / len) * bend
    const my = (p.y + q.y) / 2 + (dx / len) * bend
    return { ...e, d: `M${p.x.toFixed(1)} ${p.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}` }
  }).filter(Boolean)
}

export const nodeById = Object.fromEntries(DATA.nodes.map((n) => [n.id, n]))
export const typeById = Object.fromEntries(DATA.edgeTypes.map((t) => [t.key, t]))
export const schoolById = Object.fromEntries(DATA.schools.map((s) => [s.key, s]))

/** 一条引文 → 站内章节链接。书不在书目索引里(如《庄子》分内外杂篇)则回退拼路径。 */
export function citeHref(cite) {
  const book = bookBySlug(cite.slug)
  if (book) return chapterHref(book, cite.ch)
  return `/${cite.corpus}/${cite.slug}/${cite.ch}`
}

/** 某人身上的所有关系,分「他说别人 / 别人说他」两向——列表视图与详情面板共用。 */
export function relationsOf(id, edges = DATA.edges) {
  return {
    out: edges.filter((e) => e.from === id),
    in: edges.filter((e) => e.to === id),
  }
}
