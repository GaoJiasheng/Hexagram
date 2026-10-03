import { describe, expect, it } from 'vitest'
import { makeSnippet } from './globalSearch.js'

const DDJ28 = '知其雄，守其雌，为天下谿。为天下谿，常德不离，复归于婴儿。\n知其白，守其黑，为天下式。\n为天下式，常德不忒，'

describe('搜索结果原文预览', () => {
  it('查询带标点:命中整句并标出原文里那一段', () => {
    const s = makeSnippet(DDJ28, '知其白，守其黑')
    expect(s.match).toBe('知其白，守其黑')
    expect(s.before.endsWith('婴儿。\n')).toBe(true)
  })
  it('查询不带标点也能对上带标点的原文', () => {
    expect(makeSnippet(DDJ28, '知其白守其黑').match).toBe('知其白，守其黑')
  })
  it('整句不在,退到第一个命中的二字组合', () => {
    expect(makeSnippet(DDJ28, '守其黑白').match).toBe('守其')
  })
  it('长文截断两头加省略号;无命中给开头', () => {
    const long = '甲'.repeat(100) + '知其白' + '乙'.repeat(100)
    const s = makeSnippet(long, '知其白')
    expect(s.before.startsWith('…')).toBe(true)
    expect(s.after.endsWith('…')).toBe(true)
    expect(makeSnippet(long, '丙丁').match).toBe('')
    expect(makeSnippet('', '知其')).toBeNull()
  })
  it('一段一项的数组:交回命中所在段下标', () => {
    const paras = ['知其雄，守其雌，为天下谿。', '为天下谿，常德不离。', '知其白，守其黑，为天下式。']
    const s = makeSnippet(paras, '知其白守其黑')
    expect(s.seg).toBe(2)
    expect(s.match).toBe('知其白，守其黑')
    expect(makeSnippet('知其白', '知其').seg).toBeUndefined()
  })
})
