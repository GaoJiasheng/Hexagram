import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DATA = path.join(ROOT, 'src/data')
const OUT_ROOT = path.join(ROOT, 'public/content')
const OUT_BAIHUA = path.join(OUT_ROOT, 'baihua')
const OUT_SEARCH = path.join(OUT_ROOT, 'search')
const SEARCH_SHARDS = 128

const CORPORA = ['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue']
const YIJING_CLASSICS = [
  ['xici-shang', '系辞上传'],
  ['xici-xia', '系辞下传'],
  ['shuogua', '说卦传'],
  ['xugua', '序卦传'],
  ['zagua', '杂卦传'],
]

const { SITES } = await import(pathToFileURL(path.join(ROOT, 'src/sites/registry.js')).href)
const { LEARN_TOPICS } = await import(pathToFileURL(path.join(ROOT, 'src/features/yijing/learnTopics.js')).href)

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const exists = (file) => fs.existsSync(file)
const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data))
}
const textOf = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join('\n')
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([k]) => k !== 'svg')
      .map(([, v]) => textOf(v))
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
const compact = (s) => String(s || '').replace(/\s+/g, ' ').trim()
const uniqText = (...parts) => [...new Set(parts.map(compact).filter(Boolean))].join('\n')
const siteOf = (corpus) => SITES.find((s) => s.key === corpus)
const siteLabel = (corpus) => siteOf(corpus)?.portalTitle || corpus
const searchText = (s) => compact(s).toLowerCase().replace(/\s+/g, '')

function shardKey(token) {
  let h = 2166136261
  for (const ch of token) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h & (SEARCH_SHARDS - 1)).toString(16).padStart(2, '0')
}

function bigrams(value) {
  const chars = [...searchText(value)]
  const out = new Set()
  for (let i = 0; i < chars.length - 1; i += 1) {
    const token = `${chars[i]}${chars[i + 1]}`
    if (token.trim().length >= 2) out.add(token)
  }
  return out
}

function cleanOutDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
}

function chapterHref(corpus, slug, ch, meta) {
  if (corpus === 'dao') return meta?.singlePage ? `/dao/${slug}#dao-ch-${ch}` : `/dao/${slug}/${ch}`
  return meta?.singlePage ? `/${corpus}/${slug}#${corpus}-ch-${ch}` : `/${corpus}/${slug}/${ch}`
}

function baihuaHref(corpus, slug, ch) {
  if (corpus === 'yijing') {
    return slug === 'hexagrams' ? `/hexagram/${ch}/baihua` : `/classics/${slug}/${ch}/baihua`
  }
  return `/${corpus}/${slug}/baihua/${ch}`
}

function addRecord(records, item) {
  const title = compact(item.title)
  const href = compact(item.href)
  if (!title || !href) return
  records.push({
    id: item.id,
    kind: item.kind,
    site: item.site,
    siteTitle: item.siteTitle || siteLabel(item.site),
    title,
    subtitle: compact(item.subtitle),
    href,
    text: compact(item.text),
  })
}

function buildSearchAssets(records) {
  const indexRecords = records.map((r) => ({
    id: r.id,
    kind: r.kind,
    site: r.site,
    siteTitle: r.siteTitle,
    title: r.title,
    subtitle: r.subtitle,
    href: r.href,
  }))
  const shards = new Map()
  for (let i = 0; i < SEARCH_SHARDS; i += 1) {
    const key = i.toString(16).padStart(2, '0')
    shards.set(key, new Map())
  }

  records.forEach((record, recordIndex) => {
    for (const token of bigrams(uniqText(record.title, record.subtitle, record.siteTitle, record.text))) {
      const bucket = shards.get(shardKey(token))
      if (!bucket.has(token)) bucket.set(token, [])
      bucket.get(token).push(recordIndex)
    }
  })

  const shardKeys = []
  for (const [key, bucket] of shards) {
    const tokens = Object.fromEntries(
      [...bucket.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([token, ids]) => [token, ids.sort((a, b) => a - b)]),
    )
    writeJson(path.join(OUT_SEARCH, 'shards', `${key}.json`), { version: 1, tokens })
    shardKeys.push(key)
  }

  writeJson(path.join(OUT_SEARCH, 'index.json'), {
    version: 2,
    count: indexRecords.length,
    shardCount: SEARCH_SHARDS,
    shardPath: '/content/search/shards/{key}.json',
    shards: shardKeys,
    records: indexRecords,
  })
}

