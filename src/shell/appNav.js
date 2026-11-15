// App 外壳第二、三档(2026-11-15,docs/ipad-app-plan.md §4.2–4.3):转场方向 · 返回回到原位置 · 外接键盘快捷键 · 触感反馈。
// 全部只在 data-shell="app" 下生效(调用方传 enabled);网页端行为一行不变——浏览器有自己的返回、查找与滚动恢复。
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { Capacitor, registerPlugin } from '@capacitor/core'

// 固定导航的五个根页:在根页之间切换是「换标签」,用淡入,不用推入
export const TAB_ROOTS = ['/', '/app/continue', '/app/index', '/app/me']

// ── 转场方向 ──────────────────────────────────────────────────────
// PUSH = 进一层(从右推入)· POP = 返回(从左退回)· 根页之间或 REPLACE = 淡入。
// 不用 View Transitions API:它要 data router(本站是声明式 BrowserRouter),且 iOS 17 以下没有;
// 一个只在挂载时播一次的 CSS 动画就够,老系统同样有效,prefers-reduced-motion 时不动。
export function transitionKind(navType, from, to) {
  if (navType === 'REPLACE') return 'fade'
  if (TAB_ROOTS.includes(from) && TAB_ROOTS.includes(to)) return 'fade'
  return navType === 'POP' ? 'pop' : 'push'
}

export function useRouteTransition(enabled) {
  const location = useLocation()
  const navType = useNavigationType()
  const prev = useRef(location.pathname)
  const kind = useRef('fade')
  if (prev.current !== location.pathname) {
    kind.current = transitionKind(navType, prev.current, location.pathname)
    prev.current = location.pathname
  }
  return enabled ? `route-anim route-anim--${kind.current}` : 'route-anim-off'
}

// ── 返回回到原位置 ────────────────────────────────────────────────
// 每个历史条目(location.key)记一个滚动位置;POP 回来时恢复。页面是懒加载 + 异步取数,
// 刚挂载时文档还没那么高,所以在 2.5 秒内反复试,直到滚得到位并稳住;用户一碰屏幕 / 滚轮 / 键盘就收手。
// 进一层(PUSH)回到顶部——带 #锚点 或 ?seg= / ?hl= 的交给页面自己定位(阅读页、搜索结果落点)。
// 定时器节流,不用 rAF(后台标签页 rAF 被节流,踩过两次,见 CLAUDE.md)。
const STORE = 'guanxiang.v1.scrollPos'
const positions = (() => { try { return JSON.parse(sessionStorage.getItem(STORE) || '{}') } catch { return {} } })()
function persist() {
  try {
    const keys = Object.keys(positions)
    for (const k of keys.slice(0, Math.max(0, keys.length - 200))) delete positions[k]   // 只留最近 200 条
    sessionStorage.setItem(STORE, JSON.stringify(positions))
  } catch { /* 存不下就只在内存里 */ }
}

export function pageHandlesOwnScroll(location) {
  if (location.hash) return true
  const q = new URLSearchParams(location.search)
  return q.has('seg') || q.has('hl')
}

export function useScrollMemory(enabled) {
  const location = useLocation()
  const navType = useNavigationType()
  const keyRef = useRef(location.key)

  useEffect(() => {
    if (!enabled) return undefined
    const prevMode = history.scrollRestoration
    history.scrollRestoration = 'manual'
    // 每次滚动都记(只是内存赋值);写 sessionStorage 留到换页与 pagehide
    const onScroll = () => { positions[keyRef.current] = window.scrollY }
    const onHide = () => { positions[keyRef.current] = window.scrollY; persist() }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', onHide)
      history.scrollRestoration = prevMode
    }
  }, [enabled])

  useLayoutEffect(() => {
    if (!enabled) return undefined
    // 上一页的位置已由 scroll 监听记下(此刻 scrollY 可能已被新页面的高度截短,不能再读)
    keyRef.current = location.key
    persist()
    if (navType !== 'POP') {
      if (!pageHandlesOwnScroll(location)) window.scrollTo(0, 0)
      return undefined
    }
    const target = positions[location.key]
    if (!(target > 0)) return undefined
    let stopped = false
    let stable = 0
    const stop = () => { stopped = true }
    const opts = { passive: true, once: true }
    window.addEventListener('touchstart', stop, opts)
    window.addEventListener('wheel', stop, opts)
    window.addEventListener('keydown', stop, { once: true })
    const deadline = Date.now() + 2500
    let timer = 0
    const tick = () => {
      if (stopped || Date.now() > deadline) return
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 2
      if (reachable) {
        if (Math.abs(window.scrollY - target) > 2) { window.scrollTo(0, target); stable = 0 } else stable += 1
        if (stable >= 3) return
      }
      timer = setTimeout(tick, 80)
    }
    tick()
    return () => {
      clearTimeout(timer)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [enabled, location.key])   // eslint-disable-line react-hooks/exhaustive-deps
}

// ── 外接键盘 ──────────────────────────────────────────────────────
// ⌘F 搜索 · ⌘, 设置 · ⌘[ / ⌘] 后退前进 · ⌘1–5 切固定导航(搜索是第 3 个)。⌘K 与 / 原本就有。
// ←/→ 翻章在阅读器里已有(ClassicReader)。输入框里一律不截获。
export function appKeyAction(e) {
  const t = e.target
  if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable || e.isComposing) return null
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null
  const k = e.key.toLowerCase()
  if (k === 'f') return { type: 'search' }
  if (k === ',') return { type: 'settings' }
  if (k === '[') return { type: 'go', delta: -1 }
  if (k === ']') return { type: 'go', delta: 1 }
  if (/^[1-5]$/.test(k)) return { type: 'tab', index: Number(k) - 1 }
  return null
}

const TAB_TARGETS = ['/', '/app/continue', null, '/app/index', '/app/me']   // null = 搜索

export function useAppKeys(enabled, { navigate, onSearch, onSettings }) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      const a = appKeyAction(e)
      if (!a) return
      e.preventDefault()
      if (a.type === 'search') onSearch()
      else if (a.type === 'settings') onSettings()
      else if (a.type === 'go') navigate(a.delta)
      else if (a.type === 'tab') { const to = TAB_TARGETS[a.index]; if (to) navigate(to); else onSearch() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, navigate, onSearch, onSettings])
}

// ── 触感反馈 ──────────────────────────────────────────────────────
// 只在原生壳里、且装了 @capacitor/haptics 原生插件时有效;没装时调用会被拒,这里吞掉,什么都不发生。
// (插件要 npm 装一次 + `npx cap sync ios` + 重新打包才到手机上,见 docs/ipad-app-plan.md §4.3。)
const Haptics = registerPlugin('Haptics')
export function tapFeedback() {
  if (!Capacitor.isNativePlatform()) return
  try { Haptics.impact({ style: 'LIGHT' })?.catch?.(() => {}) } catch { /* 插件未装 */ }
}
