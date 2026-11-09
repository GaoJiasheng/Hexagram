// App 外壳的地基(2026-11-09,docs/ipad-app-plan.md §4.0):**形态只在这里判断一次**,标在 <html> 上——
//   data-shell = app | web   Capacitor 壳、或网页被「添加到主屏幕」独立运行时是 app;普通浏览器是 web
//   data-form  = phone | tablet | wide   按可用宽度算,窗口变了跟着变(iPad 分屏缩窄会自动落回 phone)
// 所有 App 化的样式与组件都挂在 [data-shell="app"] 之下:网页端零变化(SEO、桌面浏览器不受影响),
// 安卓平板 / Mac(以 iPad 应用运行)/ 折叠屏都只是 form 的不同取值,不必再各自适配。
//
// 此前「手机还是桌面」散在 40 多条 CSS 断点里(600 / 640 / 768 / 1024),iPad 正好落在缝里拿到桌面网站的外壳。
// 新写 App 相关的东西一律认这两个属性,别再加宽度断点。
//
// 调试:浏览器地址栏加 ?shell=app 强制进 App 外壳(记在 sessionStorage,关标签页即失效);?shell=web 强制回网页。
import { useSyncExternalStore } from 'react'
import { Capacitor } from '@capacitor/core'

// phone 的上界与既有手机底栏的断点(index.css `@media (max-width: 600px)`)对齐:≤600 仍走原来那套手机外壳
export const TABLET_MIN = 601
// ≥1024:iPad 横屏、13 吋竖屏、Mac 窗口——侧边导航栏
export const WIDE_MIN = 1024

export function formOf(width) {
  return width >= WIDE_MIN ? 'wide' : width >= TABLET_MIN ? 'tablet' : 'phone'
}

// 显式参数 > 本次会话记住的 > 环境判断
export function resolveShell({ native = false, standalone = false, param = null, stored = null } = {}) {
  if (param === 'app' || param === 'web') return param
  if (stored === 'app' || stored === 'web') return stored
  return native || standalone ? 'app' : 'web'
}

const STORE_KEY = 'guanxiang.v1.shell'
let state = { shell: 'web', form: 'wide' }
const listeners = new Set()

function read() {
  let param = null
  let stored = null
  try {
    param = new URLSearchParams(window.location.search).get('shell')
    if (param === 'app' || param === 'web') sessionStorage.setItem(STORE_KEY, param)
    stored = sessionStorage.getItem(STORE_KEY)
  } catch { /* sessionStorage 不可用就只认环境 */ }
  const standalone = !!window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  return {
    shell: resolveShell({ native: Capacitor.isNativePlatform(), standalone, param, stored }),
    form: formOf(window.innerWidth),
  }
}

function apply() {
  const next = read()
  const root = document.documentElement
  root.dataset.shell = next.shell
  root.dataset.form = next.form
  if (next.shell === state.shell && next.form === state.form) return
  state = next
  listeners.forEach((fn) => fn())
}

// main.jsx 在 React 挂载前调用:首帧就是对的外壳,不闪
export function initShell() {
  if (typeof window === 'undefined') return
  apply()
  window.addEventListener('resize', apply)
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', apply)
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
const getSnapshot = () => state
const getServerSnapshot = () => state

// { shell, form };appLayout = 该用 App 的平板 / 宽屏外壳(固定导航 + 书房首页);手机形态仍走原手机外壳
export function useShell() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { ...s, appLayout: s.shell === 'app' && s.form !== 'phone' }
}
