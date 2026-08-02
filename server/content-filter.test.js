import { describe, expect, it } from 'vitest'
import { screenComment } from './content-filter.js'

describe('评论内容过滤', () => {
  it('拦得住辱骂 / 色情 / 广告', () => {
    expect(screenComment('你这个傻逼')?.kind).toBe('abuse')
    expect(screenComment('约炮加我')?.kind).toBe('porn')
    expect(screenComment('兼职日结,月入过万')?.kind).toBe('spam')
  })

  it('简单绕过也拦得住(空格 / 星号 / 标点)', () => {
    expect(screenComment('傻 逼')).not.toBeNull()
    expect(screenComment('傻*逼')).not.toBeNull()
    expect(screenComment('加、微、信')).not.toBeNull()
  })

  // 这一组才是真正要守的:这是个国学站,经文与讨论里天然有「杀」「死」「淫」这些字。
  // 词表一旦按单字命中,正常研读会被大面积误伤 —— 所以只收多字串。
  it('不误伤经义讨论', () => {
    const ok = [
      '《墨子》说「杀盗人非杀人」,这里的推论要看《小取》',
      '「郑声淫」的「淫」是过度,不是今天的意思',
      '爻辞「龙战于野,其血玄黄」讲的是阴阳交争',
      '《韩非子》主张严刑峻法,但那是要警惕的一面',
      '孟子骂杨墨「无父无君,是禽兽也」,这是当时的论战修辞',
      '《商君书》讲弱民,把人当工具,这一点要点破',
      '死生亦大矣 —— 庄子这句常被误读',
    ]
    for (const text of ok) expect(screenComment(text), text).toBeNull()
  })

  it('空值不报错', () => {
    expect(screenComment('')).toBeNull()
    expect(screenComment(null)).toBeNull()
    expect(screenComment(undefined)).toBeNull()
  })
})
