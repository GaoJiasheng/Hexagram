import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearAuthHint, hasAuthHint, saveAuthHint } from '../yijing/storage.js'
import { startSyncLoop, stopSyncLoop, syncNow } from './sync.js'
import { apiFetch, hasApiToken, IS_NATIVE, setApiToken } from './apiClient.js'

const AuthSheet = lazy(() => import('./AuthSheet.jsx'))
const AuthContext = createContext(null)

async function authRequest(path, body) {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || '请求失败,请稍后重试')
  // 原生端没有 Cookie,凭证靠这个 token(后端仅在 X-Client: native 时才回传,网页拿不到)
  if (data?.token) setApiToken(data.token)
  return data
}

export function refreshAuthIfHinted(enabled, hinted, refresh) {
  if (!enabled || !hinted) return null
  return refresh()
}

// OAuth 是服务端整页重定向回来的,前端没机会写 authHint —— 回调因此在 returnTo 上带了
// ?auth=google。见到它就当作有痕迹去拉一次 /api/me,并把这个参数从地址栏抹掉
// (它只是一次性信号,留着会被收藏/分享出去)。
export function consumeOAuthReturnFlag() {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)
  if (url.searchParams.get('auth') !== 'google') return false
  url.searchParams.delete('auth')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  return true
}

export function AuthProvider({ children }) {
  // 原生端曾整体关闭(相对路径到不了服务器 + Cookie 跨源带不上)。两处都由 apiClient 解决后
  // 全平台开启;**Google 登录仍只在网页可用**(原生要另建 iOS OAuth 客户端 + ASWebAuthenticationSession)。
  const enabled = true
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => enabled && (hasAuthHint() || hasApiToken() || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('auth') === 'google')))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState('login')

  const refresh = useCallback(async () => {
    if (!enabled) return null
    setLoading(true)
    try {
      const response = await apiFetch('/api/me')
      if (!response.ok) throw new Error('登录状态读取失败')
      const data = await response.json()
      const nextUser = data.user || null
      setUser(nextUser)
      if (nextUser) saveAuthHint()
      else clearAuthHint()
      return nextUser
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    const request = refreshAuthIfHinted(enabled, hasAuthHint() || hasApiToken() || consumeOAuthReturnFlag(), refresh)
    request?.catch(() => {})
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !user?.id) {
      stopSyncLoop()
      return undefined
    }
    startSyncLoop()
    void syncNow()
    return stopSyncLoop
  }, [enabled, user?.id])

  const login = useCallback(async (credentials) => {
    if (!enabled) return null
    const data = await authRequest('/api/auth/login', credentials)
    setUser(data.user)
    saveAuthHint()
    return data.user
  }, [enabled])

  const register = useCallback(async (credentials) => {
    if (!enabled) return null
    const data = await authRequest('/api/auth/register', credentials)
    setUser(data.user)
    saveAuthHint()
    return data.user
  }, [enabled])

  const logout = useCallback(async () => {
    if (!enabled) return
    const response = await apiFetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || '退出失败,请稍后重试')
    }
    setUser(null)
    clearAuthHint()
    setApiToken(null)
  }, [enabled])

  const openAuth = useCallback((mode = 'login') => {
    if (!enabled) return
    setSheetMode(mode === 'register' ? 'register' : 'login')
    setSheetOpen(true)
  }, [enabled])
  const closeAuth = useCallback(() => setSheetOpen(false), [])

  const value = useMemo(() => ({
    user,
    loading,
    enabled,
    refresh,
    login,
    register,
    logout,
    openAuth,
    closeAuth,
  }), [user, loading, enabled, refresh, login, register, logout, openAuth, closeAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sheetOpen && (
        <Suspense fallback={null}>
          <AuthSheet open initialMode={sheetMode} onClose={closeAuth} />
        </Suspense>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
