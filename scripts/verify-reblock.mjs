#!/usr/bin/env node
// 重新分块的护栏:比对改前/改后的「纯文字」,确保只动了结构、一个字没改写。
//
// 用法: node scripts/verify-reblock.mjs <corpus> <slug> <改后文件.json>
//   例: node scripts/verify-reblock.mjs dao daodejing /tmp/daodejing.reblocked.json
//
// 判定:把一章所有块的可见文字按序拼成一个字符串,做「归一化」后逐字比对。
// 归一化只抹掉合法的结构性差异——枚举/次第记号(一、/第一，/①/第二步，)、项目符号、
// Markdown 加粗标记、空白。除此之外任何字符出入都算改写,当场报错。
import fs from 'node:fs'
import path from 'node:path'

const [corpus, slug, newFile, oldOverride] = process.argv.slice(2)
if (!corpus || !slug || !newFile) {
  console.error('用法: node scripts/verify-reblock.mjs <corpus> <slug> <改后文件.json> [改前文件.json]')
  console.error('  注:若改后文件已覆盖回原位,必须显式传「改前文件」(如 git show HEAD:… > /tmp/before.json),')
  console.error('     否则默认的改前路径就是改后文件本身,校验会空转。')
  process.exit(2)
}
const oldFile = oldOverride || (corpus === 'books' ? path.join('src/data/books', slug) : path.join('src/data', corpus, 'baihua', `${slug}.json`))
if (path.resolve(oldFile) === path.resolve(newFile)) {
  console.error('✗ 改前与改后是同一个文件,校验将空转——请显式传入改前文件。')
  process.exit(2)
}
// 观书是「一书一目录、一篇一文件」,白话是「一文件内含 {章号: 章}」——两种都读成同一张表
function readMap(p) {
  if (!fs.statSync(p).isDirectory()) return JSON.parse(fs.readFileSync(p, 'utf8'))
  const out = {}
  const add = (f) => { if (fs.existsSync(f)) out[path.relative(p, f)] = JSON.parse(fs.readFileSync(f, 'utf8')) }
  add(path.join(p, 'overview.json'))
  const ad = path.join(p, 'articles')
  if (fs.existsSync(ad)) for (const x of fs.readdirSync(ad).filter((y) => y.endsWith('.json')).sort()) add(path.join(ad, x))
  return out
}
const before = readMap(oldFile)
const after = readMap(newFile)

// 枚举/次第记号(「第一，」「其一，」「一、」「①」「第二步，」…)一律**全局对称**抹掉。
// 这是被两类情形逼出来的:
//   A 整段成列表:改前是以序号开头的 p、改后是已剥序号的 list 项。
//   B 块被切在序号处(金句正好从「第一,」起、次第除首步外的记号本在句中)。
// 只在某一侧、或只在行首剥,这两类里总有一类对不上(实测两类都中过)。全局对称则都成立。
// 代价:这些记号在任何位置被删都查不出来 —— 范围极窄,且它们本就是排版元件不是内容。
// 注意数字那一支必须**带标点**才算记号,否则散文里的数字会被吃掉。
const ENUM_MARK = /(?:[其第][一二三四五六七八九十百]+[，,、：:]|(?:第[一二三四五六七八九十]+步|最后一步)[，,、：:]|[一二三四五六七八九十百]+[、．]|[（(]?[0-9]+[）)、．]|[①②③④⑤⑥⑦⑧⑨⑩])/g
// 项目符号只对 list/steps 项剥(散文里的破折号不能动)
const BULLET_PREFIX = /^\s*[•·▪‣\-—]\s*/
const norm = (s) => String(s ?? '')
  .replace(/\*\*/g, '')          // 加粗标记不计
  .replace(ENUM_MARK, '')
  .replace(/\s+/g, '')           // 空白不计
  .replace(/[\u200b-\u200d]/g, '')

// 把一章摊平成有序的文字片段。
// 行首序号(「第一，」「其一，」「一、」…)的剥离**按侧区分**,这是两类情形挤出来的规则:
//   A 整段成列表:改前是以序号开头的 p、改后是已剥序号的 list 项 → 须在**改前侧**剥,才对得上。
//   B 块被切在序号处(如金句正好从「第一,」起):改前该序号在段中(不剥)、改后落在块首。
//     若改后侧也剥,就单侧消失、误报不一致。
// 故:改前侧一律剥;改后侧只对 list/steps 项剥(脚本也只在那里剥)。
// 代价:改前段首恰好是枚举词的删除查不出来 —— 范围极窄,可接受。
function pieces(ch) {
  const out = []
  const push = (s, isItem) => {
    const t = isItem ? String(s ?? '').replace(BULLET_PREFIX, '') : String(s ?? '')
    if (norm(t)) out.push(norm(t))
  }
  push(ch.title); push(ch.subtitle); push(ch.centralIdea)
  if (ch.hero) { push(ch.hero.badge); push(ch.hero.headline); push(ch.hero.tagline) }
  for (const b of ch.blocks || []) {
    switch (b.type) {
      case 'lead': case 'h2': case 'p': case 'pull': push(b.text); break
      case 'quote': push(b.original); push(b.translation); break
      case 'figure': push(b.caption); break            // svg 不比(结构无关)
      case 'refs': (b.items || []).forEach((t) => push(t)); break
      case 'list': (b.items || []).forEach((t) => push(t, true)); break
      // callout.label 是排版元件不是内容,owner 允许新写短签 → 不计入文字比对。
      // 但限长 12 字,免得有人把正文塞进 label 里蒙混过关(见下方 labelIssues)。
      case 'callout': (b.items || []).forEach((t) => push(t)); break
      case 'steps': (b.items || []).forEach((s) => { push(s.title, true); push(s.badge); push(s.text, true) }); break
      default: break
    }
  }
  return out
}

// label 只许是短签,不许承载正文
const labelIssues = []
for (const [k, ch] of Object.entries(after)) {
  for (const b of ch.blocks || []) {
    if (b.type === 'callout' && b.label && [...b.label].length > 12) {
      labelIssues.push(`ch${k}: callout.label 过长(${[...b.label].length} 字)「${b.label}」`)
    }
  }
}

let fail = 0, ok = 0, changed = 0
const chapters = Object.keys(before)
for (const k of chapters) {
  if (!after[k]) { console.error(`✗ ch${k}: 改后缺失该章`); fail++; continue }
  const a = pieces(before[k]).join('')
  const b = pieces(after[k]).join('')
  if (a === b) {
    ok++
    const t0 = JSON.stringify(before[k].blocks?.map((x) => x.type))
    const t1 = JSON.stringify(after[k].blocks?.map((x) => x.type))
    if (t0 !== t1) changed++
  } else {
    fail++
    // 定位首个差异,便于人工核对
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
    console.error(`✗ ch${k}: 文字不一致 @${i}`)
    console.error(`   改前 …${a.slice(Math.max(0, i - 24), i + 26)}…`)
    console.error(`   改后 …${b.slice(Math.max(0, i - 24), i + 26)}…`)
  }
}
// 改后不许凭空多出章节
for (const k of Object.keys(after)) if (!before[k]) { console.error(`✗ ch${k}: 改后多出该章`); fail++ }

for (const m of labelIssues) console.error(`✗ ${m}`)
console.log(`\n章数 ${chapters.length} · 文字一致 ${ok} · 结构有变化 ${changed} · 失败 ${fail} · label 超长 ${labelIssues.length}`)
process.exit(fail || labelIssues.length ? 1 : 0)
