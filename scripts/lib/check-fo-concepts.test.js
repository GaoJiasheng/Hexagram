import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import check, { checkFoData, TWELVE_LINKS } from './check-fo-concepts.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const concepts = readJson(path.join(ROOT, 'src/data/fo/concepts.json'))
const rings = readJson(path.join(ROOT, 'src/data/fo/rings.json'))

// 小底本:两部书,够造各种错
const BOOKS = {
  xinjing: { 1: '般若波罗蜜多心经观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空' },
  tanjing: { 1: '行由品菩提本无树', 2: '般若品烦恼即菩提' },
}
const getText = (slug, ch) => (BOOKS[slug] ? (BOOKS[slug][ch] ?? null) : undefined)
const loc = (slug, ch, kw) => ({ corpus: 'fo', slug, ch, label: `x·${kw}`, kw })
const mini = (clusters, ringsList = []) => checkFoData({ concepts: { clusters }, rings: { rings: ringsList }, getText })
const pad = (n) => Array.from({ length: n }, (_, i) => ({ term: `名${i}`, gloss: '释义', loci: [loc('xinjing', 1, '五蕴'), loc('tanjing', 1, '菩提')] }))

describe('check-fo-concepts · 真数据', () => {
  it('现行 concepts.json + rings.json 零报错,≥25 名相,十二因缘 12 支', () => {
    const errs = [], warns = [], infos = []
    check({ ROOT, err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m), readJson })
    expect(errs).toEqual([])
    expect(concepts.clusters.length).toBeGreaterThanOrEqual(25)
    expect(concepts.clusters.length).toBeLessThanOrEqual(35)
    expect(infos[0]).toMatch(/^佛名相索引: \d+ 概念 · \d+ 落点$/)
    const r12 = rings.rings.find((r) => r.id === 'shieryinyuan')
    expect(r12.items.map((it) => it.label)).toEqual(TWELVE_LINKS)
  })
  it('验收:「空」落到心经 / 金刚经 / 坛经', () => {
    const kong = concepts.clusters.find((c) => c.term === '空')
    expect(new Set(kong.loci.map((l) => l.slug))).toEqual(new Set(['xinjing', 'jingangjing', 'tanjing', 'weimojie']))
  })
  it('十二因缘环「爱」有释义与出处', () => {
    const ai = rings.rings.find((r) => r.id === 'shieryinyuan').items.find((it) => it.label === '爱')
    expect(ai.note).toBeTruthy()
    expect(ai.src.slug).toBe('weimojie')
  })
})

describe('check-fo-concepts · 逮得住错', () => {
  it('kw 在该章查不到 → 报(凭记忆指章)', () => {
    const { errors } = mini([...pad(25), { term: '空', gloss: 'x', loci: [loc('tanjing', 1, '烦恼即菩提')] }])
    expect(errors.some((m) => /查不到「烦恼即菩提」/.test(m))).toBe(true)
  })
  it('书不存在 / 章不存在', () => {
    const { errors } = mini([...pad(25), { term: 'x', gloss: 'x', loci: [loc('nope', 1, 'a'), loc('tanjing', 9, 'a')] }])
    expect(errors.some((m) => /无此书 nope/.test(m))).toBe(true)
    expect(errors.some((m) => /tanjing 无第 9 章/.test(m))).toBe(true)
  })
  it('gloss 含劝信 / 果报用字 → 报', () => {
    for (const w of ['必得', '往生', '消业', '福报', '灭罪']) {
      const { errors } = mini([...pad(25), { term: 'x', gloss: `念之${w}`, loci: [loc('xinjing', 1, '五蕴')] }])
      expect(errors.some((m) => m.includes(`「${w}」`))).toBe(true)
    }
  })
  it('名相不足 25 → 报;同名相重复指同一章 → 报', () => {
    expect(mini(pad(24)).errors.some((m) => /至少 25/.test(m))).toBe(true)
    const { errors } = mini([...pad(25), { term: 'y', gloss: 'x', loci: [loc('xinjing', 1, '五蕴'), loc('xinjing', 1, '照见')] }])
    expect(errors.some((m) => /重复指向同一章/.test(m))).toBe(true)
  })
  it('环:引文不是原文子串 → 报;次第不对 → 报;note 含禁用字 → 报', () => {
    const items = TWELVE_LINKS.map((label) => ({ label, note: '字义' }))
    items[0] = { label: '无明', note: '字义', src: { slug: 'xinjing', ch: 1, quote: '无无明', label: '心经' } }
    const bad = mini(pad(25), [{ id: 'shieryinyuan', title: '十二因缘', arrows: true, items }]).errors
    expect(bad.some((m) => /不是 xinjing#1 原文的精确子串/.test(m))).toBe(true)

    const swapped = TWELVE_LINKS.map((label) => ({ label, note: '字义' }))
    ;[swapped[7], swapped[8]] = [swapped[8], swapped[7]]
    expect(mini(pad(25), [{ id: 'shieryinyuan', title: '十二因缘', items: swapped }]).errors.some((m) => /按次第/.test(m))).toBe(true)

    const preach = TWELVE_LINKS.map((label) => ({ label, note: '字义' }))
    preach[11].note = '念此可以灭罪'
    expect(mini(pad(25), [{ id: 'shieryinyuan', title: '十二因缘', items: preach }]).errors.some((m) => /「灭罪」/.test(m))).toBe(true)

    const two = mini(pad(25), [{ id: 'x', title: 'x', items: [{ label: '甲', note: 'a' }, { label: '乙', note: 'b' }] }]).errors
    expect(two.some((m) => /3–24/.test(m))).toBe(true)
  })
})
