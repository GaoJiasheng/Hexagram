#!/usr/bin/env node
// 观书(src/data/books/)→ 书包(.deskbook,docs/deskbook-standard.md)。
//
//   node scripts/desk/books-to-deskbook.mjs [slug…|--all] [-o <目录>] [--no-ledger]
//
// 每本书出一个 g-<slug>.deskbook(默认写到 scripts/.cache/deskbooks/,已 gitignore),
// 打包后立刻用核心库 validate(unzip(bytes)) 回校;有一本不过,退出码非零。
// 书一级(标准 §11):全书总览(源 overview.json)→ 书包根上的 overview.json;思想脑图 → 根上的 mindmap.json(§10)。
// 章一级:文章 n 就是第 n 章;chapters[].summary 取文章中心句,超 80 字在句读处截短。脑图 ref.ch = n → ch n。
// 插画:scripts/.cache/desk-art/books-export/<slug>/ 下有 cover.jpg / banner.jpg / head-0.jpg(总览题头)/ head-<n>.jpg(第 n 章)
//   就收进 media/,没有就不带(另一条管线在产出这个目录,可空可缺)。
// 版本号:台账 scripts/authored/desk-shelf-revisions.json = { id: { revision, sha256(打出的书包) } };
//   打出来的字节与台账不同就 revision +1 重打并记账,相同不动。--no-ledger 照算版本号但不写台账。
// 块的转法照 scripts/build-desk-packs.mjs 的 buildBaihua(站内 type/text → 书包 t/x)。
// 有损的每一步都计数,最后汇总打印;源文件一律只读。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { zip, unzip, validate, summarize, formatIssue, LIMITS, DISCLAIMER_VOCAB, chapterFile, textLen, checkFigShape, ID_PATTERN, MINDMAP_FILE, OVERVIEW_FILE } from './deskbook-core.mjs'
import { figKey, checkFig } from './fig-gate.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BOOKS = path.join(ROOT, 'src/data/books')
const FIGS_FILE = path.join(ROOT, 'scripts/authored/desk-figs/books.json')
const ART_DIR = process.env.DESK_ART_DIR ? path.resolve(process.env.DESK_ART_DIR) : path.join(ROOT, 'scripts/.cache/desk-art/books-export') // 环境变量可另指(试跑用)
const LEDGER_FILE = path.join(ROOT, 'scripts/authored/desk-shelf-revisions.json')
const GENERATOR = 'books-to-deskbook 1.0'
const t0 = Date.now()

// ── 参数 ──
const argv = process.argv.slice(2)
let outDir = path.join(ROOT, 'scripts/.cache/deskbooks')
const want = []
let all = false
let useLedger = true
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '-o') outDir = path.resolve(argv[++i] || '')
  else if (a === '--all') all = true
  else if (a === '--no-ledger') useLedger = false
  else if (a === '-h' || a === '--help') { console.log('用法:node scripts/desk/books-to-deskbook.mjs [slug…|--all] [-o <目录>] [--no-ledger]'); process.exit(0) }
  else want.push(a)
}
if (!all && !want.length) { console.error('请给 slug,或 --all'); process.exit(2) }

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const index = readJson(path.join(BOOKS, 'index.json'))
const entries = all ? index : want.map((s) => index.find((b) => b.slug === s) || (console.error(`没有这本书:${s}`), process.exit(2)))
// 结构化图解(可能还没有这个文件):figKey(svg) → fig
const FIGS = fs.existsSync(FIGS_FILE) ? readJson(FIGS_FILE) : {}
const ledger = fs.existsSync(LEDGER_FILE) ? readJson(LEDGER_FILE) : {}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')

// ── 计数(全局)──
const S = {
  badId: [], summaryCut: [], summaryUncut: [], heroDropped: 0, featuredDropped: 0,
  ideaAsLead: 0, emptySkipped: 0, unknown: {}, stepObjItems: 0,
  mmNodes: 0, mmRefs: 0, mmBadRefs: [], mmLabelMoved: 0, mmNoteOver: [], mmTruncated: 0, mmNodesOver: [],
  art: { complete: [], partial: [], none: [] }, artFiles: 0,
  overviews: 0, chSummary: 0, chSummaryCut: 0, chSummaryNone: [],
  rev: { same: 0, bumped: [], fresh: [] },
  figTotal: 0, figEmitted: 0, figWaiting: 0, figWaitingKeys: new Set(), figGateFail: 0, figNoCaption: 0,
  tableTotal: 0, tableAsFig: 0, tableFallback: 0,
  disclaimers: {}, svgLeaks: [], titleDiffers: 0, boldFixed: [],
}

