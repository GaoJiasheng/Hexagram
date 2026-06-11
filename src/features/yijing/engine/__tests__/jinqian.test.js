import { describe, it, expect } from 'vitest'
import { tossCoins, valueFromBacks, tossLine, tossHexagram, linesToGua, COIN_LABELS } from '../jinqian.js'
import { makeSeededRng } from '../dayan.js'

describe('valueFromBacks 取数表(v3 §3.1)', () => {
  it('0背(三字)→6 老阴', () => expect(valueFromBacks(0)).toBe(6))
  it('1背(一背两字)→7 少阳', () => expect(valueFromBacks(1)).toBe(7))
  it('2背(两背一字)→8 少阴', () => expect(valueFromBacks(2)).toBe(8))
  it('3背(三背)→9 老阳', () => expect(valueFromBacks(3)).toBe(9))
})

describe('tossCoins / tossLine', () => {
  it('rng 恒小 → 全背 → 老阳 9', () => {
    const line = tossLine(() => 0.1)
    expect(line.coins).toEqual([1, 1, 1])
    expect(line.backs).toBe(3)
    expect(line.value).toBe(9)
  })
  it('rng 恒大 → 全字 → 老阴 6', () => {
    const line = tossLine(() => 0.9)
    expect(line.coins).toEqual([0, 0, 0])
    expect(line.value).toBe(6)
  })
  it('两背一字 → 8 少阴', () => {
    const seq = [0.1, 0.1, 0.9]
    let i = 0
    const line = tossLine(() => seq[i++])
    expect(line.backs).toBe(2)
    expect(line.value).toBe(8)
  })
  it('爻值只会是 6/7/8/9', () => {
    const rng = makeSeededRng(7)
    for (let i = 0; i < 200; i++) {
      expect([6, 7, 8, 9]).toContain(tossLine(rng).value)
    }
  })
})

describe('tossHexagram 六掷成卦', () => {
  it('六爻、binary 六位、自下而上', () => {
    const { lines, values, binary } = tossHexagram(makeSeededRng(42))
    expect(lines).toHaveLength(6)
    expect(binary).toHaveLength(6)
    values.forEach((v, i) => {
      expect(binary[i]).toBe(v === 7 || v === 9 ? '1' : '0')
    })
  })
  it('动爻 = 6/9 的位置(1起)', () => {
    const { values, movingLines } = tossHexagram(makeSeededRng(42))
    const expected = values.map((v, i) => (v === 6 || v === 9) ? i + 1 : 0).filter(Boolean)
    expect(movingLines).toEqual(expected)
  })
  it('同种子可复现', () => {
    const a = tossHexagram(makeSeededRng(99))
    const b = tossHexagram(makeSeededRng(99))
    expect(a.values).toEqual(b.values)
    expect(a.binary).toBe(b.binary)
  })
})

describe('linesToGua 录入模式', () => {
  it('三背×6(全9)→ 乾之坤,六爻皆动', () => {
    const { binary, movingLines } = linesToGua([9, 9, 9, 9, 9, 9])
    expect(binary).toBe('111111')
    expect(movingLines).toEqual([1, 2, 3, 4, 5, 6])
  })
  it('全少阳(7)→ 乾,无动爻', () => {
    const { binary, movingLines } = linesToGua([7, 7, 7, 7, 7, 7])
    expect(binary).toBe('111111')
    expect(movingLines).toEqual([])
  })
  it('混合:初9 二8 三7 四6 五7 上8 → 100101?,动初与四', () => {
    const { binary, movingLines } = linesToGua([9, 8, 7, 6, 7, 8])
    expect(binary).toBe('101010')
    expect(movingLines).toEqual([1, 4])
  })
})

describe('分布合理性(粗检)', () => {
  it('大样本下 7/8 各约 3/8,6/9 各约 1/8', () => {
    const rng = makeSeededRng(2026)
    const count = { 6: 0, 7: 0, 8: 0, 9: 0 }
    const N = 8000
    for (let i = 0; i < N; i++) count[tossLine(rng).value]++
    expect(count[7] / N).toBeGreaterThan(0.3)
    expect(count[7] / N).toBeLessThan(0.45)
    expect(count[8] / N).toBeGreaterThan(0.3)
    expect(count[8] / N).toBeLessThan(0.45)
    expect(count[6] / N).toBeGreaterThan(0.08)
    expect(count[6] / N).toBeLessThan(0.17)
    expect(count[9] / N).toBeGreaterThan(0.08)
    expect(count[9] / N).toBeLessThan(0.17)
  })
})

describe('COIN_LABELS', () => {
  it('四个爻值各有标签', () => {
    expect(Object.keys(COIN_LABELS).map(Number).sort()).toEqual([6, 7, 8, 9])
  })
})
