import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import data from './lunyu-people.json'
import lunyu from './classics/lunyu.json'
import check from '../../../scripts/lib/check-lunyu-people.mjs'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const para = (ch, i) => lunyu.chapters.find((c) => c.no === ch).paragraphs[i].original
const person = (id) => data.people.find((p) => p.id === id)
// 找含某片段的段落坐标
const locate = (frag) => {
  for (const c of lunyu.chapters) {
    const i = c.paragraphs.findIndex((p) => p.original.includes(frag))
    if (i !== -1) return { ch: c.no, para: i }
  }
  throw new Error(`原文无「${frag}」`)
}
const has = (id, frag) => {
  const { ch, para: i } = locate(frag)
  return person(id).hits.some((h) => h.ch === ch && h.para === i)
}

// 按 check-data 的方式调闸;tamper 可改写读到的 lunyu-people.json(测闸能不能逮住坏数据)
function runGate(tamper) {
  const errs = [], warns = []
  check({
    ROOT,
    err: (m) => errs.push(m),
    warn: (m) => warns.push(m),
    info: () => {},
    readJson: (f) => {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'))
      return tamper && f.endsWith('lunyu-people.json') ? tamper(j) : j
    },
    chapterText: (corpus, slug, ch) => {
      if (corpus !== 'ru' || slug !== 'lunyu') return null
      const c = lunyu.chapters.find((x) => x.no === ch)
      return c ? c.title + c.paragraphs.map((p) => p.original).join('') : null
    },
  })
  return { errs, warns }
}

describe('论语孔门弟子出场索引(src/data/ru/lunyu-people.json)', () => {
  it('校验闸零错误零警告(含「与原文重新派生一致」)', () => {
    const { errs, warns } = runGate()
    expect(errs).toEqual([])
    expect(warns).toEqual([])
  })

  it('校验闸逮得住:凭记忆改的 evidence、空人、人数不足', () => {
    const bad = runGate((j) => { j.people[0].hits[0].evidence = '子曰学而时习之'; return j })
    expect(bad.errs.some((m) => m.includes('不在该章原文中'))).toBe(true)
    const empty = runGate((j) => { j.people[1].hits = []; return j })
    expect(empty.errs.some((m) => m.includes('0 条出场'))).toBe(true)
    const few = runGate((j) => { j.people = j.people.slice(0, 5); return j })
    expect(few.errs.some((m) => m.includes('≥20'))).toBe(true)
  })

  it('≥20 人,每人 ≥1 条,每条 evidence 为该段原文子串且 ≤20 字', () => {
    expect(data.people.length).toBeGreaterThanOrEqual(20)
    for (const p of data.people) {
      expect(p.hits.length, p.name).toBeGreaterThan(0)
      for (const h of p.hits) {
        expect(para(h.ch, h.para).includes(h.evidence), `${p.name} ${h.ch}.${h.para}`).toBe(true)
        expect(h.evidence.length).toBeLessThanOrEqual(20)
        expect(h.evidence.slice(h.mark, h.mark + h.term.length)).toBe(h.term)
      }
    }
  })

  it('按出场篇数降序', () => {
    const pian = data.people.map((p) => new Set(p.hits.map((h) => h.ch)).size)
    for (let i = 1; i < pian.length; i++) expect(pian[i]).toBeLessThanOrEqual(pian[i - 1])
    expect(data.people.map((p) => p.pian)).toEqual(pian)
    // 量级(§2 验收):子贡、子路都在十篇以上
    expect(person('zigong').pian).toBeGreaterThanOrEqual(12)
    expect(person('zilu').pian).toBeGreaterThanOrEqual(12)
  })

  it('单字呼名:呼格计入', () => {
    expect(has('yanyuan', '回也不改其乐')).toBe(true)
    expect(has('yanyuan', '吾与回言终日')).toBe(true)
    expect(has('zilu', '由，诲女知之乎')).toBe(true)
    expect(has('zigong', '赐不受命')).toBe(true)
    expect(has('zengzi', '参乎！吾道一以贯之')).toBe(true)
    // 「柴也愚，参也鲁，师也辟，由也喭」一段四人
    for (const id of ['zigao', 'zengzi', 'zizhang', 'zilu']) expect(has(id, '柴也愚'), id).toBe(true)
    expect(has('ranyou', '求，尔何如')).toBe(true)
    expect(has('gongxihua', '赤，尔何如')).toBe(true)
    expect(has('zengxi', '点，尔何如')).toBe(true)
  })

  it('单字非名:动词 / 他义 / 他人一律不计', () => {
    expect(has('zilu', '末由也已')).toBe(false) // 由,途径(颜渊喟然叹)
    expect(has('zilu', '观其所由')).toBe(false)
    expect(has('zizhang', '柳下惠为士师')).toBe(false) // 士师,狱官
    expect(has('zizhang', '三人行，必有我师焉')).toBe(false)
    expect(has('ranyou', '富而可求也')).toBe(false)
    expect(has('ranyou', '不忮不求')).toBe(false)
    expect(has('zigong', '君赐食')).toBe(false)
    expect(has('zengzi', '参于前也')).toBe(false)
    expect(has('ziyou', '必偃')).toBe(false)
    expect(has('zhonggong', '以雍彻')).toBe(false)
    expect(has('youzi', '有若无')).toBe(false) // 「有若无，实若虚」
    expect(has('zaiwo', '天生德于予')).toBe(false) // 予,孔子自称
    expect(has('zilu', '行不由径')).toBe(false) // 属澹台灭明
  })

})
