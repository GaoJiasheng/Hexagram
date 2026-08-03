// 观书正文的按需加载。
//
// **为什么必须是懒加载**:原先三处 `import.meta.glob(..., { eager: true })` 把 140 本书的
// 脑图/总览/章文章全部同步打进同一个 chunk —— 一路长到 **29.7 MiB**,
// 超过 Cloudflare Pages 单文件 25 MiB 上限,**部署直接被拒**。
// (白话当初踩过同一个坑,那次改成了运行时分片 fetch;观书漏做,到 140 本才顶爆。)
//
// 这里改用 glob 的默认惰性形态:每个 JSON 各自成为一个动态 chunk,
// 打开哪本书才拉哪本。首屏只剩书目索引(index.json,几十 KB)。
//
// 加书**不需要改这个文件** —— glob 自动收录。

const MAPS = import.meta.glob('../../data/books/*/mindmap.json')
const OVERVIEWS = import.meta.glob('../../data/books/*/overview.json')
const ARTICLES = import.meta.glob('../../data/books/*/articles/*.json')

const cache = new Map()

function load(loaders, key, matcher) {
  if (cache.has(key)) return cache.get(key)
  const hit = Object.entries(loaders).find(([p]) => matcher(p))
  const promise = hit
    ? hit[1]().then((m) => m.default || m).catch(() => null)
    : Promise.resolve(null)
  cache.set(key, promise)
  return promise
}

export function loadMindmap(slug) {
  return load(MAPS, `m:${slug}`, (p) => p.includes(`/${slug}/`))
}

export function loadOverview(slug) {
  return load(OVERVIEWS, `o:${slug}`, (p) => p.includes(`/${slug}/`))
}

export function loadArticle(slug, chapter) {
  return load(ARTICLES, `a:${slug}:${chapter}`, (p) => (
    p.includes(`/${slug}/`) && p.endsWith(`/${chapter}.json`)
  ))
}
