// 白话模块数据加载（design-v22）——每章一篇公众号式白话长文 + 内联 SVG 图。
// 数据在 src/data/<corpus>/baihua/<slug>.json：{ 章号: { title, subtitle, centralIdea, blocks:[...] } }
// blocks 块类型：lead / h2 / p / quote{original,translation} / figure{svg,caption,ftype} / refs{items}
const modules = import.meta.glob('../../data/*/baihua/*.json', { eager: true })

const TABLE = {}
for (const path in modules) {
  const m = path.match(/data\/([^/]+)\/baihua\/([^/]+)\.json$/)
  if (m) TABLE[`${m[1]}:${m[2]}`] = modules[path].default || modules[path]
}

export function getBaihua(corpus, slug, chapter) {
  const book = TABLE[`${corpus}:${slug}`]
  if (!book) return null
  return book[String(chapter)] || null
}

export function hasBaihua(corpus, slug, chapter) {
  return !!getBaihua(corpus, slug, chapter)
}
