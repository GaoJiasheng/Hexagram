#!/usr/bin/env node
// 「观象 · 书桌」内容包构建(docs/desk-app-plan.md §4)。只读 src/data,产出 public/desk/v1/:
//   manifest.json                  可订的书:书名、体裁模板、章数、字数、主题色、包文件名(带内容哈希)
//   <id>.<hash>.json               一本书的核心包:各章原文 / 译文 / 注释 / 延伸
//   <id>.baihua.<hash>.json        这本书的白话深读(格式见 docs/desk-baihua-spec.md;图解是结构化数据,不带 SVG)
// 书桌 App 与网站、现有 App 的构建互不依赖,唯一的共同点是 src/data 这份内容。
// 约定:
//   · 书桌里的「一本书」可以由站内几个 slug 拼成(庄子 = 内 / 外 / 杂篇);每章带 src {corpus, slug, ch},
//     进度、时长、划线一律按 src 记,与网站的 readPos / readDays 同一套坐标。
//   · 段下标 0 起,与 src/data 里 paragraphs 的次序一致——构建时逐段核原文一字不差、注释 term 是该段原文子串。
//   · 书单在 scripts/desk/books.mjs:首发六本(bundled,随 App 带核心包)照旧写死,其余全站各书从站内数据派生。
//   node scripts/build-desk-packs.mjs
//
// 清单(manifest.json)`{ v: 1, categories: [门类次序], books: [...] }`,每本书一条:
//   id title alias era attribution brief howto template unit chapters summary? segs chars parts theme version file bytes art? baihua?
//   category        门类(书目分栏用,次序见 categories):易 / 道 / 儒 / 佛 / 心学 / 法 / 墨 / 兵 / 纵横 / 谋略 / 中医 / 命理 / 诗词曲 / 古文
//   disclaimer?     声明,语义同 docs/deskbook-standard.md §6:medical | divination | 自写一句,或其中几项的数组(中医 medical、观数 divination、
//                   谋略托名伪书一句定性、站内有 caveat 的照录)
//   verse?          韵文书(诗词曲、黄庭…):App 按句读断行排
//   bundled?        随 App 带核心包的那几本(首发六本)
//   layers          { trans, notes, xiang }:有译文 / 注释 / 详注的章数
//   baihua          { file, bytes, chapters, figs, figsDone, essays?, subs? }:essays = 章级白话篇数、subs = 细粒度白话篇数(有细粒度时才写)
// 核心包 `{ id, verse?, chapters: [{ no, title, src, kind?, gua?, verse?, segs: [{ o, t?, n?, label?, line?, kind? }], yanyi? }], version }`:
//   seg.kind 'title'  诗题段(texts.json 设 poemTitles 的书里独立成段的《X》),App 排成章内小标题;原文照旧一字不差
//   chapter.verse     只有部分章是韵文的书(texts.json 的 verseChapters)
// 白话包见 docs/desk-baihua-spec.md;细粒度白话(「章-序」键:诗经一首一篇、传习录一条一篇)挂在所属章的 `subs` 里(§1.1)。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { figKey, checkFig } from './desk/fig-gate.mjs'
import { DESK_BOOKS, CATEGORIES, COLLISIONS } from './desk/books.mjs'
import { subChapter, isSubKey } from './lib/sub-chapter.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/desk/v1')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const exists = (p) => fs.existsSync(path.join(ROOT, p))

// 书单在 scripts/desk/books.mjs(首发六本照旧写死,其余从站内数据派生);体裁模板编在 App 里,书只声明用哪种。
const BOOKS = DESK_BOOKS

const errors = []
const err = (m) => errors.push(m)

