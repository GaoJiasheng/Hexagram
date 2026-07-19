import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DATA_KEYS,
  applySyncSnapshot,
  getLastSyncAt,
  getSyncSnapshot,
  toggleCorpusMark,
} from './storage.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  }
}

class TestCustomEvent extends Event {
  constructor(type, init) {
    super(type)
    this.detail = init?.detail
  }
}

function mergedResponse(overrides = {}) {
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
  return Object.fromEntries(DATA_KEYS.map((key, index) => [
    key,
    { value: overrides[key] ?? defaults[key], at: 1000 + index },
  ]))
}

describe('storage sync metadata', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
    })
    const eventTarget = new EventTarget()
    Object.defineProperty(globalThis, 'window', {
      value: {
        CustomEvent: TestCustomEvent,
        addEventListener: (...args) => eventTarget.addEventListener(...args),
        removeEventListener: (...args) => eventTarget.removeEventListener(...args),
        dispatchEvent: (...args) => eventTarget.dispatchEvent(...args),
      },
      configurable: true,
    })
  })

  it('timestamps DATA_KEYS writes and dispatches gx:data-changed', () => {
    const changed = vi.fn()
    window.addEventListener('gx:data-changed', changed)
    vi.spyOn(Date, 'now').mockReturnValue(123456)

    toggleCorpusMark('ru', 'lunyu', 1, 0, '学而时习之')

    expect(JSON.parse(localStorage.getItem('guanxiang.v1.syncMeta'))).toMatchObject({
      corpusMarks: 123456,
    })
    expect(changed).toHaveBeenCalledOnce()
    expect(changed.mock.calls[0][0].detail).toEqual({ key: 'corpusMarks' })
    vi.restoreAllMocks()
  })

  it('gives pre-sync non-empty local data a current timestamp but leaves defaults at zero', () => {
    localStorage.setItem('guanxiang.v1.corpusNotes', JSON.stringify({
      'ru:lunyu:1:0': { text: '旧批注', at: '2026-01-01T00:00:00.000Z' },
    }))

    const snapshot = getSyncSnapshot(777000)
    const repeated = getSyncSnapshot(999000)
    expect(snapshot.corpusNotes.at).toBe(777000)
    expect(repeated.corpusNotes.at).toBe(777000)
    expect(snapshot.corpusNotes.value).toHaveProperty('ru:lunyu:1:0')
    expect(snapshot.corpusMarks).toEqual({ value: {}, at: 0 })
    expect(snapshot.divinations).toEqual({ value: [], at: 0 })
    expect(snapshot.settings).toEqual({ value: null, at: 0 })
  })

  it('migrates a legacy bookmark array before taking the first sync snapshot', () => {
    localStorage.setItem('guanxiang.v1.bookmarks', JSON.stringify([1, 7]))
    const snapshot = getSyncSnapshot(888000)
    expect(snapshot.bookmarks.value).toEqual({
      1: expect.objectContaining({ at: expect.any(String) }),
      7: expect.objectContaining({ at: expect.any(String) }),
    })
    expect(snapshot.bookmarks.at).toEqual(expect.any(Number))
    expect(snapshot.bookmarks.at).toBeGreaterThan(0)
  })

  it('applies every merged key without emitting changes or replacing server timestamps', () => {
    const changed = vi.fn()
    window.addEventListener('gx:data-changed', changed)
    const tombstone = { deleted: true, at: '2026-01-01T00:00:00.000Z' }
    const response = mergedResponse({
      settings: { theme: 'dark' },
      corpusMarks: { 'ru:lunyu:1:0': tombstone },
    })

    expect(applySyncSnapshot(response, 999999)).toBe(true)

    expect(changed).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.corpusMarks'))).toEqual({
      'ru:lunyu:1:0': tombstone,
    })
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.syncMeta'))).toEqual(
      Object.fromEntries(DATA_KEYS.map((key, index) => [key, 1000 + index])),
    )
    expect(getLastSyncAt()).toBe(999999)
  })
})
