// 白话红线人读复核工具(A4,2026-09-30)。
//   node scripts/redline-review.mjs            列出当前所有命中章(key · sig · 命中词)
//   node scripts/redline-review.mjs --full k1,k2   打印这些章的全部命中与 120 字前后文(人读用)
//   node scripts/redline-review.mjs --draft out.json  把所有命中章写成 {key:{sig,words}} 草稿,人读后补 note 合入 scripts/lib/redline-reviewed.json
// 已登记且签名一致的章标 ✓;签名变了标 !(章文改过,需重看)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { redlineHits } from './lib/redline.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
const full = opt('--full'), draft = opt('--draft')
const rvPath = path.join(ROOT, 'scripts/lib/redline-reviewed.json')
const reviewed = fs.existsSync(rvPath) ? JSON.parse(fs.readFileSync(rvPath, 'utf8')) : {}
const want = full ? new Set(full.split(',')) : null
const out = {}
for (const corpus of fs.readdirSync(path.join(ROOT, 'src/data'))) {
  const dir = path.join(ROOT, 'src/data', corpus, 'baihua')
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const slug = f.replace(/\.json$/, '')
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    for (const [ch, a] of Object.entries(data)) {
      const key = `${corpus}/${slug}#${ch}`
      if (want && !want.has(key)) continue
      const { hits, sig } = redlineHits(corpus, a, full ? 120 : 18)
      if (!hits.length) continue
      out[key] = { sig, words: [...new Set(hits.map((h) => h.word))] }
      const st = reviewed[key] ? (reviewed[key].sig === sig ? '✓' : '!') : ' '
      if (full) { console.log(`\n## ${key}  sig=${sig}`); for (const h of hits) console.log(`  [${h.word}] …${h.ctx}…`) }
      else console.log(`${st} ${key}  ${sig}  ${out[key].words.join('/')}`)
    }
  }
}
if (draft) { fs.writeFileSync(draft, JSON.stringify(out, null, 2) + '\n'); console.log(`draft → ${draft}(${Object.keys(out).length} 章)`) }
