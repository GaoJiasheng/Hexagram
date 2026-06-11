import { describe, it, expect } from 'vitest'
import { analyzePosition } from '../positions.js'

describe('analyzePosition', () => {
  it('屯初九: 当位, 与六四应', () => {
    const a = analyzePosition(1, '100010')
    expect(a.isYang).toBe(true)
    expect(a.dangWei).toBe(true)
    expect(a.xianYing).toBe(true)
    expect(a.corresTitle).toBe('六四')
  })
  it('九五: 中正', () => {
    const a = analyzePosition(5, '100010')
    expect(a.isYang).toBe(true)
    expect(a.zhongZheng).toBe(true)
  })
  it('六二: 中正', () => {
    const a = analyzePosition(2, '000000')
    expect(a.isYang).toBe(false)
    expect(a.zhongZheng).toBe(true)
  })
})