// 详注(docs/xiangzhu-spec.md):真源 src/data/<corpus>/xiangzhu/<slug>.json,按站内坐标存(章号 → 段下标 / 卦的部位键 → [{k,d,x,r?}])。
// 每章按它的 src {corpus, slug, ch} 去取;比站内简注多、且带一段展开 x。有详注的词用详注;与详注位置不重叠的简注照留。
const xzCache = new Map()
const xiangzhuOf = (corpus, slug) => {
  const p = `src/data/${corpus}/xiangzhu/${slug}.json`
  if (!xzCache.has(p)) xzCache.set(p, exists(p) ? read(p) : null)
  return xzCache.get(p)
}
function applyDeskNotes(id, dn, chNo, i, seg) {
  if (!Array.isArray(dn) || !dn.length) return
  const o = seg.o
  const spans = []
  const place = (k, what) => {
    const at = o.indexOf(k)
    if (at < 0) { err(`${id} 第 ${chNo} 章第 ${i + 1} 段:${what}「${k}」不是该段原文子串`); return null }
    return [at, at + k.length]
  }
  const hit = (r) => spans.some(([a, b]) => r[0] < b && a < r[1])
  const merged = []
  for (const x of dn) {
    const r = place(x.k, '详注')
    if (!r) continue
    if (hit(r)) { err(`${id} 第 ${chNo} 章第 ${i + 1} 段:详注「${x.k}」与同段另一条位置重叠`); continue }
    if ([...x.d].length > 40) err(`${id} 第 ${chNo} 章第 ${i + 1} 段:详注「${x.k}」的释义超过 40 字`)
    spans.push(r)
    merged.push({ k: x.k, d: x.d, ...(x.r ? { r: x.r } : {}), ...(x.x ? { x: x.x } : {}) })
  }
  for (const n of seg.n || []) {
    const r = place(n.k, '注释')
    if (r && !hit(r)) { spans.push(r); merged.push(n) }
  }
  seg.n = merged
}

// 每本书打包时的零碎统计(打包后逐书一行报出来)
const report = new Map()
const rep = (id) => { if (!report.has(id)) report.set(id, { titles: 0, verseCh: 0, dropped: {}, orphans: [], subs: 0 }); return report.get(id) }

function buildBook(spec) {
  const chapters = []
  const parts = []
  let meta0 = null
  let chars = 0
  const R = rep(spec.id)
  for (const [corpus, slug, partTitle] of spec.sources) {
    const meta = read(`src/data/${corpus}/texts.json`).find((t) => t.slug === slug)
    if (!meta) { err(`${corpus}/${slug}: texts.json 里没有`); continue }
    meta0 ||= meta
    const book = read(`src/data/${corpus}/classics/${slug}.json`)
    const notes = exists(`src/data/${corpus}/zhushi-anchored/${slug}.json`) ? read(`src/data/${corpus}/zhushi-anchored/${slug}.json`) : {}
    const yanyiAll = exists(`src/data/${corpus}/yanyi.json`) ? read(`src/data/${corpus}/yanyi.json`) : {}
    const yanyi = yanyiAll[slug] || {}
    const from = chapters.length + 1
    const xz = xiangzhuOf(corpus, slug) || {}
    // 诗题段(poemTitles:独立成段的《X》是一首之首):段上标 kind 'title',App 排成章内小标题
    const isTitle = (o) => !!meta.poemTitles && /^《[^》]+》$/.test(o.trim())
    const verseCh = new Set((meta.verseChapters || []).map(Number))
    for (const c of book.chapters) {
      const cn = notes[String(c.no)] || {}
      const segs = c.paragraphs.map((p, i) => {
        const o = typeof p === 'string' ? p : p.original
        const seg = { o }
        if (p.translation) seg.t = p.translation
        if (isTitle(o)) { seg.kind = 'title'; R.titles++ }
        const ns = cn[String(i)]   // 注释按「章 → 段下标(0 起)」挂
        if (Array.isArray(ns) && ns.length) {
          seg.n = ns.map((x) => {
            if (!o.includes(x.term)) err(`${corpus}/${slug} 第 ${c.no} 章第 ${i + 1} 段:注释「${x.term}」不是该段原文子串`)
            const n = { k: x.term, d: x.note }
            if (x.reading) n.r = x.reading
            return n
          })
        }
        applyDeskNotes(spec.id, xz[String(c.no)]?.[String(i)], chapters.length + 1, i, seg)
        // 原文逐字核对:书桌里的段与站内数据一字不差
        if (seg.o !== (typeof p === 'string' ? p : p.original)) err(`${spec.id} 第 ${chapters.length + 1} 章第 ${i + 1} 段:原文与源数据不一致`)
        chars += o.length
        return seg
      })
      const ch = {
        no: chapters.length + 1,
        title: meta.chapterNames?.[String(c.no)] || c.title || '',
        src: { corpus, slug, ch: c.no },
        segs,
      }
      // 只有部分章是韵文的书(verseChapters):那几章自己带 verse
      if (!meta.verse && verseCh.has(c.no)) { ch.verse = true; R.verseCh++ }
      const y = yanyi[String(c.no)]
      if (Array.isArray(y) && y.length) ch.yanyi = y
      chapters.push(ch)
    }
    if (partTitle) parts.push({ title: partTitle, from, to: chapters.length })
    else for (const p of meta.parts || []) parts.push({ title: p.title, from: p.from, to: p.to, ...(p.note ? { note: p.note } : {}) })
  }
  return finish(spec, meta0, chapters, parts, chars)
}