// ── 声明:照校验器 vocabHit 的规则(中文子串;英文整词、不分大小写、连字符 / 空格可有可无)──
function vocabHit(domain, terms) {
  const v = DISCLAIMER_VOCAB[domain]
  for (const raw of terms) {
    if (typeof raw !== 'string') continue
    const t = raw.toLowerCase()
    if (v.zh.some((z) => t.includes(z))) return true
    if (v.en.some((e) => new RegExp(`(^|[^a-z])${e.replace(/[-\s]/g, '[-\\s]?')}($|[^a-z])`).test(t))) return true
  }
  return false
}

// ── 一句话简介:超 60 字就在 ≤60 字处的句读边界截断(不补字;截断处的逗号顿号去掉,句号问号留着)──
const BREAK = /[\u3002\uFF01\uFF1F\uFF1B\uFF0C\u3001\uFF1A\u2014\u2026!?;,:]/u // 。！？；，、：—… 与半角 ! ? ; , :
const balanced = (s) => {
  const pairs = [['「', '」'], ['『', '』'], ['《', '》'], ['\uFF08', '\uFF09'], ['(', ')'], ['“', '”']]
  return pairs.every(([a, b]) => s.split(a).length === s.split(b).length) && (s.match(/\*\*/g) || []).length % 2 === 0
}
// 在 ≤ limit 字处的句读边界截出开头一段(不补字;截断处的逗号顿号冒号去掉);找不到返回 null
function cutAt(s, limit) {
  const chars = [...s]
  let best = null
  for (let i = 1; i <= chars.length; i++) {
    if (!BREAK.test(chars[i - 1])) continue
    let head = chars.slice(0, i).join('')
    if (/[\uFF0C\u3001\uFF1A\uFF1B\u2014,;:]$/u.test(head)) head = head.replace(/[\uFF0C\u3001\uFF1A\uFF1B\u2014,;:]+$/u, '')
    if (textLen(head) > limit) break
    if (head && balanced(head)) best = head
  }
  return best
}
function cutSummary(s, slug) {
  if (textLen(s) <= LIMITS.summary) return s
  const best = cutAt(s, LIMITS.summary)
  if (!best) { S.summaryUncut.push(slug); return s } // 找不到合适的边界:原样放,让校验器报出来
  S.summaryCut.push(`${slug}(${textLen(s)}→${textLen(best)})`)
  return best
}

// 章的一句话(chapters[].summary,≤ 80 字、一行):取文章中心句;超长在 ≤ 80 字的句读处截(不补字),找不到边界就不给
function chapterSummary(idea, where) {
  const s = typeof idea === 'string' ? idea.replace(/\s*[\r\n]+\s*/g, ' ').trim() : ''
  if (!s) { S.chSummaryNone.push(`${where}(无中心句)`); return null }
  S.chSummary++
  if (textLen(s) <= LIMITS.chapterSummary && balanced(s)) return s
  const cut = cutAt(s, LIMITS.chapterSummary)
  if (!cut) { S.chSummary--; S.chSummaryNone.push(`${where}(找不到截断点)`); return null }
  S.chSummaryCut++
  return cut
}

// ── 块转换 ──
// 加粗记号 ** 不成对(源文里少数段落开了没关,站上显示为字面的 **):去掉最后一个落单的 **,
// 字一个不改;记下出处,好回头修源文。标准要求成对,不成对校验即不过。
const fixBold = (s, where) => {
  if (typeof s !== 'string' || (s.match(/\*\*/g) || []).length % 2 === 0) return s
  const at = s.lastIndexOf('**')
  S.boldFixed.push(where)
  return s.slice(0, at) + s.slice(at + 2)
}
// items 里的对象({title, text, state} 一类)只取字:有 title 的写成「**title**:text」,不丢小标题
const itemText = (x) => {
  if (typeof x === 'string') return fixBold(x.trim(), CUR)
  if (x && typeof x === 'object' && typeof x.text === 'string') {
    S.stepObjItems++
    return x.title ? `**${x.title}**：${x.text.trim()}` : x.text.trim()
  }
  return ''
}
const items = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(itemText).filter(Boolean)

