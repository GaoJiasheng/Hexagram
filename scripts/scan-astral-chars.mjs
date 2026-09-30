#!/usr/bin/env node
// 扫站内数据里「辅助平面」(U+10000 以上)的字——主要是 CJK 扩展 B–I 区——并核对正文字体能否显示。
//
// 起因:正文字体自托管 @fontsource/noto-serif-sc(Google Fonts 分片,unicode-range 切 100 多片),
// 这套字**一个扩展区汉字都不含**,浏览器只能退回字体栈里的后续字体 / 系统兜底,兜不住就是空方块。
// 本脚本可反复跑:加书之后看新进了哪些扩展区字、落在哪几本书哪一章、字体栈兜不兜得住。
//
//   node scripts/scan-astral-chars.mjs                 # 只扫 classics 原文(默认)
//   node scripts/scan-astral-chars.mjs --all           # 另扫 classics 译文、白话、src/data 下其余 JSON
//   node scripts/scan-astral-chars.mjs --list          # 逐字列全部出处(书 / 章 / 段)
//   node scripts/scan-astral-chars.mjs --top=40        # 字表只列前 N 个(默认 30;--list 时列全部)
//   node scripts/scan-astral-chars.mjs --chars-out=f   # 把扫到的扩展区字写成一行文本(给 pyftsubset --text-file 用)
//   node scripts/scan-astral-chars.mjs --json=f        # 完整结果写 JSON
//   node scripts/scan-astral-chars.mjs --font=/path/x.ttc#0 [--font=…]
//                                                      # 额外核对某个字体文件的 cmap 覆盖(需 python3 + fontTools;
//                                                      # .ttc/.otc 用 #序号 选字面,缺省取 0)
//
// 只读,不改任何文件(除非显式给 --chars-out / --json)。

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = join(root, 'src/data')

// ── 参数 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const optAll = (name) => args.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3))
const SCAN_ALL = flag('all')
const LIST = flag('list')
const TOP = LIST ? Infinity : Number(opt('top') || 30)

// ── Unicode 分区(Unicode 16 的块界;扩展 J 等更新的一并落「其他表意文字」) ──
const BLOCKS = [
  ['CJK 扩展 B', 0x20000, 0x2a6df],
  ['CJK 扩展 C', 0x2a700, 0x2b73f],
  ['CJK 扩展 D', 0x2b740, 0x2b81f],
  ['CJK 扩展 E', 0x2b820, 0x2ceaf],
  ['CJK 扩展 F', 0x2ceb0, 0x2ebef],
  ['CJK 扩展 I', 0x2ebf0, 0x2ee5f],
  ['CJK 兼容表意补充', 0x2f800, 0x2fa1f],
  ['CJK 扩展 G', 0x30000, 0x3134f],
  ['CJK 扩展 H', 0x31350, 0x323af],
]
function blockOf(cp) {
  for (const [name, lo, hi] of BLOCKS) if (cp >= lo && cp <= hi) return name
  if (cp >= 0x20000 && cp <= 0x3ffff) return '其他表意文字(SIP/TIP)'
  if (cp >= 0xf0000) return '私用区(补充)'
  return '非汉字(SMP:符号/表情等)'
}
const isCjkAstral = (cp) => cp >= 0x20000 && cp <= 0x3ffff
const hex = (cp) => 'U+' + cp.toString(16).toUpperCase()

// ── 扫描 ────────────────────────────────────────────────────────────
// chars: Map<char, { cp, block, count, layers: Map<layer,count>, books: Map<book,count>, locs: string[] }>
const chars = new Map()
const layerTotals = new Map()
let bmpPua = 0 // BMP 私用区 U+E000–F8FF(同样必成方块,顺带数一下)

