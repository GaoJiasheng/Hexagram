import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ScriptureShelf, { EXPAND_MAX_BOOKS } from './ScriptureShelf.jsx'
import zongTexts from '../../data/zong/texts.json'
import xinTexts from '../../data/xin/texts.json'
import ruTexts from '../../data/ru/texts.json'
import foTexts from '../../data/fo/texts.json'
import { homePlan } from './ShelfHome.jsx'

const shelf = (corpus, texts, extra = {}) => renderToStaticMarkup(
  <MemoryRouter>
    <ScriptureShelf corpus={corpus} texts={texts} title="t" subtitle="s" basePath={`/${corpus}`} brand="b" {...extra} />
  </MemoryRouter>,
)

describe('书架首页:书少的组直接展开目录', () => {
  it('两本书的组(纵横)不出书架卡,每本书各一段展开版', () => {
    expect(zongTexts.length).toBeLessThanOrEqual(EXPAND_MAX_BOOKS)
    const html = shelf('zong', zongTexts)
    expect(html).not.toContain('class="dao-book"')
    expect(html.match(/book-home__book/g)).toHaveLength(zongTexts.length)
    expect(html).toContain('href="/zong/guiguzi"')
    expect(html).toContain('href="/zong/zhanguoce"')
    expect(html).toContain('《鬼谷子》目录')   // 章名异步载入前先出骨架,带书名的标题已在
    expect(html).toContain('《战国策（选）》目录')
  })
  it('短经(大学问)不列目录,只给「读全文」', () => {
    const html = shelf('xin', xinTexts)
    expect(html).toContain('读全文')
    expect(html.match(/book-home__toc/g)).toHaveLength(1)   // 只有传习录有目录段
  })
  it('书多、没排路径的组(佛)仍是书架卡;expand 可强制', () => {
    expect(foTexts.length).toBeGreaterThan(EXPAND_MAX_BOOKS)
    expect(homePlan('fo')).toBe(null)
    expect(shelf('fo', foTexts)).toContain('class="dao-book"')
    expect(shelf('fo', foTexts, { expand: true })).not.toContain('class="dao-book"')
    expect(shelf('zong', zongTexts, { expand: false })).toContain('class="dao-book"')
  })
  it('排了「从哪里读起」的组(儒)走新版首页:主线四步、全组的书都在、依据引导读原文', () => {
    const html = shelf('ru', ruTexts)
    expect(html).not.toContain('class="dao-book"')
    expect(html.match(/class="shelf-step"/g)).toHaveLength(4)
    for (const t of ruTexts) expect(html).toContain(`href="/ru/${t.slug}"`)
    expect(html).toContain('定其规模')
    expect(html).toContain('href="/ru/daxue/daodu"')
    expect(html).toContain('href="/ru/lineage"')   // 学脉图进了「门道」行
  })
})
