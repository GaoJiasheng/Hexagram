// 《古文观止》篇目元数据:从维基文库目录页(古文觀止)推导「卷 → 篇 → 出处/作者」,
// 写 src/data/guwen/guwenguanzhi-meta.json,供 SingleBookHome 分卷列目录、阅读页题下小字(左传 · 隐公元年 / 韩愈)。
// ⚠️ 篇目不手打:重跑即可复现;底本目录页若变动,这份 JSON 的 diff 会把变化显出来。
// 目录页格式(每行):#左傳　　[[古文觀止/卷1#鄭伯克段于鄢|鄭伯克段于鄢]]   —— 「#出处/作者<全角空格>[[页#锚|显示名]]」
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json')
const { fetchPages } = createFetcher(CACHE_FILE)
const OUT = path.join(ROOT, 'src/data/guwen/guwenguanzhi-meta.json')

const pages = await fetchPages(['古文觀止'])
const wt = pages['古文觀止']
if (!wt) throw new Error('目录页取不到')

const volumes = []   // [{ no, title, from, to }]
const pieces = []    // [{ no, title, source, vol }]
let vol = null
for (const raw of wt.split('\n')) {
  const line = raw.trim()
  const h = line.match(/^==\s*\[\[\/卷(\d+)\|([^\]]+)\]\]\s*==$/)
  if (h) {
    // 「卷一　周文」→ title「卷一 · 周文」
    const [zh, era] = t2s(h[2]).split(/[\s　]+/)
    vol = { no: Number(h[1]), title: era ? `${zh} · ${era}` : zh, from: pieces.length + 1, to: pieces.length }
    volumes.push(vol)
    continue
  }
  const m = line.match(/^#\s*([^\[]*?)[\s　]*\[\[古文觀止\/卷(\d+)#([^|\]]+)\|([^\]]+)\]\]\s*$/)
  if (!m || !vol) continue
  const source = t2s(m[1].trim())
  const title = t2s(m[4].trim())
  pieces.push({ no: pieces.length + 1, title, source, vol: vol.no })
  vol.to = pieces.length
}
if (!volumes.length || !pieces.length) throw new Error('目录页解析为空')

// 与抓取产物逐篇核对:篇题必须一一对应(卷内次序即抓取次序),对不上就别写——两边一致才能按 no 索引。
const classics = path.join(ROOT, 'src/data/guwen/classics/guwenguanzhi.json')
if (fs.existsSync(classics)) {
  const chs = JSON.parse(fs.readFileSync(classics, 'utf8')).chapters
  const bad = []
  for (const p of pieces) {
    const c = chs[p.no - 1]
    // 目录页显示名偶与页内篇题差一个作者前缀(目录「谏逐客书」/ 正文「李斯谏逐客书」),以**正文篇题**为准、目录名须是其后缀
    if (!c || !(c.title === p.title || c.title.endsWith(p.title))) bad.push(`#${p.no} 目录「${p.title}」 vs 正文「${c?.title ?? '(无)'}」`)
    else if (c.title !== p.title) { console.log(`#${p.no} 目录「${p.title}」→ 取正文篇题「${c.title}」`); p.title = c.title }
  }
  if (bad.length) { console.error('目录与正文篇题不对应:\n' + bad.join('\n')); process.exit(1) }
  console.log(`已与正文逐篇核对:${pieces.length} 篇一致`)
}

fs.writeFileSync(OUT, JSON.stringify({ volumes, pieces }, null, 1) + '\n')
const bySource = {}
for (const p of pieces) bySource[p.source] = (bySource[p.source] || 0) + 1
console.log(`写出 ${OUT}: ${volumes.length} 卷 ${pieces.length} 篇`)
console.log('出处分布:', Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '))
