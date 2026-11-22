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
  // 易经(六十四卦 + 十翼)数据形态不同,M1 接入
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
  const body = { id: spec.id, chapters }
  const json = JSON.stringify(body)
  const version = crypto.createHash('sha1').update(json).digest('hex').slice(0, 10)
  const file = `${spec.id}.${version}.json`
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ ...body, version }))
  return {
    id: spec.id,
    title: spec.title || meta0.title,
    alias: spec.title ? '' : (meta0.alias || ''),
    era: meta0.era || '',
    attribution: meta0.attribution || '',
    brief: meta0.brief || '',
    howto: meta0.howto || '',
    template: spec.template,
    unit: spec.unit || meta0.sectionUnit || '章',
    chapters: chapters.length,
    segs: chapters.reduce((n, c) => n + c.segs.length, 0),
    chars,
    parts,
    theme: spec.theme,
    version,
    file,
    bytes: Buffer.byteLength(json),
  }
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const books = BOOKS.map(buildBook)
if (errors.length) { console.error(errors.slice(0, 30).join('\n')); console.error(`✗ ${errors.length} 处校验未过`); process.exit(1) }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ v: 1, books }, null, 1))
for (const b of books) console.log(`${b.title}  ${b.chapters} ${b.unit} · ${b.segs} 段 · ${b.chars} 字 · ${(b.bytes / 1024).toFixed(0)} KB · ${b.file}`)
console.log(`→ ${path.relative(ROOT, OUT)}/manifest.json(${books.length} 本)`)
