import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { clearAuthHint, hasAuthHint, saveAuthHint } from '../yijing/storage.js'
import { startSyncLoop, stopSyncLoop, syncNow } from './sync.js'

const AuthSheet = lazy(() => import('./AuthSheet.jsx'))
const AuthContext = createContext(null)

async function authRequest(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || '请求失败,请稍后重试')
  return data
}

export function refreshAuthIfHinted(enabled, hinted, refresh) {
  if (!enabled || !hinted) return null
  return refresh()
}

export function AuthProvider({ children }) {
  const enabled = !Capacitor.isNativePlatform()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => enabled && hasAuthHint())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState('login')

  const refresh = useCallback(async () => {
    if (!enabled) return null
    setLoading(true)
    try {
      const response = await fetch('/api/me')
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
    const request = refreshAuthIfHinted(enabled, hasAuthHint(), refresh)
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
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(data?.error || '退出失败,请稍后重试')
    }
    setUser(null)
    clearAuthHint()
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
