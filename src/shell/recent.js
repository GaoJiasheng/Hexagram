import { bookBySlug, chapterHref } from '../features/reader/booksIndex.js'
import { getReadingProgress, getReadPos, getReadRecent } from '../features/yijing/storage.js'
import { SITE_MAP } from '../sites/registry.js'

// 「接着读」用的最近在读书目:先按研读统计的最近会话(readRecent,带时间)排,再补只有章级进度的旧足迹。
// 一书一条;章号取整数章(细粒度白话的「组-序」键不当章号用);能落到段的带上 ?seg=。
export function recentBooks(limit = 12) {
  const seen = new Set()
  const out = []
  const pos = getReadPos()
  const push = (slug, ch, t) => {
    if (!slug || seen.has(slug)) return
    const book = bookBySlug(slug)
    const no = Number.parseInt(ch, 10)
    if (!book || !(no > 0)) return
    seen.add(slug)
    const p = pos[slug]
    const seg = !book.singlePage && p && Number(p.ch) === no && p.seg > 0 ? p.seg : 0
    out.push({
      book, ch: no, seg, t: t || null,
      href: `${chapterHref(book, no)}${seg ? `?seg=${seg}` : ''}`,
      site: (SITE_MAP[book.corpus]?.portalTitle || '').replace(/(研读|研习)$/, ''),
    })
  }
  for (const r of getReadRecent()) push(r?.slug, r?.ch, r?.t)
  for (const [slug, ch] of Object.entries(getReadingProgress())) push(slug, ch, null)
  return out.slice(0, limit)
}

export function agoLabel(t, now = Date.now()) {
  if (!t) return ''
  const d = Math.floor((now - t) / 86400000)
  if (d <= 0) return '今天'
  if (d === 1) return '昨天'
  if (d < 30) return `${d} 天前`
  return `${Math.floor(d / 30)} 个月前`
}

// 今日一句:与名句集页同一套确定性做法(日期 hash),同一天刷新不变
export function pickDaily(list, date = new Date()) {
  const k = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let h = 0
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0
  return list[h % list.length]
}
