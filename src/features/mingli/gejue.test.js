import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { ZHI, GAN, cangGan } from '../shared/ganzhi/index.js'
import { parseCangdunGe, buildDeck, judge, shuffle } from './gejue.js'

// 底本:《渊海子平》第 3 章「又地支藏遁歌」第 0 段。原文一律取数据管线生成物,不手打。
const book = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../data/mingli/classics/yuanhai.json'), 'utf8'),
)
const chapter3 = book.chapters.find((c) => c.no === 3)
const GEJUE_TEXT = chapter3.paragraphs[0].original

describe('parseCangdunGe · 歌诀解析', () => {
  const parsed = parseCangdunGe(GEJUE_TEXT)

  it('恰好十二句', () => {
    expect(parsed).toHaveLength(12)
  })

  it('十二地支各一、不重不漏', () => {
    const zhis = parsed.map((p) => p.zhi)
    expect(new Set(zhis).size).toBe(12)
    expect([...zhis].sort()).toEqual([...ZHI].sort())
  })

  it('每句都认出了地支,且该地支字确实出现在原句里', () => {
    for (const { zhi, line } of parsed) {
      expect(zhi).not.toBeNull()
      expect(line).toContain(zhi)
    }
  })

  it('每句认出的天干字集合非空、且都是合法天干(不误收五行字)', () => {
    for (const { gans } of parsed) {
      expect(gans.length).toBeGreaterThan(0)
      for (const g of gans) expect(GAN).toContain(g)
    }
  })

  // 底本与规则层互校:歌诀里每一句提到的天干集合,必须与共享规则层 cangGan(zhi) 的集合相等。
  // 这条断言的意义是——站内规则层不是凭记忆写的,和底本对得上。
  it('底本与规则层互校:每句藏干集合 === cangGan(zhi)(12 支全等)', () => {
    for (const { zhi, gans } of parsed) {
      expect(new Set(gans), `地支「${zhi}」`).toEqual(new Set(cangGan(zhi)))
    }
  })
})

describe('buildDeck', () => {
  const deck = buildDeck(GEJUE_TEXT)

  it('十二张卡,顺序照歌诀原序(恰与 ZHI 的子丑寅卯…亥顺序一致)', () => {
    expect(deck).toHaveLength(12)
    expect(deck.map((c) => c.zhi)).toEqual(ZHI)
  })

  it('answer 直接取自规则层 cangGan,与歌诀句子里的天干集合一致', () => {
    for (const card of deck) {
      expect(card.answer).toEqual(cangGan(card.zhi))
      expect(card.line).toContain(card.zhi)
    }
  })
})

describe('judge', () => {
  it('全对:right 覆盖全部答案,missed/wrong 皆空', () => {
    const r = judge(['甲', '丙', '戊'], ['戊', '甲', '丙'])
    expect(r.ok).toBe(true)
    expect(r.missed).toEqual([])
    expect(r.wrong).toEqual([])
    expect(new Set(r.right)).toEqual(new Set(['甲', '丙', '戊']))
  })

  it('漏选:missed 非空、wrong 为空、ok=false', () => {
    const r = judge(['甲', '丙', '戊'], ['甲'])
    expect(r.ok).toBe(false)
    expect(r.right).toEqual(['甲'])
    expect(r.missed).toEqual(['丙', '戊'])
    expect(r.wrong).toEqual([])
  })

  it('错选:wrong 非空、missed 为空、ok=false', () => {
    const r = judge(['癸'], ['癸', '壬'])
    expect(r.ok).toBe(false)
    expect(r.right).toEqual(['癸'])
    expect(r.missed).toEqual([])
    expect(r.wrong).toEqual(['壬'])
  })

  it('既漏又错', () => {
    const r = judge(['己', '癸', '辛'], ['癸', '甲'])
    expect(r.ok).toBe(false)
    expect(r.right).toEqual(['癸'])
    expect(r.missed).toEqual(['己', '辛'])
    expect(r.wrong).toEqual(['甲'])
  })

  it('什么都没选', () => {
    const r = judge(['乙'], [])
    expect(r.ok).toBe(false)
    expect(r.right).toEqual([])
    expect(r.missed).toEqual(['乙'])
    expect(r.wrong).toEqual([])
  })
})

describe('shuffle · 确定性洗牌', () => {
  const arr = ZHI.slice()

  it('同 seed 得同结果', () => {
    expect(shuffle(arr, 7)).toEqual(shuffle(arr, 7))
    expect(shuffle(arr, 42)).toEqual(shuffle(arr, 42))
  })

  it('不改动原数组,返回值是原数组的一个排列', () => {
    const out = shuffle(arr, 3)
    expect(out).not.toBe(arr)
    expect(arr).toEqual(ZHI) // 原数组未被就地修改
    expect(out).toHaveLength(arr.length)
    expect([...out].sort()).toEqual([...arr].sort())
  })

  it('不同 seed 通常给出不同顺序', () => {
    expect(shuffle(arr, 1)).not.toEqual(shuffle(arr, 2))
  })
})
