import { describe, it, expect } from 'vitest'
import { gejuLens, tiaohouLens, MONTH_OF_ZHI } from './lenses.js'
import matrix from '../../data/mingli/matrix/qiongtong.json'

describe('三派对读 · 计算层', () => {
  // 滴天髓第 9 章命例:丙子 己亥 乙亥 丙子 —— 乙生亥月,本气壬 = 正印;年时透丙不在亥的藏干里,故不算透
  it('格局镜头:透干只认月令藏干、且不把日干算进去', () => {
    const r = gejuLens(['丙子', '己亥', '乙亥', '丙子'])
    expect(r.tou).toEqual([])
    expect(r.geju.name).toBe('印绶格')
    expect(r.flowHref).toBe('/mingli/zhenquan/geju?d=%E4%B9%99&z=%E4%BA%A5')
  })
  it('格局镜头:月令藏干透出则作主(辛生寅月透丙 → 正官)', () => {
    const r = gejuLens(['丙子', '庚寅', '辛未', '戊子'])
    expect(r.tou).toEqual(['丙', '戊'])        // 按藏干次序
    expect(r.geju.name).toBe('正官格')
  })
  it('日干与月令藏干同字时不算透(甲日寅月,年月时无甲 → 无透)', () => {
    expect(gejuLens(['丁卯', '壬寅', '甲子', '庚午']).tou).toEqual([])
  })
  it('调候镜头:乙木亥月 = 乙 × 十月', () => {
    expect(MONTH_OF_ZHI['亥']).toBe('十月')
    const t = tiaohouLens(['丙子', '己亥', '乙亥', '丙子'], matrix, null, null)
    expect(t.gan).toBe('乙'); expect(t.month).toBe('十月'); expect(t.yong.length).toBeGreaterThan(0)
    expect(t.href).toMatch(/^\/mingli\/qiongtong\/3/)
  })
})
