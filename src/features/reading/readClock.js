// 阅读时钟(研读统计,2026-10-01,docs/reading-stats-plan.md §7.1)。
// 一个时钟,三处消费:本机 readDays / readRecent(个人统计)、云同步(登录且开关开)、匿名埋点(telemetry 订阅事件)。
//
// 口径(§4):**活跃时长**——页面可见、且最近 60 秒内有过滚动 / 点击 / 按键 / 触摸才累加;单次会话封顶 1800 秒;
// 换章 / 隐藏 / pagehide 即提交;可见时未提交部分满 300 秒先提交一次「部分」(iOS Safari 常不触发 pagehide,防整段丢失)。
// 纯函数(newSession / advance / takeDelta)单测,hook 只管事件与定时器。
import { useEffect, useRef } from 'react'
import { readingContext } from '../telemetry.js'
import { recordReadSession } from '../yijing/storage.js'

export const IDLE_MS = 60_000
export const CAP_SEC = 1800
export const TICK_MS = 5_000
export const PARTIAL_SEC = 300
export const MIN_SEC = 5

export function newSession(ctx, now) {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    t: now, path: ctx.path, corpus: ctx.corpus ?? null, slug: ctx.slug ?? null, ch: ctx.chapter ?? null,
    key: `${ctx.path}|${ctx.corpus ?? ''}|${ctx.slug ?? ''}|${ctx.chapter ?? ''}`,
    sec: 0, flushed: 0, lastTick: now, lastActivity: now,
  }
}

// 推进到 now:上次 tick 到现在这一段,只有在 60 秒内有过操作才算数;封顶 CAP_SEC
export function advance(s, now) {
  if (!s) return s
  if (now - s.lastActivity <= IDLE_MS) s.sec = Math.min(CAP_SEC, s.sec + Math.max(0, now - s.lastTick) / 1000)
  s.lastTick = now
  return s
}

// 取未提交的增量:partial 满 300 秒才交;final 至少 5 秒(已交过部分的会话即使 0 秒也交,好让「次数」+1)
export function takeDelta(s, partial) {
  if (!s) return null
  const delta = Math.round(s.sec - s.flushed)
  if (partial ? delta < PARTIAL_SEC : (delta < MIN_SEC && s.flushed === 0)) return null
  s.flushed = s.sec
  return { id: s.id, t: s.t, path: s.path, corpus: s.corpus, slug: s.slug, ch: s.ch, sec: Math.max(0, delta), partial: !!partial }
}

function emit(ev) {
  if (!ev) return
  try { recordReadSession(ev) } catch { /* localStorage 不可用时只发事件 */ }
  if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new window.CustomEvent('gx:read-session', { detail: ev }))
  }
}

export function useReadClock(location) {
  const sRef = useRef(null)
  const ctxRef = useRef(null)
  const c = readingContext(location.pathname, location.hash)
  ctxRef.current = { path: location.pathname, corpus: c.corpus, slug: c.slug, chapter: c.chapter }

  // 换路由:先结清上一段,再开新段(可见时)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const now = Date.now()
    const ctx = ctxRef.current
    const key = `${ctx.path}|${ctx.corpus ?? ''}|${ctx.slug ?? ''}|${ctx.chapter ?? ''}`
    if (sRef.current && sRef.current.key === key) return
    if (sRef.current) { advance(sRef.current, now); emit(takeDelta(sRef.current, false)); sRef.current = null }
    if (document.visibilityState !== 'hidden') sRef.current = newSession(ctx, now)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const touch = () => { if (sRef.current) sRef.current.lastActivity = Date.now() }
    const finish = () => {
      if (!sRef.current) return
      advance(sRef.current, Date.now()); emit(takeDelta(sRef.current, false)); sRef.current = null
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') finish()
      else if (!sRef.current) sRef.current = newSession(ctxRef.current, Date.now())
    }
    const timer = window.setInterval(() => {
      const s = sRef.current
      if (!s || document.visibilityState === 'hidden') return
      advance(s, Date.now())
      emit(takeDelta(s, true))
    }, TICK_MS)
    const opts = { passive: true }
    window.addEventListener('scroll', touch, opts)
    window.addEventListener('pointerdown', touch, opts)
    window.addEventListener('keydown', touch, opts)
    window.addEventListener('touchstart', touch, opts)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', finish)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('scroll', touch)
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      window.removeEventListener('touchstart', touch)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', finish)
    }
  }, [])
}