// ── 白话深读 ──────────────────────────────────────────────────────────
// 按每章的 src 去站内白话(src/data/<corpus>/baihua/<slug>.json)里取,块归一成 docs/desk-baihua-spec.md §1 的十种。
// 图解:scripts/authored/desk-figs/<id>.json 里有、且过闸的才带 fig;其余只带 cap。
const baihuaCache = new Map()
const baihuaOf = (corpus, slug) => {
  const p = `src/data/${corpus}/baihua/${slug}.json`
  if (!baihuaCache.has(p)) baihuaCache.set(p, exists(p) ? read(p) : null)
  return baihuaCache.get(p)
}
// 站内白话的块 → 书桌的十种(docs/desk-baihua-spec.md §1)。书桌渲染不了的块(观数的交互件 widget 等)丢掉、逐书计数。
function normBlocks(srcBlocks, where, figs, R, fc) {
  const strs = (v) => (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'string' ? x : x?.text)).filter((x) => {
    if (typeof x !== 'string') { err(`${where}:items 里有非文字项`); return false }
    return x.trim().length > 0
  })
  const blocks = []
  for (const b of srcBlocks) {
    const x = typeof b.text === 'string' ? b.text.trim() : ''
    const tail = () => { if (b.items?.length) blocks.push({ t: 'list', ordered: false, items: strs(b.items) }) }
    switch (b.type) {
      case 'lead': case 'h2': case 'p': case 'pull':
        if (x) blocks.push({ t: b.type, x })
        if (b.type === 'p' && (b.original || b.translation)) blocks.push({ t: 'quote', ...(b.original ? { o: b.original } : {}), ...(b.translation ? { tr: b.translation } : {}) })
        tail()
        break
      case 'quote': {
        if (!b.original && !b.translation) break
        blocks.push({ t: 'quote', ...(b.original ? { o: b.original } : {}), ...(b.translation ? { tr: b.translation } : {}) })
        break
      }
      case 'callout': blocks.push({ t: 'callout', tone: b.tone || 'note', ...(b.label ? { label: b.label } : {}), items: strs(b.items || []) }); break
      case 'steps': blocks.push({ t: 'steps', items: strs(b.items || []) }); break
      case 'list': blocks.push({ t: 'list', ordered: !!b.ordered, items: strs(b.items || []) }); break
      case 'refs': blocks.push({ t: 'refs', items: strs(b.items || (b.text ? [b.text] : [])) }); break
      case 'figure': {
        fc.n++
        const blk = { t: 'fig', cap: b.caption || '' }
        const fig = b.svg ? figs[figKey(b.svg)] : null
        if (fig) {
          const bad = checkFig(fig, b.svg)
          if (bad.length) err(`${where}:图解 ${figKey(b.svg)} 未过闸 —— ${bad[0]}`)
          else { blk.fig = fig; fc.done++ }
        }
        blocks.push(blk)
        break
      }
      // widget(观数的排盘 / 矩阵等交互件):书桌没有对应件,说明文字又是「点一格、拖时间轴」一类操作说明,单留它会误导——整块不收
      default: { const k = b.type + (b.kind ? `:${b.kind}` : ''); R.dropped[k] = (R.dropped[k] || 0) + 1 }
    }
  }
  for (const b of blocks) for (const s of [b.x, ...(b.items || [])]) if (typeof s === 'string' && (s.match(/\*\*/g) || []).length % 2) err(`${where}:加粗记号 ** 不成对`)
  return blocks
}

