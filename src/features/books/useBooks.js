// 观书的「能不能看」与「书目从哪来」。
//
// ══ 两端的挡法不一样,别只做一半 ══
//
// **Web** —— 真正的挡在服务端:`functions/_middleware.js` 对非管理员把
// `/books*` 与 `/content/books/*` 一律回 404。所以即便有人绕过界面,
// 也拿不到任何数据。前端这层只是为了给出体面的提示,不是安全边界。
//
// **iOS** —— 内容随 App 本地打包(owner 要它离线可用),Capacitor 直接从包里
// 读同一条 fetch 路径,**根本不经过我们的边缘**。所以原生端必须由前端判:
//   · 在线 → 要求管理员身份
//   · 离线 → 放开(此时无从验证,owner 明确接受这个取舍)
//
// ⚠️ 因此原生端的「挡」是**观感层面的**,不是安全层面的:关掉网络即可绕过,
//    IPA 解包也能取到内容。owner 2026-08-13 知情并接受 —— 这里的目的是
//    「别让路人撞见私人读书笔记」,不是防有心人。

import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { IS_NATIVE } from '../auth/apiClient.js'
import { loadBooksIndex } from './bookContent.js'

// 'loading' | 'allowed' | 'denied'
export function useBookAccess() {
  const { user, loading } = useAuth()
  if (loading) return 'loading'
  if (user?.isAdmin) return 'allowed'
  // 原生端离线时无从验证 —— 放开(owner 定)
  if (IS_NATIVE && typeof navigator !== 'undefined' && navigator.onLine === false) return 'allowed'
  return 'denied'
}

// 书目索引:web 上非管理员会拿到 404 → null,页面据此显示提示。
export function useBooksIndex(access) {
  const [books, setBooks] = useState(null)
  const [state, setState] = useState('loading')
  useEffect(() => {
    if (access !== 'allowed') { setState(access); return }
    let alive = true
    loadBooksIndex().then((d) => {
      if (!alive) return
      if (Array.isArray(d)) { setBooks(d); setState('ready') } else setState('denied')
    })
    return () => { alive = false }
  }, [access])
  return { books, state }
}

// 单本书的元数据 —— 三个页面都要「按 slug 找书」,别各写各的
export function useBook(slug, access) {
  const { books, state } = useBooksIndex(access)
  return { book: books?.find((b) => b.slug === slug) || null, books, state }
}