function indexBaihuaArticle(records, manifest, corpus, slug, ch, article, bookTitle) {
  addRecord(records, {
    id: `baihua:${corpus}:${slug}:${ch}`,
    kind: '白话',
    site: corpus,
    title: article.title || `白话${bookTitle}`,
    subtitle: article.subtitle || `${bookTitle} · 第${ch}章`,
    href: baihuaHref(corpus, slug, ch),
    text: uniqText(article.title, article.subtitle, article.centralIdea, textOf(article.blocks), textOf(article.hero)),
  })

  const meta = {
    title: article.title || '',
    subtitle: article.subtitle || '',
    featured: !!article.featured || !!article.hero,
    path: `/content/baihua/${corpus}/${slug}/${ch}.json`,
  }
  manifest.baihua[corpus] ??= {}
  manifest.baihua[corpus][slug] ??= { chapters: {}, count: 0 }
  manifest.baihua[corpus][slug].chapters[String(ch)] = meta
  manifest.baihua[corpus][slug].count += 1
  writeJson(path.join(OUT_BAIHUA, corpus, slug, `${ch}.json`), article)
}

function buildBaihuaAssets(records, manifest) {
  const dataDirs = fs.readdirSync(SRC_DATA).filter((name) => exists(path.join(SRC_DATA, name, 'baihua')))
  for (const corpus of dataDirs.sort()) {
    const dir = path.join(SRC_DATA, corpus, 'baihua')
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const slug = file.replace(/\.json$/, '')
      const book = readJson(path.join(dir, file))
      const bookTitle = titleForBook(corpus, slug)
      for (const ch of Object.keys(book).sort((a, b) => Number(a) - Number(b))) {
        indexBaihuaArticle(records, manifest, corpus, slug, ch, book[ch], bookTitle)
      }
    }
  }
}

function titleForBook(corpus, slug) {
  if (corpus === 'yijing') {
    if (slug === 'hexagrams') return '易经'
    return YIJING_CLASSICS.find(([k]) => k === slug)?.[1] || slug
  }
  const file = path.join(SRC_DATA, corpus, 'texts.json')
  if (!exists(file)) return slug
  return readJson(file).find((t) => t.slug === slug)?.title || slug
}

function indexPages(records) {
  addRecord(records, {
    id: 'page:portal',
    kind: '页面',
    site: 'portal',
    siteTitle: '诸学门户',
    title: '诸学门户',
    subtitle: '全站入口',
    href: '/hexagram',
    text: '观象 诸学门户 易经 道藏 儒典 释典 心学 法家 墨家 兵家 纵横 中医 谋略 百家争鸣 义理专题',
  })
  addRecord(records, {
    id: 'page:concepts',
    kind: '专题',
    site: 'portal',
    siteTitle: '义理专题',
    title: '义理专题',
    subtitle: '跨派概念',
    href: '/concepts',
    text: '义理专题 跨派概念 人性 格物 兼爱 无为 仁 四端',
  })
  addRecord(records, {
    id: 'page:debates',
    kind: '专题',
    site: 'portal',
    siteTitle: '百家争鸣',
    title: '赛博 · 百家争鸣',
    subtitle: '跨派对辩',
    href: '/debates',
    text: '百家争鸣 对辩 诸子 儒 道 佛 法 墨 兵 纵横 心学 中医',
  })
  addRecord(records, {
    id: 'page:about',
    kind: '页面',
    site: 'portal',
    siteTitle: '关于本站',
    title: '关于本站',
    subtitle: '研读铁律与数据说明',
    href: '/about',
    text: '关于本站 研读铁律 数据说明 非医疗建议 不宣化 不算命',
  })

  for (const site of SITES) {
    addRecord(records, {
      id: `site:${site.key}`,
      kind: '页面',
      site: site.key,
      title: site.portalTitle,
      subtitle: site.portalDesc,
      href: site.home,
      text: uniqText(site.brand, site.portalTitle, site.portalDesc, ...site.nav.map((n) => n.label)),
    })
    for (const nav of site.nav) {
      addRecord(records, {
        id: `page:${site.key}:${nav.to}`,
        kind: '页面',
        site: site.key,
        title: nav.label,
        subtitle: site.portalTitle,
        href: nav.to,
        text: uniqText(nav.label, site.portalTitle, site.portalDesc),
      })
    }
  }

  for (const t of LEARN_TOPICS) {
    addRecord(records, {
      id: `learn:${t.id}`,
      kind: '页面',
      site: 'yijing',
      title: t.title,
      subtitle: `学堂 · ${t.time}`,
      href: t.to,
      text: uniqText(t.title, t.desc, t.time),
    })
  }
}

