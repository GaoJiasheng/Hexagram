// 白话模块按需加载。
// 构建前由 scripts/build-content-assets.mjs 将 src/data/*/baihua/*.json 拆成:
//   public/content/baihua/<corpus>/<slug>/<chapter>.json
// 前端只先取轻量 manifest,实际文章在打开抽屉/整页时再 fetch,避免把全站白话打进 JS chunk。

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

let manifestPromise = null
const articleCache = new Map()

export async function loadBaihuaManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(urlFor('/content/manifest.json'))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  return manifestPromise
}

export async function getBaihuaMeta(corpus, slug, chapter) {
  const manifest = await loadBaihuaManifest()
  return manifest?.baihua?.[corpus]?.[slug]?.chapters?.[String(chapter)] || null
}

export async function loadBaihua(corpus, slug, chapter) {
  const key = `${corpus}:${slug}:${chapter}`
  if (articleCache.has(key)) return articleCache.get(key)
  const meta = await getBaihuaMeta(corpus, slug, chapter)
  if (!meta?.path) {
    articleCache.set(key, null)
    return null
  }
  const promise = fetch(urlFor(meta.path))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  articleCache.set(key, promise)
  const data = await promise
  articleCache.set(key, data)
  return data
}

export async function hasBaihua(corpus, slug, chapter) {
  return !!(await getBaihuaMeta(corpus, slug, chapter))
}
