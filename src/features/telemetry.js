import { useEffect, useRef } from 'react'
import { SITES } from '../sites/registry.js'

const CID_KEY = 'guanxiang.v1.cid'
const BEAT_URL = '/api/beat'
const CORPUS_KEYS = new Set(SITES.filter((site) => site.key !== 'yijing').map((site) => site.key))

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function chapterFromHash(hash, corpus) {
  const prefix = `#${corpus}-ch-`
  if (!hash?.startsWith(prefix)) return null
  const chapter = decodeSegment(hash.slice(prefix.length))
  return chapter || null
}

function supportsTelemetryOrigin() {
  if (import.meta.env.VITE_CAP === '1') return false
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    && typeof navigator.sendBeacon === 'function'
}

function randomClientId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

// URL-level parsing is intentionally conservative: non-reading pages stay
// anonymous path events with no corpus metadata. A two-segment corpus URL can
// be either a book overview or a single-page classic, so it is counted at book
// level and gains a chapter only when its chapter hash is present.
export function readingContext(pathname, hash = '') {
  const parts = pathname.split('/').filter(Boolean).map(decodeSegment)

  if (parts[0] === 'hexagram' && parts[1] && (parts.length === 2 || (parts.length === 3 && parts[2] === 'baihua'))) {
    return { corpus: 'yijing', slug: 'hexagrams', chapter: parts[1] }
  }

  if (parts[0] === 'classics' && parts[1] && parts[2] && (parts.length === 3 || (parts.length === 4 && parts[3] === 'baihua'))) {
    return { corpus: 'yijing', slug: parts[1], chapter: parts[2] }
  }

  const corpus = parts[0]
  const slug = parts[1]
  if (!CORPUS_KEYS.has(corpus) || !slug || slug === 'me') {
    return { corpus: null, slug: null, chapter: null }
  }

  if (parts[2] === 'baihua' && parts[3]) {
    return { corpus, slug, chapter: parts[3] }
  }

  if (parts[2]) {
    return { corpus, slug, chapter: parts[2] }
  }

  return { corpus, slug, chapter: chapterFromHash(hash, corpus) }
}

function getOrCreateClientId() {
  let existing = null
  try {
    existing = localStorage.getItem(CID_KEY)
  } catch { /* Storage may be disabled; keep an in-memory id for this visit. */ }
  if (typeof existing === 'string' && existing === existing.trim() && existing.length >= 8 && existing.length <= 64) {
    return existing
  }

  const cid = randomClientId()
  try {
    // Deliberately bypass storage.js: cid is not user data and must never enter
    // its DATA_KEYS export/import whitelist.
    localStorage.setItem(CID_KEY, cid)
  } catch { /* The in-memory id still keeps this page visit internally coherent. */ }
  return cid
}

function pageFromLocation(location) {
  const context = readingContext(location.pathname, location.hash)
  return {
    key: `${location.pathname}|${context.corpus ?? ''}|${context.slug ?? ''}|${context.chapter ?? ''}`,
    path: location.pathname,
    ...context,
  }
}

// 匿名埋点只做发送(2026-10-01 起):计时统一交给 src/features/reading/readClock.js(活跃时长口径,见 docs/reading-stats-plan.md §4),
// 这里订阅它派发的 gx:read-session 事件,把 sec 作 dwell_ms 发 /api/beat。cid 与账号无关的承诺不变。
export function useTelemetry() {
  const enabledRef = useRef(supportsTelemetryOrigin())
  const cidRef = useRef(null)
  useEffect(() => {
    if (!enabledRef.current) return undefined
    if (cidRef.current === null) cidRef.current = getOrCreateClientId()
    const onSession = (e) => {
      const ev = e.detail
      if (!ev || !(ev.sec > 0)) return
      navigator.sendBeacon(BEAT_URL, JSON.stringify({
        cid: cidRef.current, path: ev.path, corpus: ev.corpus, slug: ev.slug, chapter: ev.ch, dwell_ms: Math.round(ev.sec * 1000),
      }))
    }
    window.addEventListener('gx:read-session', onSession)
    return () => window.removeEventListener('gx:read-session', onSession)
  }, [])
}
