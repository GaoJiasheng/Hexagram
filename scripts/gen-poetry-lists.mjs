// 诗词曲三组的篇目枚举 —— 从维基文库推导,不手打、不凭记忆。
//
// **为什么要有这个脚本**:唐诗 320 首、宋词 282 首、元曲散曲 354 首,篇目量太大,
// 手写进 config 既易错又无法复核。这里把「篇目从哪来」固化成可重跑的推导:
//   唐诗 → 《唐詩三百首》目录页,按 ==五言古詩== 等 7 类分段取链接
//   宋词 → 《宋詞三百首》单页,按 =='''词牌·题'''（作者）== 切
//   元曲 → Portal:全元曲 的 ==散曲== 段,按 ===作者=== 分组取链接
//
// 产出 scripts/corpus/_poetry-lists.json,由三个 corpus config 读取。
// **重跑即可复现**;源页若变动,diff 会显示出来 —— 这是刻意的,底本变了必须被看见。
//
// 用法:node scripts/gen-poetry-lists.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'scripts/corpus/_poetry-lists.json')
const API = 'https://zh.wikisource.org/w/api.php'

async function raw(title) {
  const url = `${API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=${encodeURIComponent(title)}`
  const r = await fetch(url, { headers: { 'User-Agent': 'hexagram-poetry/1.0' } })
  const p = (await r.json()).query.pages[0]
  if (p.missing) throw new Error(`源页不存在:${title}`)
  return p.revisions[0].slots.main.content
}

// 页面链接里要跳过的命名空间,以及目录页里对「别的选本」的交叉引用
const NS_RE = /^(Author|Category|File|Image|Template|Portal|Help|w|s|wikt):/i
const CROSS_REF = new Set(['千家詩', '唐詩三百首', '宋詞三百首', '全唐詩', '全元曲'])

// ── 唐诗:目录页按类分段 ───────────────────────────────────────────
async function tangshi() {
  const src = await raw('唐詩三百首')
  const groups = []
  let cur = null
  for (const ln of src.split('\n')) {
    const h = ln.match(/^==\s*([^=]+?)\s*==$/)
    if (h) {
      const title = h[1].trim()
      // 「蘅塘退士原序」不是诗类,跳过(序本身不入正文)
      cur = /序$/.test(title) ? null : { title, pages: [] }
      if (cur) groups.push(cur)
      continue
    }
    if (!cur) continue
    for (const m of ln.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
      const page = m[1].trim()
      if (NS_RE.test(page) || CROSS_REF.has(page)) continue
      // 目录页上的显示名(如 琵琶行|琵琶行並序)是编者给的题,以页名为准、显示名留作备注
      cur.pages.push(m[2] && m[2].trim() !== page ? { page, title: m[2].trim() } : page)
    }
  }
  return groups.filter(g => g.pages.length)
}

// ── 宋词:单页,== '''词牌·题'''（作者) == ─────────────────────────
async function songci() {
  const src = await raw('宋詞三百首')
  const out = []
  // 括号有全角（）与半角 () 两种写法(第179首「青玉案 (辛弃疾)」用半角),两种都要认 ——
  // 只认全角会漏掉那一首,与管线的章数对不上(踩过)。
  const re = /^==\s*'''([^']+)'''\s*(?:[（(]\s*\[\[Author:([^\]|]+)(?:\|[^\]]*)?\]\]\s*[）)])?\s*==$/gm
  for (const m of src.matchAll(re)) out.push({ title: m[1].trim(), author: m[2] ? m[2].trim() : null })
  // 还有**链接式标题** ==[[青玉案 (辛棄疾)]]== —— 283 首里独此一条不带 ''' 粗体,
  // 只按上面那条正则会漏掉它,与管线章数差 1(踩过)。
  for (const m of src.matchAll(/^==\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*==$/gm)) {
    out.push({ title: m[1].trim(), author: null, linkForm: true })
  }
  return out
}

// ── 元曲:Portal:全元曲 的散曲段,按作者分组 ────────────────────────
async function yuanqu() {
  const src = await raw('Portal:全元曲')
  const i = src.indexOf('==散曲==')
  if (i < 0) throw new Error('Portal:全元曲 里找不到「散曲」段 —— 源页结构变了,先人工看一眼')
  // 散曲是最后一个一级段;若日后其后再加段,这里要收窄
  const seg = src.slice(i)
  const out = []
  let cur = null
  for (const ln of seg.split('\n')) {
    const h = ln.match(/^===\s*([^=]+?)\s*===$/)
    if (h) { cur = { author: h[1].trim(), pages: [] }; out.push(cur); continue }
    if (!cur) continue
    for (const m of ln.matchAll(/^\*\s*\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/gm)) {
      const page = m[1].trim()
      if (NS_RE.test(page)) continue
      cur.pages.push(page)
    }
  }
  return out.filter(a => a.pages.length)
}

const [ts, sc, yq] = await Promise.all([tangshi(), songci(), yuanqu()])

const data = {
  _note: '本文件由 scripts/gen-poetry-lists.mjs 从维基文库推导生成,请勿手改;改底本请改脚本后重跑。',
  _generated: 'run `node scripts/gen-poetry-lists.mjs` to regenerate',
  tangshi: { source: '唐詩三百首', editor: '蘅塘退士(孫洙)', year: 1763, groups: ts },
  songci: { source: '宋詞三百首', editor: '朱孝臧', year: 1924, poems: sc },
  yuanqu: { source: 'Portal:全元曲 · 散曲段', note: '维基文库整理的枚举,非传统选本', authors: yq },
}

fs.writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`)

const tn = ts.reduce((a, g) => a + g.pages.length, 0)
const yn = yq.reduce((a, x) => a + x.pages.length, 0)
console.log(`唐诗 ${ts.length} 类 · ${tn} 首`)
console.log(`宋词 ${sc.length} 首`)
console.log(`元曲 ${yq.length} 位作者 · ${yn} 首(全量池,实际收录见 yuanqu.config.mjs 的选目)`)
console.log(`→ ${path.relative(ROOT, OUT)}`)
