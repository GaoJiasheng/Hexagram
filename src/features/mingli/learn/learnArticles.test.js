import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { LEARN_TOPICS } from './mingliLearnTopics.js'
import { validateWidget } from '../../shared/widgets/schema.js'

// 学堂六篇是数据(src/data/mingli/learn/*.json),这里是它们的机器闸门(design-v23 §8-2)。
// 机器只管得了结构与红线用语;**事实对不对只能人读**——文中凡可计算的断言,写的时候已用引擎算过。
const DIR = path.resolve(import.meta.dirname, '../../../data/mingli/learn')
const BLOCK_TYPES = new Set(['lead', 'h2', 'p', 'quote', 'list', 'callout', 'table', 'pull', 'steps', 'widget', 'figure'])
const load = (key) => JSON.parse(fs.readFileSync(path.join(DIR, `${key}.json`), 'utf8'))
const textOf = (b) => [b.text, b.caption, ...(b.items || []).map((x) => (typeof x === 'string' ? x : `${x.title || ''}${x.text || ''}`)), ...(b.rows || []).flat(), ...(b.head || [])].filter(Boolean).join('')

// 铁律「研习不断命」:学堂不许出现教人套用、替人断命的话。
const REDLINE = /你的命|你的八字|测一测|算一算你|可据此判断|预测你|你会在|你将会|适合你的|旺你|克你/

describe('观数学堂六篇', () => {
  it('注册表里的每一篇都有正文,且没有多出来的文件', () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
    expect(files).toEqual(LEARN_TOPICS.map((t) => t.key).sort())
  })

  for (const { key } of LEARN_TOPICS) {
    describe(key, () => {
      const a = load(key)
      it('骨架齐:标题、中心思想、正文块、小测', () => {
        expect(a.key).toBe(key)
        expect(a.title && a.centralIdea).toBeTruthy()
        expect(a.blocks.length).toBeGreaterThan(8)
        expect(a.blocks[0].type).toBe('lead')
        expect(a.quiz.length).toBeGreaterThanOrEqual(3)
      })
      it('块型合法;pull 至多一处;callout 有内容且标签不超 12 字', () => {
        for (const b of a.blocks) expect(BLOCK_TYPES.has(b.type), `未知块型 ${b.type}`).toBe(true)
        expect(a.blocks.filter((b) => b.type === 'pull').length).toBeLessThanOrEqual(1)
        for (const b of a.blocks.filter((x) => x.type === 'callout')) {
          expect(['note', 'warn', 'mute']).toContain(b.tone)
          expect(b.items?.length).toBeGreaterThan(0)
          if (b.label) expect([...b.label].length).toBeLessThanOrEqual(12)
        }
      })
      it('每篇至少一个交互件,且 widget 参数全部合法', () => {
        const ws = a.blocks.filter((b) => b.type === 'widget')
        expect(ws.length).toBeGreaterThanOrEqual(1)
        for (const w of ws) expect(validateWidget(w), JSON.stringify(w)).toEqual([])
      })
      it('小测:答案下标在选项之内,每题有讲解', () => {
        for (const q of a.quiz) {
          expect(q.options.length).toBeGreaterThanOrEqual(3)
          expect(q.answer).toBeGreaterThanOrEqual(0)
          expect(q.answer).toBeLessThan(q.options.length)
          expect(q.explain).toBeTruthy()
        }
      })
      it('守铁律:无套用指引、无替人断命的话', () => {
        const all = [a.centralIdea, ...a.blocks.map(textOf), ...a.quiz.flatMap((q) => [q.q, q.explain, ...q.options])].join('\n')
        expect(all).not.toMatch(REDLINE)
      })
    })
  }
})
