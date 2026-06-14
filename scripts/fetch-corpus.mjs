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
// 横线分隔(----)、纯数字卷次行、「上一篇 回目录 下一篇」页脚导航(孟子各卷页尾的残留)
const NAV_LINE_RE = /^(?:[-－—]{2,}|\d{1,3})$|回目[录錄]|^(?:上|下)一[篇章卷]/
// 品/分题独立成行(坛经各品页正文里重复的「行由品第一」等),作标记行剔除
const PIN_TITLE_RE = /^.{1,7}[品分]第[一二三四五六七八九十]+$/
// 亡篇占位注(商君书御盗「[内容及篇目俱亡]」、他书「(闕)」「篇亡」等),整行为编者注非经文,剔除
const LOSS_NOTE_RE = /^[【\[（(].{0,24}[亡闕阙缺佚].{0,24}[】\])）]$/
// splitHeadings 模式下需跳过的非经文标题(金刚经「正文/外部链接」、心经 djvu 页的明太祖序等)
const HEADING_SKIP_RE = /^(正文|外部連結|外部链接|參考|参考|附錄|附录|注釋|注释|目錄|目录|答話|答话)$|序$/
// 解析 -{…}- 繁简转换标记:多变体语法 -{zh:X;zh-hans:Y;zh-hant:Z}- 取简体(zh-hans/zh-cn),
// 单体 -{乾}- / -{T|乾}- 取本字。
const pickConv = (inner) => {
  if (/(?:^|;)\s*zh[\w-]*\s*:/.test(inner)) {
    const map = {}
    for (const seg of inner.split(';')) {
      const m = seg.match(/^\s*([\w-]+)\s*:\s*([\s\S]*)$/)
      if (m) map[m[1]] = m[2].trim()
    }
    return map['zh-hans'] ?? map['zh-cn'] ?? map['zh'] ?? map['zh-hant'] ?? Object.values(map)[0] ?? inner
  }
  return inner.replace(/^[A-Za-z]\|/, '')
}
// 先解析行内链接与繁简转换标记,使 {{另}} 模板首参(经文)不再内含 | 和 { }
// (如 {{另2|《[[尚書|書]]》-{云}-…|校勘}} 的首参含 [[..|..]] 与 -{..}-,否则下面取首参会失败、经文被整段删)
const preResolve = (s) => s
  .replace(/-\{([^{}]*?)\}-/g, (_, inner) => pickConv(inner))
  .replace(/<\/?onlyinclude>/gi, '')                                          // 罗织经等 <onlyinclude> 包裹标记
  .replace(/__[A-Z]+__/g, '')                                                 // __TOC__/__NOTOC__ 魔术字(行内)
  .replace(/\{\{ProperNoun\|([^|}]*)(?:\|[^}]*)?\}\}/gi, '$1')                 // {{ProperNoun|左丘明}} → 左丘明
  .replace(/\{\{(?:Novel|footer|header2?|Textquality|PD-old|NoteTA|检索|檢索|gap|reflist|DEFAULTSORT)[^{}]*\}\}/gi, '')  // 元/导航模板
  .replace(/\{\{[^{}]*?作品\}\}/g, '')                                         // {{唐朝作品}} 等版权模板
  .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  .replace(/\[\[(?:[^\][|]*\|)?([^\][]*)\]\]/g, '$1')
// 含字校勘模板 {{另|主|注}} / {{另2|主|注}}:取首参(主读、即经文),先于通用模板清洗
const replaceAnother = (s) => s.replace(/\{\{另\d?\|([^|{}]*)(?:\|[^{}]*)*\}\}/g, '$1')
// 行内 <ref>…</ref> 校勘注(常含外链),整段剔除——经文只留正文(论语各篇为单行,无跨行 ref)
const stripRef = (s) => s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')

