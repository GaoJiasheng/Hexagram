import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_QUOTE_THEME, THEMES, canonicalQuoteUrl, qrPathFor } from './QuoteCard.jsx'
import {
  DEFAULT_SETTINGS,
  clearAllData,
  exportData,
  getQuoteTheme,
  saveQuoteTheme,
} from '../yijing/storage.js'

function channel(hex) {
  const value = Number.parseInt(hex, 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const raw = hex.replace('#', '')
  return 0.2126 * channel(raw.slice(0, 2)) + 0.7152 * channel(raw.slice(2, 4)) + 0.0722 * channel(raw.slice(4, 6))
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

function localStorageStub() {
  const values = new Map()
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

describe('QuoteCard 多主题与二维码(Phase 0.7–0.11)', () => {
  beforeEach(() => { globalThis.localStorage = localStorageStub() })
  afterEach(() => { delete globalThis.localStorage })

  it('以朱印经典为默认并提供三套完整主题', () => {
    expect(DEFAULT_QUOTE_THEME).toBe('classic')
    expect(DEFAULT_SETTINGS.quoteTheme).toBe('classic')
    expect(Object.keys(THEMES)).toEqual(['classic', 'ink', 'moon'])
    expect(Object.values(THEMES).map((theme) => theme.name)).toEqual(['朱印经典', '水墨留白', '暗夜月白'])
    for (const theme of Object.values(THEMES)) {
      for (const token of ['background', 'border', 'original', 'translation', 'sealBg', 'sealText', 'ornament', 'signature', 'qr']) {
        expect(theme[token]).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })

  it('三套二维码前景与卡底对比度均高于 4:1', () => {
    for (const theme of Object.values(THEMES)) expect(contrast(theme.qr, theme.background)).toBeGreaterThan(4)
    expect(THEMES.moon.qr).toBe(THEMES.moon.original) // 暗夜强制月白，不取低对比暗金
  })

  it('把段落、卦页与三类白话路径统一到生产域名', () => {
    expect(canonicalQuoteUrl('http://localhost:5173/ru/lunyu/1#p2')).toBe('https://hexa.gavin.pub/ru/lunyu/1#p2')
    expect(canonicalQuoteUrl('/hexagram/1')).toBe('https://hexa.gavin.pub/hexagram/1')
    expect(canonicalQuoteUrl('/dao/daodejing/baihua/1')).toBe('https://hexa.gavin.pub/dao/daodejing/baihua/1')
    expect(canonicalQuoteUrl('/hexagram/1/baihua')).toBe('https://hexa.gavin.pub/hexagram/1/baihua')
    expect(canonicalQuoteUrl('/classics/xici-shang/1/baihua')).toBe('https://hexa.gavin.pub/classics/xici-shang/1/baihua')
  })

  it('用 Q 级矩阵生成带四模块留白的单一 SVG path', () => {
    const qr = qrPathFor('https://hexa.gavin.pub/ru/lunyu/1#p2')
    expect(qr.path.length).toBeGreaterThan(100)
    expect(qr.path).toMatch(/^M/)
    expect(qr.modules).toBeGreaterThanOrEqual(21)
    expect(qr.quiet).toBe(4)
    expect(qr.viewBoxSize).toBe(qr.modules + 8)
  })

  it('主题写入独立键并纳入导出/清空白名单，非法值回默认', () => {
    expect(getQuoteTheme()).toBe('classic')
    expect(saveQuoteTheme('moon')).toBe('moon')
    expect(localStorage.getItem('guanxiang.v1.quoteTheme')).toBe('"moon"')
    expect(exportData().quoteTheme).toBe('moon')
    clearAllData()
    expect(getQuoteTheme()).toBe('classic')
    expect(saveQuoteTheme('not-a-theme')).toBe('classic')
  })
})
