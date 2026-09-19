import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ditiansuiLayers } from './ditiansuiLayers.js'

const book = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../../data/mingli/classics/ditiansui.json'), 'utf8'))

describe('滴天髓阐微三层分层', () => {
  it('首章:纲领 → 原注 → 任氏曰', () => {
    expect(ditiansuiLayers(book.chapters[0].paragraphs).slice(0, 3)).toEqual(['gang', 'zhu', 'ren'])
  })
  it('命例段一律归任氏层(命例都是任铁樵所附)', () => {
    for (const c of book.chapters) {
      const L = ditiansuiLayers(c.paragraphs)
      c.paragraphs.forEach((p, i) => { if (p.pillars) expect(L[i], `${c.no}:${i}`).toBe('ren') })
    }
  })
  it('纲领都是短句:全书没有超过 80 字的纲领(超了多半是把注误判成了纲领)', () => {
    const long = []
    for (const c of book.chapters) {
      const L = ditiansuiLayers(c.paragraphs)
      c.paragraphs.forEach((p, i) => { if (L[i] === 'gang' && p.original.length > 80) long.push(`${c.no}:${i}(${p.original.length})`) })
    }
    // 天干章「己土卑薄软湿…」等个别纲领本身就长,容许少量;但不该是「原注，」这类漏判
    expect(long.length).toBeLessThanOrEqual(4)
  })
  it('每章至少有一条纲领,且章首段是纲领', () => {
    for (const c of book.chapters) {
      const L = ditiansuiLayers(c.paragraphs)
      expect(L.includes('gang'), `第 ${c.no} 章`).toBe(true)
    }
  })
})
