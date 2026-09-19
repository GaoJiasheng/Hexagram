import { describe, it, expect } from 'vitest'
import { determineGeju, YANGREN, SHUN_NI_QUOTE } from './geju.js'
import { GAN, ZHI } from './index.js'
import zhenquan from '../../../data/mingli/classics/zhenquan.json'

const para = (ch, i) => zhenquan.chapters.find((c) => c.no === ch).paragraphs[i].original

describe('子平真诠取格 · 以原书自己举的例子为验', () => {
  // 《论杂气如何取用》17·1:「如甲生辰月,透戊则用偏财,透癸则用正印,透乙则用月劫是也」
  it('甲生辰月:透戊→财、透癸→印、透乙→月劫', () => {
    expect(para(17, 1)).toContain('甲生辰月，透戊则用偏财，透癸则用正印，透乙则用月劫')
    expect(determineGeju('甲', '辰', ['戊']).geju.name).toBe('财格')
    expect(determineGeju('甲', '辰', ['癸']).geju.name).toBe('印绶格')
    expect(determineGeju('甲', '辰', ['乙']).geju.name).toBe('建禄月劫格')
  })
  // 《论用神变化》11·2:「辛生寅月,逢丙而化财为官」;11·4:「透丙化官,而又透甲,格成正财,正官乃其兼格也」
  it('辛生寅月:本为财;透丙化官;丙甲并透仍是财、官为兼格', () => {
    expect(para(11, 2)).toContain('辛生寅月，逢丙而化财为官')
    expect(para(11, 4)).toContain('格成正财，正官乃其兼格也')
    expect(determineGeju('辛', '寅').geju.name).toBe('财格')
    const r = determineGeju('辛', '寅', ['丙'])
    expect(r.geju.name).toBe('正官格'); expect(r.reason).toBe('other-tou')
    const both = determineGeju('辛', '寅', ['丙', '甲'])
    expect(both.geju.name).toBe('财格'); expect(both.jian.map((c) => c.shishen)).toEqual(['正官'])
  })
  // 11·1:「己生申月,本属伤官。藏庚透壬,则化为财」;11·3:「丙生寅月,本为印绶」「丙生申月,本属偏财」
  it('己申本伤官、透壬化财;丙寅本印;丙申本财', () => {
    expect(determineGeju('己', '申').geju.name).toBe('伤官格')
    expect(determineGeju('己', '申', ['壬']).geju.name).toBe('财格')
    expect(determineGeju('丙', '寅').geju.name).toBe('印绶格')
    expect(determineGeju('丙', '申').geju.name).toBe('财格')
  })
  // 11·1「丁生亥月,本为正官」;11·2「壬生戌月逢辛而化煞为印」「乙生寅月,月劫秉令」「癸生寅月,月令伤官秉令」
  it('丁亥正官、壬戌本煞透辛化印、乙寅月劫、癸寅伤官', () => {
    expect(determineGeju('丁', '亥').geju.name).toBe('正官格')
    expect(determineGeju('壬', '戌').geju.name).toBe('偏官格(七煞)')
    expect(determineGeju('壬', '戌', ['辛']).geju.name).toBe('印绶格')
    expect(determineGeju('乙', '寅').geju.name).toBe('建禄月劫格')
    expect(determineGeju('癸', '寅').geju.name).toBe('伤官格')
  })
  // 《论阳刃》44·0「禄前一位,惟五阳有之」;44·1「丙生午月」;44·4「若戊生午月…则化刃为印」
  it('阳刃只有五阳干;戊生午月是刃(原书明文)', () => {
    expect(para(44, 0)).toContain('禄前一位，惟五阳有之')
    expect(para(44, 4)).toContain('若戊生午月')
    for (const [g, z] of Object.entries(YANGREN)) expect(determineGeju(g, z).geju.name).toBe('阳刃格')
    expect(determineGeju('戊', '午').notes).toContain('wu-wu')
    expect(determineGeju('乙', '寅').kind).toBe('lujie')      // 阴干劫财不称刃
  })
  it('建禄:甲寅、乙卯、庚申、癸子…皆归建禄月劫一格', () => {
    expect(para(46, 0)).toContain('建禄与月劫，可同一格，不必加分')
    for (const [g, z] of [['甲', '寅'], ['乙', '卯'], ['庚', '申'], ['辛', '酉'], ['壬', '亥'], ['癸', '子']]) {
      const r = determineGeju(g, z)
      expect(r.geju.name).toBe('建禄月劫格'); expect(r.lu).toBe(true)
    }
  })
  it('戊巳、己午:禄位而本气是印——按本气论并标出', () => {
    for (const [g, z] of [['戊', '巳'], ['己', '午']]) {
      const r = determineGeju(g, z)
      expect(r.geju.name).toBe('印绶格'); expect(r.notes).toContain('lu-tu')
    }
  })
  it('全部 120 种日主×月令都有格名、章号;顺逆引文逐字出自《论用神》', () => {
    const src = para(9, 7)
    for (const q of Object.values(SHUN_NI_QUOTE)) expect(src).toContain(q)
    for (const g of GAN) for (const z of ZHI) {
      const r = determineGeju(g, z)
      expect(r.geju.name).toBeTruthy(); expect(r.geju.ch).toBeGreaterThan(30)
      expect(SHUN_NI_QUOTE[r.geju.name]).toBeTruthy()
    }
  })
  it('透干不在藏干里 → 抛错', () => {
    expect(() => determineGeju('甲', '子', ['丙'])).toThrow()
  })
})
