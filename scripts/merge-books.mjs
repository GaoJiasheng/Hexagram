// 把并发产出的书登记进 index.json。
//
// 为什么需要它:每本书都要往 `src/data/books/index.json` 追加一条,而那是**共享文件** ——
// 四个 agent 同时追加必然互相覆盖(踩过)。所以约定:agent 只写自己书目录下的
// `_entry.json`,index.json 由这个脚本统一合并。
//
// 顺带做落库前的体检,不合格的**不合并**:
//   · 章文章数必须等于 chapters.length(不齐 = 没写完,合并进去书架上会出现半本书)
//   · 引文 ≤100 字/条、≤16 条/篇(版权红线,SOP §1)
//   · slug 不得与已有书重复
//
// 用法:node scripts/merge-books.mjs            # 体检 + 合并全部待合并的
//       node scripts/merge-books.mjs --dry     # 只体检不写
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BOOKS = path.join(ROOT, 'src/data/books')
const INDEX = path.join(BOOKS, 'index.json')
const dry = process.argv.includes('--dry')

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const hanzi = (o) => (JSON.stringify(o).match(/[一-鿿]/g) || []).length
const quotesOf = (a) => (a.blocks || []).filter((b) => b.type === 'quote')
const figuresOf = (a) => (a.blocks || []).filter((b) => b.type === 'figure')

const index = readJson(INDEX)
const known = new Set(index.map((b) => b.slug))

const pending = fs.readdirSync(BOOKS)
  .filter((d) => fs.existsSync(path.join(BOOKS, d, '_entry.json')))
  .sort()

if (!pending.length) {
  console.log('没有待合并的书(找不到任何 _entry.json)')
  process.exit(0)
}

const ok = []
const bad = []

for (const slug of pending) {
  const dir = path.join(BOOKS, slug)
  const problems = []
  let entry
  try {
    entry = readJson(path.join(dir, '_entry.json'))
  } catch (error) {
    bad.push([slug, [`_entry.json 读不了:${error.message}`]])
    continue
  }

  if (entry.slug !== slug) problems.push(`_entry.json 的 slug「${entry.slug}」与目录名「${slug}」不一致`)
  // 已在 index.json 里却还留着 _entry.json:多半是合并后 agent 又写回了一份。
  // 直接删掉残留、跳过,不要报错也不要重复追加(踩过)。
  if (known.has(slug)) {
    fs.rmSync(path.join(dir, '_entry.json'))
    console.log(`· ${slug} 已在 index.json 中,清掉残留的 _entry.json`)
    continue
  }
  for (const k of ['title', 'author', 'oneLine', 'accent', 'chapters']) {
    if (!entry[k]) problems.push(`缺字段 ${k}`)
  }

  const ovFile = path.join(dir, 'overview.json')
  if (!fs.existsSync(ovFile)) problems.push('缺 overview.json')
  else {
    const ov = readJson(ovFile)
    const n = hanzi(ov)
    if (n < 6000) problems.push(`总览仅 ${n} 字(应 8000–10000)`)
    for (const q of quotesOf(ov)) {
      if ((q.original || '').length > 100) problems.push(`总览有引文超 100 字(${q.original.length})`)
    }
    if (quotesOf(ov).length > 16) problems.push(`总览引文 ${quotesOf(ov).length} 条,超 16`)
  }

  if (!fs.existsSync(path.join(dir, 'mindmap.json'))) problems.push('缺 mindmap.json')

  const artDir = path.join(dir, 'articles')
  const arts = fs.existsSync(artDir) ? fs.readdirSync(artDir).filter((f) => f.endsWith('.json')) : []
  const want = (entry.chapters || []).length
  if (arts.length !== want) problems.push(`章文章 ${arts.length} 篇 ≠ chapters ${want} 章(没写完就别合并)`)
  for (const f of arts) {
    const a = readJson(path.join(artDir, f))
    const qs = quotesOf(a)
    if (qs.length > 16) problems.push(`${f} 引文 ${qs.length} 条,超 16`)
    for (const q of qs) {
      if ((q.original || '').length > 100) problems.push(`${f} 有引文超 100 字(${q.original.length})`)
    }
  }

  const motif = entry.cover?.motif
  if (motif) {
    const inline = fs.readFileSync(path.join(ROOT, 'src/features/books/BookCover.jsx'), 'utf8')
      .includes(`motif === '${motif}'`)
    const external = fs.existsSync(path.join(ROOT, `src/features/books/motifs/${motif}.jsx`))
    if (!inline && !external) problems.push(`母题 ${motif} 既不在 BookCover 内联表、也没有 motifs/${motif}.jsx`)
  }

  const stat = `总览 ${fs.existsSync(ovFile) ? hanzi(readJson(ovFile)) : 0} 字 · ${arts.length} 章 · 图 ${
    fs.existsSync(ovFile) ? figuresOf(readJson(ovFile)).length : 0}`
  if (problems.length) bad.push([slug, problems, stat])
  else ok.push([slug, entry, stat])
}

for (const [slug, entry, stat] of ok) console.log(`✓ ${slug.padEnd(16)} ${entry.title}  ${stat}`)
for (const [slug, problems, stat] of bad) {
  console.log(`✗ ${slug.padEnd(16)} ${stat || ''}`)
  for (const p of problems) console.log(`    · ${p}`)
}

if (dry) { console.log('\n--dry:未写入'); process.exit(bad.length ? 1 : 0) }

if (ok.length) {
  for (const [, entry] of ok) index.push(entry)
  fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`)
  // _entry.json 合并后删掉,免得下次重复合并
  for (const [slug] of ok) fs.rmSync(path.join(BOOKS, slug, '_entry.json'))
  console.log(`\n已合并 ${ok.length} 本,index.json 现有 ${index.length} 本`)
}
if (bad.length) {
  console.log(`\n⚠ ${bad.length} 本未合并(见上),修好再跑一次`)
  process.exit(1)
}
