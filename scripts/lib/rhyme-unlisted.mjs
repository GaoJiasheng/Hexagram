// 韵书未收字统计(M8 · 韵书与未收字页)。生成脚本 scripts/gen-rhyme-unlisted.mjs 与校验闸
// scripts/lib/check-rhyme.mjs 共用这一份算法——闸据此重算,与落盘的 unlisted.json 不一致即报「过期」。
//
// **只统计,不补字**。查法与阅读器「格律」开关完全同一套:切句用 prosody.js 的 analyzeParagraphs
// (诗题 / 曲牌题段不计、按 ，。；！？ 切句),查字用 rhymePart(本字 → 平水韵【詞】增补 → 异体退查表,
// 简繁两种写法都进了韵书索引)。查不到的,就是读者在正文里看到「未收」的那些字。
import fs from 'node:fs'
import path from 'node:path'
import { analyzeParagraphs, rhymePart } from '../../src/features/reader/prosody.js'
import { chapterParts } from '../../src/features/reader/chapterParts.js'

/** 三组诗词各用哪部韵书(与 CorpusReadPage 的 prosodyFor 一致)。 */
export const RHYME_GROUPS = [
  { corpus: 'tangshi', label: '唐诗', scheme: 'pingshui', slugs: ['tangshi300'] },
  { corpus: 'songci', label: '宋词', scheme: 'cilin', slugs: ['songci300', 'songci-buyi'] },
  { corpus: 'yuanqu', label: '元曲', scheme: 'zhongyuan', slugs: ['yuanqu'] },
]
export const BOOK_PAGES = { pingshui: '平水韻', cilin: '詞林正韻', zhongyuan: '中原音韻' }
export const BOOK_TITLES = { pingshui: '平水韵', cilin: '词林正韵', zhongyuan: '中原音韵' }
export const MAX_EXAMPLES = 3

const chars = (s) => [...(s || '')]
const uniq = (arr) => new Set(arr).size
const isPoemTitle = (t) => /^《[^》]+》$/.test(t.trim())
const CN_ORDINAL = /^[一二三四五六七八九十]+$/

/** 读三部韵书(原样 json;prosody.js 的查表函数会就地挂上部 id 查表)。 */
export function readRhymeBooks(ROOT, readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))) {
  const out = {}
  for (const k of Object.keys(BOOK_PAGES)) out[k] = readJson(path.join(ROOT, 'src/data/rhyme', `${k}.json`))
  return out
}

/** 韵书概况:部数、收字数(繁体本字去重,与 check-rhyme 的口径一致)、索引键数、异体退查条数。 */
export function bookSummary(scheme, d) {
  const base = {
    scheme,
    title: BOOK_TITLES[scheme],
    page: BOOK_PAGES[scheme],
    parts: d.parts.length,
    indexKeys: Object.keys(d.index).length,
    variants: Object.keys(d.variants || {}).length,
  }
  if (scheme === 'pingshui') {
    return {
      ...base,
      sheng: Object.fromEntries(['上平', '下平', '上', '去', '入'].map((s) => [s, d.parts.filter((p) => p.sheng === s).length])),
      chars: uniq(d.parts.flatMap((p) => chars(p.chars))),
      ciChars: uniq(d.parts.flatMap((p) => chars(p.ciChars))),
    }
  }
  if (scheme === 'cilin') {
    return {
      ...base,
      shu: d.parts.filter((p) => p.tone !== '入').length, // 舒声部(平仄同部)
      ru: d.parts.filter((p) => p.tone === '入').length, // 入声部
      chars: uniq(d.parts.flatMap((p) => chars(p.chars))),
    }
  }
  return {
    ...base,
    chars: uniq(d.parts.flatMap((p) => Object.values(p.groups).flat().flatMap(chars))),
  }
}

