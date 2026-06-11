import { describe, it, expect } from 'vitest'
import { analyzePosition, analyzeAllPositions, describePosition } from '../positions.js'

describe('analyzePosition — 原有字段', () => {
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

describe('analyzePosition — 三才/身份/贞悔', () => {
  it('初爻: 地位、元士、贞', () => {
    const a = analyzePosition(1, '100010')
    expect(a.sancai).toBe('地')
    expect(a.shenfen).toBe('元士')
    expect(a.zhenHui).toBe('贞')
  })
  it('二爻: 地位、大夫、贞', () => {
    const a = analyzePosition(2, '100010')
    expect(a.sancai).toBe('地')
    expect(a.shenfen).toBe('大夫')
    expect(a.zhenHui).toBe('贞')
  })
  it('三爻: 人位、三公、贞', () => {
    const a = analyzePosition(3, '100010')
    expect(a.sancai).toBe('人')
    expect(a.shenfen).toBe('三公')
    expect(a.zhenHui).toBe('贞')
  })
  it('四爻: 人位、诸侯、悔', () => {
    const a = analyzePosition(4, '100010')
    expect(a.sancai).toBe('人')
    expect(a.shenfen).toBe('诸侯')
    expect(a.zhenHui).toBe('悔')
  })
  it('五爻: 天位、天子、悔', () => {
    const a = analyzePosition(5, '100010')
    expect(a.sancai).toBe('天')
    expect(a.shenfen).toBe('天子')
    expect(a.zhenHui).toBe('悔')
  })
  it('上爻: 天位、宗庙、悔', () => {
    const a = analyzePosition(6, '100010')
    expect(a.sancai).toBe('天')
    expect(a.shenfen).toBe('宗庙')
    expect(a.zhenHui).toBe('悔')
  })
})

describe('analyzeAllPositions', () => {
  it('返回6条，pos 与下标对应', () => {
    const all = analyzeAllPositions('100010')
    expect(all).toHaveLength(6)
    all.forEach((a, i) => expect(a.pos).toBe(i + 1))
  })
})

describe('describePosition — 包含身份结尾', () => {
  it('屯初九描述含"元士之象"', () => {
    const a = analyzePosition(1, '100010')
    const { desc } = describePosition(a)
    expect(desc).toContain('元士之象')
    expect(desc).toContain('地位')
  })
  it('九五描述含"天子之象"', () => {
    const a = analyzePosition(5, '100010')
    const { desc } = describePosition(a)
    expect(desc).toContain('天子之象')
  })
})
