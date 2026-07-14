import { describe, expect, it } from 'vitest'
import { readingContext } from './telemetry.js'

describe('readingContext', () => {
  it('parses Yijing hexagram and classic reading routes', () => {
    expect(readingContext('/hexagram/1')).toEqual({ corpus: 'yijing', slug: 'hexagrams', chapter: '1' })
    expect(readingContext('/classics/xici/3/baihua')).toEqual({ corpus: 'yijing', slug: 'xici', chapter: '3' })
  })

  it('parses corpus chapter and baihua routes', () => {
    expect(readingContext('/ru/lunyu/2')).toEqual({ corpus: 'ru', slug: 'lunyu', chapter: '2' })
    expect(readingContext('/dao/daodejing/baihua/37')).toEqual({ corpus: 'dao', slug: 'daodejing', chapter: '37' })
  })

  it('uses chapter hashes for single-page classics', () => {
    expect(readingContext('/fo/xinjing', '#fo-ch-1')).toEqual({ corpus: 'fo', slug: 'xinjing', chapter: '1' })
  })

  it('keeps non-reading and corpus me pages unclassified', () => {
    const empty = { corpus: null, slug: null, chapter: null }
    expect(readingContext('/')).toEqual(empty)
    expect(readingContext('/about')).toEqual(empty)
    expect(readingContext('/fo/me')).toEqual(empty)
  })
})
