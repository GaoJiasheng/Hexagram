import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, FONT_SCALE_STEPS, getSettings, saveQuoteTheme, saveSettings } from './storage.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  }
}

describe('font scale settings migration', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
    })
  })

  it('uses the enlarged middle tier by default', () => {
    expect(DEFAULT_SETTINGS.fontScale).toBe(1.15)
    expect(FONT_SCALE_STEPS).toEqual([
      [1, '小'],
      [1.15, '中'],
      [1.35, '大'],
      [1.55, '特大'],
    ])
    expect(getSettings().fontScale).toBe(1.15)
  })

  it.each([
    [0.9, 1],
    [1, 1.15],
    [1.15, 1.35],
    [1.35, 1.55],
  ])('migrates legacy scale %s by tier to %s exactly once', (legacy, expected) => {
    localStorage.setItem('guanxiang.v1.settings', JSON.stringify({ theme: 'dark', fontScale: legacy }))

    expect(getSettings().fontScale).toBe(expected)
    expect(getSettings().fontScale).toBe(expected)
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.settings'))).toMatchObject({
      fontScale: expected,
      fontScaleTier: 2,
    })
  })

  it('does not remap a versioned new tier or the unambiguous new maximum', () => {
    localStorage.setItem('guanxiang.v1.settings', JSON.stringify({ fontScale: 1.35, fontScaleTier: 2 }))
    expect(getSettings().fontScale).toBe(1.35)

    localStorage.setItem('guanxiang.v1.settings', JSON.stringify({ fontScale: 1.55 }))
    expect(getSettings().fontScale).toBe(1.55)
    expect(getSettings().fontScale).toBe(1.55)
  })

  it('persists the tier marker on new writes and keeps invalid values on the new default', () => {
    saveSettings({ ...DEFAULT_SETTINGS, fontScale: 9 })
    expect(getSettings().fontScale).toBe(DEFAULT_SETTINGS.fontScale)
    expect(JSON.parse(localStorage.getItem('guanxiang.v1.settings')).fontScaleTier).toBe(2)
  })

  it('keeps the tier marker when the quote-card theme updates settings', () => {
    saveSettings({ ...DEFAULT_SETTINGS, fontScale: 1.35 })
    saveQuoteTheme('ink')

    expect(JSON.parse(localStorage.getItem('guanxiang.v1.settings'))).toMatchObject({
      fontScale: 1.35,
      fontScaleTier: 2,
      quoteTheme: 'ink',
    })
  })
})
