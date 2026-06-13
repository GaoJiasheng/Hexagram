// 通用 corpus 抓取驱动(v16 §1)——佛/儒等读经类站共用一套管线。
// 用法:node scripts/fetch-corpus.mjs <key>  (key ∈ ru/fo;读 scripts/corpus/<key>.config.mjs 的 BOOKS)
// 产出:src/data/<key>/classics/{slug}.json;人工译文来自 scripts/authored/<key>-translations.json。
// 与道藏(fetch-dao.mjs)同构、共享 wikisource.mjs 与缓存;但解析模型不同:
//   每个源页 = 一章;页内 ==标题== 行、章号标记行(论语「一之X」)、导航链接行一律剔除,
//   余下文本行各为一段。原文一律来自抓取,严禁手改、严禁凭记忆补。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, clean, isJunk as isJunkBase, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json') // 与易经/道藏管线共享缓存
const { fetchPages } = createFetcher(CACHE_FILE)

const key = process.argv[2]
if (!key) {
  console.error('用法: node scripts/fetch-corpus.mjs <key>  (如 ru / fo)')
  process.exit(1)
}

// 导航/版本行:外链、列表式跨页链接(*[[…]])、语言转换残文
const isJunk = (text) => isJunkBase(text) || /^\[http/.test(text) || /^-\{/.test(text) || /^[a-z]{2,3}:/i.test(text)
// 章号标记行(论语 div 内「一之一」「十一之二」之类),清洗后为纯篇序之章序
const CHAPTER_MARK_RE = /^[一二三四五六七八九十百]+之[一二三四五六七八九十百]+$/
// 页尾「有声文献」诵读块(链接+录制说明+「更多有声文献」),命中即停止解析本页
const STOP_RE = /有聲文獻|Spoken_?Wikisource|ximalaya/i
// 横线分隔(----)与纯数字卷次行(孟子各卷页尾的导航残留)
const NAV_LINE_RE = /^(?:[-－—]{2,}|\d{1,3})$/
// 含字校勘模板 {{另|主|注}} / {{另2|主|注}}:取首参(主读),先于通用模板清洗
const replaceAnother = (s) => s.replace(/\{\{另\d?\|([^|{}]*)(?:\|[^{}]*)*\}\}/g, '$1')
// 行内 <ref>…</ref> 校勘注(常含外链),整段剔除——经文只留正文(论语各篇为单行,无跨行 ref)
const stripRef = (s) => s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')

// 单页 → 段落数组(各源页即一章)
function parsePageParas(wikitext, warnings, pageName) {
  const paras = []
  for (const raw of wikitext.split('\n')) {
    if (STOP_RE.test(raw)) break                       // 页尾诵读块,其后不再有正文
    const trimmed = raw.trim()
    if (/^=+.*=+$/.test(trimmed)) continue           // == 标题 == / === N === 章标记行
    if (/^\*+\s*\[\[/.test(trimmed)) continue          // *[[…]] 导航链接行
    const text = clean(replaceAnother(stripRef(raw)).replace(/^[*#:;]+/, ''))
    if (isJunk(text)) continue
    const simp = t2s(text).replaceAll('愼', '慎')   // OpenCC 未规范的异体字补正(慎)
    if (!simp || CHAPTER_MARK_RE.test(simp) || NAV_LINE_RE.test(simp)) continue   // 空行 / 章号 / 横线 / 卷次
    paras.push({ original: simp, translation: null })
  }
  if (!paras.length) warnings.push(`${pageName}: 解析后无任何段落`)
  return paras
}

async function main() {
  const { BOOKS } = await import(path.join(ROOT, `scripts/corpus/${key}.config.mjs`))
  const OUT_DIR = path.join(ROOT, `src/data/${key}/classics`)
  const warnings = []
  const errors = []
  const trPath = path.join(ROOT, `scripts/authored/${key}-translations.json`)
  const translations = fs.existsSync(trPath) ? JSON.parse(fs.readFileSync(trPath, 'utf8')) : {}

  const allPages = BOOKS.flatMap((b) => b.pages)
  const pages = await fetchPages(allPages)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []

  for (const book of BOOKS) {
    const single = book.pages.length === 1
    const chapters = []
    for (const page of book.pages) {
      const paras = parsePageParas(pages[page], warnings, page)
      const seg = page.includes('/') ? page.slice(page.indexOf('/') + 1) : page
      const title = single ? null : t2s(seg)
      if (paras.length) chapters.push({ no: chapters.length + 1, title, paragraphs: paras })
      else warnings.push(`${page}: 无正文段落`)
    }

    if (book.exactChapters && chapters.length !== book.exactChapters) {
      errors.push(`${book.title}: 应恰 ${book.exactChapters} 章,实得 ${chapters.length}`)
    }

    // 合并人工译文(章号 → 段序数组)
    const bookTr = translations[book.slug] ?? {}
    let trCount = 0
    for (const c of chapters) {
      const ps = bookTr[String(c.no)]
      if (!ps) continue
      c.paragraphs.forEach((p, i) => {
        if (ps[i]) { p.translation = ps[i]; trCount++ }
      })
    }

    const out = { book: book.slug, title: book.title, chapters }
    fs.writeFileSync(path.join(OUT_DIR, `${book.slug}.json`), JSON.stringify(out, null, 2) + '\n')
    const paraTotal = chapters.reduce((n, c) => n + c.paragraphs.length, 0)
    summary.push(`${book.title}: ${chapters.length} 章,${paraTotal} 段,译文 ${trCount} 段`)
  }

  for (const w of warnings) console.warn('⚠', w)
  for (const s of summary) console.log(s)
  if (errors.length) {
    for (const e of errors) console.error('✗', e)
    process.exit(1)
  }
  console.log(`已写入 ${OUT_DIR}(${BOOKS.length} 部)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