// 一篇白话 → 书桌的一篇(题目缺了用 fallback)
const essayOf = (src, blocks, fallback) => ({
  title: src.title || fallback,
  ...(src.subtitle ? { subtitle: src.subtitle } : {}),
  ...(src.centralIdea ? { idea: src.centralIdea } : {}),
  ...(src.hero ? { hero: src.hero } : {}),
  blocks,
})

function buildBaihua(spec, chapters) {
  const figs = exists(`scripts/authored/desk-figs/${spec.id}.json`) ? read(`scripts/authored/desk-figs/${spec.id}.json`) : {}
  const R = rep(spec.id)
  const out = {}
  const fc = { n: 0, done: 0 }
  let nSubs = 0
  const used = new Map()   // 白话文件 → 用上的键(没用上的报出来)
  for (const c of chapters) {
    const file = baihuaOf(c.src.corpus, c.src.slug)
    if (!file) continue
    const key = `${c.src.corpus}/${c.src.slug}`
    if (!used.has(key)) used.set(key, new Set())
    const src = file[String(c.src.ch)]
    const where = `${spec.id} 白话第 ${c.no} 章`
    let entry = null
    if (src?.blocks?.length) {
      used.get(key).add(String(c.src.ch))
      entry = essayOf(src, normBlocks(src.blocks, where, figs, R, fc), c.title)
    }
    // 细粒度白话(「章-序」键:诗经一首一篇、传习录一条一篇、长短经一篇一篇):挂成这一章的 subs,按序号排
    const subKeys = Object.keys(file).filter((k) => isSubKey(k) && k.split('-')[0] === String(c.src.ch))
      .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
    if (subKeys.length) {
      const classic = classicOf(c.src.corpus, c.src.slug)
      const subs = []
      for (const k of subKeys) {
        const sc = file[k]
        if (!sc?.blocks?.length) continue
        const piece = subChapter(ROOT, c.src.corpus, c.src.slug, classic, k)
        if (!piece) { err(`${where}:细粒度白话「${k}」在原文里找不到对应的段`); continue }
        used.get(key).add(k)
        const sub = { key: k, name: piece.title, from: piece.from, to: piece.to, ...essayOf(sc, normBlocks(sc.blocks, `${where}「${k}」`, figs, R, fc), piece.title) }
        subs.push(sub)
      }
      if (subs.length) {
        entry ||= { title: c.title }
        entry.subs = subs
        nSubs += subs.length
      }
    }
    if (entry) out[String(c.no)] = entry
  }
  for (const [key, keys] of used) {
    const [corpus, slug] = key.split('/')
    for (const k of Object.keys(baihuaOf(corpus, slug))) if (!keys.has(k)) R.orphans.push(`${key}#${k}`)
  }
  R.subs = nSubs
  const n = Object.keys(out).length
  if (!n) return null
  const json = JSON.stringify({ v: 1, id: spec.id, chapters: out })
  const file = `${spec.id}.baihua.${crypto.createHash('sha1').update(json).digest('hex').slice(0, 10)}.json`
  fs.writeFileSync(path.join(OUT, file), json)
  const essays = Object.values(out).filter((e) => e.blocks).length
  return { file, bytes: Buffer.byteLength(json), chapters: n, figs: fc.n, figsDone: fc.done, ...(nSubs ? { essays, subs: nSubs } : {}) }
}

const classicCache = new Map()
const classicOf = (corpus, slug) => {
  const p = `src/data/${corpus}/classics/${slug}.json`
  if (!classicCache.has(p)) classicCache.set(p, read(p))
  return classicCache.get(p)
}

