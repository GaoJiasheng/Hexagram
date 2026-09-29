import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import check, { GUOFENG } from './check-shijing-map.mjs'
import {
  poemTitlesOf, poemHref, regionRadius, orientationErrors, overlappingPairs, clusterBox,
} from '../../src/features/ru/shijingMap.js'
import { chapterParts } from '../../src/features/reader/chapterParts.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const book = readJson(path.join(ROOT, 'src/data/ru/classics/shijing.json'))
const data = readJson(path.join(ROOT, 'src/data/ru/shijing-map.json'))
const clone = (x) => JSON.parse(JSON.stringify(x))
const META = { poemTitles: true }

// mutate(d) 改一份克隆的图数据,再跑闸
function runCheck(mutate) {
  const errs = [], warns = [], infos = []
  const d = clone(data)
  if (mutate) mutate(d)
  check({
    ROOT,
    readJson: (f) => (f.endsWith('shijing-map.json') ? d : readJson(f)),
    err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m),
    chapterText: () => null,
  })
  return { errs, warns, infos }
}
const byId = (d, id) => d.regions.find((r) => r.id === id)

describe('诗经国风图 · 数据', () => {
  it('十五组按《诗经》编次,ch 恰为前 15 章,章题含国名', () => {
    expect(data.regions.map((r) => r.name)).toEqual(GUOFENG)
    expect(data.regions.map((r) => r.ch)).toEqual(GUOFENG.map((_, i) => i + 1))
    for (const r of data.regions) {
      expect(book.chapters.find((c) => c.no === r.ch).title).toContain(r.name)
    }
  })

  it('首数从原文数:十五国风共 160 首,郑最多(21)、桧曹最少(4)', () => {
    const counts = Object.fromEntries(data.regions.map((r) => [r.name, poemTitlesOf(book.chapters.find((c) => c.no === r.ch)).length]))
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(160)
    expect(counts).toMatchObject({ 周南: 11, 召南: 14, 邶: 19, 郑: 21, 桧: 4, 曹: 4, 豳: 7 })
    for (const r of data.regions) expect(r.poems).toBe(counts[r.name])
  })

  it('几何:相对方位全合、圆两两不叠、卫地虚框只框邶鄘卫', () => {
    expect(orientationErrors(data.regions)).toEqual([])
    expect(overlappingPairs(data.regions)).toEqual([])
    const box = clusterBox(data.regions, ['bei', 'yong', 'wey'])
    const inside = data.regions.filter((r) => r.x > box.x && r.x < box.x + box.w && r.y > box.y && r.y < box.y + box.h)
    expect(inside.map((r) => r.id).sort()).toEqual(['bei', 'wey', 'yong'])
  })
})

describe('诗经国风图 · 纯函数', () => {
  it('poemTitlesOf 取诗题段与段下标', () => {
    const ps = poemTitlesOf(book.chapters[0])
    expect(ps).toHaveLength(11)
    expect(ps[0]).toEqual({ title: '关雎', idx: 0 })
    expect(ps.at(-1).title).toBe('麟之趾')
  })

  it('poemHref:长章带上诗所在那一屏(首屏也显式 ?p=1),短章不带', () => {
    const bei = book.chapters.find((c) => c.no === 3)          // 邶风 106 段,拆三屏
    const parts = chapterParts(bei, META)
    const ps = poemTitlesOf(bei)
    expect(poemHref(3, ps[0].idx, parts)).toBe('/ru/shijing/3?p=1#seg-3-0')
    const xiongzhi = ps.find((p) => p.title === '雄雉')
    expect(poemHref(3, xiongzhi.idx, parts)).toBe(`/ru/shijing/3?p=2#seg-3-${xiongzhi.idx}`)
    const wei = book.chapters.find((c) => c.no === 9)           // 魏风 25 段,不拆
    expect(poemHref(9, 3, chapterParts(wei, META))).toBe('/ru/shijing/9#seg-9-3')
  })

  it('regionRadius 随首数单调增', () => {
    expect(regionRadius(21)).toBeGreaterThan(regionRadius(4))
    expect(regionRadius(4)).toBeGreaterThan(20)
  })
})

describe('诗经国风图 · 校验闸', () => {
  it('现行数据零错误零警告,报一行覆盖', () => {
    const { errs, warns, infos } = runCheck()
    expect(errs).toEqual([])
    expect(warns).toEqual([])
    expect(infos).toEqual(['诗经国风图: 15 组 · 160 首 · 河道 2 条'])
  })

  it('少一组即报', () => {
    const { errs } = runCheck((d) => { d.regions.pop() })
    expect(errs.some((e) => /应有 15 组/.test(e))).toBe(true)
  })

  it('ch 指到别国(章题不含国名)即报', () => {
    const { errs } = runCheck((d) => { byId(d, 'qin').ch = 16; byId(d, 'qin').poems = 10 })
    expect(errs.some((e) => /章题「鹿鸣之什」不含国名「秦」/.test(e))).toBe(true)
  })

  it('kw 不在该章原文即报(凭记忆指章)', () => {
    const { errs } = runCheck((d) => { byId(d, 'wey').kw = '关关雎鸠' })
    expect(errs.some((e) => /kw「关关雎鸠」不在第 5 章原文里/.test(e))).toBe(true)
  })

  it('首数不是从原文数出来的即报(poems 与 note 两处都查)', () => {
    let r = runCheck((d) => { byId(d, 'zheng').poems = 20 })
    expect(r.errs.some((e) => /poems=20,原文第 7 章实有 21 首/.test(e))).toBe(true)
    r = runCheck((d) => { byId(d, 'zheng').note = byId(d, 'zheng').note.replace('21 首', '二十首') })
    expect(r.errs.some((e) => /note 须写明「21 首」/.test(e))).toBe(true)
  })

  it('坐标出画布即报', () => {
    const { errs } = runCheck((d) => { byId(d, 'qi').x = 1200 })
    expect(errs.some((e) => /坐标 \(1200, 230\) 不在画布/.test(e))).toBe(true)
  })

  it('方位颠倒(秦齐对调)即报', () => {
    const { errs } = runCheck((d) => {
      const q = byId(d, 'qin'), c = byId(d, 'qi')
      ;[q.x, c.x] = [c.x, q.x]
    })
    expect(errs.some((e) => /秦 应在 王 之西/.test(e))).toBe(true)
    expect(errs.some((e) => /齐 应在 王 之东/.test(e))).toBe(true)
  })

  it('两圆相叠即报', () => {
    const { errs } = runCheck((d) => { byId(d, 'kuai').x = 590; byId(d, 'kuai').y = 430 })
    expect(errs.some((e) => /zheng 与 kuai 两圆相叠/.test(e))).toBe(true)
  })

  it('note 给经纬即报(示意图红线)', () => {
    const { errs } = runCheck((d) => { byId(d, 'qi').note += '约东经 118°' })
    expect(errs.some((e) => /不许给经纬/.test(e))).toBe(true)
  })

  it('河道出画布即报', () => {
    const { errs } = runCheck((d) => { d.rivers[0].d = 'M 300 -40 L 300 300' })
    expect(errs.some((e) => /河道「黄河」: 点 \(300, -40\) 出画布/.test(e))).toBe(true)
  })
})
