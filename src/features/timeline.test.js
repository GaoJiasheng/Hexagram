import { describe, it, expect } from 'vitest'
import data from '../data/timeline.json'
import { ALL_BOOKS } from './reader/booksIndex.js'

describe('全站时间轴数据(src/data/timeline.json)', () => {
  it('每条都能在书目索引里找到那部书,且不重复', () => {
    const seen = new Set()
    for (const t of data.items) {
      const key = `${t.corpus}/${t.slug}`
      expect(seen.has(key), key).toBe(false)
      seen.add(key)
      const book = t.slug === null
        ? ALL_BOOKS.find((b) => b.corpus === t.corpus)
        : ALL_BOOKS.find((b) => b.corpus === t.corpus && b.slug === t.slug)
      expect(book, key).toBeTruthy()
    }
  })
  it('有年代的条目 from≤to 且落在朝代带内;托名伪作不给年代', () => {
    const lo = Math.min(...data.bands.map((b) => b.from)), hi = Math.max(...data.bands.map((b) => b.to))
    for (const t of data.items) {
      if (t.c === 'pseudo') { expect(t.from).toBeNull(); continue }
      expect(['sure', 'approx', 'disputed']).toContain(t.c)
      expect(t.from <= t.to, `${t.slug}`).toBe(true)
      expect(t.from >= lo && t.from < hi, `${t.slug} from=${t.from}`).toBe(true)
    }
  })
  it('朝代带首尾相接、按时间升序', () => {
    for (let i = 1; i < data.bands.length; i++) expect(data.bands[i].from).toBe(data.bands[i - 1].to)
  })
  it('书目里每一部都上了轴(加书要补一条)', () => {
    const keys = new Set(data.items.map((t) => `${t.corpus}/${t.slug}`))
    const missing = ALL_BOOKS.filter((b) => !keys.has(`${b.corpus}/${b.slug}`)).map((b) => `${b.corpus}/${b.slug}`)
    expect(missing).toEqual([])
  })
  it('人物:生卒合法、组与所系之书都存在', () => {
    const lo = Math.min(...data.bands.map((b) => b.from)), hi = Math.max(...data.bands.map((b) => b.to))
    const names = new Set()
    for (const p of data.people) {
      expect(names.has(p.name), p.name).toBe(false)
      names.add(p.name)
      expect(['sure', 'approx', 'disputed']).toContain(p.c)
      expect(p.from <= p.to && p.from >= lo && p.from < hi, `${p.name} ${p.from}–${p.to}`).toBe(true)
      for (const slug of p.books) expect(ALL_BOOKS.some((b) => b.corpus === p.group && b.slug === slug), `${p.name} → ${p.group}/${slug}`).toBe(true)
    }
  })
})
