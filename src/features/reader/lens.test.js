import { describe, it, expect } from 'vitest'
import { lensHits, intersect } from './lens.js'

const chapters = [
  { no: 1, title: '道可道', paragraphs: [{ original: '道可道，非常道。名可名，非常名。' }] },
  { no: 2, title: '天下皆知', paragraphs: [{ original: '天下皆知美之为美' }, { original: '是以圣人处无为之事' }] },
  { no: 3, title: '不尚贤', paragraphs: [{ original: '为无为，则无不治。' }, { original: '常使民无知无欲' }] },
  { no: 4, title: '无段落章' },
]

describe('lensHits', () => {
  it('按标题或任一段原文计章', () => {
    const hits = lensHits(chapters, ['道', '无为', '圣人'])
    expect([...hits.get('道')]).toEqual([1])
    expect([...hits.get('无为')].sort()).toEqual([2, 3])
    expect([...hits.get('圣人')]).toEqual([2])
  })

  it('标题命中也算;零命中给空集', () => {
    const hits = lensHits(chapters, ['段落', '仁义'])
    expect([...hits.get('段落')]).toEqual([4])
    expect(hits.get('仁义').size).toBe(0)
  })
})

describe('intersect', () => {
  it('空数组 → null(不筛)', () => {
    expect(intersect([])).toBeNull()
  })

  it('两词取交集', () => {
    const hits = lensHits(chapters, ['无为', '无知'])
    expect([...intersect([hits.get('无为'), hits.get('无知')])]).toEqual([3])
  })

  it('交集为空 → 空集而非 null', () => {
    const hits = lensHits(chapters, ['道', '无为'])
    const s = intersect([hits.get('道'), hits.get('无为')])
    expect(s).not.toBeNull()
    expect(s.size).toBe(0)
  })
})
