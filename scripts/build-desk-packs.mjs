#!/usr/bin/env node
// 「观象 · 书桌」内容包构建(docs/desk-app-plan.md §4)。只读 src/data,产出 public/desk/v1/:
//   manifest.json                  可订的书:书名、体裁模板、章数、字数、主题色、包文件名(带内容哈希)
//   <id>.<hash>.json               一本书的核心包:各章原文 / 译文 / 注释 / 延伸(白话深读与插画另成包,M5)
// 书桌 App 与网站、现有 App 的构建互不依赖,唯一的共同点是 src/data 这份内容。
// 约定:
//   · 书桌里的「一本书」可以由站内几个 slug 拼成(庄子 = 内 / 外 / 杂篇);每章带 src {corpus, slug, ch},
//     进度、时长、划线一律按 src 记,与网站的 readPos / readDays 同一套坐标。
//   · 段下标 0 起,与 src/data 里 paragraphs 的次序一致——构建时逐段核原文一字不差、注释 term 是该段原文子串。
//   node scripts/build-desk-packs.mjs
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/desk/v1')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const exists = (p) => fs.existsSync(path.join(ROOT, p))

// 体裁模板:duanzhang 短章 · yulu 语录 · gua 卦 · pianzhang 篇章(编在 App 里,书只声明用哪种)
// 主题色先各给一组(主色 / 辅色 / 纸色),M0 画风定了以后从题图里取色再调。
const BOOKS = [
  { id: 'daodejing', template: 'duanzhang', sources: [['dao', 'daodejing']], theme: { accent: '#2E7D86', accent2: '#C7673F', paper: '#F7F5EE' } },
  { id: 'lunyu', template: 'yulu', sources: [['ru', 'lunyu']], theme: { accent: '#A65A2E', accent2: '#3F6F5A', paper: '#F8F4EA' } },
  { id: 'sunzi', template: 'pianzhang', sources: [['bing', 'sunzi']], theme: { accent: '#8C3B2F', accent2: '#3D5A6C', paper: '#F6F3EC' } },
  { id: 'guiguzi', template: 'pianzhang', sources: [['zong', 'guiguzi']], theme: { accent: '#5B4B8A', accent2: '#B8862F', paper: '#F5F3EE' } },
  { id: 'zhuangzi', template: 'pianzhang', title: '庄子', unit: '篇',
    sources: [['dao', 'zhuangzi-neipian', '内篇'], ['dao', 'zhuangzi-waipian', '外篇'], ['dao', 'zhuangzi-zapian', '杂篇']],
    theme: { accent: '#3F7A4E', accent2: '#D08A2E', paper: '#F6F6EC' } },
  // 易经:六十四卦(hexagrams.json)+ 独立成篇的十翼五种(classics/),数据形态不同,走 buildYijing
  { id: 'yijing', template: 'gua', title: '周易', unit: '卦', build: 'yijing',
    era: '先秦', attribution: '旧题伏羲画卦、文王系辞、孔子作传', summary: '六十四卦 · 十翼',
    brief: '六十四卦卦爻辞与十翼传文,以阴阳爻画说变化之理的群经之首。',
    theme: { accent: '#7A4E9A', accent2: '#C9892B', paper: '#F6F4EE' } },
]

const errors = []
const err = (m) => errors.push(m)

function buildBook(spec) {
  const chapters = []
  const parts = []
  let meta0 = null
  let chars = 0
  for (const [corpus, slug, partTitle] of spec.sources) {
    const meta = read(`src/data/${corpus}/texts.json`).find((t) => t.slug === slug)
    if (!meta) { err(`${corpus}/${slug}: texts.json 里没有`); continue }
    meta0 ||= meta
    const book = read(`src/data/${corpus}/classics/${slug}.json`)
    const notes = exists(`src/data/${corpus}/zhushi-anchored/${slug}.json`) ? read(`src/data/${corpus}/zhushi-anchored/${slug}.json`) : {}
    const yanyiAll = exists(`src/data/${corpus}/yanyi.json`) ? read(`src/data/${corpus}/yanyi.json`) : {}
    const yanyi = yanyiAll[slug] || {}
    const from = chapters.length + 1
    for (const c of book.chapters) {
      const cn = notes[String(c.no)] || {}
      const segs = c.paragraphs.map((p, i) => {
        const o = typeof p === 'string' ? p : p.original
        const seg = { o }
        if (p.translation) seg.t = p.translation
        const ns = cn[String(i)]   // 注释按「章 → 段下标(0 起)」挂
        if (Array.isArray(ns) && ns.length) {
          seg.n = ns.map((x) => {
            if (!o.includes(x.term)) err(`${corpus}/${slug} 第 ${c.no} 章第 ${i + 1} 段:注释「${x.term}」不是该段原文子串`)
            const n = { k: x.term, d: x.note }
            if (x.reading) n.r = x.reading
            return n
          })
        }
        chars += o.length
        return seg
      })
      const ch = {
        no: chapters.length + 1,
        title: meta.chapterNames?.[String(c.no)] || c.title || '',
        src: { corpus, slug, ch: c.no },
        segs,
      }
      const y = yanyi[String(c.no)]
      if (Array.isArray(y) && y.length) ch.yanyi = y
      chapters.push(ch)
    }
    if (partTitle) parts.push({ title: partTitle, from, to: chapters.length })
    else for (const p of meta.parts || []) parts.push({ title: p.title, from: p.from, to: p.to, ...(p.note ? { note: p.note } : {}) })
  }
  return finish(spec, meta0, chapters, parts, chars)
}

