// 观书文章的机器校验。
//
// 站里的书文章此前**不走任何校验**(SOP §1.5 明写「靠人工把关」),
// 而 2026-08-17 起改为并发产出 —— agent 会自查并在回复里说「全部合规」,
// 但**自查报告不能当验收**。这个脚本是主会话合并前的独立一道闸。
//
// ⚠️ 它只管**能机器判的那些**:JSON 结构、红线数值、SVG 上色、块型合法。
// **它抓不到事实错误**(引文是不是真的原文、书里到底有没有这句话)——
// 那一层只能人读,CLAUDE.md 里「机器校验一条事实错误都抓不到」说的就是这件事。
//
//   node scripts/check-books.mjs            # 全部
//   node scripts/check-books.mjs <slug>     # 单本

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const BOOKS = path.join(ROOT, 'src/data/books')

// `table` 是站里真在用的块型(存量 50 处),初版漏列了 —— 不是它不合法,是我没查全
const BLOCK_TYPES = new Set(['lead', 'h2', 'p', 'quote', 'figure', 'list', 'callout', 'pull', 'steps', 'refs', 'table'])
const TONES = new Set(['note', 'warn', 'mute'])

// 红线(SOP §1 / §7 / §8)
const QUOTE_MAX_CHARS = 100
const QUOTE_MAX_PER_ARTICLE = 16
const OVERVIEW_MAX_CHARS = 10000
const ARTICLE_MAX_CHARS = 5000
const LABEL_MAX = 12

const errs = []
const warns = []
const E = (f, m) => errs.push(`${f}: ${m}`)
const W = (f, m) => warns.push(`${f}: ${m}`)

const textOf = (b) => {
  let n = (b.text || '') + (b.original || '') + (b.translation || '') + (b.caption || '')
  for (const it of b.items || []) n += typeof it === 'string' ? it : `${it.title || ''}${it.text || ''}`
  return n
}

function checkArticle(file, o, { isOverview }) {
  const f = path.relative(ROOT, file)
  if (!o.title) E(f, '缺 title')
  if (!o.centralIdea) E(f, '缺 centralIdea')
  if (!Array.isArray(o.blocks) || !o.blocks.length) return E(f, 'blocks 空')

  // hero 只许总览有 —— 章文章带 hero 会让层级失控(SOP §8)
  if (isOverview) {
    if (!o.hero?.headline) E(f, '总览缺 hero.headline')
  } else if (o.hero || o.featured) {
    E(f, '章文章不该有 hero / featured')
  }

  const chars = o.blocks.reduce((n, b) => n + textOf(b).length, 0)
  const cap = isOverview ? OVERVIEW_MAX_CHARS : ARTICLE_MAX_CHARS
  if (chars > cap) E(f, `正文 ${chars} 字,超上限 ${cap}`)
  if (!isOverview && chars < 1500) W(f, `正文仅 ${chars} 字,偏薄`)

  const quotes = [], figs = []
  let pulls = 0
  for (const [i, b] of o.blocks.entries()) {
    const at = `${f} blocks[${i}]`
    if (!BLOCK_TYPES.has(b.type)) { E(at, `未知块型 ${b.type}`); continue }
    if (b.type === 'quote') {
      if (!b.original) E(at, 'quote 缺 original')
      else quotes.push(b.original)
    }
    if (b.type === 'pull') { pulls++; if (!b.text) E(at, 'pull 缺 text') }
    if (b.type === 'figure') {
      if (!b.svg) E(at, 'figure 缺 svg')
      else figs.push(b.svg)
    }
    if (b.type === 'callout') {
      if (!TONES.has(b.tone)) E(at, `callout.tone 非法: ${b.tone}`)
      if (!b.items?.length) E(at, 'callout.items 空')
      if (b.label && [...b.label].length > LABEL_MAX) E(at, `callout.label 超 ${LABEL_MAX} 字`)
    }
    if ((b.type === 'list' || b.type === 'refs') && !b.items?.length) E(at, `${b.type}.items 空`)
    // 列表项内不该自带行首序号(编号由排版出)
    if (b.type === 'list') {
      for (const it of b.items) {
        if (typeof it === 'string' && /^\s*(?:[一二三四五六七八九十]+、|\d+[.、)])/.test(it)) {
          W(at, `list 项自带行首序号: ${it.slice(0, 14)}…`)
        }
      }
    }
  }

  if (pulls > 1) E(f, `pull ${pulls} 处,一篇至多 1 处`)
  if (quotes.length > QUOTE_MAX_PER_ARTICLE) E(f, `引文 ${quotes.length} 条,超上限 ${QUOTE_MAX_PER_ARTICLE}`)
  for (const q of quotes) {
    if ([...q].length > QUOTE_MAX_CHARS) E(f, `引文超 ${QUOTE_MAX_CHARS} 字(${[...q].length}): ${q.slice(0, 20)}…`)
  }
  // 版权红线的粗筛:引文占正文比例过高 = 有靠拼引文还原原文的嫌疑
  const qChars = quotes.reduce((n, q) => n + [...q].length, 0)
  if (chars && qChars / chars > 0.15) W(f, `引文占正文 ${(qChars / chars * 100).toFixed(0)}%,偏高,复核是否靠引文撑篇幅`)

  const need = isOverview ? [5, 8] : [3, 6]
  if (figs.length < need[0] || figs.length > need[1]) W(f, `配图 ${figs.length} 张,期望 ${need[0]}–${need[1]}`)
  for (const [i, svg] of figs.entries()) {
    // SVG 的 presentation 属性不认 var(),必须写 style —— 写错了暗色模式下会瞎
    if (/\s(?:fill|stroke)="(?!none")/.test(svg)) E(`${f} 图${i + 1}`, '用了 fill/stroke 属性,必须改 style=')
    if (/#[0-9a-fA-F]{3,6}\b/.test(svg)) E(`${f} 图${i + 1}`, '写死了色值,须用 var(--…)')
    if (!/viewBox=/.test(svg)) E(`${f} 图${i + 1}`, '缺 viewBox')
    // ⚠️ 观书走**中立外壳**(App.jsx 的 isNeutralPath 含 /books),
    // 而 [data-site="portal"] 把 --cinnabar 重绑成了 --ink-soft ——
    // 在观书里写 var(--cinnabar) 朱色会**渲染成灰墨**,点睛全废。
    // 书内朱色一律用 --cinnabar-pure。2026-08-17 全库扫出 5 本共 712 处中招。
    if (/var\(--cinnabar\)/.test(svg)) {
      E(`${f} 图${i + 1}`, '观书里的朱色须用 var(--cinnabar-pure);--cinnabar 在中立外壳下会变灰')
    }
  }
  // ftype 是**直接渲染给读者看的标签**(BaihuaBlock 的 .baihua-figure__tag),
  // 写成英文读者就会看到一串 structure/compare。全站惯例是中文(结构图/对比图/金句卡…)。
  // 2026-08-17 并发产《人间词话》时十章里 37 处写成了英文 —— 规格没说清,已补。
  for (const [i, b] of o.blocks.entries()) {
    if (b.type === 'figure' && b.ftype && !/[\u4e00-\u9fff]/.test(b.ftype)) {
      E(`${f} blocks[${i}]`, `figure.ftype 须为中文标签(读者可见),现为「${b.ftype}」`)
    }
  }
}

