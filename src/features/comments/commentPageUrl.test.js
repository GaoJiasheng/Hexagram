import { describe, expect, it } from 'vitest'
import { commentPageUrl } from './commentPageUrl.js'

describe('frontend comment page URL', () => {
  it.each([
    ['books', 'zizhi-tongjian', 'home', 'https://hexa.gavin.pub/books/zizhi-tongjian'],
    ['yijing', 'xici', '2', 'https://hexa.gavin.pub/classics/xici/2'],
    ['dao', 'daodejing', '37', 'https://hexa.gavin.pub/dao/daodejing/37'],
    ['ru', 'lunyu', '1', 'https://hexa.gavin.pub/ru/lunyu/1'],
  ])('maps %s comments to their public page', (corpus, slug, chapter, expected) => {
    expect(commentPageUrl(corpus, slug, chapter)).toBe(expected)
  })
})
