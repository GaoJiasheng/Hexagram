import { describe, it, expect } from 'vitest'
import { validateRing, RING_MIN, RING_MAX } from './ring.schema.js'
import { ringLayout, arcBetween, labelLines, VB } from './ringLayout.js'

const items = (n, label = (i) => `项${i}`) => Array.from({ length: n }, (_, i) => ({ label: label(i) }))

describe('ring 件 props 校验', () => {
  it('合法 props 零报错', () => {
    expect(validateRing({ items: items(12) })).toEqual([])
    expect(validateRing({
      items: [{ label: '无明', note: '不明', quote: '无明', cite: '遗教经', href: '/fo/yijiaojing#fo-ch-1' }, { label: '行' }, { label: '识' }],
      center: { label: '十二因缘', note: '总说' }, focus: 2, arrows: true, loop: false, foot: '说明',
    })).toEqual([])
    expect(validateRing({ items: items(3), center: '八圣道' })).toEqual([])
    expect(validateRing({ items: items(RING_MAX) })).toEqual([])
  })
  it('项数只许 3–24', () => {
    expect(validateRing({ items: items(RING_MIN - 1) })[0]).toMatch(/3–24/)
    expect(validateRing({ items: items(RING_MAX + 1) })[0]).toMatch(/3–24/)
    expect(validateRing({})[0]).toMatch(/items 须为数组/)
  })
  it('label 非空且放得下', () => {
    expect(validateRing({ items: [{ label: '' }, { label: '行' }, { label: '识' }] })[0]).toMatch(/label 须为非空/)
    expect(validateRing({ items: [{ label: '一二三四五六七' }, { label: '行' }, { label: '识' }] })[0]).toMatch(/超过 6 字/)
  })
  it('focus 须在范围内', () => {
    expect(validateRing({ items: items(3), focus: 3 })[0]).toMatch(/focus/)
    expect(validateRing({ items: items(3), focus: -1 })[0]).toMatch(/focus/)
    expect(validateRing({ items: items(3), focus: 1.5 })[0]).toMatch(/focus/)
  })
  it('href 只许站内、其余字段类型不对也报', () => {
    expect(validateRing({ items: [{ label: '甲', href: 'https://evil.example' }, { label: '乙' }, { label: '丙' }] })[0]).toMatch(/站内路径/)
    expect(validateRing({ items: items(3), arrows: 'yes' })[0]).toMatch(/arrows 须为布尔/)
    expect(validateRing({ items: items(3), center: { note: 'x' } })[0]).toMatch(/center.label/)
    expect(validateRing({ items: items(3), center: '' })[0]).toMatch(/center/)
  })
})

describe('ring 几何', () => {
  for (const arrows of [false, true]) {
    it(`3–24 项节点互不重叠、都在画布内(arrows=${arrows})`, () => {
      for (let n = RING_MIN; n <= RING_MAX; n++) {
        const L = ringLayout(n, arrows)
        const chord = 2 * L.R * Math.sin(L.step / 2)
        expect(chord - 2 * L.r).toBeGreaterThan(arrows ? 8 : 4)
        for (const p of L.nodes) {
          expect(p.x - L.r).toBeGreaterThanOrEqual(0)
          expect(p.y - L.r).toBeGreaterThanOrEqual(0)
          expect(p.x + L.r).toBeLessThanOrEqual(VB)
          expect(p.y + L.r).toBeLessThanOrEqual(VB)
        }
        // 第 0 项在正上方
        expect(L.nodes[0].x).toBeCloseTo(VB / 2)
        expect(L.nodes[0].y).toBeLessThan(VB / 2)
      }
    })
  }
  it('箭头弧长为正,十二项时留得下箭头', () => {
    for (let n = RING_MIN; n <= RING_MAX; n++) {
      const L = ringLayout(n, true)
      const arcLen = (L.step - 2 * (L.r + 2) / L.R) * L.R
      expect(arcLen).toBeGreaterThan(0)
      expect(arcBetween(0, L).d).toMatch(/^M [\d.]+ [\d.]+ A /)
    }
    const L12 = ringLayout(12, true)
    expect((L12.step - 2 * (L12.r + 2) / L12.R) * L12.R).toBeGreaterThan(12)
  })
  it('节点字号:十二因缘各支放得下且不小于 12px', () => {
    const L = ringLayout(12, true)
    for (const s of ['无明', '行', '识', '名色', '六入', '触', '受', '爱', '取', '有', '生', '老死']) {
      const { lines, fs } = labelLines(s, L.r)
      expect(lines).toHaveLength(1)
      expect(fs).toBeGreaterThanOrEqual(12)
      expect(fs * [...s].length).toBeLessThanOrEqual(2 * L.r)
    }
    expect(labelLines('正精进', ringLayout(8).r).fs).toBeGreaterThanOrEqual(12)
    expect(labelLines('四五六七', 20).lines).toEqual(['四五', '六七'])
  })
})
