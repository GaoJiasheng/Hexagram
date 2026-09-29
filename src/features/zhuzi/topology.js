import { bookBySlug, chapterHref } from '../reader/booksIndex.js'
import { TOPICS } from '../debates/debates.js'

// 拓扑图的布局与几何 —— 数据无关的工厂。诸子拓扑图(zhuzi-topology.json)与儒门学脉图(ru-lineage.json)共用,
// 两份数据结构相同(eras / schools / edgeTypes / nodes / edges / end),各页 `makeTopology(DATA)` 取一套绑定好的函数。

// ── 布局常量 ───────────────────────────────────────────────
// 横轴=时代、纵轴=学派。同一格里若有多人则竖向堆叠。
// 这是确定性布局:力导向图每次刷新位置都不同,做不了时间线、也固定不了分享链接。
export const GUTTER = 58        // 左侧学派标签栏
export const ERA_W = 192        // 每个时代带的宽度(数据可按带覆写:era.w)
export const END_W = 138        // 右侧「终局」带
export const NODE_W = 88
export const NODE_H = 30
export const STACK = 38         // 同格内竖向间距
export const ROW_GAP = 16
export const HEADER_H = 46

// 同格堆叠的层数。节点可带 k(层号)让两人同层并排(配 dx 横移);不带则按出现次序一人一层。
const levelOf = (n, i) => n.k ?? i
const levels = (cell) => cell.reduce((m, n, i) => Math.max(m, levelOf(n, i) + 1), 0)

/** 算出每个节点的坐标 + 每行/每列的边界。纯函数,同一份数据永远同一个结果。
 *  可选的版面微调(诸子数据一概不用,故结果与改工厂前逐位相同):
 *    layout.stack —— 格内层距;era.w —— 该时代带的宽度;node.k —— 格内层号;node.dx —— 相对格中线的横移(px)。 */
export function computeLayout(data) {
  const stack = data.layout?.stack ?? STACK
  const eraW = data.eras.map((e) => e.w ?? ERA_W)
  const eraX = []
  let x = GUTTER
  for (const w of eraW) { eraX.push(x); x += w }

  const rows = data.schools.map((school) => {
    const cells = data.eras.map((e) => data.nodes.filter((n) => n.school === school.key && n.era === e.key))
    return { school, cells, stack: Math.max(1, ...cells.map(levels)) }
  })

  const pos = {}
  let y = HEADER_H
  for (const r of rows) {
    const contentH = (r.stack - 1) * stack + NODE_H
    r.top = y
    r.h = contentH + 20
    r.cells.forEach((cell, ei) => {
      const cx = eraX[ei] + eraW[ei] / 2
      const cellH = (levels(cell) - 1) * stack + NODE_H
      const y0 = r.top + 10 + (contentH - cellH) / 2
      cell.forEach((n, k) => { pos[n.id] = { x: cx + (n.dx ?? 0), y: y0 + levelOf(n, k) * stack + NODE_H / 2, node: n } })
    })
    y += r.h + ROW_GAP
  }

  const width = x + END_W
  const height = y - ROW_GAP + 16
  return { rows, pos, width, height, eraX, eraW, endX: x }
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

/** 一条引文 → 站内章节链接。书不在书目索引里(如《庄子》分内外杂篇)则回退拼路径。 */
export function citeHref(cite) {
  const book = bookBySlug(cite.slug)
  if (book) return chapterHref(book, cite.ch)
  return `/${cite.corpus}/${cite.slug}/${cite.ch}`
}

/** 某人参与过哪些辩题 —— 拓扑图记「史上真实的互评」,争鸣记「编排的会讲」,两边同一批人。
 *  争鸣用短 key(kong/xun/zhuang),拓扑用全名 id,故靠数据里显式的 debateKey 对接,
 *  不按 label 模糊匹配(会错配:同名不同人、书名与人名混用都出现过)。
 *  debateKey 可为数组(一人对应争鸣里的几个席位,如朱熹 = 「朱子」+「程朱」)。 */
export function debatesOf(node) {
  const keys = [].concat(node?.debateKey || [])
  if (!keys.length) return []
  return TOPICS.filter((t) => (t.schools || []).some((s) => keys.includes(s.key)))
}

/** 工厂:把一份拓扑数据绑到上面这套布局与几何上。各页只认它返回的这一包。 */
export function makeTopology(data) {
  return {
    topology: data,
    /** 默认算本份数据;传别的数据也行(与改工厂前的签名一致)。 */
    computeLayout: (d = data) => computeLayout(d),
    edgeGeometry,
    nodeById: Object.fromEntries(data.nodes.map((n) => [n.id, n])),
    typeById: Object.fromEntries(data.edgeTypes.map((t) => [t.key, t])),
    schoolById: Object.fromEntries(data.schools.map((s) => [s.key, s])),
    citeHref,
    /** 某人身上的所有关系,分「他说别人 / 别人说他」两向——列表视图与详情面板共用。 */
    relationsOf: (id, edges = data.edges) => ({
      out: edges.filter((e) => e.from === id),
      in: edges.filter((e) => e.to === id),
    }),
    debatesOf,
  }
}
