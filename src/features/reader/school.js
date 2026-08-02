// 家级导读(一家之来路)按需加载 —— 与白话/书级导读同一套分片机制。
// 构建期由 scripts/build-content-assets.mjs 把 src/data/<corpus>/school.json 输出到
// public/content/school/<corpus>.json,manifest 只存标题,点开才 fetch 全文。
//
// 三层分工,别写串了:
//   白话   —— 逐章:「这一章说了什么」
//   书级   —— 一书一篇:「这本书的前世今生」(其人/其时/其书/其传)
//   家级   —— 一组一篇:「这些书之间、这些人之间」(谁接谁/在哪一步转了向/哪一支断了)
import { loadBaihuaManifest } from './baihua.js'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`
const cache = new Map()

export async function getSchoolMeta(corpus) {
  const m = await loadBaihuaManifest()
  return m?.school?.[corpus] || null
}

export async function loadSchool(corpus) {
  const meta = await getSchoolMeta(corpus)
  if (!meta) return null
  if (!cache.has(meta.path)) {
    cache.set(meta.path, fetch(urlFor(meta.path)).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return cache.get(meta.path)
}
