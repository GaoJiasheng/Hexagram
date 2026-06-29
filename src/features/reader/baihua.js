// 白话模块按需加载。
// 构建前由 scripts/build-content-assets.mjs 将 src/data/*/baihua/*.json 输出为「按书一文件」:
//   public/content/baihua/<corpus>/<slug>.json = { 章号: article }
// 前端先取轻量 manifest（章级标题/featured/path），打开抽屉/整页时再 fetch 整本书并缓存:
// 同一本书各章共用一次请求（首开载全书，之后该书各章秒开），既不把全站白话打进 JS chunk，
// 又把文件数从「一章一文件」收回「一书一文件」，便于 CF 后台拖拽上传（≤1000 文件）。

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

let manifestPromise = null
const bookCache = new Map()   // path → Promise<{ 章号: article }>

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

function loadBook(path) {
  if (!bookCache.has(path)) {
    bookCache.set(
      path,
      fetch(urlFor(path)).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    )
  }
  return bookCache.get(path)
}

export async function loadBaihua(corpus, slug, chapter) {
  const meta = await getBaihuaMeta(corpus, slug, chapter)
  if (!meta?.path) return null
  const book = await loadBook(meta.path)
  return book?.[String(chapter)] || null
}

export async function hasBaihua(corpus, slug, chapter) {
  return !!(await getBaihuaMeta(corpus, slug, chapter))
}
