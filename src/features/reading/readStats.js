// 研读统计的算法层(docs/reading-stats-plan.md §7.1):从本机 readDays(日 × 章 × 设备 → 秒/次)与 readRecent(最近会话)
// 算 今天 / 7 天 / 30 天 / 历史 四窗,每窗 总秒数 · 次数 · 平均每次 · 读过几部几章 · 常读的书;外加近一年逐日热力与「最近看过」。
// 纯函数,不碰 localStorage;页面与设置浮层、各组 /me、管理员按用户视图共用同一套算法(服务端那份是同构的 JS)。
import { bookBySlug, chapterHref } from '../reader/booksIndex.js'
import { CLASSICS_META } from '../yijing/data.js'

export const WINDOWS = [['today', '今天', 1], ['d7', '近 7 天', 7], ['d30', '近 30 天', 30], ['all', '历史', Infinity]]

export function localDay(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dayMinus(ms, n) { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime() }

// readDays 键:day|corpus|slug|ch|dev
export function parseKey(k) {
  const [day, corpus, slug, ch] = k.split('|')
  return { day, corpus: corpus || null, slug: slug || null, ch: ch || null }
}

export function bookLabel(corpus, slug) {
  if (!corpus || !slug) return { title: '（非阅读页）', href: null, unit: '章' }
  if (corpus === 'yijing') {
    if (slug === 'hexagrams') return { title: '易经 · 六十四卦', href: '/hexagrams', unit: '卦', chHref: (ch) => `/hexagram/${ch}` }
    const m = CLASSICS_META.find((x) => x.key === slug)
    return { title: `易经 · ${m?.title || slug}`, href: `/classics/${slug}/1`, unit: '章', chHref: (ch) => `/classics/${slug}/${ch}` }
  }
  const b = bookBySlug(slug)
  if (!b) return { title: slug, href: `/${corpus}/${slug}`, unit: '章', chHref: (ch) => `/${corpus}/${slug}/${ch}` }
  return { title: b.title, href: b.href, unit: b.sectionUnit || '章', chHref: (ch) => chapterHref(b, ch) }
}

export function fmtSec(sec) {
  const s = Math.round(sec || 0)
  if (s < 60) return `${s} 秒`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h} 小时 ${r} 分` : `${h} 小时`
}

export function computeStats(days = {}, recent = [], { now = Date.now(), corpus = null } = {}) {
  const today = localDay(now)
  const since = { today: localDay(dayMinus(now, 0)), d7: localDay(dayMinus(now, 6)), d30: localDay(dayMinus(now, 29)), all: '0000-00-00' }
  const win = {}
  for (const [id] of WINDOWS) win[id] = { sec: 0, n: 0, books: new Map(), chapters: new Set(), byBook: new Map() }
  const heatMap = new Map()
  for (const [k, e] of Object.entries(days)) {
    const p = parseKey(k)
    if (!p.day || !e) continue
    if (corpus && p.corpus !== corpus) continue
    const sec = Number(e.sec) || 0, n = Number(e.n) || 0
    if (p.day <= today) heatMap.set(p.day, (heatMap.get(p.day) || 0) + sec)
    for (const [id] of WINDOWS) {
      if (p.day < since[id]) continue
      const w = win[id]
      w.sec += sec; w.n += n
      if (p.corpus && p.slug) {
        const bk = `${p.corpus}/${p.slug}`
        w.byBook.set(bk, (w.byBook.get(bk) || 0) + sec)
        if (p.ch) w.chapters.add(`${bk}/${p.ch}`)
      }
    }
  }
  const windows = {}
  for (const [id, label] of WINDOWS) {
    const w = win[id]
    const top = [...w.byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([bk, sec]) => {
      const [c, s] = bk.split('/'); const lb = bookLabel(c, s)
      return { corpus: c, slug: s, sec, title: lb.title, href: lb.href }
    })
    windows[id] = { id, label, sec: w.sec, n: w.n, avg: w.n ? w.sec / w.n : 0, books: w.byBook.size, chapters: w.chapters.size, top }
  }
  const heat = []
  for (let i = 364; i >= 0; i--) { const d = localDay(dayMinus(now, i)); heat.push({ day: d, sec: heatMap.get(d) || 0 }) }
  const recentRows = (Array.isArray(recent) ? recent : [])
    .filter((r) => r && (!corpus || r.corpus === corpus))
    .slice(0, 60)
    .map((r) => {
      const lb = bookLabel(r.corpus, r.slug)
      return { id: r.id, t: r.t, sec: r.sec || 0, title: lb.title, unit: lb.unit, ch: r.ch, href: r.ch && lb.chHref ? lb.chHref(r.ch) : lb.href }
    })
  return { windows, heat, recent: recentRows }
}