let CUR = ''
function convertBlocks(src, where) {
  const out = []
  const push = (b) => out.push(b)
  CUR = where
  for (const b of src || []) {
    const x = fixBold(typeof b.text === 'string' ? b.text.trim() : '', where)
    switch (b.type) {
      case 'lead': case 'h2': case 'h3': case 'p': case 'pull':
        if (x) push({ t: b.type, x }); else S.emptySkipped++
        break
      case 'quote': {
        const o = fixBold(typeof b.original === 'string' ? b.original.trim() : '', where)
        const tr = fixBold(typeof b.translation === 'string' ? b.translation.trim() : '', where)
        if (!o && !tr) { S.emptySkipped++; break }
        // 标准的 quote 两种形状二选一:有原话的用原文式(o 原话 + tr 释义);只有一句提示的用一般式(x)
        push(o ? { t: 'quote', o, ...(tr ? { tr } : {}) } : { t: 'quote', x: tr })
        break
      }
      case 'callout': {
        const it = items(b.items)
        if (!it.length) { S.emptySkipped++; break }
        push({ t: 'callout', tone: ['note', 'tip', 'warn'].includes(b.tone) ? b.tone : 'note', ...(b.label ? { label: b.label } : {}), items: it })
        break
      }
      case 'steps': case 'refs': {
        const it = items(b.items)
        if (it.length) push({ t: b.type, items: it }); else S.emptySkipped++
        break
      }
      case 'list': {
        const it = items(b.items)
        if (it.length) push({ t: 'list', ordered: !!b.ordered, items: it }); else S.emptySkipped++
        break
      }
      case 'table': {
        S.tableTotal++
        const fig = { kind: 'table', ...(b.caption ? { title: b.caption } : {}), heads: b.head, rows: b.rows }
        if (!checkFigShape(fig).length) { S.tableAsFig++; push({ t: 'fig', fig }) }
        else {
          // 结构不合规:退成提示框,一行一项,字不丢
          S.tableFallback++
          const rows = [b.head, ...(b.rows || [])].filter(Array.isArray).map((r) => r.join('｜')).filter(Boolean)
          push({ t: 'callout', tone: 'note', label: b.caption || '表', items: rows.length ? rows : ['(空表)'] })
        }
        break
      }
      case 'figure': {
        S.figTotal++
        const key = b.svg ? figKey(b.svg) : null
        const fig = key ? FIGS[key] : null
        const cap = (b.caption || '').trim()
        if (fig && !checkFig(fig, b.svg).length) { S.figEmitted++; push({ t: 'fig', fig, ...(cap ? { cap } : {}) }); break }
        if (fig) S.figGateFail++
        // 结构化数据还没有(或没过闸):先占一个提示框,不悄悄丢掉
        S.figWaiting++
        if (key) S.figWaitingKeys.add(key)
        const label = cap || (b.alt || '').trim() || (b.ftype || '').trim()
        if (!label) S.figNoCaption++
        push({ t: 'callout', tone: 'note', label: '图', items: [label || '图解'] })
        break
      }
      default:
        S.unknown[b.type] = (S.unknown[b.type] || 0) + 1
        console.warn(`  ${where}:不认识的块类型「${b.type}」,跳过`)
    }
  }
  return out
}

// 一篇文章(overview / articles/n)→ 章文件
function articleChapter(no, title, a, where) {
  if (a.hero) S.heroDropped++
  if (a.featured !== undefined) S.featuredDropped++
  const blocks = convertBlocks(a.blocks, where)
  const article = {}
  if (a.title && a.title !== title) { article.title = a.title; S.titleDiffers++ }
  if (a.subtitle) article.subtitle = a.subtitle
  const idea = typeof a.centralIdea === 'string' ? a.centralIdea.trim() : ''
  if (idea) {
    if (textLen(idea) <= LIMITS.idea) article.idea = idea
    else { blocks.unshift({ t: 'lead', x: idea }); S.ideaAsLead++ }
  }
  article.blocks = blocks
  return { no, title, article }
}

