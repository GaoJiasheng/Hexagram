import { describe, it, expect } from 'vitest'
import { getPalace, getAllPalaces } from '../bagong.js'

// 已知卦 binary（用于断言）
const KAN  = '010010'  // 坎
const JIE  = '110010'  // 节
const TUN  = '100010'  // 屯
const JJ   = '101010'  // 既济
const GE   = '101110'  // 革
const FENG = '101100'  // 丰
const MY   = '101000'  // 明夷
const SHI  = '010000'  // 师

const QIAN   = '111111'  // 乾
const DAXU   = '111101'  // 大有（乾宫归魂）

describe('八宫生成 — 坎宫全序列', () => {
  const seq = [KAN, JIE, TUN, JJ, GE, FENG, MY, SHI]
  const names = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂']

  seq.forEach((binary, i) => {
    it(`坎宫${names[i]} = ${binary}`, () => {
      const p = getPalace(binary)
      expect(p).not.toBeNull()
      expect(p.palaceName).toBe('坎宫')
      expect(p.generation).toBe(names[i])
    })
  })
})

describe('屯 = 坎宫二世，世2应5', () => {
  it('屯卦宫信息正确', () => {
    const p = getPalace(TUN)
    expect(p.palaceName).toBe('坎宫')
    expect(p.generation).toBe('二世')
    expect(p.shi).toBe(2)
    expect(p.ying).toBe(5)
  })
})

describe('乾宫归魂 = 大有', () => {
  it('大有 = 乾宫归魂', () => {
    const p = getPalace(DAXU)
    expect(p.palaceName).toBe('乾宫')
    expect(p.generation).toBe('归魂')
  })
  it('乾 = 乾宫本宫，世在上爻', () => {
    const p = getPalace(QIAN)
    expect(p.palaceName).toBe('乾宫')
    expect(p.generation).toBe('本宫')
    expect(p.shi).toBe(6)
  })
})

describe('八本宫卦各归本宫、世在上爻', () => {
  const PURE = {
    '111111': '乾宫',
    '110110': '兑宫',
    '101101': '离宫',
    '100100': '震宫',
    '011011': '巽宫',
    '010010': '坎宫',
    '001001': '艮宫',
    '000000': '坤宫',
  }
  Object.entries(PURE).forEach(([binary, name]) => {
    it(`${name}本宫世在上爻`, () => {
      const p = getPalace(binary)
      expect(p.palaceName).toBe(name)
      expect(p.generation).toBe('本宫')
      expect(p.shi).toBe(6)
    })
  })
})

describe('64 卦均分八宫，每宫 8 卦无重复', () => {
  it('共 64 个不同 binary 覆盖 8 宫各 8 卦', () => {
    const palaces = getAllPalaces()
    expect(palaces).toHaveLength(8)

    const allBinaries = new Set()
    const counts = {}
    for (const { name, sequence } of palaces) {
      counts[name] = sequence.length
      for (const b of sequence) {
        expect(allBinaries.has(b)).toBe(false) // 无重复
        allBinaries.add(b)
      }
    }
    expect(allBinaries.size).toBe(64)
    Object.values(counts).forEach(c => expect(c).toBe(8))
  })
})
