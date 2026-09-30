import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import check from './check-zhongyi-shapes.mjs'
import { parseBencao, liujingIndex } from '../../src/features/zhongyi/shapes.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const chapterText = (corpus, slug, ch) => {
  const book = readJson(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`))
  const c = book.chapters.find((x) => x.no === ch)
  return c ? (c.title || '') + c.paragraphs.map((p) => p.original).join('') : null
}

describe('中医三件闸', () => {
  it('现有数据零错误;本草 18 格、六经 22 篇全归位', () => {
    const errs = [], warns = [], infos = []
    check({ ROOT, err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m), readJson, chapterText })
    expect(errs).toEqual([])
    expect(infos.some((m) => m.includes('18 格'))).toBe(true)
    expect(infos.some((m) => m.includes('22/22 篇归位'))).toBe(true)
  })
  it('parseBencao 抓得到题名不合与药名缺失', () => {
    const bad = { chapters: [{ no: 1, title: '玉石部上品', paragraphs: [{ original: '玉泉　味甘平。' }, { original: '没有全角空格的段' }] }, { no: 2, title: '杂类', paragraphs: [] }] }
    const r = parseBencao(bad)
    expect(r.cells['玉石部|上品'].names).toEqual(['玉泉'])
    expect(r.problems.some((p) => p.includes('无药名段首'))).toBe(true)
    expect(r.problems.some((p) => p.includes('杂类'))).toBe(true)
    expect(r.problems.some((p) => p.includes('缺「草部上品」'))).toBe(true)
  })
  it('liujingIndex 挂篇题与条文数', () => {
    const book = { chapters: [{ no: 5, title: '辨太阳病脉证并治（上）第五', paragraphs: [{}, {}] }, { no: 8, title: '辨阳明病', paragraphs: [{}] }] }
    const idx = liujingIndex(book, { channels: [{ key: 't', label: '太阳', chapters: [5] }, { key: 'y', label: '阳明', chapters: [8] }], groups: [] })
    expect(idx.channels[0].count).toBe(2)
    expect(idx.channels[1].list[0].title).toBe('辨阳明病')
  })
})