// 写出一本书的包,返回 manifest 条目(meta0:站内 texts.json 的书目元数据;易经没有,用 spec 里的字段)
function finish(spec, meta0, chapters, parts, chars) {
  const verse = !!meta0.verse
  const body = { id: spec.id, ...(verse ? { verse: true } : {}), chapters }
  const json = JSON.stringify(body)
  const version = crypto.createHash('sha1').update(json).digest('hex').slice(0, 10)
  const file = `${spec.id}.${version}.json`
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ ...body, version }))
  const baihua = buildBaihua(spec, chapters)
  const disclaimer = disclaimerOf(spec, meta0)
  // 有几章带译文 / 注释 / 详注(书目页一行小字用)
  const layers = {
    trans: chapters.filter((c) => c.segs.some((g) => g.t)).length,
    notes: chapters.filter((c) => c.segs.some((g) => g.n?.length)).length,
    xiang: chapters.filter((c) => c.segs.some((g) => g.n?.some((n) => n.x))).length,
  }
  return {
    id: spec.id,
    title: spec.title || meta0.title,
    alias: spec.title ? '' : (meta0.alias || ''),
    era: spec.era || meta0.era || '',
    attribution: spec.attribution || meta0.attribution || '',
    brief: spec.brief || meta0.brief || '',
    howto: spec.howto || meta0.howto || '',
    template: spec.template,
    unit: spec.unit || meta0.sectionUnit || '章',
    chapters: chapters.length,
    ...(spec.summary ? { summary: spec.summary } : {}),   // 章数说不清的书(周易 = 64 卦 + 传文 35 章)给一句现成的
    segs: chapters.reduce((n, c) => n + c.segs.length, 0),
    chars,
    parts,
    theme: spec.theme,
    category: spec.category,
    ...(disclaimer ? { disclaimer } : {}),
    ...(verse ? { verse: true } : {}),
    ...(spec.bundled ? { bundled: true } : {}),
    layers,
    version,
    file,
    bytes: Buffer.byteLength(json),
    ...(baihua ? { baihua } : {}),
  }
}

// 书的声明(docs/deskbook-standard.md §6 同一套:medical / divination / 自写一句,或其中几项的数组)。
// 中医一律 medical(守「研习不诊疗」);观数一律 divination(守「研习不断命」);谋略里的托名伪书用站内的定性;
// 站内 texts.json 有 caveat(真伪 / 撰人存疑一类)的照录那一句。
const DUBIOUS_LINE = '托名·疑现代伪作\uFF0C取文献批判视角'
function disclaimerOf(spec, meta) {
  const corpus = spec.sources?.[0]?.[0]
  const out = []
  if (corpus === 'zhongyi') out.push('medical')
  if (corpus === 'mingli') out.push('divination')
  if (meta.dubious) out.push(DUBIOUS_LINE)
  else if (meta.caveat) out.push(meta.caveat)
  return out.length === 0 ? null : out.length === 1 ? out[0] : out
}

// 插画:扫 public/desk/v1/art/<id>/(cover.jpg 竖版封面 · banner.jpg 横版题图 · head-<章>.jpg 章题头图)。
// v = 文件名 + 字节数的短哈希,App 见 v 变了就清该书的插画缓存。一张都没有返回 null(清单不写 art)。
function scanArt(id) {
  const dir = path.join(OUT, 'art', id)
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter((f) => /^(cover|banner|head-\d+)\.jpg$/.test(f)).sort()
  if (!files.length) return null
  const heads = files.map((f) => f.match(/^head-(\d+)\.jpg$/)).filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b)
  const sig = files.map((f) => `${f}:${fs.statSync(path.join(dir, f)).size}`).join('\n')
  return { cover: files.includes('cover.jpg'), banner: files.includes('banner.jpg'), heads, v: crypto.createHash('sha1').update(sig).digest('hex').slice(0, 8) }
}

// ── 易经 ──────────────────────────────────────────────────────────────
// 第 1–64 章 = 六十四卦(kind 'gua'),第 65 章起 = 系辞上 / 系辞下 / 说卦 / 序卦 / 杂卦各章(kind 'text')。
// 一卦的段次:卦辞 → 彖 → 大象 → 六爻(爻辞 + 小象)→ 用九 / 用六(乾坤)→ 文言(乾坤,逐段)。
// 注释照网站的挂法:卦辞、爻辞走 zhushi.json 词典(最长优先扫描,同 AnnotatedText.segment);
// 彖 / 大象 / 小象 / 文言与十翼五种走 zhushi-anchored(逐段锚定,ref 条目从词典取释义)。
// binary 自下而上(下标 0 = 初爻),与全项目约定一致。
const YJ_TEXTS = ['xici-shang', 'xici-xia', 'shuogua', 'xugua', 'zagua']

