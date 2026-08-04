import { SITE_MAP } from '../../sites/registry.js'
import { corpusTexts } from './corpus.js'
import daoTexts from '../../data/dao/texts.json'

// 全站书目索引(#139 共享底座)——枚举 10 组每一部书 → 规范链接/书名/别名/分组。
// 一表喂三处:跨组搜索枚举语料(B1)、跨书互见自动书名链(B2)、我的足迹解析 href(B3),
// 后续义理专题/术语表亦复用。与 owner「放弃硬隔离·logo 全站可达」一致——只为「延伸/检索/
// 足迹」提供全站可解析的「书名→链接」,不改各站导航的分组语义,不触各组铁律。
//
// 数据源:corpus 站走 corpusTexts(texts.json);道藏走 dao/texts.json;
// 易经为非书目站(64 卦+工具),以单条「易经」总目登记,链向经传阅读 /classics。

const CORPUS_KEYS = ['fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu']

// 高频且无歧义的别名(供自动书名链与查名);texts.json 的 alias 字段含「 · 」分隔符、
// 多为副题不宜整体匹配,故这里只手挑干净别名。键 = `${corpus}:${slug}`。
const EXTRA_ALIASES = {
  'dao:daodejing': ['老子'],
}

function rec(site, t) {
  const aliases = EXTRA_ALIASES[`${site.key}:${t.slug}`] || []
  return {
    group: site.group,
    siteKey: site.key,
    corpus: site.key,            // corpus 站 corpus===siteKey;道藏 'dao'
    slug: t.slug,
    title: t.title,
    alias: t.alias || null,      // texts.json 原始副题(展示用)
    aliases,                     // 可参与匹配的干净别名
    singlePage: !!t.singlePage,  // 短经单页(章链接走 #锚点而非 /章号)
    href: `${site.home}/${t.slug}`,
    era: t.era || null,
    attribution: t.attribution || null,
    status: t.status || null,
    sections: t.sections ?? null,
    sectionUnit: t.sectionUnit || null,
    dubious: !!t.dubious,
    caveat: t.caveat || null,
  }
}

export const ALL_BOOKS = (() => {
  const books = []
  for (const key of CORPUS_KEYS) {
    const site = SITE_MAP[key]
    if (!site) continue
    for (const t of corpusTexts(key)) books.push(rec(site, t))
  }
  const daoSite = SITE_MAP.dao
  if (daoSite) for (const t of daoTexts) books.push(rec(daoSite, t))
  // 易经:非书目站,单条总目(链向经传阅读)
  books.push({
    group: 'yidao', siteKey: 'yijing', corpus: 'yijing', slug: null,
    title: '易经', alias: '周易', aliases: ['周易', '易传'], href: '/classics',
    era: '周', attribution: null, status: 'done',
    sections: null, sectionUnit: null, dubious: false, caveat: null,
  })
  return books
})()

// 书名(规范名 + 别名)→ 书目记录。书名全站唯一(无碰撞),别名仅取无歧义者。
const BY_NAME = (() => {
  const m = new Map()
  for (const b of ALL_BOOKS) {
    if (!m.has(b.title)) m.set(b.title, b)
    for (const a of b.aliases) if (!m.has(a)) m.set(a, b)
  }
  return m
})()

export function bookByTitle(name) {
  return BY_NAME.get(name) || null
}

// slug → 书目记录(slug 全站唯一)。供「我的研读」聚合把 reading/收藏/批注 的 slug 解析回书。
const BY_SLUG = new Map(ALL_BOOKS.filter((b) => b.slug).map((b) => [b.slug, b]))
export function bookBySlug(slug) {
  return BY_SLUG.get(slug) || null
}

// 某书某章的阅读链接:短经单页走 #锚点,分章书走 /章号。
export function chapterHref(book, ch) {
  return book.singlePage ? `${book.href}#${book.corpus}-ch-${ch}` : `${book.href}/${ch}`
}

// 剥书名尾部括注(战国策(选)→ 战国策)便于在散文里匹配。
function cleanName(name) {
  return name.replace(/[（(][^）)]*[)）]\s*$/, '')
}

// 全站跨书参引表(B2):每部书的「规范名 + 干净别名」→ href,供 linkifyBooks 在延伸里自动成链。
// 排除当前书(避免自链)。长名优先由 linkifyBooks 的 earliest-then-longest 处理。
// 书名全站唯一,故跨组也安全:某组延伸提到的他派书名(如法家延伸里的「孟子」)即链到对面那部书。
export function globalBookRefs({ excludeCorpus, excludeSlug } = {}) {
  const refs = []
  for (const b of ALL_BOOKS) {
    if (b.corpus === excludeCorpus && b.slug === excludeSlug) continue
    for (const n of [b.title, ...b.aliases]) {
      const clean = cleanName(n)
      if (clean.length >= 2) refs.push({ title: clean, to: b.href })
    }
  }
  return refs.sort((a, b) => b.title.length - a.title.length)
}
