import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ZhuangziFablesPage from './ZhuangziFablesPage.jsx'
import data from '../../../data/dao/zhuangzi-fables.json'

const html = () => renderToStaticMarkup(<MemoryRouter initialEntries={['/dao/zhuangzi/fables']}><ZhuangziFablesPage /></MemoryRouter>)

describe('庄子寓言索引页', () => {
  const out = html()
  it('三部分节、每则一张卡、成语速查与凡例都在', () => {
    expect(out.match(/<section[^>]*class="zf-book"/g)).toHaveLength(3)
    expect(out.match(/<article[^>]*class="zf-card"/g)).toHaveLength(data.fables.length)
    expect(out).toContain('成语速查')
    expect(out).toContain('凡例')
    for (const h of ['庄子内篇', '庄子外篇', '庄子杂篇']) expect(out).toContain(h)
  })
  it('「读原文 →」落到该篇该段', () => {
    const pd = data.fables.find((f) => f.id === 'paoding')
    expect(out).toContain(`href="/dao/zhuangzi-neipian/3#p${pd.para + 1}"`)
    const fy = data.fables.find((f) => f.id === 'fuyu')
    expect(out).toContain(`href="/dao/zhuangzi-zapian/4#p${fy.para + 1}"`)
  })
  it('每条成语出一个 pill,后人概括的带标签;速查云先露 24 条、可展开全部', () => {
    const n = data.fables.reduce((s, f) => s + (f.chengyu?.length || 0), 0)
    const later = data.fables.reduce((s, f) => s + (f.chengyu || []).filter((c) => c.later).length, 0)
    expect(out.match(/<button[^>]*class="zf-pill/g)).toHaveLength(n)
    expect(out.match(/class="zf-pill__tag"/g)).toHaveLength(later)
    expect(out.match(/<a[^>]*class="zf-chip/g)).toHaveLength(Math.min(24, n))
    expect(out).toContain(`展开全部 ${n} 条`)
    const first = data.fables.find((f) => f.chengyu)
    expect(out).toContain(`href="#f-${first.id}"`)
  })
  it('不宣化、不下断语', () => {
    expect(out).not.toMatch(/成仙|飞升|修炼|炼丹|内丹|火候|吉凶|福报|保佑|灵验/)
  })
})
