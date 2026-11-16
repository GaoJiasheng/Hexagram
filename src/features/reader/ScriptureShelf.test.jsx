import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ScriptureShelf, { EXPAND_MAX_BOOKS } from './ScriptureShelf.jsx'
import zongTexts from '../../data/zong/texts.json'
import xinTexts from '../../data/xin/texts.json'
import ruTexts from '../../data/ru/texts.json'
import foTexts from '../../data/fo/texts.json'
import bingTexts from '../../data/bing/texts.json'
import faTexts from '../../data/fa/texts.json'
import zhongyiTexts from '../../data/zhongyi/texts.json'
import moulueTexts from '../../data/moulue/texts.json'
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
    // 目录之前有「这一家的门道」一行(七国图进了这一行);没有阅读记录时不出「接着读」
    expect(html).toContain('shelf-sec--compact')
    expect(html).toContain('href="/zong/zhanguoce/map"')
    expect(html).not.toContain('shelf-resume')
  })
  it('短经(大学问)不列目录,只给「读全文」', () => {
    const html = shelf('xin', xinTexts)
    expect(html).toContain('读全文')
    expect(html.match(/book-home__toc/g)).toHaveLength(1)   // 只有传习录有目录段
  })
  it('没排路径时仍是书架卡;expand 可强制', () => {
    expect(foTexts.length).toBeGreaterThan(EXPAND_MAX_BOOKS)
    expect(shelf('fo', foTexts, { expand: true })).not.toContain('class="dao-book"')
    expect(shelf('zong', zongTexts, { expand: false })).toContain('class="dao-book"')
    expect(shelf(undefined, foTexts)).toContain('class="dao-book"')   // 不传 corpus = 老用法,平铺书架
  })
  it('佛 / 兵 / 法 / 中医都排了主线:全组的书都在,次序标「本站建议」', () => {
    for (const [corpus, texts] of [['fo', foTexts], ['bing', bingTexts], ['fa', faTexts], ['zhongyi', zhongyiTexts]]) {
      const plan = homePlan(corpus)
      const html = shelf(corpus, texts)
      expect(html).not.toContain('class="dao-book"')
      expect(html.match(/class="shelf-step"/g)).toHaveLength(plan.main.length)
      for (const t of texts) expect(html).toContain(`href="/${corpus}/${t.slug}"`)
      expect(html).toContain('本站建议')
      expect(html).toContain(plan.basis.note)
    }
  })
  it('谋略不排次序:没有主线,真书与托名伪书分两区,伪书卡带「托名」', () => {
    const html = shelf('moulue', moulueTexts)
    expect(html).not.toContain('class="shelf-step"')
    expect(html.match(/class="shelf-zone /g)).toHaveLength(2)
    expect(html.match(/shelf-zone--dubious/g)).toHaveLength(1)
    const [real, fake] = html.split('shelf-zone--dubious')
    for (const t of moulueTexts) {
      expect(html).toContain(`href="/moulue/${t.slug}"`)
      expect((t.dubious ? fake : real)).toContain(`href="/moulue/${t.slug}"`)
    }
    expect(fake.match(/shelf-mini__dubious/g)).toHaveLength(moulueTexts.filter((t) => t.dubious).length)
    expect(real).not.toContain('shelf-mini__dubious')
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
