import { describe, it, expect } from 'vitest'
import { qiGuaByTime, qiGuaByNumber, calcTiYong, hourToShiZhi } from '../meihua.js'

// 观梅典故自检：辰年(5) 十二月 十七日 申时(9) → 泽火革 初爻动 → 变泽山咸
describe('qiGuaByTime', () => {
  it('观梅典故：辰年十二月十七日申时 → 上兑下离 初爻动', () => {
    const result = qiGuaByTime({ nianZhi: 5, yue: 12, ri: 17, shiZhi: 9 })
    expect(result.upper).toBe('dui')     // (5+12+17)%8 = 34%8 = 2 → 兑
    expect(result.lower).toBe('li')      // (34+9)%8 = 43%8 = 3 → 离
    expect(result.dongYao).toBe(1)       // 43%6 = 1
  })

  it('余 0 取 8：sum3=8 → 坤(8)', () => {
    const result = qiGuaByTime({ nianZhi: 1, yue: 1, ri: 6, shiZhi: 1 })
    expect(result.upper).toBe('kun')     // (1+1+6)%8 = 0 → 8 → 坤
  })

  it('余 0 取 6：动爻=6', () => {
    const result = qiGuaByTime({ nianZhi: 1, yue: 1, ri: 1, shiZhi: 3 })
    // sum4=6, 6%6=0 → 6
    expect(result.dongYao).toBe(6)
  })
})

describe('qiGuaByNumber', () => {
  it('数一=2 数二=3 → 上兑(2)下离(3) 动爻5', () => {
    const r = qiGuaByNumber({ shu1: 2, shu2: 3 })
    expect(r.upper).toBe('dui')
    expect(r.lower).toBe('li')
    expect(r.dongYao).toBe(5)    // (2+3)%6=5
  })

  it('数一=8 余0取8 → 坤', () => {
    const r = qiGuaByNumber({ shu1: 8, shu2: 1 })
    expect(r.upper).toBe('kun')
  })

  it('两数之和%6=0取6', () => {
    const r = qiGuaByNumber({ shu1: 3, shu2: 3 })
    expect(r.dongYao).toBe(6)
  })
})

describe('calcTiYong', () => {
  it('观梅例：革初爻动 → 用离(火)克体兑(金) → 用克体', () => {
    const { ti, yong, relation } = calcTiYong('dui', 'li', 1)
    expect(ti).toBe('dui')      // 动在下卦，上卦为体
    expect(yong).toBe('li')     // 下卦为用
    expect(relation).toBe('用克体')
  })

  it('动在上卦(4) → 上卦为用下卦为体', () => {
    const { ti, yong } = calcTiYong('dui', 'li', 4)
    expect(ti).toBe('li')
    expect(yong).toBe('dui')
  })

  it('比和：乾(金)vs兑(金)', () => {
    const { relation } = calcTiYong('qian', 'dui', 1)
    expect(relation).toBe('比和')
  })

  it('用生体：水生木', () => {
    // 坎(水)为用生震(木)为体
    const { relation } = calcTiYong('zhen', 'kan', 1)  // 动下卦，体=zhen(木), 用=kan(水)
    expect(relation).toBe('用生体')
  })
})

describe('hourToShiZhi', () => {
  it('23时 → 子时(1)', () => expect(hourToShiZhi(23)).toBe(1))
  it('0时  → 子时(1)', () => expect(hourToShiZhi(0)).toBe(1))
  it('1时  → 丑时(2)', () => expect(hourToShiZhi(1)).toBe(2))
  it('13时 → 未时(8)', () => expect(hourToShiZhi(13)).toBe(8))
  it('15时 → 申时(9)', () => expect(hourToShiZhi(15)).toBe(9))
})
