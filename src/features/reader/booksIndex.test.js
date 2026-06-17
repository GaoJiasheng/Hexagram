import { describe, it, expect } from 'vitest'
import { ALL_BOOKS, bookByTitle, globalBookRefs } from './booksIndex.js'
import { linkifyBooks } from './linkifyBooks.jsx'

describe('booksIndex 全站书目索引(#139 底座)', () => {
  it('枚举全部 corpus 书 + 道藏 11 部 + 易经总目(≥56)', () => {
    expect(ALL_BOOKS.length).toBeGreaterThanOrEqual(56)
    expect(ALL_BOOKS.some((b) => b.corpus === 'yijing' && b.title === '易经')).toBe(true)
    expect(ALL_BOOKS.filter((b) => b.corpus === 'dao')).toHaveLength(11)
  })

  it('书名全站唯一(自动链的前提)', () => {
    const titles = ALL_BOOKS.map((b) => b.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('每条都有可解析的 href 与所属组', () => {
    for (const b of ALL_BOOKS) {
      expect(b.href).toMatch(/^\//)
      expect(b.group).toBeTruthy()
      if (b.corpus !== 'yijing') expect(b.href).toBe(`${corpusHome(b.corpus)}/${b.slug}`)
    }
  })

  it('bookByTitle 命中规范名与无歧义别名', () => {
    expect(bookByTitle('孟子')?.href).toBe('/ru/mengzi')
    expect(bookByTitle('韩非子')?.corpus).toBe('fa')
    expect(bookByTitle('老子')?.title).toBe('道德经') // 别名
    expect(bookByTitle('周易')?.href).toBe('/classics')
    expect(bookByTitle('查无此书')).toBeNull()
  })

  it('globalBookRefs 排除当前书(不自链),跨组可达对面书', () => {
    const refs = globalBookRefs({ excludeCorpus: 'fa', excludeSlug: 'hanfeizi' })
    expect(refs.some((r) => r.title === '韩非子')).toBe(false) // 当前书被排除
    expect(refs.find((r) => r.title === '孟子')?.to).toBe('/ru/mengzi') // 跨组到儒
    expect(refs.find((r) => r.title === '孙子兵法')?.to).toBe('/bing/sunzi')
  })

  it('战国策(选)括注被剥去,可在散文里匹配', () => {
    const refs = globalBookRefs({})
    expect(refs.some((r) => r.title === '战国策')).toBe(true)
    expect(refs.some((r) => r.title === '战国策（选）')).toBe(false)
  })

  it('linkify 在法家延伸里把「孟子」链到儒、且「大学问」不被「大学」截断', () => {
    const refs = globalBookRefs({ excludeCorpus: 'fa', excludeSlug: 'hanfeizi' })
    const nodes = linkifyBooks('与孟子论学异趣，又异于大学问', refs)
    const links = nodes.filter((n) => typeof n === 'object')
    const texts = links.map((l) => l.props.children)
    expect(texts).toContain('孟子')
    expect(texts).toContain('大学问') // 长名优先,非「大学」
    expect(links.find((l) => l.props.children === '孟子').props.to).toBe('/ru/mengzi')
  })
})

// 与 booksIndex.rec 同口径:corpus 站 home === '/' + corpus
function corpusHome(corpus) {
  return corpus === 'dao' ? '/dao' : `/${corpus}`
}
