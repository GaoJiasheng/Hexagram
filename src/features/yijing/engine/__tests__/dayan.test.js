import { describe, it, expect } from 'vitest'
import { castLine, castHexagram, makeSeededRng, LINE_LABELS } from '../dayan.js'

describe('castLine', () => {
  it('固定种子：任何时候结果一致（演示模式复现性）', () => {
    const rng1 = makeSeededRng(42)
    const rng2 = makeSeededRng(42)
    const r1 = castLine(rng1)
    const r2 = castLine(rng2)
    expect(r1.value).toBe(r2.value)
    expect(r1.steps).toEqual(r2.steps)
  })

  it('返回 3 步', () => {
    const r = castLine(makeSeededRng(1))
    expect(r.steps).toHaveLength(3)
  })

  it('爻值在 {6,7,8,9}', () => {
    const rng = makeSeededRng(7)
    for (let i = 0; i < 50; i++) {
      const { value } = castLine(rng)
      expect([6, 7, 8, 9]).toContain(value)
    }
  })

  it('第一变归奇必为 5 或 9', () => {
    const rng = makeSeededRng(99)
    for (let i = 0; i < 100; i++) {
      const { steps } = castLine(rng)
      expect([5, 9]).toContain(steps[0].guiqi)
    }
  })

  it('第二、三变归奇必为 4 或 8', () => {
    const rng = makeSeededRng(55)
    for (let i = 0; i < 100; i++) {
      const { steps } = castLine(rng)
      expect([4, 8]).toContain(steps[1].guiqi)
      expect([4, 8]).toContain(steps[2].guiqi)
    }
  })

  it('三变后余数在 {24,28,32,36}', () => {
    const rng = makeSeededRng(13)
    for (let i = 0; i < 100; i++) {
      const { remaining } = castLine(rng)
      expect([24, 28, 32, 36]).toContain(remaining)
    }
  })

  it('remaining / 4 = value', () => {
    const rng = makeSeededRng(21)
    for (let i = 0; i < 20; i++) {
      const { value, remaining } = castLine(rng)
      expect(remaining / 4).toBe(value)
    }
  })
})

describe('castHexagram', () => {
  it('返回 6 个爻值', () => {
    const { lines } = castHexagram(makeSeededRng(1))
    expect(lines).toHaveLength(6)
  })

  it('binary 长度为 6，由 0/1 组成', () => {
    const { binary } = castHexagram(makeSeededRng(2))
    expect(/^[01]{6}$/.test(binary)).toBe(true)
  })

  it('movingLines 只含老阴(6)或老阳(9)对应位置', () => {
    const rng = makeSeededRng(3)
    const { lines, movingLines } = castHexagram(rng)
    for (const pos of movingLines) {
      expect([6, 9]).toContain(lines[pos - 1])
    }
    for (let i = 0; i < 6; i++) {
      if (lines[i] === 6 || lines[i] === 9) {
        expect(movingLines).toContain(i + 1)
      }
    }
  })

  it('固定种子复现', () => {
    expect(castHexagram(makeSeededRng(42)).binary)
      .toBe(castHexagram(makeSeededRng(42)).binary)
  })
})

describe('LINE_LABELS', () => {
  it('四个爻值均有标签', () => {
    expect(LINE_LABELS[6]).toBeTruthy()
    expect(LINE_LABELS[7]).toBeTruthy()
    expect(LINE_LABELS[8]).toBeTruthy()
    expect(LINE_LABELS[9]).toBeTruthy()
  })
})
