// PWA 新版本自动重载(owner 2026-09-30:「缓存改成自动重载;网慢的地方超时就照旧用旧文件」)。
//
// 机制:vite-plugin-pwa 的 autoUpdate 让新 service worker 装好即接管(skipWaiting + clientsClaim),
// 但**已经打开的页面仍跑旧 JS / 旧 index.html**,不刷新永远是上一版——今天 review 每轮都撞到。
// 这里补上「接管之后」那一步:
//   · 页面刚打开(≤4s)时到手的更新 → 立即 reload(用户还没开始读,不打断);
//   · 之后到手的更新 → 记作 pending,等下一次站内导航 / 回到标签页时再 reload(不在读到一半时把页面抽走);
//   · 每 60s 最多 reload 一次(sessionStorage 记时间戳),防新 SW 接管即挂导致的刷新环;
//   · 首次安装 SW(此前没有 controller)不刷——那次页面本来就是从网络拿的新版。
//
// 慢网 / 超时:更新完全是后台的。旧 SW 一直从缓存供 index.html 与资源(navigateFallback 预缓存),
// 新 sw.js 拿不到、或新资源下载没完成、或安装失败,都不会触发 controllerchange,页面照旧用旧文件;
// 拿到之日才切换。所以「超时用旧文件」不需要额外的超时逻辑——只要不在这里做任何等待网络的事。
// 另:浏览器只在整页导航时查 sw.js,SPA 长开一页不会查——加一个 30 分钟一次 + 回到标签页时的 update()。
const RELOAD_AT_KEY = 'guanxiang.v1.pwa-reload-at'
const MIN_GAP_MS = 60_000
// 原 4s 太短:sw.js 拉取 + 预缓存 22 条 + 激活常超过 4s,刚打开的页也被判成「读到一半」而等下一次导航
// (2026-10-01 预览分支实测)。15s 内刷一下读者几乎无感。
const FRESH_MS = 15_000
const CHECK_EVERY_MS = 30 * 60_000

export function setupPwaAutoReload() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (import.meta.env.VITE_CAP === '1') return   // 原生壳无 SW
  const t0 = Date.now()
  let hadController = !!navigator.serviceWorker.controller
  let pending = false

  const reload = () => {
    try {
      const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0)
      if (Date.now() - last < MIN_GAP_MS) return
      sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
    } catch { /* sessionStorage 不可用:照刷,靠 FRESH/pending 逻辑本身已不易成环 */ }
    window.location.reload()
  }
  const flush = () => { if (pending) { pending = false; reload() } }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return }
    if (Date.now() - t0 < FRESH_MS) reload()
    else pending = true
  })
  // 站内导航(react-router 走 history.pushState)或回到标签页时补刷
  const origPush = history.pushState
  history.pushState = function (...args) { const r = origPush.apply(this, args); flush(); return r }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush() })

  // 长开一页也能发现新版:定时 + 回到标签页时向服务器查一次 sw.js(慢网下这只是一次后台请求,失败无事)
  navigator.serviceWorker.ready.then((reg) => {
    const check = () => { reg.update().catch(() => {}) }
    setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  }).catch(() => {})
}
