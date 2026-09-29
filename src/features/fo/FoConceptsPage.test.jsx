import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import FoConceptsPage from './FoConceptsPage.jsx'
import RingChart from '../shared/widgets/RingChart.jsx'
import concepts from '../../data/fo/concepts.json'
import rings from '../../data/fo/rings.json'

const html = (el) => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>)

describe('释典名相索引页', () => {
  it('两件环 + 全部名相 + 凡例,无劝信果报用字', () => {
    const out = html(<FoConceptsPage />)
    expect(out.match(/class="ring"/g)).toHaveLength(2)
    expect(out.match(/class="mc-item foc-item"/g)).toHaveLength(concepts.clusters.length)
    expect(out).toContain('名相索引')
    expect(out).toContain('凡例')
    expect(out).toMatch(/href="\/fo\/xinjing#fo-ch-1"/)            // 单页短经走锚点
    expect(out).toMatch(/href="\/fo\/tanjing\/2"/)                  // 分章经走章路由
    expect(out).not.toMatch(/必得|往生|消业|福报|灭罪/)
  })
  it('十二因缘环 12 节点、带箭头;预选「爱」出释义与出处链接', () => {
    const r = rings.rings.find((x) => x.id === 'shieryinyuan')
    const ai = r.items.findIndex((it) => it.label === '爱')
    const items = r.items.map((it) => ({ label: it.label, note: it.note, ...(it.src ? { quote: it.src.quote, cite: it.src.label, href: `/fo/${it.src.slug}/${it.src.ch}` } : {}) }))
    const out = html(<RingChart items={items} center="十二因缘" arrows loop={false} focus={ai} />)
    expect(out.match(/class="ring-node[ "]/g)).toHaveLength(12)
    expect(out.match(/class="ring-arc[ "]/g)).toHaveLength(12)
    expect(out).toContain('ring-arc--open')                          // 老死 → 无明 一段为虚线
    expect(out).toContain('从痴有爱则我病生')
    expect(out).toContain('href="/fo/weimojie/5"')
    expect(out).toMatch(/取<\/span>/)                                // 前后项:受 → 爱 → 取
  })
})
