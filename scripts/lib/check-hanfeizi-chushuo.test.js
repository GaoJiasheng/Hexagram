import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deriveChushuo, deriveChapter } from './hanfeizi-chushuo.mjs'
import check from './check-hanfeizi-chushuo.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const book = readJson(path.join(ROOT, 'src/data/fa/classics/hanfeizi.json'))
const data = readJson(path.join(ROOT, 'src/data/fa/hanfeizi-chushuo.json'))
const clone = (x) => JSON.parse(JSON.stringify(x))

function runCheck(overrides = {}) {
  const errs = [], infos = []
  const ctx = {
    ROOT, readJson, err: (m) => errs.push(m), warn: () => {}, info: (m) => infos.push(m),
    chapterText: () => null, ...overrides,
  }
  check(ctx)
  return { errs, infos }
}

describe('储说经说 · 派生', () => {
  const { chapters } = deriveChushuo(book)

  it('六篇经条数与说组数逐篇相等(七术 7 · 六微 7〔含庙攻〕· 左上 6 · 左下 6 · 右上 3 · 右下 5)', () => {
    expect(chapters.map((c) => c.ch)).toEqual([30, 31, 32, 33, 34, 35])
    expect(chapters.map((c) => c.jing.length)).toEqual([7, 7, 6, 6, 3, 5])
    for (const c of chapters) {
      const ch = book.chapters.find((x) => x.no === c.ch)
      const firstShuo = c.jing[0].shuoFrom
      const groups = ch.paragraphs.slice(firstShuo).filter((p) => /^[一二三四五六七八九十]。/.test(p.original)).length
      expect(groups).toBe(c.jing.length)
    }
  })

  it('内储说两篇的标签取自原文标签段', () => {
    expect(chapters[0].jing.map((j) => j.label)).toEqual(['参观', '必罚', '赏誉', '一听', '诡使', '挟智', '倒言'])
    expect(chapters[1].jing.map((j) => j.label)).toEqual(['权借', '利异', '似类', '有反', '参疑', '废置', '庙攻'])
    expect(chapters[0].youjingPara).toBe(14)
    expect(chapters[0].intro).toBe(0)
  })

  it('外储说左上/左下无「右经」段,说部从编号回到「一。」处起', () => {
    for (const c of chapters.filter((x) => x.ch === 32 || x.ch === 33)) {
      expect(c.youjingPara).toBeUndefined()
      expect(c.intro).toBeUndefined()
      expect(c.jing[0]).toMatchObject({ para: 0, shuoFrom: 6 })
    }
  })

  it('说组区间首尾相接、铺满说部', () => {
    for (const c of chapters) {
      const n = book.chapters.find((x) => x.no === c.ch).paragraphs.length
      c.jing.forEach((j, k) => {
        if (k) expect(j.shuoFrom).toBe(c.jing[k - 1].shuoTo + 1)
      })
      expect(c.jing.at(-1).shuoTo).toBe(n - 1)
    }
  })

  it('经条数 ≠ 说组数时抛错(不落盘的依据)', () => {
    const ch = clone(book.chapters.find((x) => x.no === 32))
    const k = ch.paragraphs.findIndex((p, i) => i > 5 && p.original.startsWith('六。'))
    ch.paragraphs[k].original = ch.paragraphs[k].original.replace(/^六。/, '')
    expect(() => deriveChapter(ch)).toThrow(/经 6 条 ≠ 说 5 组/)
  })

  it('生成物与按现行原文复算一致', () => {
    expect(data.chapters.map((c) => c.jing)).toEqual(chapters.map((c) => c.jing))
  })
})

describe('储说经说 · 校验闸', () => {
  it('现行数据零错误,报一行覆盖', () => {
    const { errs, infos } = runCheck()
    expect(errs).toEqual([])
    expect(infos).toEqual(['储说经说: 6 篇 · 34 经 · 34 说'])
  })

  it('篡改说组起点 / 删一条经,闸都能逮到', () => {
    const tampered = clone(data)
    tampered.chapters[0].jing[2].shuoFrom += 1
    tampered.chapters[2].jing.pop()
    const readTampered = (f) => (f.endsWith('hanfeizi-chushuo.json') ? tampered : readJson(f))
    const { errs } = runCheck({ readJson: readTampered })
    expect(errs.some((m) => /第 30 章 经3: 说组首段/.test(m))).toBe(true)
    expect(errs.some((m) => /第 32 章: 经 5 条 ≠ 原文说组 6 组/.test(m))).toBe(true)
    expect(errs.some((m) => /复算的结果不一致/.test(m))).toBe(true)
  })
})
