// 详注层(docs/xiangzhu-spec.md §5)的运行时装载与合并。
// 构建期 scripts/build-content-assets.mjs 把真源 src/data/<corpus>/xiangzhu/<slug>.json 按章拆成
//   public/content/xiangzhu/<corpus>/<slug>/<章号>.json   = { "<段下标>": [ {k,d,x,r?} ] }
//   (易经卦:yijing/hexagrams/<卦序>.json = { "<部位键>": [...] })
//   public/content/xiangzhu/index.json                     = { "<corpus>/<slug>": [章号…] }
// 真源几 MB 且还在长,**不进 bundle**:先取一次 index,打开一章才取这一章的分片,内存缓存。
// 一律软失败——网络错、404、SPA 回退成 HTML(JSON 解析失败)都当「没有详注」,绝不挡页面。
// /content/ 在 PWA 里是 StaleWhileRevalidate(vite.config.js),与白话分片同一套。
import { useEffect, useState } from 'react'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

const getJson = (p) =>
  fetch(urlFor(p)).then((r) => (r.ok ? r.json() : null)).catch(() => null)

let indexPromise = null
let indexSets = null              // 解析后的 index:`${corpus}/${slug}` → Set<章号字符串>
const shardPromises = new Map()   // `${corpus}/${slug}/${ch}` → Promise<shard | null>
const shardData = new Map()       // 同键 → 已到手的分片(或 null),供同步读,回访一章不闪

function loadIndex() {
  if (!indexPromise) {
    indexPromise = getJson('/content/xiangzhu/index.json').then((idx) => {
      indexSets = {}
      if (idx && typeof idx === 'object') {
        for (const [k, nos] of Object.entries(idx)) {
          if (Array.isArray(nos)) indexSets[k] = new Set(nos.map(String))
        }
      }
      return indexSets
    })
  }
  return indexPromise
}

/** 这一章有没有详注(先取 index)。 */
export async function hasXiangzhu(corpus, slug, ch) {
  const sets = await loadIndex()
  return !!sets[`${corpus}/${slug}`]?.has(String(ch))
}

/** 同步读已到手的分片;没取过返回 undefined,取过但没有返回 null。 */
export function peekXiangzhu(corpus, slug, ch) {
  return shardData.get(`${corpus}/${slug}/${ch}`)
}

/** 取这一章的详注分片;没有 / 出错一律 null。 */
export function loadXiangzhu(corpus, slug, ch) {
  const key = `${corpus}/${slug}/${ch}`
  if (!shardPromises.has(key)) {
    shardPromises.set(key, hasXiangzhu(corpus, slug, ch).then((yes) =>
      (yes ? getJson(`/content/xiangzhu/${corpus}/${slug}/${ch}.json`) : null),
    ).then((d) => {
      const shard = d && typeof d === 'object' && !Array.isArray(d) ? d : null
      shardData.set(key, shard)
      return shard
    }))
  }
  return shardPromises.get(key)
}

/** React 钩子:取一组章的详注。返回 { [章号]: 分片 }(无详注的章不出现)。
 *  已取过的章同步给出(初始 state 即带上),新章到手再补,页面先用简注照常渲染、到了原地升级。 */
export function useXiangzhu(corpus, slug, chapterNos) {
  const nosKey = (chapterNos || []).join(',')
  const read = () => {
    const out = {}
    if (!corpus || !slug) return out
    for (const no of chapterNos || []) {
      const d = peekXiangzhu(corpus, slug, no)
      if (d) out[no] = d
    }
    return out
  }
  const [state, setState] = useState(() => ({ key: `${corpus}/${slug}`, map: read() }))
  useEffect(() => {
    if (!corpus || !slug || !nosKey) return
    let alive = true
    const bookKey = `${corpus}/${slug}`
    for (const no of nosKey.split(',')) {
      loadXiangzhu(corpus, slug, no).then((d) => {
        if (!alive || !d) return
        setState((s) => {
          const base = s.key === bookKey ? s.map : {}
          if (base[no] === d) return s
          return { key: bookKey, map: { ...base, [no]: d } }
        })
      })
    }
    return () => { alive = false }
  }, [corpus, slug, nosKey])
  // 换书时旧书的分片不外泄(state 尚未被新书的 effect 覆盖的那一帧)
  if (state.key !== `${corpus}/${slug}`) return read()
  return state.map
}

// ── 合并(与书桌 App 的 applyDeskNotes 同规则) ─────────────────────────
// 同一段里:详注优先;简注只在它的区间与任何一条详注都不重叠时保留。
// 区间 = 词在段内**第一次**出现的位置(详注);简注沿用它自己的 n(第 n 次出现),与 AnnotatedText 锚定模式一致。
// 桥(道藏 → 易经,entry.qiao):桥必须留下——与详注区间完全相同则把桥挂到详注上,否则保留简注桥、丢掉与之重叠的详注。

/** 详注条目 → AnnotatedText 的 entry 形状。 */
export function xzEntry(n) {
  return { term: n.k, note: n.d, more: n.x, ...(n.r ? { reading: n.r } : {}), xz: true }
}

/** 锚定条目定位:第 n 次出现。返回按起点排序、互不重叠的 [{start,end,entry}]。 */
export function placeAnchors(text, anchors) {
  const placed = []
  for (const a of anchors || []) {
    if (!a?.term) continue
    const n = a.n ?? 1
    let idx = -1
    let from = 0
    for (let k = 0; k < n; k++) {
      idx = text.indexOf(a.term, from)
      if (idx === -1) break
      from = idx + 1
    }
    if (idx === -1) continue
    placed.push({ start: idx, end: idx + a.term.length, entry: a })
  }
  return dropOverlaps(placed)
}

function dropOverlaps(spans) {
  spans.sort((x, y) => x.start - y.start)
  const out = []
  let pos = 0
  for (const s of spans) {
    if (s.start < pos) continue
    out.push(s)
    pos = s.end
  }
  return out
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end

/** base:简注已定位的区间(锚定或词典模式);notes:该处的详注原始条目 [{k,d,x,r?}]。 */
export function mergeSpans(text, base, notes) {
  if (!notes?.length) return base
  const detail = []
  for (const n of notes) {
    if (!n?.k) continue
    const idx = text.indexOf(n.k)
    if (idx === -1) continue   // 分片与原文对不上(数据在写的半途)→ 这条不挂
    detail.push({ start: idx, end: idx + n.k.length, entry: xzEntry(n) })
  }
  if (!detail.length) return base
  const bridges = base.filter((s) => s.entry?.qiao)
  const keptDetail = []
  for (const d of detail) {
    const same = bridges.find((b) => b.start === d.start && b.end === d.end)
    if (same) { keptDetail.push({ ...d, entry: { ...d.entry, qiao: same.entry.qiao } }); continue }
    if (bridges.some((b) => overlaps(b, d))) continue
    keptDetail.push(d)
  }
  const keptBase = base.filter((s) => {
    if (s.entry?.qiao) return !keptDetail.some((d) => d.entry.qiao === s.entry.qiao && d.start === s.start)
    return !keptDetail.some((d) => overlaps(s, d))
  })
  return dropOverlaps([...keptDetail, ...keptBase])
}
