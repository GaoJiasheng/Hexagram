import { describe, it, expect } from 'vitest'
import { getNajia } from '../najia.js'

// 乾卦自检：甲子水·子孙 / 甲寅木·妻财 / 甲辰土·父母 / 壬午火·官鬼 / 壬申金·兄弟 / 壬戌土·父母
describe('乾卦纳甲六爻', () => {
  const najia = getNajia('111111')

  const expected = [
    { pos: 1, gan: '甲', zhi: '子', element: '水', liuqin: '子孙' },
    { pos: 2, gan: '甲', zhi: '寅', element: '木', liuqin: '妻财' },
    { pos: 3, gan: '甲', zhi: '辰', element: '土', liuqin: '父母' },
    { pos: 4, gan: '壬', zhi: '午', element: '火', liuqin: '官鬼' },
    { pos: 5, gan: '壬', zhi: '申', element: '金', liuqin: '兄弟' },
    { pos: 6, gan: '壬', zhi: '戌', element: '土', liuqin: '父母' },
  ]

  expected.forEach(({ pos, gan, zhi, element, liuqin }) => {
    it(`乾卦第${pos}爻: ${gan}${zhi} ${element}·${liuqin}`, () => {
      const row = najia.find(r => r.pos === pos)
      expect(row.gan).toBe(gan)
      expect(row.zhi).toBe(zhi)
      expect(row.element).toBe(element)
      expect(row.liuqin).toBe(liuqin)
    })
  })
})

// 屯卦自检：庚子水·兄弟 / 庚寅木·子孙 / 庚辰土·官鬼 / 戊申金·父母 / 戊戌土·官鬼 / 戊子水·兄弟
describe('屯卦纳甲六爻', () => {
  const najia = getNajia('100010')

  const expected = [
    { pos: 1, gan: '庚', zhi: '子', element: '水', liuqin: '兄弟' },
    { pos: 2, gan: '庚', zhi: '寅', element: '木', liuqin: '子孙' },
    { pos: 3, gan: '庚', zhi: '辰', element: '土', liuqin: '官鬼' },
    { pos: 4, gan: '戊', zhi: '申', element: '金', liuqin: '父母' },
    { pos: 5, gan: '戊', zhi: '戌', element: '土', liuqin: '官鬼' },
    { pos: 6, gan: '戊', zhi: '子', element: '水', liuqin: '兄弟' },
  ]

  expected.forEach(({ pos, gan, zhi, element, liuqin }) => {
    it(`屯卦第${pos}爻: ${gan}${zhi} ${element}·${liuqin}`, () => {
      const row = najia.find(r => r.pos === pos)
      expect(row.gan).toBe(gan)
      expect(row.zhi).toBe(zhi)
      expect(row.element).toBe(element)
      expect(row.liuqin).toBe(liuqin)
    })
  })
})

describe('getNajia 基础结构', () => {
  it('返回 6 条记录，pos 1-6', () => {
    const najia = getNajia('111111')
    expect(najia).toHaveLength(6)
    expect(najia.map(r => r.pos)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('64 卦全部返回 6 条非空记录', () => {
    // 验证所有八宫的宫卦（本宫 binary）不为 null
    const PURE = ['111111','110110','101101','100100','011011','010010','001001','000000']
    for (const b of PURE) {
      const najia = getNajia(b)
      expect(najia).not.toBeNull()
      expect(najia).toHaveLength(6)
    }
  })
})
