import { describe, expect, it } from 'vitest'
import { summarizeReadDays, dwellHistogram, median, windowStarts } from './read-stats.js'

describe('summarizeReadDays', () => {
  it('四窗累加、跨设备键相加、未来日期与坏键忽略', () => {
    const days = {
      '2026-10-01|ru|lunyu|1|a': { sec: 600, n: 2, at: 'x' },
      '2026-10-01|ru|lunyu|1|b': { sec: 60, n: 1, at: 'x' },
      '2026-09-28|guwen|guwenguanzhi|113|a': { sec: 900, n: 1, at: 'x' },
      '2026-09-05|dao|daodejing|1|a': { sec: 300, n: 1, at: 'x' },
      '2026-05-01|ru|lunyu|2|a': { sec: 1200, n: 3, at: 'x' },
      '2026-10-09|ru|lunyu|2|a': { sec: 999, n: 9, at: 'x' },     // 未来(时钟错):不计
      'garbage': { sec: 5, n: 1 },
      '2026-10-01||||a': 'not-an-object',
    }
    const s = summarizeReadDays(days, '2026-10-01')
    expect(s.sec).toEqual({ today: 660, d7: 1560, d30: 1860, all: 3060 })
    expect(s.n).toEqual({ today: 3, d7: 4, d30: 5, all: 8 })
    expect(s.lastDay).toBe('2026-10-01')
    expect(s.days).toBe(4)
    expect(s.top[0]).toEqual({ corpus: 'ru', slug: 'lunyu', sec: 1860 })
  })
  it('空值安全', () => {
    expect(summarizeReadDays(null, '2026-10-01').sec.all).toBe(0)
    expect(summarizeReadDays([], '2026-10-01').lastDay).toBeNull()
  })
  it('窗口边界', () => {
    expect(windowStarts('2026-10-01')).toEqual({ today: '2026-10-01', d7: '2026-09-25', d30: '2026-09-02', all: '0000-00-00' })
  })
})

describe('dwellHistogram / median', () => {
  it('五档分箱', () => {
    const h = dwellHistogram([30_000, 60_000, 299_999, 300_000, 1_000_000, 1_800_000, 5_000_000, -1, 'x'])
    expect(h.map((b) => b.count)).toEqual([1, 2, 1, 1, 2])
  })
  it('中位数', () => {
    expect(median([])).toBe(0)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})
