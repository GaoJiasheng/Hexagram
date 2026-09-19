import { describe, it, expect } from 'vitest'
import { validateWidget, WIDGET_KINDS } from './schema.js'

const w = (kind, props, extra = {}) => ({ type: 'widget', kind, props, ...extra })

describe('widget 块校验', () => {
  it('合法块零报错', () => {
    expect(validateWidget(w('sizhu', { pillars: ['辛卯', '丁酉', '庚午', '丙子'], focus: ['丁', '午'] }))).toEqual([])
    expect(validateWidget(w('wuxing', { center: '木', labels: { 木: '肝', 火: '心' }, mode: 'both' }))).toEqual([])
    expect(validateWidget(w('matrix', { rows: ['甲'], cols: ['正月'], cells: { '甲|正月': { text: '丙癸', href: '/mingli/qiongtong/2' } } }))).toEqual([])
    for (const k of ['jiazi', 'shishen', 'dizhi', 'qizhu', 'jieqi']) expect(validateWidget(w(k, {}))).toEqual([])
  })
  it('参数错了查得出 —— 这正是 widget 相对静态 SVG 的意义', () => {
    expect(validateWidget(w('sizhu', { pillars: ['甲丑', '丁酉', '庚午', '丙子'] }))[0]).toMatch(/不是合法干支/)   // 阳干配阴支
    expect(validateWidget(w('sizhu', { pillars: ['辛卯', '丁酉', '庚午'] }))[0]).toMatch(/4 个干支/)
    expect(validateWidget(w('wuxing', { center: '风' }))[0]).toMatch(/不是五行/)
    expect(validateWidget(w('shishen', { dayGan: '子' }))[0]).toMatch(/不是天干/)
    expect(validateWidget(w('matrix', { rows: ['甲'], cols: ['正月'], cells: { '乙|正月': { text: 'x' } } }))[0]).toMatch(/不在行列之内/)
    expect(validateWidget(w('matrix', { rows: ['甲'], cols: ['正月'], cells: { '甲|正月': { text: 'x', href: 'https://evil.example' } } }))[0]).toMatch(/站内路径/)
    expect(validateWidget(w('nope', {}))[0]).toMatch(/未知 widget kind/)
  })
  it('kind 清单稳定(加件要同步 registry 与规格)', () => {
    expect(WIDGET_KINDS).toEqual(['sizhu', 'wuxing', 'jiazi', 'shishen', 'dizhi', 'qizhu', 'jieqi', 'matrix', 'geju'])
  })
})
