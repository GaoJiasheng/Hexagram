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
  if (/^\[\d+\][^[]{0,16}[：:]/.test(raw.trim())) return null  // 校勘脚注行(如难经「[1]字：原作…据《…》改」),整行剔除
  // 剥离正文内联校注锚 [数字](难经经文如「其脉浮[1]在…」);经典正文不用 [数字] 故他书 no-op
  const text = clean(replaceAnother(preResolve(stripRef(raw))).replace(/^[*#:;]+/, '').replace(/\[\d+\]/g, ''))
  if (isJunk(text)) return null
  const simp = t2s(text).replaceAll('愼', '慎').replaceAll('擧', '举')   // OpenCC 未规范的异体字补正(慎/举)
  if (!simp || CHAPTER_MARK_RE.test(simp) || NAV_LINE_RE.test(simp) || PIN_TITLE_RE.test(simp) || LOSS_NOTE_RE.test(simp) || /^__\w+__$/.test(simp) || /^目\s*[录錄]/.test(simp)) return null
  return simp
}

// 诗经专用:一诗一页,页内构造不统一——部分诗以「===毛诗序===/===诗文===」分节标题隔开头注与正文
// (樛木一类),部分以「毛诗序：「…」」内嵌一行不另立标题(那/文王一类),《关雎》因是开篇更叠了鲁诗说/
// 齐诗说/韩诗说三家序甚至「鲁齐韩三家说」合并标题(何彼襛矣),个别另附「安大简本」等出土文献异文
// 对照(蒹葭)、页首「詩經‧类别‧诗题」面包屑重复行(部分页无 < 前缀故不落入 clean() 的残段清除)、
// 表格式版式残留的 `!诗题` 表头行(鸤鸠);页尾另有「《X》，N章，M句」计数注(个别诗页内文用异体字
// 拼写与页名不同,如「何彼襛矣」页内作「何彼穠矣」,故计数注判据须用通配、不能只靠精确诗题匹配)、
// 「===注解/注释===」训诂节。
// 判据:①序类/异文类小标题(毛诗序/毛诗说/毛诗叙/鲁诗说/…/鲁齐韩三家说/诗序/小序/X简本/X帛书本)
// 本身非正文,其下内容整段跳过;②内嵌无标题的「毛诗序：」行逐行丢弃;③面包屑行(诗经‧…)、表头行
// (!…)、与本诗诗题相同的裸标题行(节南山、丰)逐行丢弃;④以书名号起首、句中含「章」「句」的计数注
// 逐行丢弃(通配,不要求诗题字形与页名完全一致);⑤训诂节即本诗终点。
const SHI_XU_LINE_RE = /^毛诗序/
const SHI_BREADCRUMB_RE = /^诗经[‧·]/
const SHI_STANZA_NOTE_RE = /^《[^》]+》.*[章句]/
const SHI_SKIP_HEADING_RE = /(诗(序|说|叙)$)|(简本$)|(帛书本?$)|^小序$|^鲁齐韩三家说$/
// 子串匹配(非锚定):个别多国合页的「注解」标题被语言转换标记包住(如「-{zh-hans:註解; zh-hant:註解}-」
// 未被通用 clean() 的简化 -{}- 处理器完全拆开),子串匹配可稳健命中。
const SHI_STOP_HEADING_RE = /注解|注释/
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// sectionFilter:同页含多首同名诗(如「白华」笙诗〔亡辞〕与魚藻之什实有其辞的「白华」共享一页,
// 以「----」分隔为两个 === 小节),仅取标题含 sectionFilter 的小节;不传则不作节过滤,遇训诂节即停。
// (已核实:8 处同页消歧诗均为内嵌无标题的简单形式,不含毛诗序/诗文分节标题,故消歧模式下不需
// 处理 SHI_SKIP_HEADING_RE 与 sectionFilter 的层级交互——两套机制分工清晰、互不纠缠。)
function parsePoemPage(wikitext, warnings, pageName, sectionFilter = null) {
  const paras = []
  const filterSimp = sectionFilter ? t2s(sectionFilter) : null // 标题已简体化,过滤关键字(配置里或写繁体)需同转
  let active = !sectionFilter
  let controlLevel = null // 记录使 active 生效的标题层级,子级标题(层级更深)不重判、继承父级状态
  const poemName = t2s(pageName.slice(pageName.indexOf('/') + 1))
  const selfTitleRe = new RegExp(`^《${reEscape(poemName)}》`)
  // 长短经等篇内含 {{*|议曰：…}} 大段夹注(可能跨行),需先整段剔除(同战国策处理);诗经无此标记,no-op。
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break
    const h = raw.trim().match(/^(=+)\s*(.+?)\s*=+$/)
    if (h) {
      const level = h[1].length
      const title = t2s(clean(h[2]))
      if (SHI_STOP_HEADING_RE.test(title)) {
        // 仅当前(或无节过滤)已在目标节内时,训诂节才是本诗终点;否则可能是另一同页诗的训诂节,继续找目标节
        if (!sectionFilter || active) break
        continue
      }
      if (sectionFilter) {
        if (controlLevel === null || level <= controlLevel) {
          active = title.includes(filterSimp)
          controlLevel = level
        }
        continue
      }
      // 无节过滤(单一诗页):序类小标题本身非正文,其下内容跳过;其余标题(诗文/诗题自身重复/
      // 国风归属行)一律视为正文段起点。
      active = !SHI_SKIP_HEADING_RE.test(title)
      continue
    }
    if (!active) continue
    if (/^!/.test(raw.trim())) continue // 表格式版式残留的表头行(如「!鳲鳩」)
    const simp = cleanLine(raw)
    if (!simp || simp === poemName) continue
    if (SHI_XU_LINE_RE.test(simp) || selfTitleRe.test(simp) || SHI_STANZA_NOTE_RE.test(simp) || SHI_BREADCRUMB_RE.test(simp)) continue
    paras.push({ original: simp, translation: null })
  }
  if (!paras.length) warnings.push(`${pageName}: 解析后无任何段落`)
  return paras
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
function parsePageChapters(wikitext, warnings, pageName, book = {}) {
  // mergeHeadingRe:匹配的标题不另起章,内容并入上一章(如金匮附方并入前篇);
  // dropChapterRe:切章后丢弃标题匹配的整章(如六韬卷题章「文韬」等只含卷标无正文)。
  const mergeRe = book.mergeHeadingRe ? new RegExp(book.mergeHeadingRe) : null
  const dropRe = book.dropChapterRe ? new RegExp(book.dropChapterRe) : null
  const chapters = []
  let cur = null
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break
    const h = raw.trim().match(/^=+\s*(.+?)\s*=+$/)
    if (h) {
      const rawTitle = h[1].replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '')  // 剔标题内 <ref> 校勘
      const title = t2s(clean(rawTitle).replace(/『[^』]*』/g, '').replace(/「[^」]*」/g, '')).trim()
      if (!title || HEADING_SKIP_RE.test(title)) { cur = null; continue }
      if (mergeRe && mergeRe.test(title) && chapters.length) { cur = chapters[chapters.length - 1]; continue }
      cur = { title, paragraphs: [] }
      chapters.push(cur)
      continue
    }
    const simp = cleanLine(raw)
    if (simp && cur && simp !== cur.title) cur.paragraphs.push({ original: simp, translation: null }) // 丢章末重复的经题
  }
  let kept = chapters.filter((c) => c.paragraphs.length)
  if (dropRe) kept = kept.filter((c) => !dropRe.test(c.title))
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

  const allPages = BOOKS.flatMap((b) => b.groupPages
    ? b.groupPages.flatMap((g) => g.pages.map((p) => (typeof p === 'string' ? p : p.page)))
    : b.pages)
  const pages = await fetchPages(allPages)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []

  for (const book of BOOKS) {
    const single = !book.groupPages && book.pages.length === 1 && !book.splitHeadings
    const chapters = []
    // 内联卷题切章(韬晦术:单页无 == 标题,卷题「隐晦卷一」等内联成行,按 markPattern 切)
    if (book.markPattern) {
      const re = new RegExp(book.markPattern)
      let cur = null
      for (const p of parsePageParas(pages[book.pages[0]], warnings, book.pages[0])) {
        if (re.test(p.original)) { cur = { no: chapters.length + 1, title: p.original, paragraphs: [] }; chapters.push(cur) }
        else if (cur) cur.paragraphs.push(p)
      }
    } else
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
    // 多页合一章(诗经:一诗一页,按国风/什归组,组内诸诗顺次接续、诗题作为一段插在诗句之前)
    if (book.groupPages) {
      for (const group of book.groupPages) {
        const paragraphs = []
        for (const entry of group.pages) {
          const page = typeof entry === 'string' ? entry : entry.page
          const section = typeof entry === 'string' ? null : entry.section
          const poemParas = parsePoemPage(pages[page], warnings, page, section)
          if (!poemParas.length) continue
          const poemTitle = t2s(page.slice(page.indexOf('/') + 1))
          paragraphs.push({ original: `《${poemTitle}》`, translation: null })
          paragraphs.push(...poemParas)
        }
        if (paragraphs.length) chapters.push({ no: chapters.length + 1, title: t2s(group.title), paragraphs })
        else warnings.push(`${group.title}: 分组无内容`)
      }
    } else
    for (const page of book.pages) {
      if (book.splitHeadings) {
        // 单页按标题切多章(金刚经 32 分)
        for (const c of parsePageChapters(pages[page], warnings, page, book)) {
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

    // dropParaRe:逐段丢弃匹配的非正文段(经题/卷题/撰人题等,如证道歌首标题与撰人题)
    if (book.dropParaRe) {
      const re = new RegExp(book.dropParaRe)
      for (const c of chapters) c.paragraphs = c.paragraphs.filter((p) => !re.test(p.original))
    }
    // stopParaRe:章内遇首个匹配段即截断(含其后),剔除正文后的附录(如阿弥陀经正文末「佛说阿弥陀经」经题后所附往生咒、译咒题记)
    if (book.stopParaRe) {
      const re = new RegExp(book.stopParaRe)
      for (const c of chapters) { const idx = c.paragraphs.findIndex((p) => re.test(p.original)); if (idx >= 0) c.paragraphs = c.paragraphs.slice(0, idx) }
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
