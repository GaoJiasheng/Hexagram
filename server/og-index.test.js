// 这份分片规则有两个消费方(边缘中间件的分享卡、评论通知邮件的标题),
// 而它的失败方式是**静默的** —— 哈希对不上就查不到,没有报错,只是标题悄悄
// 退回机器味的 corpus/slug/章号,或者分享卡悄悄消失。
// 所以这里拿磁盘上的**真实产物**跑,而不是手写假索引验出「假的通过」。

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { lookupPageTitle, stripSiteSuffix, ogShardKey, normPath } from './og-index.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const OG_DIR = path.join(ROOT, 'public/content/og')

const env = {
  ASSETS: {
    fetch: async (url) => {
      const file = path.join(ROOT, 'public', new URL(url).pathname)
      if (!fs.existsSync(file)) return new Response('', { status: 404 })
      return new Response(fs.readFileSync(file, 'utf8'), { status: 200 })
    },
  },
}

describe('逐页标题查询', () => {
  beforeAll(() => {
    if (!fs.existsSync(OG_DIR)) throw new Error('先跑 npm run content:build')
  })

  it.each([
    ['/dao/daodejing/1', '道德经 · 一章'],
    ['/ru/lunyu/1', '论语 · 学而第一'],
    ['/hexagram/1', '乾为天 第1卦'],
    ['/fo/xinjing', '心经'],
  ])('%s -> %s', async (p, expected) => {
    expect(await lookupPageTitle(env, p)).toBe(expected)
  })

  it('末尾斜杠也要命中(否则同一页查不到)', async () => {
    expect(await lookupPageTitle(env, '/ru/lunyu/1/')).toBe('论语 · 学而第一')
  })

  it('查不到就返回 null,让调用方退回机器味写法', async () => {
    expect(await lookupPageTitle(env, '/ru/lunyu/99999')).toBeNull()
    expect(await lookupPageTitle(env, '/books/anything')).toBeNull()  // 观书不入索引
  })

  it('**没有 ASSETS 绑定、或读取抛异常,都只返回 null** —— 绝不能拖累发信', async () => {
    expect(await lookupPageTitle({}, '/ru/lunyu/1')).toBeNull()
    expect(await lookupPageTitle(
      { ASSETS: { fetch: async () => { throw new Error('boom') } } }, '/ru/lunyu/1',
    )).toBeNull()
  })

  it('站名后缀只去最后一段,书名里本来就有的「·」不受影响', () => {
    expect(stripSiteSuffix('道德经 · 一章 · 道藏研读')).toBe('道德经 · 一章')
    expect(stripSiteSuffix('黄帝内经·素问 · 上古天真论 · 中医典籍')).toBe('黄帝内经·素问 · 上古天真论')
    expect(stripSiteSuffix('心经 · 释典研读')).toBe('心经')
    expect(stripSiteSuffix('无后缀')).toBe('无后缀')
  })

  it('分片键落在 0..255,且对同一路径稳定', () => {
    const k = ogShardKey(normPath('/ru/lunyu/1'))
    expect(k).toBeGreaterThanOrEqual(0)
    expect(k).toBeLessThan(256)
    expect(ogShardKey(normPath('/ru/lunyu/1/'))).toBe(k)
  })
})
