// 「观象 · 新收」订阅源(/feed.xml)。
//
// ══ 为什么要有它 ══
// 站里现在唯一的回访钩子是首页的「每日一辩」——**只有人已经来了才看得见**。
// 一个独立站需要能离站触达的东西:读者订一次,之后每添一部书他就知道。
//
// ══ 条目的时间从哪来:git,不编造 ══
// 每本书取它**第一次入库那个提交**的日期(`--diff-filter=A`),这是真实发生过的时间。
// 不用 mtime(装配脚本一重跑全变)、更不用当天日期充数——
// 那样订阅者每次拉取都以为有新东西,是骗人。
//
// 因此这份 feed 的语义是「**新收了哪本书**」,不是「今天读哪一章」。
// 逐章日更是另一件事(要么服务端定时生成,要么客户端算),不在这里假装。
//
// 用法:随 npm run content:build 自动跑;单跑 node scripts/gen-feed.mjs

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DATA = path.join(ROOT, 'src/data')
const ORIGIN = 'https://hexa.gavin.pub'
const MAX_ITEMS = 50

const { SITES } = await import(pathToFileURL(path.join(ROOT, 'src/sites/registry.js')).href)
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const exists = (f) => fs.existsSync(f)
const esc = (s) => String(s || '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const compact = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// ── 一遍扫完整个 git 历史,得「文件 → 首次入库时间」 ────────────────────────
// 逐文件跑 git log 要几百次调用;这样只跑一次(实测 0.25s),可以直接进 content:build。
function firstSeenMap() {
  const out = execFileSync('git', [
    'log', '--diff-filter=A', '--name-only', '--format=C|%aI', '--reverse', '--', 'src/data',
  ], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const map = new Map()
  let when = null
  for (const line of out.split('\n')) {
    if (line.startsWith('C|')) { when = line.slice(2).trim(); continue }
    const f = line.trim()
    if (f && when && !map.has(f)) map.set(f, when)
  }
  return map
}

const seen = firstSeenMap()
const dateOf = (...files) => {
  const ds = files.map((f) => seen.get(f)).filter(Boolean).sort()
  return ds[0] || null
}

const items = []

// ── 典籍:一部书一条 ────────────────────────────────────────────────────────
for (const corpus of fs.readdirSync(SRC_DATA).sort()) {
  const textsFile = path.join(SRC_DATA, corpus, 'texts.json')
  if (!exists(textsFile)) continue
  const site = SITES.find((s) => s.key === corpus)
  const home = site?.home || `/${corpus}`
  for (const t of readJson(textsFile)) {
    // 书的「入库时间」以它的原文文件为准 —— texts.json 是全组共用的,先有它不代表这本已收
    const when = dateOf(`src/data/${corpus}/classics/${t.slug}.json`)
    if (!when) continue
    items.push({
      when,
      title: `新收《${t.title}》`,
      link: `${ORIGIN}${home}/${t.slug}`,
      desc: compact(t.brief || t.alias || ''),
      cat: site?.portalTitle || corpus,
    })
  }
}

// ── 观书:**一律不收** ──────────────────────────────────────────────────────
// 它是隐藏书房(个人读书笔记),不入公共搜索、不进 sitemap —— 订阅源同理。
// 这条与 robots.txt / buildSitemap / og 索引是同一条规矩,四处都要挡。

// ── 争鸣:一辩一条 ──────────────────────────────────────────────────────────
const debIdx = path.join(SRC_DATA, 'debates/index.json')
if (exists(debIdx)) {
  for (const t of readJson(debIdx).topics || []) {
    const when = dateOf(`src/data/debates/${t.id}.json`)
    if (!when) continue
    items.push({
      when,
      title: `新辩《${t.title}》`,
      link: `${ORIGIN}/debates/${t.id}`,
      desc: compact(t.question || ''),
      cat: '百家争鸣',
    })
  }
}

items.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0))
const latest = items.slice(0, MAX_ITEMS)

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '<channel>',
  '<title>观象 · 新收</title>',
  `<link>${ORIGIN}/</link>`,
  '<description>古籍学习站「观象」新收的典籍与新开的辩题。每部书含原文、白话译注、每章延伸与深读。</description>',
  '<language>zh-CN</language>',
  `<atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml" />`,
  latest[0] ? `<lastBuildDate>${new Date(latest[0].when).toUTCString()}</lastBuildDate>` : '',
  ...latest.map((it) => [
    '<item>',
    `<title>${esc(it.title)}</title>`,
    `<link>${esc(it.link)}</link>`,
    `<guid isPermaLink="true">${esc(it.link)}</guid>`,
    `<category>${esc(it.cat)}</category>`,
    `<pubDate>${new Date(it.when).toUTCString()}</pubDate>`,
    `<description>${esc(it.desc)}</description>`,
    '</item>',
  ].join('')),
  '</channel>',
  '</rss>',
].filter(Boolean).join('\n')

fs.writeFileSync(path.join(ROOT, 'public/feed.xml'), `${xml}\n`)

// 首页「最近新收」复用同一批条目 —— 与 RSS 同源同序,不另算一套,
// 否则两处迟早对不上(而对不上的那天没人会发现)。
fs.mkdirSync(path.join(ROOT, 'public/content'), { recursive: true })
fs.writeFileSync(
  path.join(ROOT, 'public/content/recent.json'),
  JSON.stringify(latest.slice(0, 8).map((it) => ({
    title: it.title, href: it.link.replace(ORIGIN, ''), cat: it.cat, at: it.when.slice(0, 10),
  }))),
)
console.log(`feed: ${latest.length} 条(候选 ${items.length},观书不入)`)
