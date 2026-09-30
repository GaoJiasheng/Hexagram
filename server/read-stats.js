// 研读统计的服务端同构算法(docs/reading-stats-plan.md §7.3):把 user_data 里的 readDays
//(`day|corpus|slug|ch|dev → {sec, n, at}`)按 今天 / 7 天 / 30 天 / 历史 四窗聚合。
// 不碰书名(书名由客户端 booksIndex 取),只算数;与 src/features/reading/readStats.js 口径一致。
// today 由客户端传本地日期(YYYY-MM-DD),服务端只拿它算窗口边界;缺省取 UTC 今天。

const DAY_MS = 86_400_000

export function isDayString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function dayMinus(day, n) {
  const t = Date.parse(`${day}T00:00:00Z`) - n * DAY_MS
  return new Date(t).toISOString().slice(0, 10)
}

export function windowStarts(today) {
  return { today, d7: dayMinus(today, 6), d30: dayMinus(today, 29), all: '0000-00-00' }
}

function isRecordMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// → { sec:{today,d7,d30,all}, n:{…}, lastDay, days, top:[{corpus,slug,sec}] (历史,前 5) }
export function summarizeReadDays(days, today, { topLimit = 5 } = {}) {
  const since = windowStarts(today)
  const ids = Object.keys(since)
  const sec = Object.fromEntries(ids.map((id) => [id, 0]))
  const n = Object.fromEntries(ids.map((id) => [id, 0]))
  const byBook = new Map()
  const daySet = new Set()
  let lastDay = null
  if (isRecordMap(days)) {
    for (const [k, e] of Object.entries(days)) {
      const [day, corpus, slug] = k.split('|')
      if (!isDayString(day) || !isRecordMap(e)) continue
      if (day > today) continue
      const s = Number(e.sec) || 0
      const c = Number(e.n) || 0
      if (s <= 0 && c <= 0) continue
      daySet.add(day)
      if (!lastDay || day > lastDay) lastDay = day
      for (const id of ids) {
        if (day < since[id]) continue
        sec[id] += s
        n[id] += c
      }
      if (corpus && slug) {
        const bk = `${corpus}/${slug}`
        byBook.set(bk, (byBook.get(bk) || 0) + s)
      }
    }
  }
  const top = [...byBook.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([bk, s]) => { const i = bk.indexOf('/'); return { corpus: bk.slice(0, i), slug: bk.slice(i + 1), sec: s } })
  return { sec, n, lastDay, days: daySet.size, top }
}

// 停留分布五档(分钟):<1 / 1–5 / 5–15 / 15–30 / >30
export const DWELL_BUCKETS = [
  { id: 'lt1', label: '< 1 分', max: 60_000 },
  { id: 'm1_5', label: '1–5 分', max: 300_000 },
  { id: 'm5_15', label: '5–15 分', max: 900_000 },
  { id: 'm15_30', label: '15–30 分', max: 1_800_000 },
  { id: 'gt30', label: '> 30 分', max: Infinity },
]

export function dwellHistogram(dwells) {
  const counts = DWELL_BUCKETS.map((b) => ({ id: b.id, label: b.label, count: 0 }))
  for (const raw of dwells) {
    const ms = Number(raw)
    if (!Number.isFinite(ms) || ms < 0) continue
    const i = DWELL_BUCKETS.findIndex((b) => ms < b.max)
    counts[i >= 0 ? i : counts.length - 1].count += 1
  }
  return counts
}

export function median(values) {
  const arr = values.map(Number).filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  if (arr.length === 0) return 0
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}
