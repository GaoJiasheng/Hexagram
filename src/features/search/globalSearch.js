import { SITES } from '../../sites/registry.js'
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

const GROUP_CAP = 10
const KIND_ORDER = ['页面', '经典', '来路', '导读', '易经', '正文', '白话', '注疏', '专题']

let indexPromise = null
let records = []
let shardPath = '/content/search/shards/{key}.json'
let textPath = ''                 // 原文预览桶路径模板(index.json 给;没有就不出预览)
let textSoloPath = ''             // 超长章单独成文件的路径模板(记录带 pv:'s')
let textShards = 1024
let previewKinds = new Set()
const shardCache = new Map()
const textCache = new Map()

// 分片与预览桶的文件名都带构建版本号,由 index.json 指路:分片里存的是记录位置,
// 必须与同一次构建的 index.json 配对(PWA 的 SWR 缓存曾让新索引配上旧分片,错位 11 条)

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function compactSearch(s) {
  return normalize(s).replace(/\s+/g, '')
}

function fnv(s, mask) {
  let h = 2166136261
  for (const ch of s) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return h & mask
}
const shardKey = (token) => fnv(token, 127).toString(16).padStart(2, '0')
const textKey = (id) => fnv(id, textShards - 1).toString(16).padStart(3, '0')
const soloKey = (id) => (fnv(id, 0xffffffff) >>> 0).toString(16).padStart(8, '0')

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

async function loadTextBucket(key, solo = false) {
  const tpl = solo ? textSoloPath : textPath
  if (!tpl) return {}
  const cacheKey = solo ? `solo:${key}` : key
  if (!textCache.has(cacheKey)) {
    textCache.set(
      cacheKey,
      fetch(urlFor(tpl.replace('{key}', key)))
        .then((r) => (r.ok ? r.json() : { texts: {} }))
        .then((data) => data.texts || {})
        .catch(() => ({})),
    )
  }
  return textCache.get(cacheKey)
}

const PUNCT_RE = /[\s\p{P}\p{S}]/u

// 原文预览:在正文里找到查询命中的位置,截前 18 字 / 后 36 字,命中段单独交回给渲染层标红。
// 查询里的标点与正文未必一致(「知其白守其黑」对「知其白，守其黑」),所以先按「去标点」的影子串找位置,
// 再映射回原文下标;整句找不到(命中的是零散的二字组合)就退到第一个二字组合;再找不到就给开头。
export function makeSnippet(text, query) {
  const src = String(text || '')
  if (!src) return null
  const q = compactSearch(query)
  const chars = [...src]
  const map = []            // 影子串下标 → 原文(字符数组)下标
  const shadow = []
  chars.forEach((ch, i) => { if (!PUNCT_RE.test(ch)) { shadow.push(ch.toLowerCase()); map.push(i) } })
  const shadowStr = shadow.join('')
  const needles = [[...q].filter((ch) => !PUNCT_RE.test(ch)).join(''), ...queryTokens(q)].filter((n) => n.length >= 2)
  let s = -1, e = -1
  for (const needle of needles) {
    const at = shadowStr.indexOf(needle)
    if (at === -1) continue
    s = map[at]
    e = map[at + [...needle].length - 1] + 1
    break
  }
  const BEFORE = 18, AFTER = 36, OPEN = 54
  if (s === -1) {
    const head = chars.slice(0, OPEN).join('')
    return { before: head, match: '', after: chars.length > OPEN ? '…' : '' }
  }
  const from = Math.max(0, s - BEFORE)
  const to = Math.min(chars.length, e + AFTER)
  return {
    before: (from > 0 ? '…' : '') + chars.slice(from, s).join(''),
    match: chars.slice(s, e).join(''),
    after: chars.slice(e, to).join('') + (to < chars.length ? '…' : ''),
  }
}

export async function ensureGlobalSearchIndexed() {
  if (!indexPromise) {
    indexPromise = fetch(urlFor('/content/search/index.json'))
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((data) => {
        records = Array.isArray(data.records) ? data.records : []
        shardPath = data.shardPath || shardPath
        textPath = data.textPath || ''
        textSoloPath = data.textSoloPath || ''
        textShards = Number(data.textShardCount) || 1024
        previewKinds = new Set(Array.isArray(data.previewKinds) ? data.previewKinds : [])
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

  // 门户暂不露出的组(registry portalHidden,如 review 前的观数):站外搜不到,人在该组里才搜得到自家内容。
  // 与「门户不列、sitemap 不收」同一道口径——要么都露,要么都不露。
  const here = typeof location !== 'undefined' ? location.pathname : ''
  const hiddenPrefixes = SITES.filter((x) => x.portalHidden && x.prefix).map((x) => x.prefix)
  const blocked = (href) => hiddenPrefixes.some((pre) => (href === pre || href.startsWith(pre + '/')) && !(here === pre || here.startsWith(pre + '/')))

  const list = [...hits.values()]
    .filter(({ index }) => !blocked(records[index].href || ''))
    .map(({ index, score }) => {
      const r = records[index]
      return {
        id: r.id,
        index,
        kind: r.kind || '页面',
        label: r.title,
        sub: [...new Set([r.siteTitle, r.subtitle].filter(Boolean))].join(' · '),   // 正文记录的 subtitle 就是站名,去重
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

  // 只给真正要显示的那几条取原文预览(每组最多 GROUP_CAP 条),桶按 id 哈希、取过的留缓存
  const shown = [...groups.values()].flat().filter((h) => previewKinds.has(h.kind))
  await Promise.all(shown.map(async (h) => {
    const solo = records[h.index]?.pv === 's'
    const texts = await loadTextBucket(solo ? soloKey(h.id) : textKey(h.id), solo)
    const preview = makeSnippet(texts[h.id], q)
    if (preview) h.preview = preview
  }))

  return [...groups.entries()]
    .sort(([a], [b]) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
    .map(([key, items]) => ({ key, label: key, items }))
}
