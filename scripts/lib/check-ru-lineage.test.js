import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import check, { DATA_PATH } from './check-ru-lineage.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const clone = (x) => JSON.parse(JSON.stringify(x))
const DATA = readJson(path.join(ROOT, DATA_PATH))

// 与 check-data 注入的 chapterText 同义:该章 title + 全部 paragraphs.original 拼接
const books = {}
function chapterText(corpus, slug, ch) {
  const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
  if (!(f in books)) books[f] = fs.existsSync(f) ? readJson(f) : null
  const c = books[f]?.chapters.find((x) => x.no === ch)
  return c ? (c.title || '') + c.paragraphs.map((p) => p.original).join('') : null
}

// 用改过的数据跑闸:readJson 截住数据文件那一次读取
function run(mutate) {
  const data = clone(DATA)
  if (mutate) mutate(data)
  const errs = [], warns = [], infos = []
  check({
    ROOT, chapterText,
    readJson: (f) => (path.resolve(f) === path.join(ROOT, DATA_PATH) ? data : readJson(f)),
    err: (m) => errs.push(m), warn: (m) => warns.push(m), info: (m) => infos.push(m),
  })
  return { errs, warns, infos }
}
const edge = (d, from, to, type) => d.edges.find((e) => e.from === from && e.to === to && (!type || e.type === type))

describe('儒门学脉图 · 校验闸', () => {
  it('现行数据零错误零警告,报一行覆盖', () => {
    const { errs, warns, infos } = run()
    expect(errs).toEqual([])
    expect(warns).toEqual([])
    expect(infos).toHaveLength(1)
    expect(infos[0]).toMatch(/^儒门学脉图: \d+ 人 · \d+ 条关系\(师承 \d+ · 指摘 \d+ · 推许 \d+\)· \d+ 条引文 · 0 坏引文 · 存疑 \d+$/)
  })

  it('规格要点:五个时代、三个学派、十二人骨架齐全,每条边都有引文', () => {
    expect(DATA.eras.map((e) => e.key)).toEqual(['xianqin', 'han', 'beisong', 'nansong', 'ming'])
    expect(DATA.schools.map((s) => s.key).sort()).toEqual(['li', 'ru', 'xin'])
    const labels = new Set(DATA.nodes.map((n) => n.label))
    for (const who of ['孔子', '曾子', '子思', '孟子', '荀子', '董仲舒', '周敦颐', '程颢', '程颐', '朱熹', '陆九渊', '王守仁']) {
      expect(labels.has(who), who).toBe(true)
    }
    expect(DATA.edges.every((e) => e.cites.length > 0)).toBe(true)
    // 验收点:荀子 → 子思、孟子 两根线都挂《非十二子》原文;王守仁挂《传习录》
    for (const to of ['zisi', 'mengzi']) {
      expect(edge(DATA, 'xunzi', to, 'criticize').cites.some((c) => c.slug === 'xunzi' && c.ch === 6)).toBe(true)
    }
    expect(DATA.nodes.find((n) => n.id === 'wangshouren').book).toMatchObject({ corpus: 'xin', slug: 'chuanxilu' })
  })

  it('引文改一个字即报坏引文', () => {
    const { errs } = run((d) => { edge(d, 'xunzi', 'zisi').cites[0].quote += '也' })
    expect(errs.some((m) => m.includes('xunzi→zisi') && m.includes('引文非'))).toBe(true)
  })

  it('引文指错章(原文确有、但不在所指那一章)即报错——校验池收窄到该章', () => {
    const { errs } = run((d) => { edge(d, 'mengzi', 'kongzi').cites[0].ch = 4 })
    expect(errs.some((m) => m.includes('mengzi→kongzi') && m.includes('引文非'))).toBe(true)
  })

  it('无引文的边、存疑无说明、师承倒指、类型/时代/学派非法都拦下', () => {
    expect(run((d) => { edge(d, 'kongzi', 'yanhui').cites = [] }).errs.join()).toMatch(/一条引文都没有/)
    expect(run((d) => { delete edge(d, 'zengzi', 'zisi').note }).errs.join()).toMatch(/存疑却没有 note/)
    expect(run((d) => { d.edges.push({ ...clone(edge(d, 'zisi', 'mengzi')), from: 'wangshouren', to: 'kongzi' }) }).errs.join())
      .toMatch(/由前指向后/)
    expect(run((d) => { edge(d, 'kongzi', 'yanhui').type = 'debate' }).errs.join()).toMatch(/type 非法/)
    expect(run((d) => { d.nodes[0].era = 'tang' }).errs.join()).toMatch(/era 非法/)
    expect(run((d) => { d.nodes[0].school = 'dao' }).errs.join()).toMatch(/school 非法/)
    expect(run((d) => { edge(d, 'kongzi', 'yanhui').c = 'approx' }).errs.join()).toMatch(/c 只许 disputed/)
  })

  it('书目、人物志、争鸣席位须确有', () => {
    expect(run((d) => { d.nodes[0].book.slug = 'chunqiu' }).errs.join()).toMatch(/不在该组 texts\.json/)
    expect(run((d) => { d.nodes[0].renwu = 'nobody' }).errs.join()).toMatch(/人物志无此人/)
    expect(run((d) => { d.nodes[0].debateKey = 'nokey' }).errs.join()).toMatch(/争鸣里无此参辩家/)
  })

  it('id 重复、同格相叠、挤出时代带都拦下', () => {
    expect(run((d) => { d.nodes[1].id = d.nodes[0].id }).errs.join()).toMatch(/节点 id 有重复/)
    expect(run((d) => { d.nodes.find((n) => n.id === 'yanhui').dx = 20 }).errs.join()).toMatch(/同层相叠/)
    expect(run((d) => { d.nodes.find((n) => n.id === 'zisi').dx = -140 }).errs.join()).toMatch(/挤出了/)
  })
})
