const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

const GROUP_CAP = 10
const KIND_ORDER = ['页面', '经典', '来路', '导读', '易经', '正文', '白话', '注疏', '专题']

let indexPromise = null
let records = []
let shardPath = '/content/search/shards/{key}.json'
const shardCache = new Map()

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function compactSearch(s) {
  return normalize(s).replace(/\s+/g, '')
}

function shardKey(token) {
  let h = 2166136261
  for (const ch of token) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h & 127).toString(16).padStart(2, '0')
}

function queryTokens(query) {
  const chars = [...compactSearch(query)]
  const tokens = []
  for (let i = 0; i < chars.length - 1; i += 1) {
    const token = `${chars[i]}${chars[i + 1]}`
    if (token.trim().length >= 2) tokens.push(token)
  }
  return [...new Set(tokens)]
}

async function loadShard(key) {
  if (!shardCache.has(key)) {
    const path = shardPath.replace('{key}', key)
    shardCache.set(
      key,
      fetch(urlFor(path))
        .then((r) => (r.ok ? r.json() : { tokens: {} }))
        .then((data) => data.tokens || {})
        .catch(() => ({})),
    )
  }
  return shardCache.get(key)
}

export async function ensureGlobalSearchIndexed() {
  if (!indexPromise) {
    indexPromise = fetch(urlFor('/content/search/index.json'))
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((data) => {
        records = Array.isArray(data.records) ? data.records : []
        shardPath = data.shardPath || shardPath
        return records
      })
      .catch(() => {
        records = []
        return records
      })
  }
  return indexPromise
}

function titleRank(record, q) {
  const title = normalize(record.title)
  const subtitle = normalize(record.subtitle)
  const siteTitle = normalize(record.siteTitle)
  if (title.includes(q)) return 0
  if (subtitle.includes(q)) return 1
  if (siteTitle.includes(q)) return 2
  return -1
}

async function fullTextCandidateIds(query) {
  const tokens = queryTokens(query)
  if (!tokens.length) return new Set()

  const tokenLists = await Promise.all(tokens.map(async (token) => {
    const shard = await loadShard(shardKey(token))
    return shard[token] || []
  }))
  if (tokenLists.some((list) => !list.length)) return new Set()

  tokenLists.sort((a, b) => a.length - b.length)
  const result = new Set(tokenLists[0])
  for (const list of tokenLists.slice(1)) {
    const next = new Set(list)
    for (const id of [...result]) {
      if (!next.has(id)) result.delete(id)
    }
  }
  return result
}

export async function searchGlobal(query) {
  await ensureGlobalSearchIndexed()
  const q = normalize(query)
  if (!q || !records.length) return []

  const hits = new Map()
  records.forEach((r, index) => {
    const score = titleRank(r, q)
    if (score === -1) return
    hits.set(index, { index, score })
  })

  if (compactSearch(q).length >= 2) {
    const fullTextIds = await fullTextCandidateIds(q)
    for (const index of fullTextIds) {
      if (!hits.has(index)) hits.set(index, { index, score: 3 })
    }
  }

  const list = [...hits.values()]
    .map(({ index, score }) => {
      const r = records[index]
      return {
        id: r.id,
        kind: r.kind || '页面',
        label: r.title,
        sub: [r.siteTitle, r.subtitle].filter(Boolean).join(' · '),
        snippet: score < 3 ? (r.subtitle || '') : '',
        to: r.href,
        score,
      }
    })
    .sort((a, b) => {
      const ak = KIND_ORDER.indexOf(a.kind)
      const bk = KIND_ORDER.indexOf(b.kind)
      return a.score - b.score || ak - bk || a.label.length - b.label.length
    })

  const groups = new Map()
  for (const h of list) {
    if (!groups.has(h.kind)) groups.set(h.kind, [])
    const bucket = groups.get(h.kind)
    if (bucket.length < GROUP_CAP) bucket.push(h)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
    .map(([key, items]) => ({ key, label: key, items }))
}
