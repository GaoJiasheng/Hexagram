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

// 标点规范化(全角→半角,1:1 等长)——工具链常把 agent 输出的全角逗号/分号/问号静默转半角,
// 致引文与全角原文不匹配。snap:按规范化匹配定位,再从真原文按下标切出 → 引文回吸为原文精确子串。
const W2H = { '，': ',', '。': '.', '；': ';', '：': ':', '？': '?', '！': '!', '（': '(', '）': ')', '、': ',', '「': '"', '」': '"', '『': '"', '』': '"' }
const norm = (s) => s.replace(/[，。；：？！（）、「」『』]/g, (c) => W2H[c] || c)
const isCJK = (c) => c >= '一' && c <= '鿿'
function snapQuote(q, text) {
  if (!q || !text || text.includes(q)) return q
  // ① 全角→半角标点规范化后定位,按真原文下标切出
  const idx = norm(text).indexOf(norm(q))
  if (idx >= 0) return text.slice(idx, idx + q.length)
  // ② 仅按汉字匹配(忽略标点/空白差异),命中后取原文对应字符区间 —— 救「标点不同/个别符号增删」的引文
  const map = []; let stripped = ''
  for (let i = 0; i < text.length; i++) { if (isCJK(text[i])) { stripped += text[i]; map.push(i) } }
  const qC = [...q].filter(isCJK).join('')
  if (qC.length >= 4) {                          // ≥4 字才用,避免短串误命中
    const s = stripped.indexOf(qC)
    if (s >= 0) return text.slice(map[s], map[s + qC.length - 1] + 1)  // 含区间内原文标点
  }
  return q
}

// 一卦全经传原文(卦辞+彖+大象+爻辞+小象+用九六+文言+序卦杂卦)——易经引文子串校验池
function hexAllOriginal(q) {
  const parts = [q.judgment?.original, q.tuan?.original, q.daxiang?.original]
  for (const l of q.lines || []) { parts.push(l.original, l.xiaoxiang?.original) }
  if (q.extra?.use) { parts.push(q.extra.use.original, q.extra.use.xiaoxiang?.original) }
  for (const w of q.extra?.wenyan || []) parts.push(w.original)
  parts.push(q.xugua, q.zagua)
  return parts.filter(Boolean).join('')
}

const chCache = {}
const chapterText = (corpus, slug, no) => {
  const k = `${corpus}/${slug}`
  if (corpus === 'yijing' && slug === 'hexagrams') {   // 64 卦(经传 slug 落下方 corpus 分支,路径 src/data/yijing/classics/<slug>.json 通用)
    if (!(k in chCache)) {
      const f = path.join(ROOT, 'src/data/yijing/hexagrams.json')
      chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
    }
    const q = chCache[k]?.find((x) => x.id === Number(no))
    return q ? hexAllOriginal(q) : null
  }
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
    // 自校:逐 quote 回吸为原文子串;**只剔除仍对不上的坏引文块、保留整章其余**
    // (根治个别坏引文致整卦反复重生乃至永久缺口;剩 ≥1 有效引文就落盘,带一处小缺远胜整卦没白话)
    const cleanBlocks = []
    let figHere = 0, dropped = 0
    for (const b of blocks) {
      if (b.type === 'quote' && b.original && text) {
        const snapped = snapQuote(b.original, text)
        if (!text.includes(snapped)) { dropped++; continue }   // 坏引文块:不带进正文
        b.original = snapped
      }
      if (b.type === 'figure') figHere++
      cleanBlocks.push(b)
    }
    const goodQuotes = cleanBlocks.filter((b) => b.type === 'quote' && b.original).length
    // 仅当全章 0 有效引文(check-data 要求 ≥1)才整章丢弃→重生;否则保留
    if (goodQuotes < 1) {
      delete existing[String(u.no)]
      console.warn(`  ⚠ 丢弃 ${corpus}/${slug}#${u.no}:无有效引文,待重生`)
      continue
    }
    if (dropped > 0) { nBadCite += dropped; console.warn(`  ℹ ${corpus}/${slug}#${u.no}:剔除 ${dropped} 处坏引文块(保留其余 ${goodQuotes} 引文)`) }
    nFig += figHere
    const article = { title: d.title, subtitle: d.subtitle, centralIdea: d.centralIdea, blocks: cleanBlocks }
    // featured/hero 仅认单元(书首章)标记 —— agent 常给非首章误加 hero,一律以 u.featured 为准
    if (u.featured) {
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

console.log(`\n装配完成:写入 ${nCh} 章 · ${nFig} 图。坏引文丢弃 ${nBadCite} 处(对应章未写,gen 重跑会自动补)。`)
