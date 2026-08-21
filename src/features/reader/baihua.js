// 白话模块按需加载。
// 构建前由 scripts/build-content-assets.mjs 将 src/data/*/baihua/*.json 输出为「按章一文件」:
//   public/content/baihua/<corpus>/<slug>/<章号>.json = article（该章内容本身）
// 前端先取轻量 manifest（章级标题/featured/path），打开抽屉/整页时再按需 fetch 这一章并缓存。
//
// 2026-08 由「按书一文件」改回「按章一文件」——此前收成按书一文件，是为了迁就 CF 后台
// 拖拽上传（≤1000 文件）；但部署早已改用 `wrangler pages deploy` CLI（限 2 万文件，见
// CLAUDE.md「部署」节），那层迁就已无必要，代价却是打开任意一章白话都要先把整本书下下来
// （最大的书 7MB+，如诗经）。改回一章一文件后，点开一章只取这一章（约 24KB 均值），
// 文件数从 74 涨到约两千，仍在 CLI 上限内。

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const urlFor = (p) => `${BASE}${p.startsWith('/') ? p : `/${p}`}`

let manifestPromise = null
const articleCache = new Map()   // path（章级）→ Promise<article | null>

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

function loadArticle(path) {
  if (!articleCache.has(path)) {
    articleCache.set(
      path,
      fetch(urlFor(path)).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    )
  }
  return articleCache.get(path)
}

export async function loadBaihua(corpus, slug, chapter) {
  const meta = await getBaihuaMeta(corpus, slug, chapter)
  if (!meta?.path) return null
  return loadArticle(meta.path)
}

export async function hasBaihua(corpus, slug, chapter) {
  return !!(await getBaihuaMeta(corpus, slug, chapter))
}
