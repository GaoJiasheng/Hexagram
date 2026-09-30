// 韵书未收字清单(M8 · /rhyme 页的数据)。生成物来自 scripts/gen-rhyme-unlisted.mjs,不手改。
// 查:结构;每组合计自洽;清单里的字**确实**不在对应韵书(用阅读器同一套查法 rhymePart,含简繁双键与异体退查);
// 例句能在原文里找到;与重算一致(不一致即过期);校验闸对坏数据会报错。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import unlisted from './unlisted.json'
import pingshui from './pingshui.json'
import cilin from './cilin.json'
import zhongyuan from './zhongyuan.json'
import { rhymePart } from '../../features/reader/prosody.js'
import { computeUnlisted, RHYME_GROUPS, MAX_EXAMPLES } from '../../../scripts/lib/rhyme-unlisted.mjs'
import check from '../../../scripts/lib/check-rhyme.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const BOOKS = { pingshui, cilin, zhongyuan }
const HAN = /\p{Script=Han}/gu
const hanOnly = (s) => (String(s).match(HAN) || []).join('')
const group = (corpus) => unlisted.groups.find((g) => g.corpus === corpus)

describe('结构', () => {
  it('三组:唐诗→平水韵 · 宋词→词林正韵 · 元曲→中原音韵', () => {
    expect(unlisted.groups.map((g) => [g.corpus, g.scheme])).toEqual([
      ['tangshi', 'pingshui'], ['songci', 'cilin'], ['yuanqu', 'zhongyuan'],
    ])
  })
  it('三部韵书概况:部数 106 / 19 / 19,收字数为正', () => {
    expect(unlisted.books.pingshui.parts).toBe(106)
    expect(unlisted.books.pingshui.sheng).toEqual({ 上平: 15, 下平: 15, 上: 29, 去: 30, 入: 17 })
    expect(unlisted.books.cilin.parts).toBe(19)
    expect(unlisted.books.zhongyuan.parts).toBe(19)
    for (const b of Object.values(unlisted.books)) expect(b.chars).toBeGreaterThan(4000)
  })
  it('每组 stats 与条目合计相符', () => {
    for (const g of unlisted.groups) {
      const s = g.stats
      expect(g.items.reduce((n, x) => n + x.count, 0)).toBe(s.unlisted)
      expect(g.items.reduce((n, x) => n + x.endCount, 0)).toBe(s.endUnlisted)
      expect(g.items.length).toBe(s.distinct)
      expect(g.items.filter((x) => x.endCount > 0).length).toBe(s.endDistinct)
      expect(s.unlisted).toBeLessThan(s.chars * 0.05) // 未收是少数(元曲最多也不到 2%)
      expect(s.rate).toBeCloseTo(s.unlisted / s.chars, 4)
    }
  })
  it('条目:一字一条,次数 ≥ 句末次数,按次数降序,例句 1–3 条', () => {
    for (const g of unlisted.groups) {
      expect(new Set(g.items.map((x) => x.char)).size).toBe(g.items.length)
      g.items.forEach((x, i) => {
        expect(x.count).toBeGreaterThanOrEqual(Math.max(1, x.endCount))
        if (i) expect(g.items[i - 1].count).toBeGreaterThanOrEqual(x.count)
        expect(x.examples.length).toBeGreaterThan(0)
        expect(x.examples.length).toBeLessThanOrEqual(Math.min(MAX_EXAMPLES, x.count))
      })
    }
  })
})

describe('未收字确实不在对应韵书(同一套查法)', () => {
  it('每一条都查不到:本字、简繁双键、【詞】增补、异体退查都落空', () => {
    for (const g of unlisted.groups) {
      const book = BOOKS[g.scheme]
      for (const { char } of g.items) {
        expect(rhymePart(char, g.scheme, book), `${g.label}「${char}」`).toBeNull()
        expect(book.index[char]).toBeUndefined()
        if (book.ciIndex) expect(book.ciIndex[char]).toBeUndefined()
        const alt = book.variants?.[char]
        if (alt) expect(book.index[alt] || book.ciIndex?.[alt]).toBeUndefined()
      }
    }
  })
  it('抽样:平水韵页面漏收的「啼」在唐诗清单里(按规矩不补)', () => {
    const ti = group('tangshi').items.find((x) => x.char === '啼')
    expect(ti).toBeTruthy()
    expect(pingshui.index['啼']).toBeUndefined()
    expect(ti.endCount).toBeGreaterThan(0)
  })
  it('反例:走异体表 / 简体键查得到的字不进清单(隣→鄰、东→東)', () => {
    const chars = new Set(unlisted.groups.flatMap((g) => g.items.map((x) => x.char)))
    for (const c of ['隣', '东', '東', '中', '月', '花']) expect(chars.has(c)).toBe(false)
  })
})