function indexYijing(records) {
  const hexagrams = readJson(path.join(SRC_DATA, 'yijing/hexagrams.json'))
  for (const h of hexagrams) {
    addRecord(records, {
      id: `hex:${h.id}`,
      kind: '易经',
      site: 'yijing',
      title: `${h.fullName} 第${h.id}卦`,
      subtitle: h.summary || '',
      href: `/hexagram/${h.id}`,
      text: uniqText(
        h.name, h.fullName, h.pinyin, h.summary, h.imagery,
        textOf(h.judgment), textOf(h.tuan), textOf(h.daxiang),
        textOf(h.lines), textOf(h.extra), h.xugua, h.zagua,
      ),
    })
  }

  for (const [slug, fallbackTitle] of YIJING_CLASSICS) {
    const book = readJson(path.join(SRC_DATA, `yijing/classics/${slug}.json`))
    addRecord(records, {
      id: `book:yijing:${slug}`,
      kind: '经典',
      site: 'yijing',
      title: book.title || fallbackTitle,
      subtitle: '易经经传',
      href: `/classics/${slug}/1`,
      text: uniqText(book.title, fallbackTitle),
    })
    for (const ch of book.chapters) {
      addRecord(records, {
        id: `chapter:yijing:${slug}:${ch.no}`,
        kind: '正文',
        site: 'yijing',
        title: `${book.title || fallbackTitle} · 第${ch.no}章`,
        subtitle: '易经经传',
        href: `/classics/${slug}/${ch.no}`,
        text: uniqText(ch.title, textOf(ch.paragraphs)),
      })
    }
  }

  for (const g of readJson(path.join(SRC_DATA, 'yijing/glossary.json'))) {
    addRecord(records, {
      id: `glossary:${g.key}`,
      kind: '注疏',
      site: 'yijing',
      title: g.name,
      subtitle: '易学名词',
      href: `/basics/glossary#${g.key}`,
      text: uniqText(g.name, ...(g.aliases || []), g.brief),
    })
  }
  for (const s of readJson(path.join(SRC_DATA, 'yijing/shili.json'))) {
    addRecord(records, {
      id: `shili:${s.id}`,
      kind: '专题',
      site: 'yijing',
      title: s.title,
      subtitle: `${s.era} · ${s.kind === 'shi' ? '筮占' : '引易'}`,
      href: `/shili/${s.id}`,
      text: uniqText(s.title, s.background, textOf(s.paragraphs), textOf(s.reading)),
    })
  }
  for (const s of readJson(path.join(SRC_DATA, 'yijing/shishi.json'))) {
    addRecord(records, {
      id: `shishi:${s.id}`,
      kind: '专题',
      site: 'yijing',
      title: s.title,
      subtitle: '爻辞中的商周史事',
      href: `/basics/shishi#${s.id}`,
      text: uniqText(s.title, textOf(s.paragraphs)),
    })
  }
  for (const p of readJson(path.join(SRC_DATA, 'yijing/renwu.json'))) {
    addRecord(records, {
      id: `renwu:${p.id}`,
      kind: '专题',
      site: 'yijing',
      title: p.name,
      subtitle: `${p.era} · 人物志`,
      href: `/basics/yuanliu#${p.id}`,
      text: uniqText(p.name, p.era, textOf(p.paragraphs)),
    })
  }
}

