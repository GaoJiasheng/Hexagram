import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DATA_KEYS, getLastSyncAt, toggleCorpusMark } from '../yijing/storage.js'
import { startSyncLoop, stopSyncLoop, syncNow } from './sync.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

class TestCustomEvent extends Event {
  constructor(type, init) {
    super(type)
    this.detail = init?.detail
  }
}

function responseData(overrides = {}) {
  const defaults = {
    settings: null,
    quoteTheme: null,
    bookmarks: {},
    notes: null,
    divinations: [],
    reading: null,
    recentHexagrams: [],
    progress: {},
    corpusMarks: {},
    corpusNotes: {},
  }
  return Object.fromEntries(DATA_KEYS.map((key, index) => [key, {
    value: Object.hasOwn(overrides, key) ? overrides[key] : defaults[key],
    at: 5000 + index,
  }]))
}

function okResponse(data = responseData()) {
  return {
    status: 200,
    ok: true,
    json: async () => ({ ok: true, data }),
  }
}

describe('sync client', () => {
  beforeEach(() => {
    stopSyncLoop()
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
    })
    const target = new EventTarget()
    Object.defineProperty(globalThis, 'window', {
      value: {
        CustomEvent: TestCustomEvent,
        addEventListener: (...args) => target.addEventListener(...args),
        removeEventListener: (...args) => target.removeEventListener(...args),
        dispatchEvent: (...args) => target.dispatchEvent(...args),
        setTimeout: (...args) => setTimeout(...args),
        clearTimeout: (...args) => clearTimeout(...args),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    stopSyncLoop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('posts a full snapshot and applies the full merged response', async () => {
    const cloudMark = { corpus: 'ru', slug: 'lunyu', ch: 1, i: 0, at: '2026-01-01T00:00:00.000Z' }
    const fetchMock = vi.fn(async () => okResponse(responseData({
      settings: { theme: 'dark' },
      corpusMarks: { 'ru:lunyu:1:0': cloudMark },
    })))
    vi.stubGlobal('fetch', fetchMock)

    expect(await syncNow()).toBe(true)

    const request = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(Object.keys(request.data)).toEqual(DATA_KEYS)
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.corpusMarks'))).toEqual({
      'ru:lunyu:1:0': cloudMark,
    })
    expect(getLastSyncAt()).toEqual(expect.any(Number))
  })

  it('silently ignores a 401 without recording a successful sync', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 401, ok: false })))
    await expect(syncNow()).resolves.toBe(false)
    expect(getLastSyncAt()).toBeNull()
  })

  it('does not overwrite a local edit made while the request is in flight', async () => {
    let resolveFetch
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolveFetch = resolve })))
    const request = syncNow()

    toggleCorpusMark('ru', 'lunyu', 1, 0, '学而时习之')
    resolveFetch(okResponse(responseData({ corpusMarks: {} })))

    await expect(request).resolves.toBe(false)
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.corpusMarks'))).toHaveProperty('ru:lunyu:1:0')
    expect(getLastSyncAt()).toBeNull()
  })

  it('debounces data changes for 60 seconds and stopSyncLoop cancels the timer', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => ({ status: 401, ok: false }))
    vi.stubGlobal('fetch', fetchMock)
    startSyncLoop()

    window.dispatchEvent(new window.CustomEvent('gx:data-changed', { detail: { key: 'settings' } }))
    await vi.advanceTimersByTimeAsync(30_000)
    window.dispatchEvent(new window.CustomEvent('gx:data-changed', { detail: { key: 'settings' } }))
    await vi.advanceTimersByTimeAsync(59_999)
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledOnce()

    window.dispatchEvent(new window.CustomEvent('gx:data-changed', { detail: { key: 'settings' } }))
    stopSyncLoop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
