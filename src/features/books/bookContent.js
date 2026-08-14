// 观书内容的按需加载。
//
// ══ 为什么是 fetch 而不是 import.meta.glob(2026-08-13 改) ══
// 从前用 glob 懒加载:每篇文章各成一个动态 chunk。那解决了体积问题
//(曾 eager 打成 29.7 MiB,超 Cloudflare Pages 单文件 25 MiB 上限,部署被拒),
// 但**没解决可见性**:那些 chunk 是可按 URL 直取的公开静态文件,
// 书目 index.json 更是静态 import、任何访客一进站就下载了 150KB。
// 也就是说「隐藏书房」当时只是「不给链接」,数据全在明面上。
//
// owner 2026-08-13 定「观书只给管理员看」,于是数据搬到 `/content/books/`:
//   · **Web** —— 走边缘,由 functions/_middleware.js 鉴权,非管理员一律 404
//   · **iOS** —— Capacitor 把 public/ 打进包里本地直供**同一条 fetch 路径**,
//     所以天然离线可用、也天然不经过鉴权(owner 明确要这个取舍)
// 两端同一份代码,不必分支 —— 白话当初已经趟过这条路。
//
// ⚠️ 加书**不需要改这个文件**;但改完数据要跑 `npm run content:build` 重新落盘。

const cache = new Map()

// 404 是「没权限」的正常回答(中间件对非管理员就返回 404,不透露存在与否),
// 所以这里一律吞掉、返回 null,由页面去显示「需要管理员登录」。
async function getJson(url) {
  if (cache.has(url)) return cache.get(url)
  const p = fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
  cache.set(url, p)
  return p
}

export function loadBooksIndex() {
  return getJson('/content/books/index.json')
}

export function loadMindmap(slug) {
  return getJson(`/content/books/${slug}/mindmap.json`)
}

export function loadOverview(slug) {
  return getJson(`/content/books/${slug}/overview.json`)
}

export function loadArticle(slug, chapter) {
  return getJson(`/content/books/${slug}/articles/${chapter}.json`)
}
