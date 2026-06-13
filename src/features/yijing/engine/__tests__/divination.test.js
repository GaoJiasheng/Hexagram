import { describe, it, expect } from 'vitest'
import { getDivinationResult } from '../divination.js'
import { allHexagrams as HEXES, hexagramByBinary } from '../../data.js'

const byName = Object.fromEntries(HEXES.map(h => [h.name, h]))
const run = (name, dong) => getDivinationResult(byName[name], dong, hexagramByBinary)

// 卦辞配彖、爻辞配小象;彖原文「彖曰：」/小象「象曰：」前缀自带
describe('断卦传文层(解卦补充:只释卦象不断吉凶)', () => {
  it('无动爻:本卦卦辞 → 彖传释卦', () => {
    const r = run('乾', [])
    expect(r.ruleName).toBe('无动爻')
    expect(r.primaryTexts[0].commentary.kind).toBe('tuan')
    expect(r.primaryTexts[0].commentary.original).toContain('彖曰')
    // 大象 secondary 本身是传,不再叠传
    expect(r.secondaryTexts[0].commentary).toBeUndefined()
  })

  it('一爻变:本卦变爻 → 小象释爻;参考卦辞 → 彖', () => {
    const r = run('乾', [1]) // 乾初九「潜龙勿用」
    expect(r.ruleName).toBe('一爻变')
    expect(r.primaryTexts[0].commentary.kind).toBe('xiang')
    expect(r.primaryTexts[0].commentary.original).toContain('潜龙勿用')
    expect(r.secondaryTexts[0].commentary.kind).toBe('tuan')
  })

  it('二爻变:两变爻各配小象', () => {
    const r = run('乾', [2, 5])
    expect(r.primaryTexts).toHaveLength(2)
    expect(r.primaryTexts.every(t => t.commentary?.kind === 'xiang')).toBe(true)
  })

  it('三爻变:贞悔两卦辞各配彖', () => {
    const r = run('泰', [1, 2, 3]) // 泰下三爻变 → 坤
    expect(r.ruleName).toBe('三爻变')
    expect(r.bianHex.name).toBe('坤')
    expect(r.primaryTexts.map(t => t.commentary.kind)).toEqual(['tuan', 'tuan'])
  })

  it('五爻变:变卦不变爻 → 该爻小象(穆姜艮之随,六二不变)', () => {
    const r = run('艮', [1, 3, 4, 5, 6])
    expect(r.bianHex.name).toBe('随')
    expect(r.primaryTexts[0].label).toContain('随')
    expect(r.primaryTexts[0].commentary.original).toContain('弗兼与也')
  })

  it('六爻皆变·乾:用九 → 用九小象', () => {
    const r = run('乾', [1, 2, 3, 4, 5, 6])
    expect(r.primaryTexts[0].label).toBe('乾·用九')
    expect(r.primaryTexts[0].commentary.original).toContain('天德不可为首')
  })

  it('六爻皆变·坤:用六 → 用六小象', () => {
    const r = run('坤', [1, 2, 3, 4, 5, 6])
    expect(r.primaryTexts[0].label).toBe('坤·用六')
    expect(r.primaryTexts[0].commentary.original).toContain('以大终也')
  })

  it('六爻皆变·余卦:变卦卦辞 → 变卦彖', () => {
    const r = run('屯', [1, 2, 3, 4, 5, 6]) // 屯 ↔ 鼎(错卦)
    expect(r.bianHex.name).toBe('鼎')
    expect(r.primaryTexts[0].commentary.kind).toBe('tuan')
    expect(r.primaryTexts[0].commentary.original).toContain('鼎')
  })

  it('每条 commentary 都带原文与译文(数据完整)', () => {
    for (const h of HEXES) {
      for (const dong of [[], [1], [3, 4], [1, 2, 3]]) {
        const r = getDivinationResult(h, dong, hexagramByBinary)
        for (const t of [...r.primaryTexts, ...r.secondaryTexts]) {
          if (t.commentary) {
            expect(t.commentary.original).toBeTruthy()
            expect(t.commentary.translation).toBeTruthy()
          }
        }
      }
    }
  })
})
