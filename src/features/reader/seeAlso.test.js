import { describe, it, expect } from 'vitest'
import { seeAlsoFor } from './seeAlso.js'
import concepts from '../../data/concepts.json'

describe('seeAlsoFor 义理互见(#141)', () => {
  it('性论聚类:孟子告子上 ↔ 荀子性恶 ↔ 传习录卷中(不自链,跨组)', () => {
    const g = seeAlsoFor('ru', 'mengzi', 11)
    expect(g).toHaveLength(1)
    expect(g[0].term).toBe('人性之辨')
    const labels = g[0].items.map((i) => i.label)
    expect(labels).toContain('荀子·性恶篇')
    expect(labels).toContain('传习录·卷中')
    expect(labels).not.toContain('孟子·告子上') // 不自链
    expect(g[0].items.find((i) => i.label === '荀子·性恶篇').to).toBe('/ru/xunzi/23')
    expect(g[0].items.find((i) => i.label === '传习录·卷中').to).toBe('/xin/chuanxilu/2') // 跨组到心学
  })

  it('章号字符串/数字皆命中', () => {
    expect(seeAlsoFor('ru', 'xunzi', '23')).toHaveLength(1)
    expect(seeAlsoFor('ru', 'xunzi', 23)).toHaveLength(1)
  })

  it('非互指章返回空', () => {
    expect(seeAlsoFor('ru', 'mengzi', 1)).toEqual([])
    expect(seeAlsoFor('fo', 'xinjing', 1)).toEqual([])
  })

  it('每个 locus 的 slug 都能被 booksIndex 解析(href 非空)', () => {
    for (const c of concepts.clusters) {
      for (const l of c.loci) {
        const g = seeAlsoFor(l.corpus, l.slug, l.ch)
        // 该 locus 至少属于一个聚类,且其互见项 href 都已解析
        expect(g.length).toBeGreaterThan(0)
        for (const grp of g) for (const it of grp.items) expect(it.to).toMatch(/^\//)
      }
    }
  })
})
