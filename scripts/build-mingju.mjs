#!/usr/bin/env node
// 名句集数据生成(§四)。用法: node scripts/build-mingju.mjs [--write]
//
// **不新写一个字**。料全部取自站内**已逐字校验过的引文**:
//   ① 《赛博·百家争鸣》每一 turn 的 cite.quote —— check-data 逐条校过是该章原文的精确子串,
//      而且它们是各家「最能立住自己那一说」的句子,本就是被挑过一轮的;
//   ② `concepts.json` 五个跨派概念聚类的 loci —— 同样经原文 grep 坐实。
// 凭记忆敲名句是这个站最不该犯的错(原文一律走管线),故宁可只收已验的。
//
// 落 `src/data/mingju.json`。字段:
//   q 句子 · label 出处(人可读)· corpus/slug/ch 定位(页面据此链回原文)· from 来源辩题 id
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chapterParts } from '../src/features/reader/chapterParts.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write')

// 名句的长度窗口:短于此不成句(「无为」),长于此不是句是段,分享卡也放不下。
// 争鸣/概念两源是机器全量扫的,窗口收紧;人工选目(源③)是一条条挑过的,放宽到 30——
// 词曲一句长过诗句(「一曲新词酒一杯，去年天气旧池台，夕阳西下几时回」),卡上放得下。
const MIN = 6, MAX = 22, MAX_PICKED = 30
let picking = false

const seen = new Map()   // 归一后的句子 → 条目(去重:同一句在多辩被引很常见)
const norm = (s) => s.replace(/[\s，。、；：！？「」『』（）()]/g, '')

function add(q, label, corpus, slug, ch, from, seg) {
  const t = String(q || '').trim()
  const n = norm(t)
  if (n.length < MIN || n.length > (picking ? MAX_PICKED : MAX)) return
  const k = n
  if (seen.has(k)) { seen.get(k).cited += 1; return }
  const e = { q: t, label, corpus, slug, ch, from, cited: 1 }
  if (Number.isInteger(seg)) e.seg = seg
  seen.set(k, e)
}

// ① 争鸣引文
const D = path.join(ROOT, 'src/data/debates')
for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const d = JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))
  for (const r of d.rounds) {
    for (const t of r.turns) {
      const c = t.cite
      add(c.quote, c.label, c.corpus, c.slug, c.ch, d.id)
    }
  }
}

// ② 概念聚类的代表章(有 quote 字段的才收)
const cj = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/concepts.json'), 'utf8'))
for (const cl of cj.clusters || []) {
  for (const l of cl.loci || []) {
    if (l.quote) add(l.quote, l.label || `${l.slug}·${l.ch}`, l.corpus, l.slug, l.ch, null)
  }
}

// ③ 人工选目(中医/谋略/唐诗/宋词/元曲五组**按设计不入争鸣**,概念聚类也没收它们,
//    于是这五组在 /mingju 里一句都没有)。料出自**白话层的 quote 块**——那些引文
//    check-data 逐条校过是原文精确子串,与争鸣 cite 同级可信;候选由
//    `scripts/harvest-mingju.mjs` 机器拉出,挑哪几句写在这里,仍是人的事。
//    这一源同样不新写一个字,落盘前照走下面的逐字复核。
const EX = path.join(ROOT, 'scripts/authored/mingju-extra')
picking = true
if (fs.existsSync(EX)) {
  for (const f of fs.readdirSync(EX).filter((x) => x.endsWith('.json'))) {
    for (const e of JSON.parse(fs.readFileSync(path.join(EX, f), 'utf8'))) {
      add(e.q, e.label, e.corpus, e.slug, e.ch, null, e.seg)
    }
  }
}

// 落盘前再核一次:每条必须仍是该章原文的精确子串(数据后来被改过也能逮住)
const chCache = {}
function chapterText(corpus, slug, ch) {
  const k = `${corpus}/${slug}`
  if (!(k in chCache)) {
    const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
    chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
  }
  const b = chCache[k]
  const c = b?.chapters?.find((x) => String(x.no) === String(ch))
  return c ? c.paragraphs.map((p) => p.original).join('') : null
}

const items = [], bad = []
for (const e of seen.values()) {
  const txt = chapterText(e.corpus, e.slug, e.ch)
  if (!txt || !txt.includes(e.q)) { bad.push(e); continue }
  items.push(e)
}
// 互为包含的去重:同一处常被不同辩截取长短不一(「杨氏为我，是无君也」与它的合并句)。
// 名句取**短的那句**——更立得住,分享卡也放得下;被引次数并到留下的那条。
const byLen = [...items].sort((a, b) => norm(a.q).length - norm(b.q).length)
const kept = []
for (const e of byLen) {
  const n = norm(e.q)
  const sup = kept.find((k) => n.includes(norm(k.q)))   // 已留了更短的、且是它的子串 → 本条丢弃
  if (sup) { sup.cited += e.cited; continue }
  kept.push(e)
}
items.length = 0
items.push(...kept)

// 深链:唐诗一卷含几十首、长短经一卷含数篇,只链到「卷」等于把人扔进几百段里。
// 带 seg 的条目算出段锚 + 该段落在第几屏(长章拆屏见 chapterParts),链接直落那一首。
const metaCache = {}
function metaOf(corpus, slug) {
  const k = `${corpus}/${slug}`
  if (!(k in metaCache)) {
    const f = path.join(ROOT, `src/data/${corpus}/texts.json`)
    const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
    metaCache[k] = (Array.isArray(list) ? list : list.texts || []).find((x) => x.slug === slug) || null
  }
  return metaCache[k]
}
for (const e of items) {
  if (!Number.isInteger(e.seg)) continue
  const book = chCache[`${e.corpus}/${e.slug}`]
  const chap = book?.chapters?.find((x) => String(x.no) === String(e.ch))
  if (!chap) { delete e.seg; continue }
  e.hash = `seg-${e.ch}-${e.seg}`
  const parts = chapterParts(chap, metaOf(e.corpus, e.slug))
  if (parts) {
    const i = parts.findIndex((p) => e.seg >= p.from && e.seg < p.to)
    if (i > 0) e.part = i + 1   // ?p= 是 1 起(ClassicReader 的 part 默认 1)
  }
  delete e.seg
}

// 被引次数多的排前(多辩都拿它立论 = 更有分量),同次数按出处稳定排序
items.sort((a, b) => b.cited - a.cited || a.label.localeCompare(b.label, 'zh'))

const byCorpus = items.reduce((m, e) => ((m[e.corpus] = (m[e.corpus] || 0) + 1), m), {})
console.log(`名句 ${items.length} 条 · 剔除非子串 ${bad.length} 条`)
console.log('  按组:', Object.entries(byCorpus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
for (const e of bad.slice(0, 5)) console.warn(`  ✗ ${e.slug}#${e.ch}「${e.q.slice(0, 16)}」`)

if (WRITE) {
  const out = path.join(ROOT, 'src/data/mingju.json')
  fs.writeFileSync(out, JSON.stringify(items, null, 1) + '\n')
  console.log(`已写入 ${path.relative(ROOT, out)}`)
} else {
  console.log('(加 --write 才落盘)')
}
