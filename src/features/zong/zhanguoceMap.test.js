import { describe, it, expect } from 'vitest'
import data from '../../data/zong/zhanguoce-map.json'
import { ownerAt, hexTerritories, makeXScale, layoutLanes, selectedChs, piecesOfState, AXIS } from './zhanguoceMap.js'

describe('七国示意图 · 疆域六角格', () => {
  const { paths, count } = hexTerritories(data.view, data.states)

  it('八国(七国 + 周)各分到格子,周最小', () => {
    for (const s of data.states) {
      expect(count[s.id]).toBeGreaterThan(0)
      expect(paths[s.id]).toMatch(/^M/)
    }
    const others = data.states.filter((s) => s.id !== 'zhou').map((s) => count[s.id])
    expect(count.zhou).toBeLessThan(Math.min(...others))
  })

  it('每国的国名落在自己的疆域里', () => {
    for (const s of data.states) expect(ownerAt(data.states, s.x, s.y)).toBe(s.id)
  })

  it('每处地名落在它所属之国的疆域里', () => {
    for (const p of data.places) if (p.state) expect(ownerAt(data.states, p.x, p.y), p.name).toBe(p.state)
  })

  it('相对方位:秦西、齐东、燕东北、楚南', () => {
    const S = Object.fromEntries(data.states.map((s) => [s.id, s]))
    for (const id of ['chu', 'qi', 'yan', 'zhao', 'wei', 'han', 'zhou']) expect(S.qin.x).toBeLessThan(S[id].x)
    for (const id of ['qin', 'zhao', 'wei', 'han', 'zhou']) expect(S.qi.x).toBeGreaterThan(S[id].x)
    for (const id of ['qin', 'qi', 'zhao', 'wei', 'han', 'zhou']) expect(S.chu.y).toBeGreaterThan(S[id].y)
    expect(S.yan.y).toBeLessThan(S.qi.y)
    expect(S.yan.x).toBeGreaterThan(S.zhao.x)
  })
})

describe('时间轴 · 泳道', () => {
  const W = 720, xOf = makeXScale(W, 14, 14)
  const { spans, lanes } = layoutLanes(data.pieces, xOf, { W, padR: 14 })

  it('刻度首尾落在两端', () => {
    expect(xOf(AXIS.from)).toBe(14)
    expect(xOf(AXIS.to)).toBe(W - 14)
  })

  it('一篇一条,同一道里前后不相碰(含篇名占位)', () => {
    expect(spans).toHaveLength(18)
    expect(lanes).toBeGreaterThan(1)
    for (let l = 0; l < lanes; l++) {
      const row = spans.filter((s) => s.lane === l).sort((a, b) => a.occ[0] - b.occ[0])
      for (let i = 1; i < row.length; i++) expect(row[i].occ[0]).toBeGreaterThan(row[i - 1].occ[1])
    }
  })

  it('篇名不出右缘', () => {
    for (const s of spans) expect(s.occ[1]).toBeLessThanOrEqual(W - 14 + 0.01)
  })
})

describe('选择', () => {
  it('点国 → 所涉之篇;点地名 → 提到它的篇', () => {
    expect([...selectedChs(data, 'zhou')]).toEqual([1])
    expect([...selectedChs(data, 'p:handan')].sort((a, b) => a - b)).toEqual([8, 12])
    expect(selectedChs(data, '')).toBeNull()
    expect(selectedChs(data, 'qin').size).toBe(piecesOfState(data, 'qin').length)
  })
})
