import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import check, { validateZhanguoceMap, STATE_IDS, YEAR_MIN, YEAR_MAX } from './check-zhanguoce-map.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const data = readJson(path.join(ROOT, 'src/data/zong/zhanguoce-map.json'))
const clone = (x) => JSON.parse(JSON.stringify(x))

// 与 check-data 约定同形:章题 + 全部 paragraphs.original 拼接;不存在返回 null
const books = {}
function chapterText(corpus, slug, ch) {
  const k = `${corpus}/${slug}`
  if (!(k in books)) {
    const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
    books[k] = fs.existsSync(f) ? readJson(f) : null
  }
  const c = books[k]?.chapters.find((x) => x.no === Number(ch))
  return c ? c.title + c.paragraphs.map((p) => p.original).join('') : null
}
const run = (d) => validateZhanguoceMap(d, chapterText)
const piece = (d, ch) => d.pieces.find((p) => p.ch === ch)

describe('战国策七国图 · 校验闸', () => {
  it('现行数据零错误、零警告,报一行覆盖', () => {
    const { errors, warnings, stats } = run(data)
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(stats.pieces).toBe(18)
    expect(stats.states).toBe(8)
    const errs = [], infos = []
    check({ ROOT, readJson, chapterText, err: (m) => errs.push(m), warn: () => {}, info: (m) => infos.push(m) })
    expect(errs).toEqual([])
    expect(infos).toHaveLength(1)
    expect(infos[0]).toMatch(/^战国策七国图: 18 篇/)
  })

  it('18 篇各一条,国只取七国 + 周,年代都在战国范围内', () => {
    expect(data.pieces.map((p) => p.ch).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    expect(data.states.map((s) => s.id).sort()).toEqual([...STATE_IDS].sort())
    for (const p of data.pieces) {
      expect(p.from).toBeGreaterThanOrEqual(YEAR_MIN)
      expect(p.to).toBeLessThanOrEqual(YEAR_MAX)
      expect(p.from).toBeLessThanOrEqual(p.to)
    }
  })

  it('缺一篇即报错', () => {
    const d = clone(data)
    d.pieces = d.pieces.filter((p) => p.ch !== 7)
    expect(run(d).errors.join('\n')).toMatch(/缺第 7 篇/)
  })

  it('年代出了战国范围即报错', () => {
    const d = clone(data)
    piece(d, 18).to = -210
    expect(run(d).errors.join('\n')).toMatch(/超出战国范围/)
    const d2 = clone(data)
    piece(d2, 3).from = -480
    expect(run(d2).errors.join('\n')).toMatch(/超出战国范围/)
  })

  it('from 晚于 to 即报错', () => {
    const d = clone(data)
    Object.assign(piece(d, 16), { from: -330, to: -340 })
    expect(run(d).errors.join('\n')).toMatch(/晚于 to/)
  })

  it('kw 不在该篇原文里即报错(凭记忆指章的那一类)', () => {
    const d = clone(data)
    piece(d, 15).kw = '苏秦'          // 鹬蚌相争里说话的是苏代
    expect(run(d).errors.join('\n')).toMatch(/第 15 篇: kw「苏秦」不在该篇原文里/)
  })

  it('states 里有未知国或篇中无字面依据即报错', () => {
    const d = clone(data)
    piece(d, 16).states = ['chu', 'song']
    expect(run(d).errors.join('\n')).toMatch(/未知国「song」/)
    const d2 = clone(data)
    piece(d2, 3).states = ['qi', 'qin']   // 邹忌讽齐王里没有「秦」字
    expect(run(d2).errors.join('\n')).toMatch(/找不到秦国的字样/)
    const d3 = clone(data)
    delete piece(d3, 12).via             // 唐雎说信陵君不出「魏」字,靠 via 信陵君
    expect(run(d3).errors.join('\n')).toMatch(/第 12 篇: 原文里找不到魏国的字样/)
  })

  it('note 里「」括的不是该篇原文即报错', () => {
    const d = clone(data)
    piece(d, 6).note += '另见「赵太后新用事」。'   // 这句在第七篇,不在第六篇
    expect(run(d).errors.join('\n')).toMatch(/第 6 篇: note 里「赵太后新用事」不是该篇原文的子串/)
  })

  it('disputed 不许给数字 label、不许窄区间;approx 的 label 须带「约」', () => {
    const d = clone(data)
    piece(d, 1).label = '约前 330 年'
    expect(run(d).errors.join('\n')).toMatch(/disputed 的 label 不给数字/)
    const d2 = clone(data)
    Object.assign(piece(d2, 5), { from: -300, to: -295 })
    expect(run(d2).errors.join('\n')).toMatch(/disputed 须给宽区间/)
    const d3 = clone(data)
    piece(d3, 7).label = '前 265 年'
    expect(run(d3).errors.join('\n')).toMatch(/approx 的 label 须带「约」/)
    const d4 = clone(data)
    piece(d4, 7).c = 'sure'
    expect(run(d4).errors.join('\n')).toMatch(/c 只许 approx \| disputed/)
  })

  it('地名挂到原文里没有它的篇即报错,漏挂则警告', () => {
    const d = clone(data)
    d.places.find((p) => p.id === 'handan').chs = [8, 12, 3]
    expect(run(d).errors.join('\n')).toMatch(/地名 邯郸: 第 3 篇原文里没有「邯郸」/)
    const d2 = clone(data)
    d2.places.find((p) => p.id === 'handan').chs = [8]
    expect(run(d2).warnings.join('\n')).toMatch(/第 12 篇原文也有「邯郸」/)
  })

  it('合纵 / 连横引文与《五蠹》界定逐字回查', () => {
    const d = clone(data)
    d.axes[0].cites[0].quote = '合纵以抗强秦'
    expect(run(d).errors.join('\n')).toMatch(/「合纵以抗强秦」不是第 1 篇原文的子串/)
    const d2 = clone(data)
    d2.def.quote = '从者，合众弱以攻一强也；衡者，事一强以攻众弱也'
    expect(run(d2).errors.join('\n')).toMatch(/界定引文/)
  })

  it('我方文字出现教程口吻即报错(纵横红线)', () => {
    const d = clone(data)
    piece(d, 7).caveat = '可作职场沟通的范本。'
    expect(run(d).errors.join('\n')).toMatch(/教程口吻/)
  })

  it('坐标出画布即报错', () => {
    const d = clone(data)
    d.states.find((s) => s.id === 'qi').x = d.view.w + 10
    expect(run(d).errors.join('\n')).toMatch(/国 qi 坐标不在画布内/)
  })
})