// 思想脑图 → 书包根上的 mindmap.json(标准 §10)。
// 源节点 {id, label, note, ref: {ch: 文章号}, children} → {label, note?, ch?(书包章号), children?};id 不要。
// label 超 60 字(源里不少节点是整句):label 取 ≤ 60 字处的句读边界前一段(找不到边界就截 59 字加「…」),
// 整句原样放到 note 开头——字一个不丢。
function buildMindmap(mm, entry, slug) {
  const chOf = new Map(entry.chapters.map((c, i) => [c.no, i + 1])) // 文章号 → 书包章号(总览不占章号,文章 n 就是第 n 章)
  let nodes = 0
  const conv = (n, where, depth) => {
    nodes++
    let label = fixBold(String(n.label || '').replace(/\s*[\r\n]+\s*/g, ' ').trim(), where)
    let note = typeof n.note === 'string' ? fixBold(n.note.trim(), where) : ''
    if (textLen(label) > LIMITS.mindmapLabel) {
      S.mmLabelMoved++
      const head = cutAt(label, LIMITS.mindmapLabel) || [...label].slice(0, LIMITS.mindmapLabel - 1).join('') + '…'
      note = note ? `${label}\n\n${note}` : label
      label = head
    }
    if (textLen(note) > LIMITS.mindmapNote) S.mmNoteOver.push(`${where}(${textLen(note)} 字)`)
    const out = { label }
    if (note) out.note = note
    if (n.ref && n.ref.ch !== undefined) {
      S.mmRefs++
      if (chOf.has(n.ref.ch)) out.ch = chOf.get(n.ref.ch)
      else S.mmBadRefs.push(`${where}→文章 ${n.ref.ch}`)
    }
    if (Array.isArray(n.children) && n.children.length) {
      if (depth < LIMITS.mindmapDepth) out.children = n.children.map((c, i) => conv(c, `${where}.children[${i}]`, depth + 1))
      else S.mmTruncated += n.children.length
    }
    return out
  }
  const root = conv(mm.root || mm, `${slug}/mindmap:root`, 1)
  S.mmNodes += nodes
  if (nodes > LIMITS.mindmapNodes) S.mmNodesOver.push(`${slug}(${nodes})`)
  return { root }
}

// 插画:有哪个收哪个
function findArt(slug, entry) {
  const dir = path.join(ART_DIR, slug)
  const has = (f) => fs.existsSync(path.join(dir, f))
  const want = ['cover.jpg', 'banner.jpg', 'head-0.jpg', ...entry.chapters.map((c) => `head-${c.no}.jpg`)]
  const got = want.filter(has)
  ;(got.length === want.length ? S.art.complete : got.length ? S.art.partial : S.art.none).push(slug)
  S.artFiles += got.length
  return { dir, got: new Set(got) }
}

// 文字里不许混进 SVG / HTML
function scanLeaks(obj, where) {
  const walk = (v, k) => {
    if (typeof v === 'string') { if (/<svg\b|<\/?(text|path|g|rect|div|span)\b[^>]*>/i.test(v)) S.svgLeaks.push(`${where}.${k}`) }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k))
    else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) walk(x, kk)
  }
  walk(obj, '')
}

// 讲别人的书:每章引用条数 / 单条长度(quote 的 x 或 o、pull、金句卡 text),与校验器同一口径
function citeStats(ch) {
  const cites = []
  for (const b of ch.article.blocks) {
    if (b.t === 'pull') cites.push(b.x)
    else if (b.t === 'quote' && (b.x || b.o)) cites.push(b.x || b.o)
    else if (b.t === 'fig' && b.fig?.kind === 'quote' && b.fig.text) cites.push(b.fig.text)
  }
  const long = cites.map(textLen).filter((n) => n > LIMITS.quoteChars)
  return { n: cites.length, long }
}

