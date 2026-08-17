// 安卓硬件返回键。
//
// iOS 没有这个概念,所以这套逻辑此前**一行都没有** —— 而安卓上不接管返回键,
// 用户按一下就是**直接退出 App**(不是回上一页),这是安卓端最刺眼的缺陷。
//
// 三层优先级,自上而下:
//   ① 有浮层开着 → 关浮层,**吃掉这次返回**
//   ② 有站内历史 → 回上一页
//   ③ 已在栈底 → 再按一次才退出(两秒内),否则只提示
//
// ── 浮层怎么判断 ──────────────────────────────────────────────────
// 站内模态浮层守着一条**统一约定**:打开时 `document.body.style.overflow = 'hidden'`,
// 并监听 window 上的 Escape 关闭自己(12 个组件都是这么写的;2026-08-17 把
// QuoteCard 与 DailyDebate 这两个漏网的也并了进来)。
// 于是这里不必认识每一个浮层,只要:
//   看 body 锁没锁滚动 → 锁了就派发一次 Escape,让浮层自己关。
//
// ⚠️ **新增模态浮层务必守这条约定**(锁滚动 + 监听 Escape)。漏掉的话,
// 安卓上按返回不会关它,而是直接退出 App —— 而这在浏览器和 iOS 上都测不出来。
//
// 注释气泡一类的**轻浮层**不锁滚动(它们滚动即关),故用类名单独认一下。

const TOOLTIPS = '.zhushi__popover, .termtip__popover'

export function overlayOpen() {
  if (typeof document === 'undefined') return false
  if (document.body.style.overflow === 'hidden') return true
  return !!document.querySelector(TOOLTIPS)
}

function dismissTopOverlay() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

// 退出前的二次确认:安卓的惯例是「再按一次退出」,而不是一按就走。
export const EXIT_WINDOW_MS = 2000
let lastBackAt = 0

// history.length 在原生壳里不可靠(壳自身会留下条目),用「路径是不是首页」判断更准。
export const atRoot = (pathname) => pathname === '/' || pathname === '/hexagram'

/**
 * 三层优先级的**纯决策**,抽出来是为了能测 —— 这套逻辑只有装进安卓壳才跑得到,
 * 靠手点验不了,而错了的表现是「按返回直接退出 App」这种最难堪的缺陷。
 * @returns {'dismiss'|'back'|'exit'|'hint'}
 */
export function decideBack({ overlay, canGoBack, pathname, now, lastAt }) {
  if (overlay) return 'dismiss'
  if (canGoBack && !atRoot(pathname)) return 'back'
  return now - lastAt < EXIT_WINDOW_MS ? 'exit' : 'hint'
}

/**
 * 挂上安卓返回键处理。仅安卓生效,其他平台直接短路(web 上零开销)。
 * @param {(delta:number)=>void} goBack  路由回退(传 React Router 的 navigate)
 * @param {(msg:string)=>void} [toast]   可选:提示「再按一次退出」
 * @returns {Promise<() => void>} 反注册函数
 */
export async function setupBackButton(goBack, toast) {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor?.isNativePlatform?.() || Capacitor.getPlatform() !== 'android') return () => {}

  const { App } = await import('@capacitor/app')
  const handle = await App.addListener('backButton', ({ canGoBack }) => {
    const now = Date.now()
    const action = decideBack({
      overlay: overlayOpen(),
      canGoBack,                      // 壳给的,含壳自身历史,故与「是否在首页」取交集
      pathname: window.location.pathname,
      now,
      lastAt: lastBackAt,
    })
    if (action === 'dismiss') return dismissTopOverlay()
    if (action === 'back') return goBack(-1)
    if (action === 'exit') return App.exitApp()
    lastBackAt = now
    if (toast) toast('再按一次退出')
  })

  return () => { handle.remove() }
}
