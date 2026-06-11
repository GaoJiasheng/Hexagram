import { describe, it, expect } from 'vitest'
import { getBianGua, getHuGua, getCuoGua, getZongGua, lineTitle } from '../transforms.js'

describe('getBianGua', () => {
  it('屯初爻动 → 比', () => {
    expect(getBianGua('100010', [1])).toBe('000010')
  })
  it('无动爻不变', () => {
    expect(getBianGua('100010', [])).toBe('100010')
  })
})

describe('getHuGua', () => {
  it('屯互剥', () => {
    expect(getHuGua('100010')).toBe('000001')
  })
  it('乾互乾', () => {
    expect(getHuGua('111111')).toBe('111111')
  })
})

describe('getCuoGua', () => {
  it('屯错鼎', () => {
    expect(getCuoGua('100010')).toBe('011101')
  })
  it('乾错坤', () => {
    expect(getCuoGua('111111')).toBe('000000')
  })
})

describe('getZongGua', () => {
  it('屯综蒙', () => {
    expect(getZongGua('100010')).toBe('010001')
  })
  it('泰综否', () => {
    expect(getZongGua('000111')).toBe('111000')
  })
  it('乾综乾(自综)', () => {
    expect(getZongGua('111111')).toBe('111111')
  })
})

describe('lineTitle', () => {
  it('初九', () => expect(lineTitle(1, true)).toBe('初九'))
  it('六二', () => expect(lineTitle(2, false)).toBe('六二'))
  it('九五', () => expect(lineTitle(5, true)).toBe('九五'))
  it('上六', () => expect(lineTitle(6, false)).toBe('上六'))
})
