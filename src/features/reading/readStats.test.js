import { describe, expect, it } from 'vitest'
import { advance, takeDelta, newSession, CAP_SEC, IDLE_MS } from './readClock.js'
import { computeStats, localDay } from './readStats.js'

describe('readClock 纯函数', () => {
  it('60 秒内有操作才累加,超过即暂停;单次封顶 1800 秒', () => {
    const s = newSession({ path: '/ru/lunyu/1', corpus: 'ru', slug: 'lunyu', chapter: '1' }, 0)
    advance(s, 5_000); expect(s.sec).toBeCloseTo(5)
    s.lastActivity = 0; advance(s, IDLE_MS + 30_000)           // 空闲超过 60 秒:这一段不算
    expect(s.sec).toBeCloseTo(5)
    s.lastActivity = IDLE_MS + 30_000; advance(s, IDLE_MS + 35_000); expect(s.sec).toBeCloseTo(10)
    s.sec = CAP_SEC - 1; s.lastActivity = s.lastTick; advance(s, s.lastTick + 60_000); expect(s.sec).toBe(CAP_SEC)
  })
  it('takeDelta:部分满 300 秒才交,最终至少 5 秒;交过部分的最终即使 0 秒也交', () => {
    const s = newSession({ path: '/p', corpus: 'ru', slug: 'lunyu', chapter: '1' }, 0)
    s.sec = 100
    expect(takeDelta(s, true)).toBeNull()
    s.sec = 320
    expect(takeDelta(s, true)).toMatchObject({ sec: 320, partial: true })
    expect(takeDelta(s, false)).toMatchObject({ sec: 0, partial: false })   // 已交过部分,结清时仍交(次数 +1)
    const t = newSession({ path: '/p' }, 0); t.sec = 3
    expect(takeDelta(t, false)).toBeNull()
  })
})

describe('computeStats 四窗', () => {
  const now = new Date(2026, 9, 1, 12).getTime()   // 2026-10-01 本地
  const day = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return localDay(d.getTime()) }
  const days = {
    [`${day(0)}|ru|lunyu|1|dev1`]: { sec: 600, n: 2, at: 'x' },
    [`${day(0)}|ru|lunyu|1|dev2`]: { sec: 60, n: 1, at: 'x' },   // 另一台设备,同日同章:相加
    [`${day(3)}|guwen|guwenguanzhi|113|dev1`]: { sec: 900, n: 1, at: 'x' },
    [`${day(20)}|dao|daodejing|1|dev1`]: { sec: 300, n: 1, at: 'x' },
    [`${day(100)}|ru|lunyu|2|dev1`]: { sec: 1200, n: 3, at: 'x' },
    [`${day(0)}||||dev1`]: { sec: 30, n: 1, at: 'x' },            // 首页/门户:只计总时长,不计书
  }
  const st = computeStats(days, [{ id: 'a', t: now, corpus: 'ru', slug: 'lunyu', ch: '1', sec: 600 }], { now })
  it('窗口累加与去重', () => {
    expect(st.windows.today.sec).toBe(690); expect(st.windows.today.n).toBe(4); expect(st.windows.today.books).toBe(1); expect(st.windows.today.chapters).toBe(1)
    expect(st.windows.d7.sec).toBe(1590); expect(st.windows.d30.sec).toBe(1890); expect(st.windows.all.sec).toBe(3090)
    expect(st.windows.all.chapters).toBe(4); expect(st.windows.all.books).toBe(3)
    expect(st.windows.all.top[0]).toMatchObject({ slug: 'lunyu', sec: 1860 })
  })
  it('热力 365 天、最近列表带书名与链接', () => {
    expect(st.heat).toHaveLength(365); expect(st.heat[364].sec).toBe(690); expect(st.heat[361].sec).toBe(900)
    expect(st.recent[0]).toMatchObject({ title: '论语', href: '/ru/lunyu/1', unit: '篇' })
  })
  it('按组切片', () => {
    const g = computeStats(days, [], { now, corpus: 'guwen' })
    expect(g.windows.all.sec).toBe(900); expect(g.windows.today.sec).toBe(0)
  })
})
