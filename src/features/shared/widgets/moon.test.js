import { describe, it, expect } from 'vitest'
import moonData from '../../../data/dao/cantongqi-moon.json'
import trigramList from '../../../data/yijing/trigrams.json'
import { validateMoon } from './moon.schema.js'
import { stationsOf, stationOfGan, ganFang, moonLitPath, trigramChange, yinYangCount, cnDay, MOON_STATIONS } from './moon.js'

const TRI = Object.fromEntries(trigramList.map((t) => [t.name, t.binary]))

describe('validateMoon(moon 件 props)', () => {
  it('合法', () => {
    expect(validateMoon({})).toEqual([])
    expect(validateMoon({ phase: 0 })).toEqual([])
    expect(validateMoon({ phase: 7, showHex: false })).toEqual([])
  })
  it('不合法', () => {
    expect(validateMoon({ phase: 8 })).toHaveLength(1)
    expect(validateMoon({ phase: -1 })).toHaveLength(1)
    expect(validateMoon({ phase: 1.5 })).toHaveLength(1)
    expect(validateMoon({ phase: '3' })).toHaveLength(1)
    expect(validateMoon({ showHex: 'yes' })).toHaveLength(1)
  })
})

describe('盘上八格', () => {
  const st = stationsOf(moonData)
  it('0 朔 · 1–6 六相 · 7 合符', () => {
    expect(st).toHaveLength(MOON_STATIONS)
    expect(st.map((s) => s.kind)).toEqual(['shuo', 'phase', 'phase', 'phase', 'phase', 'phase', 'phase', 'hefu'])
    expect(st.slice(1, 7).map((s) => s.src.name).join('')).toBe('震兑乾巽艮坤')
    expect(st.map((s) => s.idx)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })
  it('点天干找格:庚→震、甲→乾、壬癸→朔、戊己→合符', () => {
    expect(stationOfGan(st, '庚')).toBe(1)
    expect(stationOfGan(st, '甲')).toBe(3)
    expect(stationOfGan(st, '壬')).toBe(0)
    expect(stationOfGan(st, '癸')).toBe(0)
    expect(stationOfGan(st, '戊')).toBe(7)
    expect(stationOfGan(st, '己')).toBe(7)
  })
  it('天干五方:甲乙东、丙丁南、戊己中、庚辛西、壬癸北', () => {
    expect(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].map(ganFang).join('')).toBe('东东南南中中西西北北')
  })
})

describe('取象:阳自下长、阴自下替', () => {
  it('震→兑→乾 逐爻由阴转阳;巽→艮→坤 逐爻由阳转阴(都自下而上)', () => {
    const seq = ['坤', '震', '兑', '乾', '巽', '艮', '坤'].map((n) => TRI[n])
    const changes = seq.slice(1).map((b, i) => trigramChange(seq[i], b))
    expect(changes).toEqual([
      '初爻由阴转阳', '二爻由阴转阳', '三爻由阴转阳',
      '初爻由阳转阴', '二爻由阳转阴', '三爻由阳转阴',
    ])
  })
  it('阴阳计数', () => {
    expect(yinYangCount(TRI['震'])).toBe('阳一阴二')
    expect(yinYangCount(TRI['乾'])).toBe('阳三阴零')
    expect(yinYangCount(TRI['坤'])).toBe('阳零阴三')
  })
})

describe('月轮示意', () => {
  it('三十日(晦)全暗;十五日(望)满月为整圆;前半月亮面在右、后半月在左', () => {
    expect(moonLitPath(30, 9)).toBe('')
    const full = moonLitPath(15, 9)
    expect(full).toMatch(/A 9 9 0 0 [01] 0 -9 Z$/)   // 明暗界线的半椭圆 rx = r → 整圆
    expect(moonLitPath(3, 9)).toMatch(/^M 0 -9 A 9 9 0 0 1 0 9/)   // 右半圆亮
    expect(moonLitPath(23, 9)).toMatch(/^M 0 -9 A 9 9 0 0 0 0 9/)  // 左半圆亮
  })
})

describe('cnDay', () => {
  it('汉字日数', () => {
    expect([1, 3, 8, 10, 15, 16, 20, 23, 30].map(cnDay)).toEqual(['一', '三', '八', '十', '十五', '十六', '二十', '二十三', '三十'])
  })
})