function record(text, layer, book, loc) {
  if (typeof text !== 'string' || !text) return
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp >= 0xe000 && cp <= 0xf8ff) bmpPua++
    if (cp <= 0xffff) continue
    let e = chars.get(ch)
    if (!e) {
      e = { cp, block: blockOf(cp), count: 0, layers: new Map(), books: new Map(), locs: [] }
      chars.set(ch, e)
    }
    e.count++
    e.layers.set(layer, (e.layers.get(layer) || 0) + 1)
    e.books.set(book, (e.books.get(book) || 0) + 1)
    if (!e.locs.includes(loc)) e.locs.push(loc)
    layerTotals.set(layer, (layerTotals.get(layer) || 0) + 1)
  }
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const corpora = readdirSync(DATA).filter((d) => statSync(join(DATA, d)).isDirectory())
const seenFiles = new Set()

// 1) classics:chapters[].paragraphs[].original(+ --all 时 translation)
for (const corpus of corpora) {
  const dir = join(DATA, corpus, 'classics')
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const file = join(dir, f)
    seenFiles.add(file)
    const slug = f.replace(/\.json$/, '')
    const book = `${corpus}/${slug}`
    const data = readJson(file)
    for (const c of data.chapters || []) {
      ;(c.paragraphs || []).forEach((p, i) => {
        const loc = `${book} 第${c.no}章${c.title ? `《${c.title}》` : ''} 段${i + 1}`
        record(p.original, '原文', book, loc)
        if (SCAN_ALL) record(p.translation, '译文', book, loc)
      })
    }
  }
}

// 2) --all:白话 + src/data 下其余 JSON(递归取所有字符串值)
function walkStrings(node, fn) {
  if (typeof node === 'string') fn(node)
  else if (Array.isArray(node)) node.forEach((x) => walkStrings(x, fn))
  else if (node && typeof node === 'object') for (const v of Object.values(node)) walkStrings(v, fn)
}
function listJson(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listJson(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}
if (SCAN_ALL) {
  for (const corpus of corpora) {
    const dir = join(DATA, corpus, 'baihua')
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const file = join(dir, f)
      seenFiles.add(file)
      const book = `${corpus}/${f.replace(/\.json$/, '')}`
      const data = readJson(file)
      for (const [ch, art] of Object.entries(data)) walkStrings(art, (s) => record(s, '白话', book, `${book} 白话#${ch}`))
    }
  }
  for (const file of listJson(DATA)) {
    if (seenFiles.has(file)) continue
    const rel = relative(DATA, file)
    walkStrings(readJson(file), (s) => record(s, '其他数据', rel.replace(/\.json$/, ''), rel))
  }
}

// ── 字体覆盖:@fontsource/noto-serif-sc 的 unicode-range(只看 main.jsx 实际引入的字重) ──
function parseRanges(css) {
  const ranges = []
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/^U\+/i, '')
      if (!t) continue
      if (t.includes('?')) {
        ranges.push([parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'f'), 16)])
      } else if (t.includes('-')) {
        const [a, b] = t.split('-')
        ranges.push([parseInt(a, 16), parseInt(b, 16)])
      } else {
        const v = parseInt(t, 16)
        ranges.push([v, v])
      }
    }
  }
  return ranges
}
const inRanges = (ranges, cp) => ranges.some(([a, b]) => cp >= a && cp <= b)

const FS_DIR = join(root, 'node_modules/@fontsource/noto-serif-sc')
const mainSrc = readFileSync(join(root, 'src/main.jsx'), 'utf8')
const weights = [...mainSrc.matchAll(/@fontsource\/noto-serif-sc\/(\d+)\.css/g)].map((m) => m[1])
const fontsource = {}
if (existsSync(FS_DIR)) {
  for (const w of weights) {
    const p = join(FS_DIR, `${w}.css`)
    if (existsSync(p)) fontsource[w] = parseRanges(readFileSync(p, 'utf8'))
  }
}
// 项目自己声明的 @font-face(将来若加扩展区子集字体,在这里核它的 unicode-range 盖没盖全)
function listCss(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listCss(p))
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}
const ownFaces = []
for (const file of listCss(join(root, 'src'))) {
  const css = readFileSync(file, 'utf8')
  for (const m of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
    const fam = (m[1].match(/font-family:\s*([^;]+);/) || [])[1]
    const ranges = parseRanges(m[1])
    ownFaces.push({ file: relative(root, file), family: fam ? fam.trim() : '?', ranges })
  }
}

