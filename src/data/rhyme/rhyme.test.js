// 韵书数据(design-v24 §7.1):部数 + 抽样。数据由 scripts/fetch-rhyme.mjs 生成,不手改。
import { describe, it, expect } from 'vitest'
import pingshui from './pingshui.json'
import cilin from './cilin.json'
import zhongyuan from './zhongyuan.json'

const psPart = (id) => pingshui.parts.find((p) => p.id === id)

describe('平水韵', () => {
  it('106 部:上平 15 / 下平 15 / 上 29 / 去 30 / 入 17', () => {
    expect(pingshui.parts).toHaveLength(106)
    const n = (s) => pingshui.parts.filter((p) => p.sheng === s).length
    expect([n('上平'), n('下平'), n('上'), n('去'), n('入')]).toEqual([15, 15, 29, 30, 17])
    expect(new Set(pingshui.parts.map((p) => p.id)).size).toBe(106)
  })
  it('平声两部平、上去入三声仄', () => {
    for (const p of pingshui.parts) expect(p.tone).toBe(p.sheng.endsWith('平') ? '平' : '仄')
  })
  it('東 → 上平一東 · 平(繁简皆可查)', () => {
    expect(pingshui.index['東']).toEqual(['上平一東'])
    expect(pingshui.index['东']).toEqual(['上平一東'])
    expect(psPart('上平一東').tone).toBe('平')
  })
  it('月 → 入声六月 · 仄', () => {
    expect(pingshui.index['月']).toEqual(['入六月'])
    expect(psPart('入六月').tone).toBe('仄')
  })
  it('花 → 下平六麻', () => {
    expect(pingshui.index['花']).toEqual(['下平六麻'])
  })
  it('「中」多音 → 两部(上平一東 / 去一送),一平一仄', () => {
    expect(pingshui.index['中']).toEqual(['上平一東', '去一送'])
    expect(pingshui.index['中'].map((id) => psPart(id).tone)).toEqual(['平', '仄'])
  })
  it('【詞】增补字另立 ciIndex,不混入本字表', () => {
    // 「瘋」只见于上平一東的【詞】行
    expect(pingshui.index['瘋']).toBeUndefined()
    expect(pingshui.ciIndex['瘋']).toEqual(['上平一東'])
  })
  it('異体退查表只收本字未收者,且所指之字确在韵书', () => {
    expect(pingshui.variants['隣']).toBe('鄰')
    for (const [v, base] of Object.entries(pingshui.variants)) {
      expect(pingshui.index[v] || pingshui.ciIndex[v]).toBeUndefined()
      expect(pingshui.index[base] || pingshui.ciIndex[base]).toBeTruthy()
    }
  })
  it('送杜少府之任蜀州 五韵脚同在上平十一真', () => {
    for (const c of ['秦', '津', '人', '鄰', '邻', '巾']) expect(pingshui.index[c]).toEqual(['上平十一真'])
  })
})

describe('词林正韵', () => {
  it('19 部,1–14 部平仄两类、15–19 部入声', () => {
    expect(cilin.parts).toHaveLength(19)
    cilin.parts.forEach((p, i) => {
      expect(p.no).toBe(i + 1)
      expect(p.tone).toBe(p.no <= 14 ? '平仄' : '入')
    })
  })
  it('括注已剔:字表全是汉字,不含「（」「）」「[」', () => {
    for (const p of cilin.parts) expect(p.chars).toMatch(/^\p{Script=Han}+$/u)
  })
  it('抽样:東 → 第一部平;月 → 第十八部入;花 → 第十部平', () => {
    expect(cilin.index['東']).toContain('1平')
    expect(cilin.index['月']).toEqual(['18入'])
    expect(cilin.index['花']).toContain('10平')
  })
})

describe('中原音韵', () => {
  it('19 韵,各韵皆有阴平/阳平/上/去', () => {
    expect(zhongyuan.parts).toHaveLength(19)
    expect(zhongyuan.parts.map((p) => p.name).join('')).toBe('東鍾江陽支思齊微魚模皆來真文寒山桓歡先天蕭豪歌戈家麻車遮庚青尤侯侵尋監咸廉纖')
    for (const p of zhongyuan.parts) for (const k of ['阴平', '阳平', '上', '去']) expect(p.groups[k].length).toBeGreaterThan(0)
  })
  it('卷首序文不入;支思行尾的「△陽」标记已切开(「陽」不误入支思)', () => {
    expect(zhongyuan.index['陽']).toEqual(['江陽'])
    const zhisi = zhongyuan.parts.find((p) => p.name === '支思')
    expect(zhisi.groups['阳平'][0]).toBe('兒而洏')
  })
  it('入派三声:月 → 車遮(入作去)', () => {
    expect(zhongyuan.index['月']).toContain('車遮')
    const chezhe = zhongyuan.parts.find((p) => p.name === '車遮')
    expect(chezhe.groups['入作去'].some((xy) => xy.includes('月'))).toBe(true)
  })
})