// 维基文库页首 {{header ... }} 元数据块:整块剔除。其多行字段(如 override_author =
// [[作者:孟子|孟轲\n]]及其弟子公孙丑、万章等人)的断行会让闭合 ]] 那一行漏出残文——
// 该行不以 {|}= 起首,逃过 isJunk(孟子告子上/下曾各漏出一段)。按花括号配平扫描整块切除,
// 容忍字段内嵌套模板({{gap}} 等);切前置于逐行解析,paras/chapters 两路共用。
function stripHeaderBlock(wikitext) {
  const m = /\{\{\s*header\b/i.exec(wikitext)
  if (!m) return wikitext
  const start = m.index
  let depth = 0
  let i = start
  while (i < wikitext.length) {
    if (wikitext.startsWith('{{', i)) { depth++; i += 2; continue }
    if (wikitext.startsWith('}}', i)) { depth--; i += 2; if (depth === 0) break; continue }
    i++
  }
  return wikitext.slice(0, start) + wikitext.slice(i)
}

// 战国策(士礼居叢書本)校注模板 {{*|姚本…}} / {{*|鮑本…}} / {{*|補曰…}}:整段剔除。
// 括号配平扫描(容嵌套 {{gap}} 等与跨行),只去校注、保经文。仅含 `{{*` 的书受影响,他经无此标记。
function stripStarTemplates(wikitext) {
  if (!wikitext.includes('{{*')) return wikitext
  let out = ''
  let i = 0
  while (i < wikitext.length) {
    if (wikitext.startsWith('{{*', i)) {
      let depth = 0
      let j = i
      while (j < wikitext.length) {
        if (wikitext.startsWith('{{', j)) { depth++; j += 2; continue }
        if (wikitext.startsWith('}}', j)) { depth--; j += 2; if (depth === 0) break; continue }
        j++
      }
      i = j
      continue
    }
    out += wikitext[i]
    i++
  }
  return out
}

// 行清洗 → 简体正文;若为导航/标题/标记/空行返回 null
function cleanLine(raw) {
  if (/^\*+\s*\[\[/.test(raw.trim())) return null          // *[[…]] 导航链接行
  const text = clean(replaceAnother(preResolve(stripRef(raw))).replace(/^[*#:;]+/, ''))
  if (isJunk(text)) return null
  const simp = t2s(text).replaceAll('愼', '慎').replaceAll('擧', '举')   // OpenCC 未规范的异体字补正(慎/举)
  if (!simp || CHAPTER_MARK_RE.test(simp) || NAV_LINE_RE.test(simp) || PIN_TITLE_RE.test(simp) || LOSS_NOTE_RE.test(simp) || /^__\w+__$/.test(simp) || /^目\s*[录錄]/.test(simp)) return null
  return simp
}

// 单页 → 段落数组(各源页即一章)
function parsePageParas(wikitext, warnings, pageName) {
  const paras = []
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break                       // 页尾诵读块,其后不再有正文
    if (/^=+.*=+$/.test(raw.trim())) continue          // == 标题 == 行
    const simp = cleanLine(raw)
    if (simp) paras.push({ original: simp, translation: null })
  }
  if (!paras.length) warnings.push(`${pageName}: 解析后无任何段落`)
  return paras
}

// 单页按 == 标题 == 切多章(金刚经 32 分):标题去『…』夹注;跳过「正文/外部链接」等非经文标题;
// 首个有效标题前的内容(开经偈、礼佛文等)丢弃。
function parsePageChapters(wikitext, warnings, pageName) {
  const chapters = []
  let cur = null
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break
    const h = raw.trim().match(/^=+\s*(.+?)\s*=+$/)
    if (h) {
      const rawTitle = h[1].replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '')  // 剔标题内 <ref> 校勘
      const title = t2s(clean(rawTitle).replace(/『[^』]*』/g, '').replace(/「[^」]*」/g, '')).trim()
      if (!title || HEADING_SKIP_RE.test(title)) { cur = null; continue }
      cur = { title, paragraphs: [] }
      chapters.push(cur)
      continue
    }
    const simp = cleanLine(raw)
    if (simp && cur && simp !== cur.title) cur.paragraphs.push({ original: simp, translation: null }) // 丢章末重复的经题
  }
  const kept = chapters.filter((c) => c.paragraphs.length)
  if (!kept.length) warnings.push(`${pageName}: 切章后无内容`)
  return kept
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
    const single = book.pages.length === 1 && !book.splitHeadings
    const chapters = []
    // 摘录式(战国策):跨卷切章后,按 pickHeadings 顺序挑选指定章并改用友好标题(v18 §1 纵横)
    if (book.pickHeadings) {
      const all = book.pages.flatMap((p) => parsePageChapters(pages[p], warnings, p).map((c) => ({ ...c, page: p })))
      for (const pick of book.pickHeadings) {
        const matched = all.filter((c) => c.title.includes(pick.match) && (!pick.page || c.page === pick.page))
        if (!matched.length) { errors.push(`${book.title}: 未找到摘录章「${pick.match}」`); continue }
        if (matched.length > 1) warnings.push(`${book.title}: 摘录「${pick.match}」命中 ${matched.length} 章,取第一`)
        chapters.push({ no: chapters.length + 1, title: pick.title, paragraphs: matched[0].paragraphs })
      }
    } else
    for (const page of book.pages) {
      if (book.splitHeadings) {
        // 单页按标题切多章(金刚经 32 分)
        for (const c of parsePageChapters(pages[page], warnings, page)) {
          chapters.push({ no: chapters.length + 1, title: c.title, paragraphs: c.paragraphs })
        }
        continue
      }
      const paras = parsePageParas(pages[page], warnings, page)
      const seg = page.includes('/') ? page.slice(page.indexOf('/') + 1) : page
      const title = single ? null : t2s(seg)
      if (paras.length) chapters.push({ no: chapters.length + 1, title, paragraphs: paras })
      else warnings.push(`${page}: 无正文段落`)
    }

    // 子页书友好章名覆盖(罗织经 01..12 → 阅人卷一 等),按序赋予
    if (book.chapterTitles) chapters.forEach((c, i) => { if (book.chapterTitles[i]) c.title = book.chapterTitles[i] })

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
