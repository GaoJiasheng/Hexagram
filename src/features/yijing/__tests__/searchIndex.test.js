import { describe, it, expect } from 'vitest'
import { searchAll, ensureClassicsIndexed } from '../searchIndex.js'

function group(results, key) {
  return results.find(g => g.key === key)
}

describe('searchAll 多源索引(v10 §1)', () => {
  it('卦名直达', () => {
    const g = group(searchAll('乾'), 'hex')
    expect(g.items[0].to).toBe('/hexagram/1')
  })

  it('卦爻辞原文', () => {
    const g = group(searchAll('潜龙'), 'yuanwen')
    expect(g.items[0].to).toBe('/hexagram/1')
    expect(g.items[0].sub).toContain('初九')
  })

  it('筮例标题与正文', () => {
    expect(group(searchAll('穆姜'), 'shili').items[0].to).toBe('/shili/mu-jiang')
    // 正文命中(背景/解读)
    const g = group(searchAll('崔杼'), 'shili')
    expect(g.items.some(i => i.to === '/shili/cui-wuzi')).toBe(true)
  })

  it('史事锚点', () => {
    const g = group(searchAll('王亥'), 'shishi')
    expect(g.items[0].to).toBe('/basics/shishi#wang-hai')
  })

  it('人物志锚点', () => {
    const g = group(searchAll('京房'), 'renwu')
    expect(g.items[0].to).toBe('/basics/yuanliu#jingfang')
  })

  it('名词表锚点', () => {
    const g = group(searchAll('错卦'), 'glossary')
    expect(g.items[0].to).toBe('/basics/glossary#cuogua')
  })

  it('学堂篇目', () => {
    const g = group(searchAll('梅花'), 'topics')
    expect(g.items[0].to).toBe('/basics/meihua')
  })

  it('经传篇目同步可搜,正文待索引建成', async () => {
    expect(group(searchAll('系辞'), 'classics').items.length).toBeGreaterThan(0)
    await ensureClassicsIndexed()
    const g = group(searchAll('天尊地卑'), 'classics')
    expect(g.items[0].to).toBe('/classics/xici-shang/1')
  })

  it('每组上限 4 条,空查询返回空', () => {
    expect(searchAll('')).toEqual([])
    for (const g of searchAll('之')) expect(g.items.length).toBeLessThanOrEqual(4)
  })
})