describe('例句', () => {
  const cache = {}
  const chapter = (corpus, slug, ch) => {
    const k = `${corpus}/${slug}`
    cache[k] ||= readJson(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`))
    return cache[k].chapters.find((c) => c.no === ch)
  }
  it('每条例句都在原文那一段里,且含该字;句末例句以该字收尾', () => {
    for (const g of unlisted.groups) {
      for (const it of g.items) {
        for (const ex of it.examples) {
          expect(g.slugs).toContain(ex.slug)
          const c = chapter(g.corpus, ex.slug, ex.ch)
          expect(c, `${g.label} ${ex.slug}#${ex.ch}`).toBeTruthy()
          expect(hanOnly(c.paragraphs[ex.para].original)).toContain(ex.line)
          expect(ex.line).toContain(it.char)
          if (ex.end) expect([...ex.line].at(-1)).toBe(it.char)
          if (ex.part !== undefined) expect(Number.isInteger(ex.part) && ex.part >= 1).toBe(true)
        }
      }
    }
  })
  it('唐诗例句的出处是该段之前最近的诗题', () => {
    const ex = group('tangshi').items.find((x) => x.char === '啼').examples[0]
    const c = chapter('tangshi', ex.slug, ex.ch)
    const title = c.paragraphs.slice(0, ex.para).map((p) => p.original.trim()).filter((t) => /^《[^》]+》$/.test(t)).at(-1)
    expect(title).toBe(`《${ex.title}》`)
  })
})

describe('新鲜度与校验闸', () => {
  it('与按现行韵书 + 诗词原文重算的结果一致(否则重跑 node scripts/gen-rhyme-unlisted.mjs)', () => {
    const fresh = computeUnlisted({ ROOT, books: BOOKS })
    expect(fresh.books).toEqual(unlisted.books)
    for (const g of RHYME_GROUPS) {
      const a = fresh.groups.find((x) => x.corpus === g.corpus)
      expect(a).toEqual(group(g.corpus))
    }
  })

  // mutate(d) 改一份克隆的清单,再跑闸
  const runCheck = (mutate) => {
    const errs = []
    const d = JSON.parse(JSON.stringify(unlisted))
    if (mutate) mutate(d)
    check({
      ROOT,
      readJson: (f) => (f.endsWith('unlisted.json') ? d : readJson(f)),
      err: (m) => errs.push(m), warn: () => {}, info: () => {},
    })
    return errs
  }
  it('原样过闸', () => {
    expect(runCheck()).toEqual([])
  })
  it('缺一组 / 缺 stats 即报错', () => {
    expect(runCheck((d) => { d.groups = d.groups.filter((g) => g.corpus !== 'songci') }).join()).toMatch(/宋词.*缺该组/)
    expect(runCheck((d) => { delete d.groups[2].stats }).join()).toMatch(/元曲.*stats/)
  })
  it('混进韵书已收的字即报错', () => {
    const errs = runCheck((d) => {
      d.groups[0].items.push({ char: '東', count: 1, endCount: 0, examples: [{ slug: 'tangshi300', ch: 1, title: 'x', line: '東', para: 1, end: false }] })
      d.groups[0].stats.unlisted++
      d.groups[0].stats.distinct++
    })
    expect(errs.join()).toMatch(/「東」韵书已收/)
  })
  it('合计对不上、或与重算不一致即报错', () => {
    const errs = runCheck((d) => { d.groups[1].items[0].count++ })
    expect(errs.join()).toMatch(/次数合计/)
    expect(errs.join()).toMatch(/过期/)
  })
})