function buildYijing(spec) {
  const Y = 'src/data/yijing'
  const hexes = read(`${Y}/hexagrams.json`)
  const trigrams = new Map(read(`${Y}/trigrams.json`).map((t) => [t.id, t.name]))
  const dict = read(`${Y}/zhushi.json`)
  const dictByTerm = new Map(dict.map((z) => [z.term, z]))
  const byFirst = new Map()
  for (const z of dict) { if (!byFirst.has(z.term[0])) byFirst.set(z.term[0], []); byFirst.get(z.term[0]).push(z) }
  for (const l of byFirst.values()) l.sort((a, b) => b.term.length - a.term.length)
  const hexAnch = read(`${Y}/zhushi-anchored/hexagrams.json`)

  const toNote = (x) => { const n = { k: x.term, d: x.note }; if (x.reading) n.r = x.reading; return n }
  // 词典模式:与网站 AnnotatedText 同一扫描,命中的词去重后挂上
  const dictNotes = (o) => {
    const out = [], seen = new Set()
    for (let i = 0; i < o.length;) {
      const hit = (byFirst.get(o[i]) || []).find((z) => o.startsWith(z.term, i))
      if (hit) { if (!seen.has(hit.term)) { seen.add(hit.term); out.push(toNote(hit)) } i += hit.term.length } else i++
    }
    return out
  }
  // 锚定模式:ref 条目从词典取释义,取不到的丢弃(同 zhushiAnchored.resolve)
  const anchNotes = (list) => (list || []).map((e) => (e.ref ? dictByTerm.get(e.term) : e)).filter(Boolean).map(toNote)

  const stats = { dict: 0, anchHex: 0, anchText: 0 }
  let chars = 0
  const chapters = []
  const segParts = new Map()   // 书桌章号 → 各段的部位键(只卦有)
  const mkSeg = (where, o, t, notes, extra, kind) => {
    if (typeof o !== 'string' || !o) { err(`易经 ${where}:原文缺`); return null }
    const seg = { o }
    if (t) seg.t = t
    if (notes.length) {
      for (const n of notes) if (!o.includes(n.k)) err(`易经 ${where}:注释「${n.k}」不是该段原文子串`)
      seg.n = notes
      stats[kind] += notes.length
    }
    Object.assign(seg, extra)
    chars += o.length
    return seg
  }

  // 六十四卦
  if (hexes.length !== 64) err(`易经:hexagrams.json 有 ${hexes.length} 卦,应为 64`)
  const sorted = [...hexes].sort((a, b) => a.id - b.id)
  sorted.forEach((h, i) => {
    const where = `第 ${h.id} 卦${h.name}`
    if (h.id !== i + 1) err(`易经:卦序不连续,第 ${i + 1} 位是 ${h.id}`)
    if (!/^[01]{6}$/.test(h.binary || '')) err(`易经 ${where}:binary「${h.binary}」不是 6 位 0/1`)
    if (!Array.isArray(h.lines) || h.lines.length !== 6) { err(`易经 ${where}:爻数不是 6`); return }
    const upper = trigrams.get(h.upperTrigram), lower = trigrams.get(h.lowerTrigram)
    if (!upper || !lower) err(`易经 ${where}:上下卦 ${h.upperTrigram}/${h.lowerTrigram} 在 trigrams.json 里找不到`)
    const A = hexAnch[String(h.id)] || {}
    // [源原文, seg] 成对记下,末尾逐段核一字不差
    const pairs = []
    // part:详注真源里的部位键(judgment / tuan / daxiang / l1… / x1… / use / xuse / w0…,见 scripts/lib/xiangzhu.mjs 的 hexParts)
    const push = (src, seg, part) => { if (seg) { pairs.push([src, seg]); segs.push(seg); parts.push(part) } }
    const segs = [], parts = []
    push(h.judgment?.original, mkSeg(`${where} 卦辞`, h.judgment?.original, h.judgment?.translation, dictNotes(h.judgment?.original || ''), { label: '卦辞' }, 'dict'), 'judgment')
    push(h.tuan?.original, mkSeg(`${where} 彖`, h.tuan?.original, h.tuan?.translation, anchNotes(A.tuan), { label: '彖' }, 'anchHex'), 'tuan')
    push(h.daxiang?.original, mkSeg(`${where} 大象`, h.daxiang?.original, h.daxiang?.translation, anchNotes(A.daxiang), { label: '象' }, 'anchHex'), 'daxiang')
    const lineSegs = (ln, key, lineNo) => {
      push(ln.original, mkSeg(`${where} ${ln.title}`, ln.original, ln.translation, dictNotes(ln.original || ''), { label: ln.title, line: lineNo }, 'dict'), key === 'use' ? 'use' : `l${key}`)
      const xx = ln.xiaoxiang
      if (!xx) { err(`易经 ${where} ${ln.title}:缺小象`); return }
      push(xx.original, mkSeg(`${where} ${ln.title} 小象`, xx.original, xx.translation, anchNotes(A.xiaoxiang?.[key]), { label: '象', line: lineNo }, 'anchHex'), key === 'use' ? 'xuse' : `x${key}`)
    }
    h.lines.forEach((ln, j) => lineSegs(ln, String(j + 1), j + 1))
    if (h.extra?.use) lineSegs(h.extra.use, 'use', 7)
    ;(h.extra?.wenyan || []).forEach((p, j) => push(p.original, mkSeg(`${where} 文言第 ${j + 1} 段`, p.original, p.translation, anchNotes(A.wenyan?.[String(j)]), { label: '文言' }, 'anchHex'), `w${j}`))
    for (const [src, seg] of pairs) if (seg.o !== src) err(`易经 ${where}:有一段原文与源数据不一致`)
    segParts.set(chapters.length + 1, parts)
    chapters.push({
      no: chapters.length + 1,
      title: h.fullName || h.name,
      kind: 'gua',
      gua: { name: h.name, fullName: h.fullName, pinyin: h.pinyin, binary: h.binary, upper, lower },
      src: { corpus: 'yijing', slug: 'hexagrams', ch: h.id },
      segs,
    })
  })
  const parts = [{ title: '上经', from: 1, to: 30 }, { title: '下经', from: 31, to: 64 }]

  // 十翼五种
  for (const slug of YJ_TEXTS) {
    const book = read(`${Y}/classics/${slug}.json`)
    const notes = exists(`${Y}/zhushi-anchored/${slug}.json`) ? read(`${Y}/zhushi-anchored/${slug}.json`) : {}
    const from = chapters.length + 1
    for (const c of book.chapters) {
      const cn = notes[String(c.no)] || {}
      const where = `${book.title} 第 ${c.no} 章`
      const segs = c.paragraphs.map((p, i) => {
        const o = typeof p === 'string' ? p : p.original
        const seg = mkSeg(`${where}第 ${i + 1} 段`, o, p.translation, anchNotes(cn[String(i)]), {}, 'anchText')
        if (seg && seg.o !== o) err(`易经 ${where}第 ${i + 1} 段:原文与源数据不一致`)
        return seg
      }).filter(Boolean)
      chapters.push({
        no: chapters.length + 1,
        // 文件只有一章(杂卦)就只用书名;否则「系辞上 · 第一章」
        title: book.chapters.length === 1 ? book.title : `${book.title} · ${c.title || `第 ${c.no} 章`}`,
        kind: 'text',
        src: { corpus: 'yijing', slug, ch: c.no },
        segs,
      })
    }
    parts.push({ title: book.title, from, to: chapters.length })
  }
  for (const p of parts) if (p.to < p.from) err(`易经:部「${p.title}」是空的`)
  // 详注按每章 src 取:卦按部位键,十翼五种按段下标(十翼各段原文都不空,书桌段下标即站内段下标)
  let detailed = 0
  for (const c of chapters) {
    const xz = xiangzhuOf(c.src.corpus, c.src.slug)?.[String(c.src.ch)]
    if (!xz) continue
    const parts = segParts.get(c.no)
    c.segs.forEach((seg, i) => { applyDeskNotes(spec.id, xz[parts ? parts[i] : String(i)], c.no, i, seg); detailed += (seg.n || []).filter((n) => n.x).length })
  }
  console.log(`  易经注释:卦辞爻辞词典 ${stats.dict} 条 · 卦内传文锚注 ${stats.anchHex} 条 · 十翼五种锚注 ${stats.anchText} 条 · 并入详注 ${detailed} 条`)
  return finish(spec, {}, chapters, parts, chars)
}

