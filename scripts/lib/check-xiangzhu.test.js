import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import check from './check-xiangzhu.mjs'
import { ROOT, checkPlace, hexParts, partRank, loadBook } from './xiangzhu.mjs'

const X = '这是一段四十字以上的展开文字,用来凑足下限。'.repeat(3)   // 66 字
const note = (k, extra = {}) => ({ k, d: '释义', x: X, ...extra })

describe('checkPlace(详注一处的规则)', () => {
  const o = '道可道，非常道。名可名，非常名。'
  it('合规条目通过', () => {
    const r = checkPlace(o, [note('道可道'), note('非常名', { r: 'míng' })])
    expect(r.bad).toEqual([])
    expect(r.good.length).toBe(2)
  })
  it('k 不是子串 / 重叠 / 重复', () => {
    const r = checkPlace(o, [note('道可道'), note('可道'), note('道可道'), note('无名')])
    expect(r.bad.map((b) => b.why)).toEqual(['同处重叠', 'k 重复', 'k 不是原文子串'])
  })
  it('字数按码点:d 1–40、x 40–150', () => {
    const r = checkPlace(o, [
      { k: '道可道', d: '', x: X },
      { k: '非常道', d: '释'.repeat(41), x: X },
      { k: '名可名', d: '释义', x: '短' },
      { k: '非常名', d: '释义', x: '长'.repeat(151) },
    ])
    expect(r.bad.map((b) => b.why)).toEqual(['d 为空', 'd 超长', 'x 过短', 'x 过长'])
    expect(checkPlace(o, [{ k: '道可道', d: '释义', x: '𠀀'.repeat(40) }]).bad).toEqual([])   // 40 个扩展区字 = 40 码点
  })
  it('多余字段:闸里是错,合并时剥掉;空读音合并时当没给', () => {
    expect(checkPlace(o, [note('道可道', { src: 'x' })]).bad[0].why).toMatch('多余字段')
    expect(checkPlace(o, [note('道可道', { src: 'x' })], { strict: false }).good[0]).toEqual(note('道可道'))
    expect(checkPlace(o, [note('道可道', { r: '' })]).bad[0].why).toBe('r 为空')
    expect(checkPlace(o, [note('道可道', { r: '' })], { strict: false }).good[0]).toEqual(note('道可道'))
  })
})

describe('卦的部位键', () => {
  const hexes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
  it('乾:卦辞 彖 大象 六爻各带小象 用九 文言,次序与 build-desk-packs 一致', () => {
    const keys = hexParts(hexes.find((h) => h.id === 1)).map((p) => p.key)
    expect(keys.slice(0, 17)).toEqual(['judgment', 'tuan', 'daxiang', 'l1', 'x1', 'l2', 'x2', 'l3', 'x3', 'l4', 'x4', 'l5', 'x5', 'l6', 'x6', 'use', 'xuse'])
    expect(keys[17]).toBe('w0')
    expect([...keys].sort((a, b) => partRank(a) - partRank(b))).toEqual(keys)
  })
  it('普通卦 15 个部位', () => {
    expect(hexParts(hexes.find((h) => h.id === 3)).length).toBe(15)
    expect(loadBook('yijing', 'hexagrams').chapters.length).toBe(64)
  })
})

describe('闸本身', () => {
  it('现有真源全过', () => {
    const errs = [], infos = []
    check({ ROOT, err: (m) => errs.push(m), info: (m) => infos.push(m), readJson: (f) => JSON.parse(fs.readFileSync(f, 'utf8')) })
    expect(errs).toEqual([])
  })
  it('坐标不存在、k 不是子串都报错', () => {
    const errs = []
    const fake = { 999: { 0: [note('道')] }, 1: { 99: [note('道')], 0: [note('不存在的词')] } }
    check({
      ROOT, err: (m) => errs.push(m), info: () => {},
      readJson: (f) => (f.endsWith(path.join('dao', 'xiangzhu', 'daodejing.json')) ? fake : JSON.parse(fs.readFileSync(f, 'utf8'))),
    })
    expect(errs.some((e) => e.includes('第 999 章不存在'))).toBe(true)
    expect(errs.some((e) => e.includes('段「99」不存在'))).toBe(true)
    expect(errs.some((e) => e.includes('k 不是原文子串'))).toBe(true)
  })
})