// ── 可选:字体文件 cmap 覆盖(python3 fontTools) ──
function fontCmap(spec) {
  const [path, idx = '0'] = spec.split('#')
  const py = `
import sys
from fontTools.ttLib import TTFont
p, i = sys.argv[1], int(sys.argv[2])
kw = {'fontNumber': i} if p.lower().endswith(('.ttc', '.otc')) else {}
f = TTFont(p, lazy=True, **kw)
name = f['name'].getDebugName(4) or f['name'].getDebugName(1) or '?'
cm = f.getBestCmap() or {}
if 'cmap' in f:
    for t in f['cmap'].tables:
        if t.format in (12, 13): cm = {**t.cmap, **cm}
print(name)
print(' '.join(format(c, 'x') for c in cm if c > 0xffff))
`
  const r = spawnSync('python3', ['-c', py, path, idx], { encoding: 'utf8', maxBuffer: 64 << 20 })
  if (r.status !== 0) return { spec, error: (r.stderr || 'python3/fontTools 不可用').trim().split('\n').pop() }
  const [name, cps = ''] = r.stdout.split('\n')
  return { spec, name, set: new Set(cps.split(' ').filter(Boolean).map((h) => parseInt(h, 16))) }
}
const extraFonts = optAll('font').map(fontCmap)

// ── 输出 ────────────────────────────────────────────────────────────
const all = [...chars.entries()].sort((a, b) => b[1].count - a[1].count || a[1].cp - b[1].cp)
const cjk = all.filter(([, e]) => isCjkAstral(e.cp))
const nonCjk = all.filter(([, e]) => !isCjkAstral(e.cp))
const sum = (arr) => arr.reduce((n, [, e]) => n + e.count, 0)

const line = (s = '') => console.log(s)
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - [...String(s)].length))

line(`扫描范围:${SCAN_ALL ? 'classics 原文 + 译文 + 白话 + src/data 其余 JSON' : 'classics 原文(加 --all 扫全部)'}`)
line(`辅助平面字:${all.length} 个不同字 · 共 ${sum(all)} 次;其中 CJK 扩展区 ${cjk.length} 字 / ${sum(cjk)} 次,非汉字 ${nonCjk.length} 字 / ${sum(nonCjk)} 次`)
if (SCAN_ALL) line(`  按层:${[...layerTotals].map(([k, v]) => `${k} ${v}`).join(' · ')}`)
if (bmpPua) line(`  另:BMP 私用区(U+E000–F8FF)出现 ${bmpPua} 次——同样无字形,不在本脚本修复范围`)
line()

// 按分区
line('── 按分区 ──')
const byBlock = new Map()
for (const [, e] of all) {
  const b = byBlock.get(e.block) || { distinct: 0, count: 0 }
  b.distinct++
  b.count += e.count
  byBlock.set(e.block, b)
}
const blockOrder = [...BLOCKS.map((b) => b[0]), '其他表意文字(SIP/TIP)', '私用区(补充)', '非汉字(SMP:符号/表情等)']
for (const name of blockOrder) {
  const b = byBlock.get(name)
  if (b) line(`  ${pad(name, 20)} ${pad(b.distinct + ' 字', 8)} ${b.count} 次`)
}
line()

// 按书
line('── 按书(扩展区字)──')
const byBook = new Map()
for (const [ch, e] of cjk) {
  for (const [book, n] of e.books) {
    const b = byBook.get(book) || { distinct: new Set(), count: 0 }
    b.distinct.add(ch)
    b.count += n
    byBook.set(book, b)
  }
}
for (const [book, b] of [...byBook].sort((x, y) => y[1].count - x[1].count)) {
  line(`  ${pad(book, 30)} ${pad(b.distinct.size + ' 字', 8)} ${pad(b.count + ' 次', 8)} ${[...b.distinct].slice(0, 16).join('')}${b.distinct.size > 16 ? '…' : ''}`)
}
line()

