import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'src/data')
const CONTENT = path.join(ROOT, 'public/content')
const errors = []

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const exists = (file) => fs.existsSync(file)
const err = (msg) => errors.push(msg)
const { SITES } = await import(pathToFileURL(path.join(ROOT, 'src/sites/registry.js')).href)

const SITE_KEYS = new Set(SITES.map((s) => s.key))
const CORPUS_KEYS = new Set(['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue'])
const STATIC_ROUTES = new Set([
  '/',
  '/hexagram',
  '/hexagrams',
  '/workbench',
  '/classics',
  '/basics',
  '/basics/yinyang',
  '/basics/hetu-luoshu',
  '/basics/xiaoxi',
  '/basics/shicao',
  '/basics/meihua',
  '/basics/jinqian',
  '/basics/yuanliu',
  '/basics/shishi',
  '/basics/guahua',
  '/basics/tuiyan',
  '/basics/glossary',
  '/shili',
  '/me',
  '/concepts',
  '/debates',
  '/about',
])
for (const s of SITES) {
  STATIC_ROUTES.add(s.home)
  for (const n of s.nav || []) STATIC_ROUTES.add(n.to)
  if (s.key !== 'yijing') STATIC_ROUTES.add(`${s.home}/me`)
}

const manifest = readJson(path.join(CONTENT, 'manifest.json'))
const search = readJson(path.join(CONTENT, 'search/index.json'))
const searchRecords = Array.isArray(search.records) ? search.records : []
const hexagrams = readJson(path.join(DATA, 'yijing/hexagrams.json'))
const hexIds = new Set(hexagrams.map((h) => h.id))
const shiliIds = new Set(exists(path.join(DATA, 'yijing/shili.json')) ? readJson(path.join(DATA, 'yijing/shili.json')).map((s) => s.id) : [])
const debateIds = new Set(exists(path.join(DATA, 'debates/index.json')) ? readJson(path.join(DATA, 'debates/index.json')).topics.map((t) => t.id) : [])
const textMeta = {}
for (const c of CORPUS_KEYS) {
  const f = path.join(DATA, c, 'texts.json')
  textMeta[c] = exists(f) ? readJson(f) : []
}
const yijingClassics = {}
for (const slug of ['xici-shang', 'xici-xia', 'shuogua', 'xugua', 'zagua']) {
  const f = path.join(DATA, `yijing/classics/${slug}.json`)
  if (exists(f)) yijingClassics[slug] = readJson(f)
}

function hasBaihua(corpus, slug, ch) {
  return !!manifest.baihua?.[corpus]?.[slug]?.chapters?.[String(ch)]
}

function hasCorpusChapter(corpus, slug, ch) {
  const meta = textMeta[corpus]?.find((t) => t.slug === slug && t.status !== 'pending')
  if (!meta) return false
  return Number(ch) >= 1 && Number(ch) <= meta.sections
}

function verifyPath(rawHref) {
  if (!rawHref || rawHref.startsWith('http')) return true
  const href = rawHref.split('#')[0].split('?')[0] || '/'
  if (STATIC_ROUTES.has(href)) return true

  let m = href.match(/^\/hexagram\/(\d+)(?:\/baihua)?$/)
  if (m) {
    const id = Number(m[1])
    if (!hexIds.has(id)) return false
    return href.endsWith('/baihua') ? hasBaihua('yijing', 'hexagrams', id) : true
  }

  m = href.match(/^\/classics\/([^/]+)\/(\d+)(?:\/baihua)?$/)
  if (m) {
    const [, slug, chRaw] = m
    const ch = Number(chRaw)
    const book = yijingClassics[slug]
    if (!book?.chapters?.some((c) => c.no === ch)) return false
    return href.endsWith('/baihua') ? hasBaihua('yijing', slug, ch) : true
  }

  m = href.match(/^\/shili\/([^/]+)$/)
  if (m) return shiliIds.has(m[1])

  m = href.match(/^\/debates\/([^/]+)$/)
  if (m) return debateIds.has(m[1])

  m = href.match(/^\/(dao|fo|ru|xin|fa|mo|bing|zong|zhongyi|moulue)\/([^/]+)$/)
  if (m) return !!textMeta[m[1]]?.find((t) => t.slug === m[2] && t.status !== 'pending')

  m = href.match(/^\/(dao|fo|ru|xin|fa|mo|bing|zong|zhongyi|moulue)\/([^/]+)\/(\d+)$/)
  if (m) return hasCorpusChapter(m[1], m[2], Number(m[3]))

  m = href.match(/^\/(dao|fo|ru|xin|fa|mo|bing|zong|zhongyi|moulue)\/([^/]+)\/baihua\/(\d+)$/)
  if (m) return hasBaihua(m[1], m[2], Number(m[3]))

  return false
}

for (const [corpus, books] of Object.entries(manifest.baihua || {})) {
  for (const [slug, data] of Object.entries(books)) {
    for (const [ch, meta] of Object.entries(data.chapters || {})) {
      const file = path.join(ROOT, 'public', meta.path)
      if (!exists(file)) err(`白话资源缺失: ${corpus}/${slug}#${ch} -> ${meta.path}`)
      if (!verifyPath(baihuaRoute(corpus, slug, ch))) err(`白话路由无效: ${corpus}/${slug}#${ch}`)
    }
  }
}

function baihuaRoute(corpus, slug, ch) {
  if (corpus === 'yijing') return slug === 'hexagrams' ? `/hexagram/${ch}/baihua` : `/classics/${slug}/${ch}/baihua`
  return `/${corpus}/${slug}/baihua/${ch}`
}

if (!Array.isArray(search.records) || searchRecords.length !== search.count) {
  err(`搜索索引 count 不一致: ${searchRecords.length}/${search.count}`)
}
const ids = new Set()
for (const r of searchRecords) {
  if (!r.id || ids.has(r.id)) err(`搜索记录 id 缺失/重复: ${r.id || '(empty)'}`)
  ids.add(r.id)
  if (!SITE_KEYS.has(r.site) && r.site !== 'portal') err(`搜索记录 site 非法: ${r.id} -> ${r.site}`)
  if (!verifyPath(r.href)) err(`搜索记录坏链: ${r.id} -> ${r.href}`)
}

if (!Array.isArray(search.shards) || !search.shards.length) {
  err('搜索分片目录缺失')
} else {
  for (const key of search.shards) {
    const file = path.join(CONTENT, 'search/shards', `${key}.json`)
    if (!exists(file)) {
      err(`搜索分片缺失: ${key}`)
      continue
    }
    const shard = readJson(file)
    for (const [token, list] of Object.entries(shard.tokens || {})) {
      if (!token || !Array.isArray(list)) {
        err(`搜索分片格式错误: ${key}/${token || '(empty)'}`)
        continue
      }
      for (const idx of list) {
        if (!Number.isInteger(idx) || idx < 0 || idx >= searchRecords.length) {
          err(`搜索分片记录越界: ${key}/${token} -> ${idx}`)
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ 链接校验失败, ${errors.length} 个错误:`)
  for (const e of errors) console.error(`- ${e}`)
  process.exit(1)
}

console.log(`✓ 链接校验通过: ${Object.keys(manifest.baihua || {}).length} 组白话, ${searchRecords.length} 条搜索记录, ${search.shards?.length || 0} 个搜索分片`)