// 只清包文件与清单;art/(gen-art.mjs --export 的产物)保留
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.rmSync(path.join(OUT, f))
const ids = new Set()
for (const b of BOOKS) { if (ids.has(b.id)) err(`书 id「${b.id}」重复`); ids.add(b.id) }
const books = BOOKS.map((b) => (b.build === 'yijing' ? buildYijing(b) : buildBook(b)))
for (const b of books) { const a = scanArt(b.id); if (a) b.art = a }
if (errors.length) { console.error(errors.slice(0, 30).join('\n')); console.error(`✗ ${errors.length} 处校验未过`); process.exit(1) }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ v: 1, categories: CATEGORIES.filter((c) => books.some((b) => b.category === c)), books }, null, 1))

// 逐书一行:章数 / 段 / 字 / 包大小;白话章数(细粒度的篇数)、图解、丢掉的块、没挂上的白话键
const kb = (n) => `${(n / 1024).toFixed(0)} KB`
for (const b of books) {
  const R = rep(b.id)
  const bits = [`${b.chapters} ${b.unit}`, `${b.segs} 段`, `${b.chars} 字`, kb(b.bytes), `译 ${b.layers.trans} · 注 ${b.layers.notes} · 详注 ${b.layers.xiang}`]
  if (b.baihua) bits.push(`白话 ${b.baihua.essays ?? b.baihua.chapters} 章${b.baihua.subs ? ` + ${b.baihua.subs} 篇细分` : ''} ${kb(b.baihua.bytes)} 图解 ${b.baihua.figsDone}/${b.baihua.figs}`)
  else bits.push('无白话')
  if (R.titles) bits.push(`诗题 ${R.titles}`)
  if (b.verse) bits.push('韵文')
  if (R.verseCh) bits.push(`韵文章 ${R.verseCh}`)
  const dr = Object.entries(R.dropped)
  if (dr.length) bits.push(`丢块 ${dr.map(([k, n]) => `${k}×${n}`).join(' ')}`)
  if (R.orphans.length) bits.push(`未挂白话 ${R.orphans.length}(${R.orphans.slice(0, 3).join('、')}${R.orphans.length > 3 ? '…' : ''})`)
  if (b.disclaimer) bits.push(`声明 ${JSON.stringify(b.disclaimer)}`)
  console.log(`${b.bundled ? '★' : ' '} ${b.category} ${b.id} ${b.title}  ${bits.join(' · ')}`)
}
const total = books.reduce((n, b) => n + b.bytes + (b.baihua?.bytes || 0), 0)
const byCat = CATEGORIES.map((c) => { const xs = books.filter((b) => b.category === c); return `${c} ${xs.length}` }).join(' · ')
console.log(`门类:${byCat}`)
if (COLLISIONS.length) console.log(`id 撞名:${COLLISIONS.join(';')}`)
console.log(`合计 ${books.length} 本 · 核心包 ${(books.reduce((n, b) => n + b.bytes, 0) / 1048576).toFixed(1)} MB · 白话包 ${(books.reduce((n, b) => n + (b.baihua?.bytes || 0), 0) / 1048576).toFixed(1)} MB · 共 ${(total / 1048576).toFixed(1)} MB;随 App 带 ${books.filter((b) => b.bundled).length} 本(${(books.filter((b) => b.bundled).reduce((n, b) => n + b.bytes, 0) / 1048576).toFixed(1)} MB)`)
console.log(`→ ${path.relative(ROOT, OUT)}/manifest.json(${books.length} 本)`)
