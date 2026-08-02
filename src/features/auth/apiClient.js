import { Capacitor } from '@capacitor/core'

// 全站唯一的后端调用入口。存在的理由只有一个:**网页与 iOS 壳拿凭证的方式不同**。
//
//   网页  同源,凭证是 httpOnly Cookie —— JS 碰不到,最安全,什么都不用做。
//   iOS   页面从本地包加载(capacitor://localhost),`/api/x` 会指向本地、根本到不了服务器;
//         而且跨源请求带不上 SameSite=Lax 的 Cookie、WKWebView 的 ITP 也会拦第三方 Cookie。
//         所以原生端改用**绝对地址 + Authorization: Bearer**,token 存在 app 沙箱里。
//
// 两条路走的是**同一张 sessions 表、同一个 token**,后端逻辑完全一致(见 readSessionToken)。
// 只有在客户端显式声明 `X-Client: native` 时,登录接口才会把 token 放进响应体 ——
// 网页那条路上 token 永远只存在于 Set-Cookie 里,不给 XSS 任何可读的长期凭证。

export const IS_NATIVE = Capacitor.isNativePlatform()

// 原生壳指向生产站。改域名要同步改这里(网页端为空串,走同源相对路径)。
const API_ORIGIN = IS_NATIVE ? 'https://hexa.gavin.pub' : ''

const TOKEN_KEY = 'guanxiang.v1.apiToken'

function readToken() {
  if (!IS_NATIVE) return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

let token = readToken()

export function setApiToken(value) {
  if (!IS_NATIVE) return
  token = value || null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* 存不下也不致命:本次会话仍在内存里可用 */ }
}

export function hasApiToken() {
  return IS_NATIVE && !!token
}

export function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (IS_NATIVE) {
    headers.set('X-Client', 'native')
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(`${API_ORIGIN}${path}`, {
    // 原生端明确不带 Cookie(带了也没用,反而在某些 WebView 上触发多余的预检)
    credentials: IS_NATIVE ? 'omit' : 'same-origin',
    ...options,
    headers,
  })
}
