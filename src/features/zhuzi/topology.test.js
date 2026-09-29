import { describe, it, expect } from 'vitest'
import ZHUZI from '../../data/zhuzi-topology.json'
import RU from '../../data/ru-lineage.json'
import { makeTopology, computeLayout, GUTTER, ERA_W, END_W, NODE_W, NODE_H, STACK, ROW_GAP, HEADER_H } from './topology.js'

// 改工厂前的布局算法原样抄一份——诸子数据不带 k / dx / era.w,工厂算出来必须与它逐位相同(诸子页零变化)。
function legacyLayout(data) {
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
      cell.forEach((n, k) => { pos[n.id] = { x: cx, y: y0 + k * STACK + NODE_H / 2 } })
    })
    y += r.h + ROW_GAP
  }
  return { rows, pos, width: GUTTER + data.eras.length * ERA_W + END_W, height: y - ROW_GAP + 16 }
}

// 二次贝塞尔上取点,看它有没有穿过第三个人的方框(端点两人除外)
function crossings(t, layout) {
  const out = []
  for (const e of t.edgeGeometry(t.topology.edges, layout.pos)) {
    const [px, py, cx, cy, qx, qy] = e.d.match(/-?[\d.]+/g).map(Number)
    const hit = new Set()
    for (let i = 1; i < 80; i++) {
      const u = i / 80
      const x = (1 - u) ** 2 * px + 2 * u * (1 - u) * cx + u * u * qx
      const y = (1 - u) ** 2 * py + 2 * u * (1 - u) * cy + u * u * qy
      for (const [id, p] of Object.entries(layout.pos)) {
        if (id !== e.from && id !== e.to && Math.abs(x - p.x) < NODE_W / 2 + 3 && Math.abs(y - p.y) < NODE_H / 2 + 3) hit.add(id)
      }
    }
    if (hit.size) out.push({ type: e.type, from: e.from, to: e.to, hit: [...hit] })
  }
  return out
}

describe('拓扑工厂 · 诸子图零变化', () => {
  const t = makeTopology(ZHUZI)
  const now = t.computeLayout()
  const old = legacyLayout(ZHUZI)

  it('节点坐标、画布宽高与改工厂前逐位相同', () => {
    expect(Object.fromEntries(Object.entries(now.pos).map(([id, p]) => [id, { x: p.x, y: p.y }]))).toEqual(old.pos)
    expect([now.width, now.height]).toEqual([old.width, old.height])
    expect(now.rows.map((r) => [r.school.key, r.stack, r.top, r.h])).toEqual(old.rows.map((r) => [r.school.key, r.stack, r.top, r.h]))
  })

  it('默认参数仍算本份数据;模块级 computeLayout 接任意数据', () => {
    expect(t.computeLayout().pos).toEqual(computeLayout(ZHUZI).pos)
    expect(t.computeLayout(RU).width).toBe(computeLayout(RU).width)
  })

  it('查表与关系函数绑定在各自数据上', () => {
    expect(t.nodeById.kongzi.label).toBe('孔子')
    const r = makeTopology(RU)
    expect(r.nodeById.wangshouren.label).toBe('王守仁')
    expect(r.relationsOf('xunzi').out.map((e) => e.to)).toEqual(expect.arrayContaining(['zisi', 'mengzi', 'kongzi']))
    expect(t.relationsOf('xunzi').out.length).toBe(ZHUZI.edges.filter((e) => e.from === 'xunzi').length)
  })

  it('debateKey 字符串与数组两种写法都认', () => {
    const one = t.debatesOf({ debateKey: 'kong' })
    expect(one.length).toBeGreaterThan(0)
    const both = t.debatesOf({ debateKey: ['zhu', 'cheng'] })
    expect(both.length).toBeGreaterThanOrEqual(t.debatesOf({ debateKey: 'zhu' }).length)
    expect(t.debatesOf({})).toEqual([])
  })
})

describe('拓扑工厂 · 儒门学脉图版面', () => {
  const t = makeTopology(RU)
  const L = t.computeLayout()

  it('时代带按 era.w 排开,终局带接在最后', () => {
    expect(L.eraX[0]).toBe(GUTTER)
    RU.eras.forEach((e, i) => { if (i) expect(L.eraX[i]).toBe(L.eraX[i - 1] + (RU.eras[i - 1].w ?? ERA_W)) })
    expect(L.width).toBe(L.endX + END_W)
  })

  it('人与人互不相叠', () => {
    const ps = Object.entries(L.pos)
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const [a, pa] = ps[i], [b, pb] = ps[j]
        const apart = Math.abs(pa.x - pb.x) >= NODE_W + 4 || Math.abs(pa.y - pb.y) >= NODE_H + 4
        expect(apart, `${a} / ${b}`).toBe(true)
      }
    }
  })

  it('默认亮的师承骨架没有一根线穿过第三个人', () => {
    expect(crossings(t, L).filter((c) => c.type === 'lineage')).toEqual([])
  })
})