// ── 一本书 ──
async function buildBook(entry) {
  const slug = entry.slug
  const dir = path.join(BOOKS, slug)
  const id = 'g-' + slug
  if (!ID_PATTERN.test(id)) S.badId.push(id)
  const tags = (entry.tags || []).slice(0, LIMITS.tags)
  const category = tags[0]
  const disclaimer = ['medical', 'divination'].filter((d) => vocabHit(d, [category, ...tags]))
  for (const d of disclaimer) S.disclaimers[d] = (S.disclaimers[d] || 0) + 1

  const chapters = []
  const summaries = []
  for (const c of entry.chapters) {
    const a = readJson(path.join(dir, 'articles', `${c.no}.json`))
    chapters.push(articleChapter(chapters.length + 1, c.title || a.title, a, `${slug}/articles/${c.no}`))
    summaries.push(chapterSummary(a.centralIdea, `${slug}/articles/${c.no}`))
  }
  // 全书总览:书一级,不是章(标准 §11)
  let overview = null
  if (fs.existsSync(path.join(dir, 'overview.json'))) {
    const src = readJson(path.join(dir, 'overview.json'))
    const { article } = articleChapter(0, src.title, src, `${slug}/overview`)
    overview = { title: src.title || '全书总览', ...article }
    S.overviews++
  }
  const mindmap = fs.existsSync(path.join(dir, 'mindmap.json')) ? buildMindmap(readJson(path.join(dir, 'mindmap.json')), entry, slug) : null
  const art = findArt(slug, entry)
  const media = (f) => (art.got.has(f) ? `media/${f}` : undefined)
  const heads = entry.chapters.map((c) => media(`head-${c.no}.jpg`))
  if (overview && media('head-0.jpg')) overview = { ...overview, head: media('head-0.jpg') }

  const book = {
    format: 'deskbook', version: 1, id, revision: 1, kind: 'book',
    title: entry.title,
    ...(entry.subtitle ? { subtitle: entry.subtitle } : {}),
    authors: [],
    lang: 'zh-Hans',
    summary: cutSummary(entry.oneLine || entry.title, slug),
    ...(category ? { category } : {}),
    tags,
    source: { type: 'digest', of: { title: entry.title, author: entry.author }, ...(entry.subtitle ? { note: `原书名 ${entry.subtitle}` } : {}) },
    ...(disclaimer.length ? { disclaimer: disclaimer.length === 1 ? disclaimer[0] : disclaimer } : {}),
    unit: '章',
    ...(entry.accent ? { theme: { accent: entry.accent } } : {}),
    ...(media('cover.jpg') ? { cover: media('cover.jpg') } : {}),
    ...(media('banner.jpg') ? { banner: media('banner.jpg') } : {}),
    chapters: chapters.map((c, i) => ({ no: c.no, file: chapterFile(c.no), title: c.title, ...(summaries[i] ? { summary: summaries[i] } : {}), ...(heads[i] ? { head: heads[i] } : {}) })),
    ...(overview ? { overview: OVERVIEW_FILE } : {}),
    ...(mindmap ? { mindmap: MINDMAP_FILE } : {}),
    generator: GENERATOR,
  }

  const enc = new TextEncoder()
  const files = new Map()
  const digest = []
  if (mindmap) { scanLeaks(mindmap, `${slug}/mindmap.json`); files.set(MINDMAP_FILE, enc.encode(JSON.stringify(mindmap))) }
  if (overview) {
    scanLeaks(overview, `${slug}/overview.json`)
    const cs = citeStats({ article: overview })
    if (cs.n > LIMITS.quotesPerChapter || cs.long.length) digest.push({ no: '总览', title: overview.title, n: cs.n, long: cs.long })
    files.set(OVERVIEW_FILE, enc.encode(JSON.stringify(overview)))
  }
  for (const f of art.got) files.set(`media/${f}`, new Uint8Array(fs.readFileSync(path.join(art.dir, f))))
  for (const c of chapters) {
    scanLeaks(c, `${slug}/${chapterFile(c.no)}`)
    const cs = citeStats(c)
    if (cs.n > LIMITS.quotesPerChapter || cs.long.length) digest.push({ no: c.no, title: c.title, n: cs.n, long: cs.long })
    files.set(chapterFile(c.no), enc.encode(JSON.stringify(c)))
  }
  scanLeaks(book, `${slug}/book.json`)

  // 版本号:先按台账里的号打;字节与台账不同就 +1 重打(打出的字节里含 revision,所以记的是最终那份的哈希)
  const pack = (revision) => { book.revision = revision; files.set('book.json', enc.encode(JSON.stringify(book, null, 1))); return zip(files) }
  const prev = ledger[id]
  let revision = prev?.revision || 1
  let bytes = await pack(revision)
  if (!prev) S.rev.fresh.push(id)
  else if (sha256(bytes) === prev.sha256) S.rev.same++
  else { revision = prev.revision + 1; bytes = await pack(revision); S.rev.bumped.push(`${slug}→${revision}`) }
  fs.writeFileSync(path.join(outDir, `${id}.deskbook`), bytes)
  const res = validate(await unzip(bytes))
  if (res.ok) ledger[id] = { revision, sha256: sha256(bytes) } // 校验不过的不记账
  return { slug, id, bytes: bytes.length, ok: res.ok, errors: res.errors, warnings: res.warnings, digest, revision, mindmapNodes: summarize(res).mindmapNodes }
}

