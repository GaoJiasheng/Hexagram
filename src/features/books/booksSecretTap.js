import { useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

// 观书隐藏入口的手势(owner 2026-10-05):底部栏某个按钮 **连点 3 次**(间隔各 < 600ms)→ /books。
// 手机网页与 iOS App 共用同一条底栏(MobileNav 第一项),桌面网页没有底栏,挂在页脚左侧那行字上。
// **只对管理员生效**:非管理员连点什么也不发生,不给任何提示——它本来就该像不存在。
// 这只是入口;真正的闸仍在原处:网页 /books* 与 /content/books/* 由 functions/_middleware.js 对非管理员回 404,
// App 端由 useBookAccess() 在线时要求管理员(离线放开,owner 08-13 定)。
const WINDOW_MS = 600
export function useBooksSecretTap() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const taps = useRef([])
  // 返回 true 表示这一下凑满了三连击并已跳转(调用方据此取消原本的点击动作)
  return useCallback((event) => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < WINDOW_MS * 2), now].slice(-3)
    const [a, b, c] = taps.current
    const triple = taps.current.length === 3 && b - a < WINDOW_MS && c - b < WINDOW_MS
    if (!triple || !user?.isAdmin) return false
    taps.current = []
    event?.preventDefault?.()
    navigate('/books')
    return true
  }, [user?.isAdmin, navigate])
}
