// 深链:让外部打开的 hexa.gavin.pub 链接落到 App 里对应的那一章。
//
// 原生壳里页面是从**本地包**加载的,地址栏那套东西不存在 —— 系统把 URL 交给
// Activity,但 WebView 只会照常显示 index.html,**路由停在首页**。
// 2026-08-17 安卓实测:`am start -d "https://hexa.gavin.pub/ru/lunyu/1"` 落回首页、
// 路径被丢掉。所以必须自己听 `appUrlOpen` 事件,把路径喂给 React Router。
//
// 两处入口都走这里:
//   ① 外部链接(App Links / 用户从「打开方式」选本 App)
//   ② 冷启动时携带的 URL(App 没在运行时,事件可能早于监听器挂载,故另查一次 launchUrl)
//
// ⚠️ **只接受本站域名**。外部传进来的 URL 是不可信输入,照单全收等于让任何 App
// 把本应用导航到任意路径;虽然本站全是公开内容、危害有限,但没有理由放宽。

const ALLOWED_HOSTS = new Set(['hexa.gavin.pub'])

/** 从任意 URL 取出可用于站内路由的路径;不合法或非本站一律返回 null。 */
export function routePathFromUrl(raw) {
  try {
    const u = new URL(String(raw))
    if (!ALLOWED_HOSTS.has(u.hostname)) return null
    const path = `${u.pathname}${u.search}${u.hash}`
    // 只接受绝对路径,挡掉 `//evil.com` 这种会被当成协议相对地址的写法
    return path.startsWith('/') && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}

/**
 * 挂上深链处理。仅原生生效,web 直接短路(浏览器本来就会自己路由)。
 * @param {(path:string)=>void} navigate  React Router 的 navigate
 * @returns {Promise<() => void>} 反注册函数
 */
export async function setupDeepLinks(navigate) {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor?.isNativePlatform?.()) return () => {}

  const { App } = await import('@capacitor/app')

  // ② 冷启动:事件可能在监听器挂上之前就发过了,故主动查一次
  try {
    const { url } = await App.getLaunchUrl() || {}
    const path = url && routePathFromUrl(url)
    if (path) navigate(path)
  } catch { /* 没有 launchUrl 是常态,不是错误 */ }

  // ① 运行中被外部链接唤起
  const handle = await App.addListener('appUrlOpen', ({ url }) => {
    const path = routePathFromUrl(url)
    if (path) navigate(path)
  })

  return () => { handle.remove() }
}
