// 装配「白话」workflow 产出(design-v22 A4)。
// 用法: node scripts/assemble-baihua.mjs <result.json>
//   result.json = workflow 返回的数组 [{corpus, book, no, featured, data:{title,subtitle,centralIdea,blocks,hero?}}…]
//   按 corpus/book 合并写入 src/data/<corpus>/baihua/<slug>.json(保留其它章),并自校引文逐字命中原文、报坏 cite。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const resultPath = process.argv[2]
if (!resultPath) { console.error('用法: node scripts/assemble-baihua.mjs <result.json>'); process.exit(1) }
const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'))
const units = (Array.isArray(result) ? result : result.result || []).filter((u) => u && u.data)

const chCache = {}
const chapterText = (corpus, slug, no) => {
  const k = `${corpus}/${slug}`
  if (!(k in chCache)) {
    const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
    chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
  }
  const c = chCache[k]?.chapters.find((x) => x.no === Number(no))
  return c ? c.paragraphs.map((p) => p.original).join('') : null
}

// 按 corpus/book 分组
const byBook = {}
for (const u of units) {
  const key = `${u.corpus}/${u.book}`
  ;(byBook[key] ||= []).push(u)
}

let nCh = 0, nFig = 0, nBadCite = 0
for (const [key, list] of Object.entries(byBook)) {
  const [corpus, slug] = key.split('/')
  const outFile = path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`)
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {}

  for (const u of list) {
    const d = u.data
    const text = chapterText(corpus, slug, u.no)
    const blocks = Array.isArray(d.blocks) ? d.blocks : []
    // 自校:每个 quote.original 须为原文子串(报坏,不丢弃 —— 留待 check-data 硬卡)
    for (const b of blocks) {
      if (b.type === 'figure') nFig++
      if (b.type === 'quote' && b.original && text && !text.includes(b.original)) {
        nBadCite++
        console.warn(`  ⚠ 坏引文 ${corpus}/${slug}#${u.no}: 「${b.original.slice(0, 16)}…」非原文子串`)
      }
    }
    const article = { title: d.title, subtitle: d.subtitle, centralIdea: d.centralIdea, blocks }
    if (u.featured || d.featured) {
      article.featured = true
      if (d.hero) article.hero = d.hero
    }
    existing[String(u.no)] = article
    nCh++
  }

  // 章号数值序写出
  const ordered = {}
  for (const k of Object.keys(existing).sort((a, b) => Number(a) - Number(b))) ordered[k] = existing[k]
  fs.writeFileSync(outFile, JSON.stringify(ordered, null, 2) + '\n')
  console.log(`写 ${outFile}  (${list.length} 章)`)
}

console.log(`\n装配完成:${nCh} 章 · ${nFig} 图 · ${nBadCite} 坏引文。`)
if (nBadCite) console.log('⚠ 有坏引文,跑 npm run check-data 会硬卡,需修后再 commit。')
