// 书级导读(前世今生)按需加载 —— 与白话同一套分片机制。
// 构建期由 scripts/build-content-assets.mjs 把 src/data/*/daodu/*.json 输出到
// public/content/daodu/<corpus>/<slug>.json,manifest 只存标题,点开才 fetch 全文。
// 与白话的分工:白话讲「这一章说了什么」(逐章),导读讲「这本书的前世今生」(一书一篇)。
import { loadBaihuaManifest } from './baihua.js'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`
const cache = new Map()

export async function getDaoduMeta(corpus, slug) {
  const m = await loadBaihuaManifest()
  return m?.daodu?.[corpus]?.[slug] || null
}

/** 一书多 slug 的情形(《庄子》拆内/外/杂三部、《黄帝内经》拆素问/灵枢),
 *  前世今生本是同一套,只写一篇、其余以 aliasOf 指过去,免得写三遍近乎一样的文章。 */
export function resolveAlias(meta) {
  return meta?.aliasOf || null
}

export async function loadDaodu(corpus, slug) {
  const meta = await getDaoduMeta(corpus, slug)
  if (!meta) return null
  if (!cache.has(meta.path)) {
    cache.set(meta.path, fetch(urlFor(meta.path)).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return cache.get(meta.path)
}