// ── 主流程 ──
fs.mkdirSync(outDir, { recursive: true })
const results = []
for (const e of entries) {
  try { results.push(await buildBook(e)) }
  catch (x) { results.push({ slug: e.slug, ok: false, bytes: 0, errors: [{ file: '', where: '', msg: `转换出错:${x.message}` }], warnings: [], digest: [] }) }
}

// ── 汇总 ──
const pass = results.filter((r) => r.ok)
const fail = results.filter((r) => !r.ok)
const totalBytes = results.reduce((n, r) => n + r.bytes, 0)
console.log(`\n书包 ${results.length} 本 → ${path.relative(ROOT, outDir) || outDir}/ · 通过 ${pass.length} · 不过 ${fail.length} · 共 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
if (fail.length) {
  console.log('\n不过的书(首条错误 · 错误条数):')
  for (const r of fail) console.log(`  ${r.slug}:${formatIssue(r.errors[0])}(${r.errors.length} 条${r.errors.length >= LIMITS.maxReported ? '+' : ''})`)
  // 错误种类(去掉数字后归并)
  const kinds = {}
  for (const r of fail) for (const e of r.errors) { const k = e.msg.replace(/\d+/g, 'N'); kinds[k] = (kinds[k] || 0) + 1 }
  console.log('  错误种类:')
  for (const [k, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${n} × ${k}`)
}
const wk = {}
for (const r of results) for (const w of r.warnings) { const k = w.msg.replace(/\d+/g, 'N').replace(/「[^」]*」/g, '「…」'); wk[k] = (wk[k] || 0) + 1 }
const wTotal = Object.values(wk).reduce((a, b) => a + b, 0)
console.log(`\n提示 ${wTotal} 条${wTotal ? ',前几种:' : ''}`)
for (const [k, n] of Object.entries(wk).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${n} × ${k}`)

const dg = results.filter((r) => r.digest?.length)
console.log(`\n讲别人的书的引用上限(每章 ≤ ${LIMITS.quotesPerChapter} 条、每条 ≤ ${LIMITS.quoteChars} 字)超出:${dg.reduce((n, r) => n + r.digest.length, 0)} 章 / ${dg.length} 本`)
for (const r of dg) for (const d of r.digest) {
  const parts = []
  if (d.n > LIMITS.quotesPerChapter) parts.push(`${d.n} 条`)
  if (d.long.length) parts.push(`超长 ${d.long.length} 条(${d.long.join('、')} 字)`)
  console.log(`  ${r.slug} 第 ${d.no} 章「${d.title}」:${parts.join(';')}`)
}

console.log(`\n图解:共 ${S.figTotal} · 出结构化 fig ${S.figEmitted} · 待结构化数据 ${S.figWaiting}(不同 SVG ${S.figWaitingKeys.size}${S.figGateFail ? `,其中有数据但未过闸 ${S.figGateFail}` : ''}${S.figNoCaption ? `,无说明文字 ${S.figNoCaption}` : ''})${fs.existsSync(FIGS_FILE) ? '' : ' —— 尚无 ' + path.relative(ROOT, FIGS_FILE)}`)
console.log(`\n全书脑图:${results.filter((r) => r.mindmapNodes).length} 本 · 节点共 ${S.mmNodes}(书包里 ${results.reduce((n, r) => n + (r.mindmapNodes || 0), 0)})· 带 ref 的节点 ${S.mmRefs} · 指向不存在文章的 ${S.mmBadRefs.length}${S.mmBadRefs.length ? ':' + S.mmBadRefs.slice(0, 10).join(' ') : ''}`)
console.log(`  label 超 ${LIMITS.mindmapLabel} 字、整句移进 note ${S.mmLabelMoved} 个 · note 超 ${LIMITS.mindmapNote} 字 ${S.mmNoteOver.length}${S.mmNoteOver.length ? ':' + S.mmNoteOver.join(' ') : ''} · 超 ${LIMITS.mindmapDepth} 层截掉 ${S.mmTruncated} · 节点超 ${LIMITS.mindmapNodes} 的书 ${S.mmNodesOver.length}${S.mmNodesOver.length ? ':' + S.mmNodesOver.join(' ') : ''}`)
console.log(`全书总览 ${S.overviews} 本 · 章简介 ${S.chSummary} 条(其中截短 ${S.chSummaryCut})${S.chSummaryNone.length ? ` · 没给简介的章 ${S.chSummaryNone.length}:${S.chSummaryNone.slice(0, 8).join(' ')}` : ''}`)
console.log(`插画:齐全 ${S.art.complete.length} 本 · 部分 ${S.art.partial.length} 本 · 没有 ${S.art.none.length} 本(共收 ${S.artFiles} 张${fs.existsSync(ART_DIR) ? '' : ';' + path.relative(ROOT, ART_DIR) + ' 还不存在'})`)
console.log(`版本号:未变 ${S.rev.same} · 升版 ${S.rev.bumped.length} · 台账里没有(记为第 1 版)${S.rev.fresh.length}${useLedger ? '' : '(--no-ledger:台账未写)'}`)
console.log(`表格:共 ${S.tableTotal} · 转 fig table ${S.tableAsFig} · 退成提示框 ${S.tableFallback}`)
console.log('\n有损 / 改写的步骤:')
console.log(`  简介截断 ${S.summaryCut.length} 本${S.summaryCut.length ? ':' + S.summaryCut.join(' ') : ''}`)
if (S.summaryUncut.length) console.log(`  简介超长却找不到截断点 ${S.summaryUncut.length} 本:${S.summaryUncut.join(' ')}`)
console.log(`  hero 丢弃 ${S.heroDropped} · featured 标记丢弃 ${S.featuredDropped} · 中心句超 ${LIMITS.idea} 字改作导语 ${S.ideaAsLead}`)
console.log(`  落单的加粗记号 ** 去掉 ${S.boldFixed.length} 处${S.boldFixed.length ? '(源文待修):' + S.boldFixed.join(' · ') : ''}`)
console.log(`  空块跳过 ${S.emptySkipped} · items 里的对象转成字 ${S.stepObjItems}`)
console.log(`  文章自带标题与目录章题不同(另存 article.title)${S.titleDiffers}`)
if (Object.keys(S.unknown).length) console.log(`  不认识的块类型:${JSON.stringify(S.unknown)}`)
console.log(`  带声明:${JSON.stringify(S.disclaimers)}`)
if (S.badId.length) console.log(`  id 不合规:${S.badId.join(' ')}`)
console.log(`  文字里混进的 SVG / HTML:${S.svgLeaks.length}${S.svgLeaks.length ? ' —— ' + S.svgLeaks.slice(0, 5).join(' ') : ''}`)
if (useLedger) {
  const sorted = Object.fromEntries(Object.keys(ledger).sort().map((k) => [k, ledger[k]]))
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(sorted, null, 1) + '\n')
}
console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`)
process.exit(fail.length ? 1 : 0)
