import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ZhanguoceMapPage from './ZhanguoceMapPage.jsx'

const render = (url) => renderToStaticMarkup(
  <MemoryRouter initialEntries={[url]}><ZhanguoceMapPage /></MemoryRouter>,
)

describe('ZhanguoceMapPage', () => {
  it('渲染地图、时间轴、十八篇推定表与凡例', () => {
    const html = render('/zong/zhanguoce/map')
    expect(html).toContain('七国图 · 合纵连横时间轴')
    expect((html.match(/class="zgm-state[ "]/g) || []).length).toBe(8)
    expect((html.match(/class="zgm-bar/g) || []).length).toBe(18)
    expect((html.match(/class="zgm-item /g) || []).length).toBe(18)
    expect(html).toContain('href="/zong/zhanguoce/18"')
    expect(html).toContain('示意图,非考古地图')
    expect(html).toContain('年代为推定')
    expect(html).not.toMatch(/fill="var\(/)   // SVG 着色只走 style
  })

  it('?s=zhou 只列第一篇;?v=heng 出连横说明与《五蠹》界定', () => {
    const one = render('/zong/zhanguoce/map?s=zhou')
    expect((one.match(/class="zgm-item /g) || []).length).toBe(1)
    const heng = render('/zong/zhanguoce/map?v=heng')
    expect(heng).toContain('zgm-axis--heng')
    expect(heng).toContain('href="/fa/hanfeizi/49"')
    expect((heng.match(/class="zgm-axis-line"/g) || []).length).toBe(6)
  })
})