// 一首诗的称呼:唐诗一卷几十首,取段前最近的《诗题》;词、曲一章即一首(元曲一章含数支小令时,
// 缀上段前的小题,如「醉中天 (王和卿)·咏大蝴蝶」)。小题:无句读、≤12 字、非【宫调】题、
// 非（小序）、非「小令 / 套数」、非纯序数(组曲的「一」「二」)。
function subTitleOf(t) {
  if (/[\uFF0C\u3002\uFF1B\uFF01\uFF1F]/.test(t) || /^[【（(]/.test(t)) return null
  const han = chars(t).filter((c) => /\p{Script=Han}/u.test(c)).length
  if (!han || han > 12 || ['小令', '套数'].includes(t) || CN_ORDINAL.test(t)) return null
  return t.replace(/[\uFF1A:]$/, '')
}

/**
 * 统计一组诗词的未收字。
 * @param {{corpus,label,scheme,slugs}} group
 * @param {object} books 三部韵书 json
 * @param {(corpus, slug) => {chapters}} loadClassic
 * @param {(corpus, slug) => object|null} metaOf texts.json 里该书的条目(算长章拆屏用)
 */
export function computeGroup(group, books, loadClassic, metaOf) {
  const { corpus, scheme, slugs } = group
  const book = books[scheme]
  const cache = new Map() // 字 → 查表结果(同一字不重复查)
  const lookup = (c) => {
    if (!cache.has(c)) cache.set(c, rhymePart(c, scheme, book))
    return cache.get(c)
  }
  const stats = { chars: 0, lines: 0, unlisted: 0, distinct: 0, rate: 0, endUnlisted: 0, endDistinct: 0, viaVariant: 0 }
  if (scheme === 'pingshui') stats.viaCi = 0
  const byChar = new Map() // 字 → { count, endCount, occ: [...] }

  for (const slug of slugs) {
    const data = loadClassic(corpus, slug)
    const meta = metaOf(corpus, slug)
    for (const chapter of data.chapters) {
      const texts = chapter.paragraphs.map((p) => p.original)
      const res = analyzeParagraphs(texts, { scheme, tones: false, books: { [scheme]: book } })
      const parts = chapterParts(chapter, meta)
      const partOf = (i) => (parts ? parts.findIndex((pt) => i >= pt.from && i < pt.to) + 1 : 0)
      let poemTitle = chapter.title || `第${chapter.no}章`
      let poemKey = `${chapter.no}`
      chapter.paragraphs.forEach((p, i) => {
        // 出处追踪(不影响统计口径,只为例句有个可读的出处)
        const t = p.original.trim()
        if (meta?.poemTitles) {
          if (isPoemTitle(t)) { poemTitle = t.replace(/^《|》$/g, ''); poemKey = `${chapter.no}-${i}` }
        } else if (!res[i]) {
          const sub = subTitleOf(t)
          if (sub) {
            poemTitle = chapter.title && !chapter.title.includes(sub) ? `${chapter.title}·${sub}` : chapter.title || sub
            poemKey = `${chapter.no}-${i}`
          }
        }
        const lines = res[i]
        if (!lines) return
        for (const ln of lines) {
          stats.lines++
          const line = ln.chars.map((x) => x.c).join('')
          ln.chars.forEach((x, j) => {
            stats.chars++
            const r = lookup(x.c)
            const end = j === ln.chars.length - 1
            if (r) {
              if (r.variant) stats.viaVariant++
              if (r.ci && scheme === 'pingshui') stats.viaCi++
              return
            }
            stats.unlisted++
            if (end) stats.endUnlisted++
            let e = byChar.get(x.c)
            if (!e) byChar.set(x.c, (e = { count: 0, endCount: 0, occ: [] }))
            e.count++
            if (end) e.endCount++
            e.occ.push({ slug, ch: chapter.no, title: poemTitle, line, para: i, part: partOf(i), end, poem: `${slug}/${poemKey}` })
          })
        }
      })
    }
  }

  const items = [...byChar.entries()].map(([char, e]) => ({ char, count: e.count, endCount: e.endCount, examples: pickExamples(e.occ) }))
  items.sort((a, b) => b.count - a.count || b.endCount - a.endCount || (a.char < b.char ? -1 : a.char > b.char ? 1 : 0))
  stats.distinct = items.length
  stats.endDistinct = items.filter((x) => x.endCount > 0).length
  stats.rate = stats.chars ? Math.round((stats.unlisted / stats.chars) * 1e5) / 1e5 : 0
  return { corpus, label: group.label, scheme, slugs, stats, items }
}

// 例句 ≤3:先取句末(读者在韵脚签上看到「未收」的那些)、再取句中;尽量各出一首,不重复同一首。
function pickExamples(occ) {
  const out = []
  const poems = new Set()
  const take = (o) => {
    const { poem, part, ...ex } = o
    if (part) ex.part = part
    out.push(ex)
    poems.add(poem)
  }
  for (const pass of [(o) => o.end && !poems.has(o.poem), (o) => !poems.has(o.poem), () => true]) {
    for (const o of occ) {
      if (out.length >= MAX_EXAMPLES) return out
      if (out.some((x) => x.slug === o.slug && x.ch === o.ch && x.para === o.para && x.line === o.line)) continue
      if (pass(o)) take(o)
    }
  }
  return out
}

/** 全量:三部韵书概况 + 三组未收字。 */
export function computeUnlisted({ ROOT, readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8')), books } = {}) {
  const bks = books || readRhymeBooks(ROOT, readJson)
  const classicCache = {}
  const loadClassic = (corpus, slug) => {
    const k = `${corpus}/${slug}`
    return (classicCache[k] ||= readJson(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)))
  }
  const metaCache = {}
  const metaOf = (corpus, slug) => {
    if (!(corpus in metaCache)) {
      const f = path.join(ROOT, `src/data/${corpus}/texts.json`)
      const list = fs.existsSync(f) ? readJson(f) : []
      metaCache[corpus] = Array.isArray(list) ? list : list.texts || []
    }
    return metaCache[corpus].find((x) => x.slug === slug) || null
  }
  return {
    note: '韵书未收字统计:与阅读器「格律」开关同一套查法(prosody.js),只统计、不补字。由 scripts/gen-rhyme-unlisted.mjs 生成,不手改。',
    books: Object.fromEntries(Object.keys(BOOK_PAGES).map((k) => [k, bookSummary(k, bks[k])])),
    groups: RHYME_GROUPS.map((g) => computeGroup(g, bks, loadClassic, metaOf)),
  }
}
