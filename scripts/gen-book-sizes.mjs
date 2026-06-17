// 统计各 corpus + 道藏每部书的原文字数 → src/data/bookSizes.json(#148 篇幅档数据源)。
// 加书后重跑:node scripts/gen-book-sizes.mjs。纯统计、不改原文。
import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORPORA = ['fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'dao']
const sizes = {}

for (const corpus of CORPORA) {
  const dir = join(root, 'src/data', corpus, 'classics')
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const book = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    let chars = 0
    for (const c of book.chapters || []) for (const p of c.paragraphs || []) chars += (p.original || '').length
    sizes[f.replace(/\.json$/, '')] = chars
  }
}

writeFileSync(join(root, 'src/data/bookSizes.json'), JSON.stringify(sizes) + '\n')
console.log(`bookSizes.json: ${Object.keys(sizes).length} 部书`)