// 写出一本书的包,返回 manifest 条目(meta0:站内 texts.json 的书目元数据;易经没有,用 spec 里的字段)
function finish(spec, meta0, chapters, parts, chars) {
  const body = { id: spec.id, chapters }
  const json = JSON.stringify(body)
  const version = crypto.createHash('sha1').update(json).digest('hex').slice(0, 10)
  const file = `${spec.id}.${version}.json`
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ ...body, version }))
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
    version,
    file,
    bytes: Buffer.byteLength(json),
  }
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
    const push = (src, seg) => { if (seg) { pairs.push([src, seg]); segs.push(seg) } }
    const segs = []
    push(h.judgment?.original, mkSeg(`${where} 卦辞`, h.judgment?.original, h.judgment?.translation, dictNotes(h.judgment?.original || ''), { label: '卦辞' }, 'dict'))
    push(h.tuan?.original, mkSeg(`${where} 彖`, h.tuan?.original, h.tuan?.translation, anchNotes(A.tuan), { label: '彖' }, 'anchHex'))
    push(h.daxiang?.original, mkSeg(`${where} 大象`, h.daxiang?.original, h.daxiang?.translation, anchNotes(A.daxiang), { label: '象' }, 'anchHex'))
    const lineSegs = (ln, key, lineNo) => {
      push(ln.original, mkSeg(`${where} ${ln.title}`, ln.original, ln.translation, dictNotes(ln.original || ''), { label: ln.title, line: lineNo }, 'dict'))
      const xx = ln.xiaoxiang
      if (!xx) { err(`易经 ${where} ${ln.title}:缺小象`); return }
      push(xx.original, mkSeg(`${where} ${ln.title} 小象`, xx.original, xx.translation, anchNotes(A.xiaoxiang?.[key]), { label: '象', line: lineNo }, 'anchHex'))
    }
    h.lines.forEach((ln, j) => lineSegs(ln, String(j + 1), j + 1))
    if (h.extra?.use) lineSegs(h.extra.use, 'use', 7)
    ;(h.extra?.wenyan || []).forEach((p, j) => push(p.original, mkSeg(`${where} 文言第 ${j + 1} 段`, p.original, p.translation, anchNotes(A.wenyan?.[String(j)]), { label: '文言' }, 'anchHex')))
    for (const [src, seg] of pairs) if (seg.o !== src) err(`易经 ${where}:有一段原文与源数据不一致`)
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
  console.log(`  易经注释:卦辞爻辞词典 ${stats.dict} 条 · 卦内传文锚注 ${stats.anchHex} 条 · 十翼五种锚注 ${stats.anchText} 条`)
  return finish(spec, {}, chapters, parts, chars)
}

// 只清包文件与清单;art/(gen-art.mjs --export 的产物)保留
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) fs.rmSync(path.join(OUT, f))
const books = BOOKS.map((b) => (b.build === 'yijing' ? buildYijing(b) : buildBook(b)))
for (const b of books) { const a = scanArt(b.id); if (a) b.art = a }
if (errors.length) { console.error(errors.slice(0, 30).join('\n')); console.error(`✗ ${errors.length} 处校验未过`); process.exit(1) }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ v: 1, books }, null, 1))
for (const b of books) console.log(`${b.title}  ${b.chapters} ${b.unit} · ${b.segs} 段 · ${b.chars} 字 · ${(b.bytes / 1024).toFixed(0)} KB · ${b.file}`)
console.log(`→ ${path.relative(ROOT, OUT)}/manifest.json(${books.length} 本)`)
