// 观数白话复核「存疑未改」项的跨章核备料(续跑 ⑤ 第二条,owner 10-01 定做)。
// 第一轮每章一个代理只拿本章原文,231 处引他章 / 他书的说法核不了;这一轮给代理整套原文的**分章文本目录**
//(scripts/.mingli-review/text/<slug>/<章号>.txt + INDEX.txt),按需 Read 任何一章,逐条判:成立 / 要改 / 仍存疑。
// 输入 = 该章现行白话(svg 占位)+ 存疑条目;输出与第一轮同形(改了就写 out2/<slug>-<key>.json + verdict:'fixed'),
// 合并仍走 mingli-review-apply.mjs(它读 units.json,这里覆写成本轮的单元)。
//   node scripts/mingli-doubt-prep.mjs <doubts.json>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripSvg } from './mingli-review-prep.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORK = path.join(ROOT, 'scripts/.mingli-review')
const IN = path.join(WORK, 'in2'), OUT = path.join(WORK, 'out2'), TEXT = path.join(WORK, 'text')

const [, , doubtsFile] = process.argv
if (!doubtsFile) { console.log('用法: node scripts/mingli-doubt-prep.mjs <doubts.json>'); process.exit(2) }
fs.mkdirSync(IN, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
const doubts = JSON.parse(fs.readFileSync(doubtsFile, 'utf8'))
const texts = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/texts.json'), 'utf8'))
const bookList = texts.map((t) => `${t.slug}\t${t.title}`).join('\n')
const baihua = {}
const bh = (slug) => baihua[slug] ||= JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/mingli/baihua/${slug}.json`), 'utf8'))

const units = []
for (const [sk, list] of Object.entries(doubts)) {
  const [slug, key] = sk.split(':')
  const ch = bh(slug)?.[key]
  if (!ch) { console.error(`✗ ${sk} 无白话`); continue }
  const meta = texts.find((t) => t.slug === slug) || {}
  const input = {
    corpus: 'mingli', slug, key, book: meta.title || slug,
    textDir: path.join(TEXT, slug), textIndex: path.join(TEXT, slug, 'INDEX.txt'), books: bookList, textRoot: TEXT,
    doubts: list,
    baihua: stripSvg(ch),
  }
  const inFile = path.join(IN, `${slug}-${key}.json`)
  fs.writeFileSync(inFile, JSON.stringify(input, null, 1))
  units.push({ slug, key, label: `${meta.title || slug}·${key}`, inFile, outFile: path.join(OUT, `${slug}-${key}.json`), n: list.length })
}
fs.writeFileSync(path.join(WORK, 'units.json'), JSON.stringify(units))
console.log(`存疑跨章核备料 ${units.length} 章 · ${units.reduce((n, u) => n + u.n, 0)} 条 → ${IN}`)
