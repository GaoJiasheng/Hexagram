import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import RuLineagePage from './RuLineagePage.jsx'
import LineageEntry from './LineageEntry.jsx'
import DATA from '../../data/ru-lineage.json'

const render = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>)

describe('儒门学脉图页', () => {
  const html = render(<RuLineagePage />)

  it('首屏出图:十三人全在,默认只亮师承骨架', () => {
    for (const n of DATA.nodes) expect(html).toContain(`>${n.label}</text>`)
    const paths = html.match(/class="topo-edge[^"]*"/g) || []
    expect(paths).toHaveLength(DATA.edges.filter((e) => e.type === 'lineage').length)
    expect(html).toContain('aria-pressed="true"')
  })

  it('线色走 token、存疑画点线,不写死 hex', () => {
    expect(html).toMatch(/stroke:var\(--ink-soft\)/)
    expect(html).toContain('stroke-dasharray="1.5 4"')
    const svg = html.slice(html.indexOf('<svg class="topo-svg"'), html.indexOf('</svg>', html.indexOf('<svg class="topo-svg"')))
    expect(svg).not.toMatch(/(fill|stroke)="#/)
  })

  it('页骨架:面包屑回两组、凡例、「此后」一格', () => {
    expect(html).toContain('href="/ru"')
    expect(html).toContain('href="/xin"')
    expect(html).toContain('凡例')
    expect(html).toContain(DATA.end.items[0].label)
  })

  it('两组首页的一行入口指向 /ru/lineage', () => {
    expect(render(<LineageEntry />)).toContain('href="/ru/lineage"')
  })
})
