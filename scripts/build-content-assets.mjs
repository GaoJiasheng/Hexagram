import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ogShardKey, normPath } from '../server/og-index.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DATA = path.join(ROOT, 'src/data')
const OUT_ROOT = path.join(ROOT, 'public/content')
const OUT_BAIHUA = path.join(OUT_ROOT, 'baihua')
const OUT_DAODU = path.join(OUT_ROOT, 'daodu')
const OUT_SCHOOL = path.join(OUT_ROOT, 'school')
const OUT_SEARCH = path.join(OUT_ROOT, 'search')
const SEARCH_SHARDS = 128

const CORPORA = ['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu']
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
const homeOf = (corpus) => siteOf(corpus)?.home || `/${corpus}`
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
    // 按书一文件:同书各章共用此 path（前端 loadBook 缓存整本，首开载全书、之后秒开），
    // 文件数从「一章一文件」收回「一书一文件」，便于 CF 后台拖拽（≤1000 文件）。
    path: `/content/baihua/${corpus}/${slug}.json`,
  }
  manifest.baihua[corpus] ??= {}
  manifest.baihua[corpus][slug] ??= { chapters: {}, count: 0 }
  manifest.baihua[corpus][slug].chapters[String(ch)] = meta
  manifest.baihua[corpus][slug].count += 1
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
      // 按书写一个文件 = { 章号: article }（源 baihua json 本就是这个结构，直接落盘）
      writeJson(path.join(OUT_BAIHUA, corpus, `${slug}.json`), book)
    }
  }
}

// 书级导读(前世今生):一书一篇,与白话同走分片,免得 62 篇 × 数千字打进 JS chunk。
function buildDaoduAssets(manifest, records) {
  const dirs = fs.readdirSync(SRC_DATA).filter((n) => exists(path.join(SRC_DATA, n, 'daodu')))
  manifest.daodu ??= {}
  for (const corpus of dirs.sort()) {
    const dir = path.join(SRC_DATA, corpus, 'daodu')
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const slug = file.replace(/\.json$/, '')
      const art = readJson(path.join(dir, file))
      manifest.daodu[corpus] ??= {}
      // aliasOf:一书多 slug(庄子内/外/杂、内经素问/灵枢)只写一篇,别的 slug 指同一份文件
      if (art.aliasOf) {
        // 标题取自被指向的那一篇 —— alias 存根本身没有 title,不接过来入口会是空的
        const tgt = readJson(path.join(dir, `${art.aliasOf}.json`))
        manifest.daodu[corpus][slug] = {
          title: tgt?.title || '', subtitle: tgt?.subtitle || '', aliasOf: art.aliasOf,
          path: `/content/daodu/${corpus}/${art.aliasOf}.json`,
        }
        continue
      }
      manifest.daodu[corpus][slug] = {
        title: art.title || '', subtitle: art.subtitle || '',
        path: `/content/daodu/${corpus}/${slug}.json`,
      }
      writeJson(path.join(OUT_DAODU, corpus, `${slug}.json`), art)
      addRecord(records, {
        id: `daodu:${corpus}:${slug}`, kind: '导读', site: corpus,
        title: art.title, subtitle: art.subtitle,
        href: `${homeOf(corpus)}/${slug}/daodu`, text: art.centralIdea,
      })
    }
  }
}

