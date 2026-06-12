// 道藏数据装载(v6 §3):动态 import + 内存缓存,照 yijing/data.js 的 loadClassics 模式。
import texts from '../../data/dao/texts.json'

export const DAO_TEXTS = texts

const cache = {}

export async function loadDaoText(slug) {
  if (cache[slug]) return cache[slug]
  const mod = await import(`../../data/dao/classics/${slug}.json`)
  cache[slug] = mod.default
  return mod.default
}

export function getDaoMeta(slug) {
  return texts.find((t) => t.slug === slug) ?? null
}
