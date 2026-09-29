import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import check, { checkFables, MIN_FABLES } from './check-zhuangzi-fables.mjs'

const ROOT = path.resolve(import.meta.dirname, '../..')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const data = readJson(path.join(ROOT, 'src/data/dao/zhuangzi-fables.json'))

// 小底本:一部书两篇,够造各种错
const MINI = {
  'zhuangzi-neipian': {
    1: { title: '逍遥游', paragraphs: [{ original: '北冥有鱼，其名为鲲。' }, { original: '惠子谓庄子曰：「吾有大树，人谓之樗。」' }] },
    3: { title: '养生主', paragraphs: [{ original: '庖丁为文惠君解牛，恢恢乎其于游刃必有余地矣。三年之后，未尝见全牛也。' }] },
  },
}
const getChapter = (slug, ch) => MINI[slug]?.[ch] || null
const good = (i) => ({ id: `f${i}`, title: `寓言${i}`, slug: 'zhuangzi-neipian', ch: 1, pian: '逍遥游', para: 0, kw: '北冥有鱼', gist: '这是一句足够长的提要,讲这则寓言在讲什么,不宣化、不下断语。' })
const pad = (n) => Array.from({ length: n }, (_, i) => good(i))
const run = (extra, n = MIN_FABLES) => checkFables({ fables: [...pad(n), ...extra] }, { getChapter })
const has = (errors, re) => errors.some((m) => re.test(m))

describe('check-zhuangzi-fables · 真数据', () => {
  it('现行 zhuangzi-fables.json 零报错零警告,60–90 则,三部都有', () => {
    const errs = [], warns = [], infos = []
    check({ ROOT, err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m), readJson })
    expect(errs).toEqual([])
    expect(warns).toEqual([])
    expect(data.fables.length).toBeGreaterThanOrEqual(60)
    expect(data.fables.length).toBeLessThanOrEqual(90)
    expect(infos[0]).toMatch(/^庄子寓言索引: \d+ 则\(内 \d+ \/ 外 \d+ \/ 杂 \d+\)· 成语 \d+ 条\(后人概括 \d+\)$/)
    for (const slug of ['zhuangzi-neipian', 'zhuangzi-waipian', 'zhuangzi-zapian']) {
      expect(data.fables.filter((f) => f.slug === slug).length).toBeGreaterThanOrEqual(15)
    }
  })
  it('验收:庖丁解牛落在养生主、濠梁在秋水、涸辙之鲋在外物(杂篇)', () => {
    const by = Object.fromEntries(data.fables.map((f) => [f.id, f]))
    expect([by.paoding.slug, by.paoding.pian]).toEqual(['zhuangzi-neipian', '养生主'])
    expect([by.haoliang.slug, by.haoliang.pian]).toEqual(['zhuangzi-waipian', '秋水'])
    expect([by.fuyu.slug, by.fuyu.pian]).toEqual(['zhuangzi-zapian', '外物'])
  })
  it('「东施效颦」「井底之蛙」如实标后人概括', () => {
    const idioms = data.fables.flatMap((f) => f.chengyu || [])
    for (const t of ['东施效颦', '井底之蛙', '呆若木鸡']) {
      const c = idioms.find((x) => x.text === t)
      expect(c?.later).toBe(true)
      expect(c.note).toBeTruthy()
    }
  })
})

describe('check-zhuangzi-fables · 逮得住错', () => {
  it('kw 在该篇查不到 → 报(凭记忆指篇)', () => {
    const { errors } = run([{ ...good(99), kw: '庄周梦为胡蝶' }])
    expect(has(errors, /查不到 kw「庄周梦为胡蝶」/)).toBe(true)
  })
  it('para 指错段 / 篇不存在 / pian 名不对', () => {
    expect(has(run([{ ...good(99), para: 1 }]).errors, /第 1 段里没有 kw/)).toBe(true)
    expect(has(run([{ ...good(99), ch: 9 }]).errors, /无第 9 篇/)).toBe(true)
    expect(has(run([{ ...good(99), pian: '齐物论' }]).errors, /pian 应为「逍遥游」/)).toBe(true)
  })
  it('id 重复 → 报;总数不足 60 → 报', () => {
    expect(has(run([good(0)]).errors, /f0.*id 重复/)).toBe(true)
    expect(has(run([], MIN_FABLES - 1).errors, /至少 60/)).toBe(true)
    expect(run([]).errors).toEqual([])
  })
  it('gist 含红线用字 → 报', () => {
    for (const w of ['成仙', '炼丹', '吉凶', '福报']) {
      const { errors } = run([{ ...good(99), gist: `这则寓言说的是如何${w}的道理,读来颇有意思,值得细读。` }])
      expect(has(errors, new RegExp(`「${w}」`))).toBe(true)
    }
  })
  it('成语:from 不在原文 → 报;字面不全见于原文却不标后人概括 → 报;标了却不写 note → 报', () => {
    const f = { ...good(99), ch: 3, pian: '养生主', kw: '庖丁为文惠君解牛' }
    expect(has(run([{ ...f, chengyu: [{ text: '庖丁解牛', from: '庖丁解牛' }] }]).errors, /不是本篇原文子串/)).toBe(true)
    expect(has(run([{ ...f, chengyu: [{ text: '目无全牛', from: '未尝见全牛也' }] }]).errors, /「目无」不见于原文.*应标 later/)).toBe(true)
    expect(has(run([{ ...f, chengyu: [{ text: '目无全牛', from: '未尝见全牛也', later: true }] }]).errors, /须写 note/)).toBe(true)
    const ok = run([{ ...f, chengyu: [
      { text: '庖丁解牛', from: '庖丁为文惠君解牛' },
      { text: '游刃有余', from: '恢恢乎其于游刃必有余地矣' },
      { text: '目无全牛', from: '未尝见全牛也', later: true, note: '原文作「未尝见全牛」' },
    ] }])
    expect(ok.errors).toEqual([])
    expect(ok.stats.later).toBe(1)
  })
  it('part 与阅读器拆屏规则不一致 → 报', () => {
    // 造一个 70 段的长篇:阅读器会拆成两屏(0–39 / 40–69)
    const long = { title: '长篇', paragraphs: Array.from({ length: 70 }, (_, i) => ({ original: `第${i}段文字在此` })) }
    const getLong = (slug, ch) => (ch === 2 ? long : getChapter(slug, ch))
    const base = { ...good(99), ch: 2, pian: '长篇', kw: '第45段文字', para: 45 }
    const bad = checkFables({ fables: [...pad(MIN_FABLES), base] }, { getChapter: getLong })
    expect(has(bad.errors, /part 应为 2/)).toBe(true)
    const fine = checkFables({ fables: [...pad(MIN_FABLES), { ...base, part: 2 }] }, { getChapter: getLong })
    expect(fine.errors).toEqual([])
  })
})
