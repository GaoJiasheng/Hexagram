import { describe, it, expect } from 'vitest'
import { xiantianNum, xiantianIndex, circleAngle, squarePos } from '../xiantian.js'
import { allHexagrams as TABLE } from '../../data.js'
import { getCuoGua } from '../transforms.js'

const byName = Object.fromEntries(TABLE.map(t => [t.name, t]))
const bin = name => byName[name].binary

describe('先天卦数(v10 §5.1)', () => {
  it('乾一兑二离三震四巽五坎六艮七坤八', () => {
    expect(xiantianNum('111')).toBe(1) // 乾
    expect(xiantianNum('110')).toBe(2) // 兑
    expect(xiantianNum('101')).toBe(3) // 离
    expect(xiantianNum('100')).toBe(4) // 震
    expect(xiantianNum('011')).toBe(5) // 巽
    expect(xiantianNum('010')).toBe(6) // 坎
    expect(xiantianNum('001')).toBe(7) // 艮
    expect(xiantianNum('000')).toBe(8) // 坤
  })
})

describe('邵雍次序(v10 §5.2)', () => {
  it('设计稿自检值', () => {
    expect(xiantianIndex(bin('乾'))).toBe(1)
    expect(xiantianIndex(bin('夬'))).toBe(2)
    expect(xiantianIndex(bin('大有'))).toBe(3)
    expect(xiantianIndex(bin('复'))).toBe(32)
    expect(xiantianIndex(bin('姤'))).toBe(33)
    expect(xiantianIndex(bin('师'))).toBe(48)
    expect(xiantianIndex(bin('坤'))).toBe(64)
    expect(xiantianIndex(bin('离'))).toBe(19)
    expect(xiantianIndex(bin('坎'))).toBe(46)
  })

  it('64 卦次序无重复且覆盖 1–64', () => {
    const idx = TABLE.map(t => xiantianIndex(t.binary)).sort((a, b) => a - b)
    expect(idx).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
  })
})

describe('圆图角度(v10 §5.3)', () => {
  it('乾姤夹正南(上),复坤夹正北(下)', () => {
    expect(circleAngle(bin('乾'))).toBeCloseTo(-2.8125)
    expect(circleAngle(bin('姤'))).toBeCloseTo(2.8125)
    expect(circleAngle(bin('复'))).toBeCloseTo(-177.1875)
    expect(circleAngle(bin('坤'))).toBeCloseTo(177.1875)
  })

  it('错卦对处于圆图直径两端(相差 180°)', () => {
    for (const t of TABLE) {
      const a = circleAngle(t.binary)
      const b = circleAngle(getCuoGua(t.binary))
      const diff = Math.abs(a - b)
      expect(Math.min(diff, 360 - diff)).toBeCloseTo(180)
    }
  })

  it('64 槽角度无重复', () => {
    const set = new Set(TABLE.map(t => circleAngle(t.binary).toFixed(4)))
    expect(set.size).toBe(64)
  })
})

describe('方图行列(v10 §5.4)', () => {
  it('四角与对角线', () => {
    expect(squarePos(bin('乾'))).toEqual({ row: 1, col: 1 })
    expect(squarePos(bin('坤'))).toEqual({ row: 8, col: 8 })
    expect(squarePos(bin('泰'))).toEqual({ row: 1, col: 8 })
    expect(squarePos(bin('否'))).toEqual({ row: 8, col: 1 })
    // 对角线 = 八纯卦(上下卦同)
    for (const t of TABLE) {
      const { row, col } = squarePos(t.binary)
      if (row === col) expect(t.binary.slice(0, 3)).toBe(t.binary.slice(3))
    }
  })

  it('64 格无重复', () => {
    const set = new Set(TABLE.map(t => { const p = squarePos(t.binary); return `${p.row}-${p.col}` }))
    expect(set.size).toBe(64)
  })
})
