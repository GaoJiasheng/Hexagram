import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import check, { validateMoonData } from './check-cantongqi-moon.mjs'
import { buildHexagramIndex } from './hexagram-table.mjs'
import { getNajia } from '../../src/features/yijing/engine/najia.js'
import { GAN } from '../../src/features/shared/ganzhi/index.js'

// 参同契月相纳甲盘:数据逐句回查 + 卦序对表 + 与易经纳甲引擎互校(design-v24 §3)。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const data = readJson(path.join(ROOT, 'src/data/dao/cantongqi-moon.json'))
const book = readJson(path.join(ROOT, 'src/data/dao/classics/cantongqi.json'))
const HEX = buildHexagramIndex()

// 与 check-data 的 ctx.chapterText 同形:章题 + 全部段落原文
const chapterText = (corpus, slug, ch) => {
  if (corpus !== 'dao' || slug !== 'cantongqi') return null
  const c = book.chapters.find((x) => x.no === ch)
  return c ? c.title + c.paragraphs.map((p) => p.original).join('') : null
}
const chapterTitle = (slug, ch) => (slug === 'cantongqi' ? book.chapters.find((c) => c.no === ch)?.title ?? null : null)
const run = (d) => validateMoonData(d, { chapterText, chapterTitle })
const clone = () => JSON.parse(JSON.stringify(data))

// 数据里所有带 quote 的条目
function allQuotes(d) {
  const out = []
  for (const p of d.phases) out.push(p, p.echo, p.yao)
  out.push(...d.center, d.centerNote)
  for (const j of d.junctions) { out.push(j); if (j.also) out.push(j.also) }
  return out
}

describe('参同契月相纳甲盘 · 真数据', () => {
  it('闸全过,无软警告', () => {
    const r = run(data)
    expect(r.errors).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.stats.quotes).toBe(allQuotes(data).length)
    expect(r.stats.bridges).toBe(8)
  })

  it('每一句 quote 都是所指章的原文精确子串(只看段落原文,不借章题)', () => {
    for (const q of allQuotes(data)) {
      const c = book.chapters.find((x) => x.no === q.ch)
      expect(c, `第 ${q.ch} 章`).toBeTruthy()
      expect(c.paragraphs.map((p) => p.original).join('')).toContain(q.quote)
    }
  })

  it('六相出自第四章、对读出自第十八章、坎离出自第二章', () => {
    expect(data.phases.map((p) => p.ch)).toEqual([4, 4, 4, 4, 4, 4])
    expect(data.phases.map((p) => p.echo.ch)).toEqual([18, 18, 18, 18, 18, 18])
    expect(data.center.map((c) => c.ch)).toEqual([2, 2])
  })

  it('hex 与卦序表对得上,且都是八纯卦', () => {
    const want = { 震: 51, 兑: 58, 乾: 1, 巽: 57, 艮: 52, 坤: 2, 坎: 29, 离: 30 }
    for (const o of [...data.phases, ...data.center]) {
      expect(o.hex, o.name).toBe(want[o.name])
      const h = HEX[o.hex - 1]
      expect(h.name).toBe(o.name)
      expect(h.upperTrigram).toBe(h.lowerTrigram)
    }
    expect(data.phases.map((p) => p.name).join('')).toBe('震兑乾巽艮坤')
    expect(data.phases.map((p) => p.day)).toEqual([3, 8, 15, 16, 23, 30])
  })

  it('纳甲干与易经纳甲引擎(京房)一致:内卦干 = 月相之干;乾外壬、坤外癸 = 朔的壬癸', () => {
    for (const o of [...data.phases, ...data.center]) {
      expect(getNajia(HEX[o.hex - 1].binary)[0].gan, o.name).toBe(o.gan)
    }
    const shuo = data.junctions.find((j) => j.key === 'shuo')
    expect(shuo.gan).toEqual([getNajia('111111')[5].gan, getNajia('000000')[5].gan])
  })

  it('十干恰好分完:六相 + 坎离 + 朔,各一次', () => {
    const shuo = data.junctions.find((j) => j.key === 'shuo')
    const all = [...data.phases.map((p) => p.gan), ...data.center.map((c) => c.gan), ...shuo.gan]
    expect([...all].sort()).toEqual([...GAN].sort())
  })
})

describe('参同契月相纳甲盘 · 闸能逮住错', () => {
  it('引文改一个字 → 报非子串', () => {
    const d = clone()
    d.phases[0].quote = '三日出为爽，震庚受东方'
    expect(run(d).errors.some((m) => m.includes('不是第 4 章原文子串'))).toBe(true)
  })

  it('卦序填错 → 报卦名不符', () => {
    const d = clone()
    d.phases[2].hex = 2
    expect(run(d).errors.some((m) => m.includes('第 2 卦是「坤」'))).toBe(true)
  })

  it('方位与天干五方不一致 → 报错', () => {
    const d = clone()
    d.phases[1].dir = '西'
    expect(run(d).errors.some((m) => m.includes('丁 属南方'))).toBe(true)
  })

  it('dirFrom=text 而原句无方位字 → 报错', () => {
    const d = clone()
    d.phases[1].dirFrom = 'text'
    expect(run(d).errors.some((m) => m.includes('dirFrom=text'))).toBe(true)
  })

  it('坎离纳干改成他干 → 十干分不完', () => {
    const d = clone()
    d.center[0].gan = '甲'
    const errs = run(d).errors
    expect(errs.some((m) => m.includes('十干须恰好分完'))).toBe(true)
    expect(errs.some((m) => m.includes('不能居中'))).toBe(true)
  })

  it('对读爻题错位 → 报错', () => {
    const d = clone()
    ;[d.phases[0].yao, d.phases[1].yao] = [d.phases[1].yao, d.phases[0].yao]
    expect(run(d).errors.some((m) => m.includes('应对「初九」'))).toBe(true)
  })

  it('我方文字带断语/工法字 → 报错', () => {
    const d = clone()
    d.phases[3].note = '此时进火最吉。'
    expect(run(d).errors.some((m) => m.includes('红线字'))).toBe(true)
  })

  it('章题写错 → 报错', () => {
    const d = clone()
    d.chapters['4'] = '圣人上观章'
    expect(run(d).errors.some((m) => m.includes('chapters[4]'))).toBe(true)
  })

  it('缺合符格 → 报错', () => {
    const d = clone()
    d.junctions = d.junctions.filter((j) => j.key !== 'hefu')
    expect(run(d).errors.some((m) => m.includes('hefu'))).toBe(true)
  })
})

describe('check(ctx) 默认导出(check-data 调用形)', () => {
  it('真数据:零 err、零 warn、一行 info', () => {
    const errs = [], warns = [], infos = []
    check({ ROOT, err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m), readJson, chapterText })
    expect(errs).toEqual([])
    expect(warns).toEqual([])
    expect(infos).toHaveLength(1)
    expect(infos[0]).toMatch(/参同契月相纳甲盘/)
  })
})