const only = process.argv[2]
const index = JSON.parse(fs.readFileSync(path.join(BOOKS, 'index.json'), 'utf8'))
const list = (Array.isArray(index) ? index : index.books).filter((b) => !only || b.slug === only)
if (!list.length) { console.error(`找不到书: ${only}`); process.exit(1) }

let nArt = 0
for (const bk of list) {
  const dir = path.join(BOOKS, bk.slug)
  if (!fs.existsSync(dir)) { E(bk.slug, '目录不存在'); continue }
  for (const key of ['slug', 'title', 'author', 'oneLine', 'accent', 'chapters']) {
    if (!bk[key]) E(`index:${bk.slug}`, `缺 ${key}`)
  }
  if (bk.accent && !/^#[0-9a-f]{6}$/i.test(bk.accent)) E(`index:${bk.slug}`, `accent 格式不对: ${bk.accent}`)

  const ov = path.join(dir, 'overview.json')
  if (!fs.existsSync(ov)) E(bk.slug, '缺 overview.json')
  else checkArticle(ov, JSON.parse(fs.readFileSync(ov, 'utf8')), { isOverview: true })

  if (!fs.existsSync(path.join(dir, 'mindmap.json'))) E(bk.slug, '缺 mindmap.json')

  // 每个一级章都要有对应文章,且不许有多余文章
  const want = new Set((bk.chapters || []).map((c) => String(c.no)))
  const got = new Set(fs.existsSync(path.join(dir, 'articles'))
    ? fs.readdirSync(path.join(dir, 'articles')).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5))
    : [])
  for (const no of want) if (!got.has(no)) E(bk.slug, `章 ${no} 缺文章`)
  for (const no of got) if (!want.has(no)) E(bk.slug, `多出文章 ${no}.json,index 里没有这一章`)
  for (const no of got) {
    if (!want.has(no)) continue
    checkArticle(path.join(dir, 'articles', `${no}.json`),
      JSON.parse(fs.readFileSync(path.join(dir, 'articles', `${no}.json`), 'utf8')), { isOverview: false })
    nArt++
  }
}

for (const w of warns) console.log(`⚠️  ${w}`)
for (const e of errs) console.error(`❌ ${e}`)
console.log(`\n观书校验:${list.length} 本 · ${nArt} 篇章文章 · ${errs.length} 错 · ${warns.length} 警告`)
if (errs.length) {
  console.error('\n⚠️ 这个脚本抓不到事实错误(引文是否真是原文、书里有没有这句话)—— 那一层必须人读。')
  process.exit(1)
}
