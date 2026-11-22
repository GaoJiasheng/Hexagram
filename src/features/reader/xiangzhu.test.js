import { describe, it, expect } from 'vitest'
import { placeAnchors, mergeSpans, xzEntry } from './xiangzhu.js'

const text = '道可道，非常道。名可名，非常名。'
const terms = (spans) => spans.map((s) => [s.start, s.entry.term, !!s.entry.xz])

describe('xiangzhu 合并(详注优先,不重叠的简注照留,桥必留)', () => {
  it('无详注时原样返回简注', () => {
    const base = placeAnchors(text, [{ term: '常道', note: '恒常之道' }])
    expect(mergeSpans(text, base, null)).toBe(base)
    expect(mergeSpans(text, base, [])).toBe(base)
  })

  it('重叠的简注让位,不重叠的保留,按起点排序', () => {
    const base = placeAnchors(text, [
      { term: '常道', note: '短' },        // 与详注「非常道」重叠 → 去
      { term: '名', note: '短', n: 3 },    // 第三个「名」(非常名)→ 位置 14
    ])
    const out = mergeSpans(text, base, [
      { k: '非常道', d: '不是恒常的道', x: '展开' },
      { k: '道可道', d: '可说的道', x: '展开' },
    ])
    expect(terms(out)).toEqual([[0, '道可道', true], [4, '非常道', true], [14, '名', false]])
  })

  it('详注区间取第一次出现;找不到的条目丢弃', () => {
    const out = mergeSpans(text, [], [{ k: '非常', d: 'a', x: 'b' }, { k: '不存在', d: 'a', x: 'b' }])
    expect(terms(out)).toEqual([[4, '非常', true]])
  })

  it('详注带出展开与读音', () => {
    expect(xzEntry({ k: '徼', d: '边际', x: '展开', r: 'jiào' })).toEqual({ term: '徼', note: '边际', more: '展开', reading: 'jiào', xz: true })
  })

  it('桥:区间相同 → 桥挂到详注上;区间不同但重叠 → 留简注桥、丢详注', () => {
    const qiao = { to: '/hexagram/1', label: '乾 →' }
    const base = placeAnchors(text, [{ term: '非常道', note: '桥注', qiao }, { term: '名可名', note: '桥2', qiao: { to: '/x', label: 'x' } }])
    const out = mergeSpans(text, base, [
      { k: '非常道', d: '详', x: '展开' },
      { k: '可名', d: '详', x: '展开' },     // 与桥「名可名」重叠 → 丢
      { k: '道可道', d: '详', x: '展开' },
    ])
    expect(terms(out)).toEqual([[0, '道可道', true], [4, '非常道', true], [8, '名可名', false]])
    expect(out[1].entry.qiao).toBe(qiao)
    expect(out[2].entry.qiao.to).toBe('/x')
  })

  it('详注彼此重叠时防御性去后者', () => {
    const out = mergeSpans(text, [], [{ k: '道可道', d: 'a', x: 'b' }, { k: '可道', d: 'a', x: 'b' }])
    expect(terms(out)).toEqual([[0, '道可道', true]])
  })
})
