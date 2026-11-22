#!/usr/bin/env node
// 观书(src/data/books/)→ 书包(.deskbook,docs/deskbook-standard.md)。
//
//   node scripts/desk/books-to-deskbook.mjs [slug…|--all] [-o <目录>]
//
// 每本书出一个 g-<slug>.deskbook(默认写到 scripts/.cache/deskbooks/,已 gitignore),
// 打包后立刻用核心库 validate(unzip(bytes)) 回校;有一本不过,退出码非零。
// 一本书的章:第 1 章「全书总览」(overview.json)· 第 2 章「思想脑图」(mindmap.json → outline)· 之后每篇文章一章。
// 块的转法照 scripts/build-desk-packs.mjs 的 buildBaihua(站内 type/text → 书包 t/x)。
// 有损的每一步都计数,最后汇总打印;源文件一律只读。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zip, unzip, validate, formatIssue, LIMITS, DISCLAIMER_VOCAB, chapterFile, textLen, checkFigShape, ID_PATTERN } from './deskbook-core.mjs'
import { figKey, checkFig } from './fig-gate.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BOOKS = path.join(ROOT, 'src/data/books')
const FIGS_FILE = path.join(ROOT, 'scripts/authored/desk-figs/books.json')
const GENERATOR = 'books-to-deskbook 1.0'
const t0 = Date.now()

// ── 参数 ──
const argv = process.argv.slice(2)
let outDir = path.join(ROOT, 'scripts/.cache/deskbooks')
const want = []
let all = false
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '-o') outDir = path.resolve(argv[++i] || '')
  else if (a === '--all') all = true
  else if (a === '-h' || a === '--help') { console.log('用法:node scripts/desk/books-to-deskbook.mjs [slug…|--all] [-o <目录>]'); process.exit(0) }
  else want.push(a)
}
if (!all && !want.length) { console.error('请给 slug,或 --all'); process.exit(2) }

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const index = readJson(path.join(BOOKS, 'index.json'))
const entries = all ? index : want.map((s) => index.find((b) => b.slug === s) || (console.error(`没有这本书:${s}`), process.exit(2)))
// 结构化图解(可能还没有这个文件):figKey(svg) → fig
const FIGS = fs.existsSync(FIGS_FILE) ? readJson(FIGS_FILE) : {}