function indexCorpus(records, corpus) {
  const metaFile = path.join(SRC_DATA, corpus, 'texts.json')
  if (!exists(metaFile)) return
  const metas = readJson(metaFile).filter((t) => t.status !== 'pending')
  const yanyiFile = path.join(SRC_DATA, corpus, 'yanyi.json')
  const yanyi = exists(yanyiFile) ? readJson(yanyiFile) : {}
  const zhushiDir = path.join(SRC_DATA, corpus, 'zhushi-anchored')

  for (const m of metas) {
    addRecord(records, {
      id: `book:${corpus}:${m.slug}`,
      kind: '经典',
      site: corpus,
      title: m.title,
      subtitle: m.authorNote || siteLabel(corpus),
      href: `/${corpus}/${m.slug}`,
      text: uniqText(m.title, m.alias, m.authorNote, m.portalDesc),
    })

    const bookFile = path.join(SRC_DATA, corpus, `classics/${m.slug}.json`)
    if (!exists(bookFile)) continue
    const book = readJson(bookFile)
    const anchorsFile = path.join(zhushiDir, `${m.slug}.json`)
    const anchors = exists(anchorsFile) ? readJson(anchorsFile) : {}
    for (const ch of book.chapters) {
      const noteText = textOf(anchors[String(ch.no)])
      const yanyiText = textOf(yanyi[m.slug]?.[String(ch.no)])
      addRecord(records, {
        id: `chapter:${corpus}:${m.slug}:${ch.no}`,
        kind: '正文',
        site: corpus,
        title: `${book.title || m.title} · ${ch.title || `第${ch.no}${m.sectionUnit || '章'}`}`,
        subtitle: siteLabel(corpus),
        href: chapterHref(corpus, m.slug, ch.no, m),
        text: uniqText(ch.title, textOf(ch.paragraphs), noteText, yanyiText),
      })
    }
  }
}

function indexConceptsAndDebates(records) {
  const concepts = readJson(path.join(SRC_DATA, 'concepts.json'))
  for (const c of concepts.clusters || []) {
    addRecord(records, {
      id: `concept:${c.term}`,
      kind: '专题',
      site: 'portal',
      siteTitle: '义理专题',
      title: c.term,
      subtitle: '义理互见',
      href: '/concepts',
      text: uniqText(c.term, c.gloss, textOf(c.loci)),
    })
  }

  const debateIndex = readJson(path.join(SRC_DATA, 'debates/index.json'))
  for (const t of debateIndex.topics || []) {
    let detail = {}
    const f = path.join(SRC_DATA, `debates/${t.id}.json`)
    if (exists(f)) detail = readJson(f)
    addRecord(records, {
      id: `debate:${t.id}`,
      kind: '专题',
      site: 'portal',
      siteTitle: '百家争鸣',
      title: t.title,
      subtitle: t.question || t.category || '百家争鸣',
      href: `/debates/${t.id}`,
      text: uniqText(t.title, t.category, t.concept, t.question, textOf(t.schools), detail.framing, textOf(detail.rounds), detail.coda),
    })
  }
}

cleanOutDir(OUT_BAIHUA)
cleanOutDir(OUT_SEARCH)

const records = []
const manifest = { version: 1, baihua: {} }
indexPages(records)
indexYijing(records)
for (const corpus of CORPORA) indexCorpus(records, corpus)
indexConceptsAndDebates(records)
buildBaihuaAssets(records, manifest)

writeJson(path.join(OUT_ROOT, 'manifest.json'), manifest)
buildSearchAssets(records)

const baihuaCount = Object.values(manifest.baihua)
  .flatMap((books) => Object.values(books))
  .reduce((n, b) => n + b.count, 0)
console.log(`content assets: baihua ${baihuaCount} chapters, search ${records.length} records`)