// 字表
line(`── 字表(扩展区,按次数;${LIST ? '全部' : `前 ${Math.min(TOP, cjk.length)} / ${cjk.length}`})──`)
for (const [ch, e] of cjk.slice(0, TOP)) {
  const books = [...e.books].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b}×${n}`).join(' ')
  line(`  ${ch} ${pad(hex(e.cp), 8)} ${pad(e.block.replace('CJK ', ''), 8)} ${pad(e.count, 4)} ${books}`)
  if (LIST) for (const loc of e.locs) line(`        · ${loc}`)
}
if (!LIST && cjk.length > TOP) line(`  …(--list 看全部与逐条出处)`)
if (nonCjk.length) {
  line()
  line('── 非汉字辅助平面字符 ──')
  for (const [ch, e] of nonCjk) line(`  ${ch} ${pad(hex(e.cp), 8)} ${pad(e.count, 4)} ${[...e.books.keys()].join(' ')}`)
}
line()

// 字体覆盖
line('── 字体覆盖核对 ──')
if (!Object.keys(fontsource).length) {
  line('  未找到 @fontsource/noto-serif-sc 的 CSS(node_modules 未装?)')
} else {
  for (const [w, ranges] of Object.entries(fontsource)) {
    const hit = cjk.filter(([, e]) => inRanges(ranges, e.cp))
    line(`  Noto Serif SC ${w}(@fontsource,${ranges.length} 段 unicode-range):覆盖扩展区 ${hit.length}/${cjk.length} 字${hit.length ? ':' + hit.map(([c]) => c).join('') : ''}`)
  }
}
const extFaces = ownFaces.filter((f) => f.ranges.some(([, b]) => b > 0xffff))
if (!extFaces.length) line('  项目自有 @font-face:无声明辅助平面 unicode-range 的字面')
for (const f of extFaces) {
  const miss = cjk.filter(([, e]) => !inRanges(f.ranges, e.cp))
  line(`  ${f.family}(${f.file}):unicode-range 覆盖 ${cjk.length - miss.length}/${cjk.length}${miss.length ? ',缺 ' + miss.map(([c]) => c).join('') : ''}`)
}
// 多个 --font 按给出的顺序当字体栈看:每个字体自身覆盖几字、比前面的新接住几字、累计几字
const stackHit = new Set()
for (const f of extraFonts) {
  if (f.error) {
    line(`  ${f.spec}:读取失败(${f.error})`)
    continue
  }
  const own = cjk.filter(([, e]) => f.set.has(e.cp))
  const fresh = own.filter(([c]) => !stackHit.has(c))
  fresh.forEach(([c]) => stackHit.add(c))
  line(`  ${f.name}(${f.spec}):cmap 覆盖 ${own.length}/${cjk.length},新接住 +${fresh.length},累计 ${stackHit.size}/${cjk.length}${fresh.length && fresh.length <= 80 ? ' ' + fresh.map(([c]) => c).join('') : ''}`)
}
if (extraFonts.length > 1) {
  const left = cjk.filter(([c]) => !stackHit.has(c))
  line(`  → 以上字体合计仍缺 ${left.length} 字${left.length && left.length <= 80 ? ':' + left.map(([c]) => c).join('') : ''}`)
}

// ── 可选落盘 ──
const charsOut = opt('chars-out')
if (charsOut) {
  writeFileSync(charsOut, cjk.map(([c]) => c).join('') + '\n')
  line(`\n已写扩展区字表 → ${charsOut}(${cjk.length} 字)`)
}
const jsonOut = opt('json')
if (jsonOut) {
  const out = all.map(([ch, e]) => ({
    char: ch,
    cp: hex(e.cp),
    block: e.block,
    count: e.count,
    layers: Object.fromEntries(e.layers),
    books: Object.fromEntries(e.books),
    locs: e.locs,
  }))
  writeFileSync(jsonOut, JSON.stringify(out, null, 1) + '\n')
  line(`已写完整结果 → ${jsonOut}`)
}