// ── 计数(全局)──
const S = {
  badId: [], summaryCut: [], summaryUncut: [], heroDropped: 0, featuredDropped: 0,
  ideaAsLead: 0, emptySkipped: 0, unknown: {}, stepObjItems: 0, outlineTruncated: 0, rootNoteMissing: [],
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
function cutSummary(s, slug) {
  if (textLen(s) <= LIMITS.summary) return s
  const chars = [...s]
  let best = null
  for (let i = 1; i <= chars.length; i++) {
    if (!BREAK.test(chars[i - 1])) continue
    let head = chars.slice(0, i).join('')
    if (/[\uFF0C\u3001\uFF1A\uFF1B\u2014,;:]$/u.test(head)) head = head.replace(/[\uFF0C\u3001\uFF1A\uFF1B\u2014,;:]+$/u, '')
    if (textLen(head) > LIMITS.summary) break
    if (head && balanced(head)) best = head
  }
  if (!best) { S.summaryUncut.push(slug); return s } // 找不到合适的边界:原样放,让校验器报出来
  S.summaryCut.push(`${slug}(${textLen(s)}→${textLen(best)})`)
  return best
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

// 脑图 → 提纲(root 的 note 作导语;root.children 起算,提纲至多 4 层)
function mindmapChapter(no, mm, entry) {
  const root = mm.root || mm
  const walk = (nodes, depth) => nodes.map((n) => {
    const label = String(n.label || '').trim()
    const note = typeof n.note === 'string' ? n.note.trim() : ''
    const it = { x: note ? `**${label}**：${note}` : label }
    if (n.children?.length) {
      if (depth < LIMITS.outlineDepth) it.children = walk(n.children, depth + 1)
      else S.outlineTruncated += n.children.length
    }
    return it
  }).filter((it) => it.x)
  let lead = typeof root.note === 'string' ? root.note.trim() : ''
  if (!lead) { S.rootNoteMissing.push(entry.slug); lead = entry.oneLine } // 根节点没有 note:用书目的一句话简介作导语
  const blocks = [{ t: 'lead', x: lead }]
  if (root.children?.length) blocks.push({ t: 'outline', items: walk(root.children, 1) })
  return { no, title: '思想脑图', article: { blocks } }
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
  chapters.push(articleChapter(1, '全书总览', readJson(path.join(dir, 'overview.json')), `${slug}/overview`))
  chapters.push(mindmapChapter(2, readJson(path.join(dir, 'mindmap.json')), entry))
  for (const c of entry.chapters) {
    const a = readJson(path.join(dir, 'articles', `${c.no}.json`))
    chapters.push(articleChapter(chapters.length + 1, c.title || a.title, a, `${slug}/articles/${c.no}`))
  }

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
    chapters: chapters.map((c) => ({ no: c.no, file: chapterFile(c.no), title: c.title })),
    generator: GENERATOR,
  }

  const enc = new TextEncoder()
  const files = new Map([['book.json', enc.encode(JSON.stringify(book, null, 1))]])
  const digest = []
  for (const c of chapters) {
    scanLeaks(c, `${slug}/${chapterFile(c.no)}`)
    const cs = citeStats(c)
    if (cs.n > LIMITS.quotesPerChapter || cs.long.length) digest.push({ no: c.no, title: c.title, n: cs.n, long: cs.long })
    files.set(chapterFile(c.no), enc.encode(JSON.stringify(c)))
  }
  scanLeaks(book, `${slug}/book.json`)

  const bytes = await zip(files)
  fs.writeFileSync(path.join(outDir, `${id}.deskbook`), bytes)
  const res = validate(await unzip(bytes))
  return { slug, id, bytes: bytes.length, ok: res.ok, errors: res.errors, warnings: res.warnings, digest }
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
console.log(`表格:共 ${S.tableTotal} · 转 fig table ${S.tableAsFig} · 退成提示框 ${S.tableFallback}`)
console.log('\n有损 / 改写的步骤:')
console.log(`  简介截断 ${S.summaryCut.length} 本${S.summaryCut.length ? ':' + S.summaryCut.join(' ') : ''}`)
if (S.summaryUncut.length) console.log(`  简介超长却找不到截断点 ${S.summaryUncut.length} 本:${S.summaryUncut.join(' ')}`)
console.log(`  hero 丢弃 ${S.heroDropped} · featured 标记丢弃 ${S.featuredDropped} · 中心句超 ${LIMITS.idea} 字改作导语 ${S.ideaAsLead}`)
console.log(`  落单的加粗记号 ** 去掉 ${S.boldFixed.length} 处${S.boldFixed.length ? '(源文待修):' + S.boldFixed.join(' · ') : ''}`)
console.log(`  空块跳过 ${S.emptySkipped} · items 里的对象转成字 ${S.stepObjItems} · 提纲超 ${LIMITS.outlineDepth} 层截掉 ${S.outlineTruncated} 个节点`)
console.log(`  文章自带标题与目录章题不同(另存 article.title)${S.titleDiffers}`)
if (S.rootNoteMissing.length) console.log(`  脑图根节点无 note、改用一句话简介作导语 ${S.rootNoteMissing.length} 本:${S.rootNoteMissing.join(' ')}`)
if (Object.keys(S.unknown).length) console.log(`  不认识的块类型:${JSON.stringify(S.unknown)}`)
console.log(`  带声明:${JSON.stringify(S.disclaimers)}`)
if (S.badId.length) console.log(`  id 不合规:${S.badId.join(' ')}`)
console.log(`  文字里混进的 SVG / HTML:${S.svgLeaks.length}${S.svgLeaks.length ? ' —— ' + S.svgLeaks.slice(0, 5).join(' ') : ''}`)
console.log(`\n用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`)
process.exit(fail.length ? 1 : 0)
