import { useCallback, useEffect, useRef } from 'react'
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

export function useTelemetry(location) {
  const enabledRef = useRef(supportsTelemetryOrigin())
  const cidRef = useRef(null)
  const latestPageRef = useRef(pageFromLocation(location))
  const sessionRef = useRef(null)

  latestPageRef.current = pageFromLocation(location)

  const startSession = useCallback(() => {
    if (!enabledRef.current || cidRef.current === null || document.visibilityState === 'hidden') return
    sessionRef.current = {
      page: latestPageRef.current,
      startedAt: Date.now(),
    }
  }, [])

  const flushSession = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    // Clear first: visibilitychange(hidden) and pagehide commonly arrive back
    // to back, and only the first event should produce a row.
    sessionRef.current = null
    navigator.sendBeacon(BEAT_URL, JSON.stringify({
      cid: cidRef.current,
      path: session.page.path,
      corpus: session.page.corpus,
      slug: session.page.slug,
      chapter: session.page.chapter,
      dwell_ms: Math.max(0, Date.now() - session.startedAt),
    }))
  }, [])

  // Report the previous route in the new route's effect body. Deliberately do
  // not report from cleanup: React StrictMode runs an extra setup/cleanup pass
  // in development and would otherwise create a false initial event.
  useEffect(() => {
    if (!enabledRef.current) return
    if (cidRef.current === null) cidRef.current = getOrCreateClientId()

    const nextPage = latestPageRef.current
    if (sessionRef.current?.page.key !== nextPage.key) {
      flushSession()
      startSession()
    } else if (!sessionRef.current) {
      startSession()
    }
  }, [location.pathname, location.hash, flushSession, startSession])

  useEffect(() => {
    if (!enabledRef.current) return undefined

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flushSession()
      else if (!sessionRef.current) startSession()
    }

    function onPageHide() {
      flushSession()
    }

    function onPageShow() {
      if (!sessionRef.current) startSession()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [flushSession, startSession])
}