// 家级导读(一家之来路):一组一篇。与书级同走分片。
// 分工:书级讲「这一本的前世今生」,家级讲「这些书之间、这些人之间」——
// 谁接谁 · 在哪一步转了向 · 哪一支断了 · 这几本按什么顺序读。
function buildSchoolAssets(manifest, records) {
  manifest.school ??= {}
  for (const corpus of fs.readdirSync(SRC_DATA).sort()) {
    const f = path.join(SRC_DATA, corpus, 'school.json')
    if (!exists(f)) continue
    const art = readJson(f)
    manifest.school[corpus] = {
      title: art.title || '', subtitle: art.subtitle || '',
      path: `/content/school/${corpus}.json`,
    }
    writeJson(path.join(OUT_SCHOOL, `${corpus}.json`), art)
    // 导读页分享出去原本是裸链接 —— 收进 og 索引,爬虫来取时能拿到题与摘要
    addRecord(records, {
      id: `school:${corpus}`, kind: '来路', site: corpus,
      title: art.title, subtitle: art.subtitle,
      href: `${homeOf(corpus)}/school`, text: art.centralIdea,
    })
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

// 逐页分享卡(OG)索引:href → [标题, 副标, 正文摘录]。
// 复用搜索索引的同一批 records —— 标题/副标/链接本来就是同一套,另建一份必然走样。
// 消费者是 functions/_middleware.js:只有爬虫 UA 才会读它,普通访客不受影响。
// 只收「分享出去有意义」的页(有 subtitle 或属内容页),纯功能页不收。
//
// 第三项「正文摘录」是给**搜索引擎收录**用的(2026-08-08 加):
// 本站是纯前端 SPA,爬虫拿到的 <body> 只有一个空 <div id="root">,正文要执行 JS 才出得来。
// Google 会渲染 JS,但**百度基本不渲染**——一个中文古籍站放弃百度不合算。
// 故中间件把这段摘录直接写进 body,让「不执行 JS 也能读到正文」。
// 长度取 `SEO_BODY_MAX`:够表达这一章讲什么,又不至于把分片撑爆(实测约 3–4 倍)。
const SEO_BODY_MAX = 600
// 分片方式 2026-08-08 由「按路径首段」改为「**按整条路径哈希**」。
// 原因:加了正文摘录后,按首段分的片涨到 1.1MB(ru/songci),
// 而中间件每来一个爬虫就要 parse 一整片 —— 会撞 Worker 的 CPU 限额,
// 失败后 try/catch 静默回退,**把现在好用的逐页 meta 一起弄丢**(得不偿失)。
// 哈希分成 256 片后每片约 25KB,取一条的代价与它的价值才匹配。
// 分片规则来自 server/og-index.js(唯一一份,中间件与通知邮件都用它)
function buildOgIndex(records) {
  const shards = {}
  let n = 0
  for (const r of records) {
    if (!r.href || !r.title) continue
    if (r.href.includes('#')) continue          // 段锚共用整页的卡,不单列
    const href = normPath(r.href)
    // 副标常常就是站名(章页尤其),那样的卡等于没信息 —— 退回用正文开头当预览。
    const sub = (r.subtitle || '').trim()
    const body = compact(r.text).slice(0, SEO_BODY_MAX)
    const desc = (sub && sub !== r.siteTitle ? sub : (r.text || '').trim()).slice(0, 70)
    const site = r.siteTitle && r.siteTitle !== '观象' ? ` · ${r.siteTitle}` : ''
    ;(shards[ogShardKey(href)] ??= {})[href] = [`${r.title}${site}`, desc, body]
    n++
  }
  cleanOutDir(path.join(OUT_ROOT, 'og'))
  for (const [k, map] of Object.entries(shards)) {
    writeJson(path.join(OUT_ROOT, 'og', `${k}.json`), map)
  }
  console.log(`og index: ${n} 条 / ${Object.keys(shards).length} 片`)
}

// ── sitemap.xml + robots.txt ────────────────────────────────────────────────
// 没有 sitemap,五千个内容页只能靠爬虫从首页一层层摸链接,发现极慢、深页几乎摸不到。
// 这是本站可发现性上**最便宜也最见效**的一件,数据源仍是同一批 records(不另建一份)。
//
// ⚠️ **观书 `/books/*` 一律不收** —— 它是隐藏入口(CLAUDE.md 明写不入公共搜索),
// 收进 sitemap 等于亲手把它交给搜索引擎。og 索引本就不含它,这里再挡一道,
// 因为「哪些页该公开」这件事值得写两遍。
const SITE_ORIGIN = 'https://hexa.gavin.pub'
function buildSitemap(records) {
  const seen = new Set()
  for (const r of records) {
    if (!r.href || !r.title) continue
    if (r.href.includes('#')) continue
    if (r.href.startsWith('/books')) continue    // 隐藏书房,不进 sitemap
    seen.add(r.href)
  }
  const urls = [...seen].sort()
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace('www.sitemap.org', 'www.sitemaps.org'),
    ...urls.map((u) => `<url><loc>${SITE_ORIGIN}${u.replace(/&/g, '&amp;')}</loc></url>`),
    '</urlset>',
  ].join('\n')
  fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'), `${xml}\n`)

  fs.writeFileSync(path.join(ROOT, 'public/robots.txt'), [
    '# 观象 · https://hexa.gavin.pub',
    '# 生成物,勿手改 —— 改 scripts/build-content-assets.mjs 的 buildSitemap()',
    'User-agent: *',
    'Allow: /',
    '',
    '# 观书是隐藏书房(个人读书笔记),不入公共搜索',
    'Disallow: /books',
    '# 个人足迹页与推演工作台无收录价值',
    'Disallow: /me',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ].join('\n') + '\n')

  console.log(`sitemap: ${urls.length} 条 URL(已排除 /books 隐藏书房)`)
}

// ── 观书:从 JS 包搬到 /content/books,好让它能被鉴权 ────────────────────────
// 2026-08-13 owner 定「观书只给管理员看」。此前它是**假隐藏**:
// 书目 index.json 静态 import 进 books-*.js(150KB,任何访客一进站就下载),
// 每篇文章又各是一个可按 URL 直取的 chunk —— 光拦路由等于掩耳盗铃。
//
// 搬到 public/content/books/ 之后:
//   · **Web** 走边缘,由 functions/_middleware.js 鉴权(非管理员 404)
//   · **iOS** 由 Capacitor 本地直供同一条 fetch 路径 —— 天然离线可用、天然不经鉴权
//     (owner 明确要这个:本地内容 + 登录才看 + 离线放开)
// 同一份前端代码,不必分支 —— 白话当初已经趟过这条路。
function buildBooksAssets() {
  const src = path.join(SRC_DATA, 'books')
  if (!exists(src)) return
  const out = path.join(OUT_ROOT, 'books')
  cleanOutDir(out)
  let n = 0, arts = 0
  fs.cpSync(src, out, { recursive: true })
  for (const f of fs.readdirSync(out)) {
    const d = path.join(out, f)
    if (fs.statSync(d).isDirectory()) {
      n += 1
      const ad = path.join(d, 'articles')
      if (exists(ad)) arts += fs.readdirSync(ad).filter((x) => x.endsWith('.json')).length
    }
  }
  console.log(`books assets: ${n} 本 / ${arts} 篇(已移出 JS 包,受中间件鉴权)`)
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
buildDaoduAssets(manifest, records)
buildSchoolAssets(manifest, records)

writeJson(path.join(OUT_ROOT, 'manifest.json'), manifest)
buildSearchAssets(records)
buildOgIndex(records)
buildSitemap(records)
buildBooksAssets()

// 首页要亮的那几个数(2026-08-08)。**构建期算,前端不手写** ——
// 手写的数字必然过时:门户卡片描述当年就是因为手写才长期显示错的书目数(v1.40.0 修过一次)。
// 只出计数,不出清单,几百字节。
{
  const nBooks = fs.readdirSync(SRC_DATA)
    .map((c) => path.join(SRC_DATA, c, 'classics'))
    .filter(exists)
    .reduce((n, d) => n + fs.readdirSync(d).filter((f) => f.endsWith('.json')).length, 0)
  const nBaihua = Object.values(manifest.baihua)
    .flatMap((books) => Object.values(books))
    .reduce((n, b) => n + b.count, 0)
  const debFile = path.join(SRC_DATA, 'debates/index.json')
  const mjFile = path.join(SRC_DATA, 'mingju.json')
  const cpFile = path.join(SRC_DATA, 'concepts.json')
  const mj = exists(mjFile) ? readJson(mjFile) : null
  const cp = exists(cpFile) ? readJson(cpFile) : null
  writeJson(path.join(OUT_ROOT, 'stats.json'), {
    books: nBooks,
    baihua: nBaihua,
    debates: exists(debFile) ? (readJson(debFile).topics || []).length : 0,
    mingju: Array.isArray(mj) ? mj.length : (mj?.items?.length || 0),
    concepts: Array.isArray(cp) ? cp.length : (cp?.clusters?.length || 0),
    groups: new Set(SITES.map((s) => s.group)).size,
  })
}

const baihuaCount = Object.values(manifest.baihua)
  .flatMap((books) => Object.values(books))
  .reduce((n, b) => n + b.count, 0)
console.log(`content assets: baihua ${baihuaCount} chapters, search ${records.length} records`)
