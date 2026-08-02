import { describe, expect, it } from 'vitest'
import { AVATAR_MARKS, markForSeed } from './SchoolAvatar.jsx'

describe('流派印记头像', () => {
  it('同一个 seed 永远给同一枚', () => {
    for (const seed of ['a', 'b-c-d', '00000000-1111-2222-3333-444444444444']) {
      expect(markForSeed(seed).key).toBe(markForSeed(seed).key)
    }
  })

  it('分布铺得开(不是永远同一枚)', () => {
    const keys = new Set()
    for (let i = 0; i < 300; i += 1) keys.add(markForSeed(`seed-${i}`).key)
    expect(keys.size).toBe(AVATAR_MARKS.length)
  })

  // 头像最小 24px,笔画一多就糊;而且写死颜色会在暗色主题下瞎。
  it('每枚都只用线条几何,颜色走 CSS 变量', () => {
    for (const mark of AVATAR_MARKS) {
      expect(mark.accent, mark.key).toMatch(/^[a-z-]+$/)
      expect(mark.label, mark.key).toBeTruthy()
      const strokes = (mark.paths?.length || 0) + (mark.circles?.length || 0) + (mark.rects?.length || 0)
      expect(strokes, `${mark.key} 无笔画`).toBeGreaterThan(0)
      expect(strokes, `${mark.key} 笔画过多,小尺寸会糊`).toBeLessThanOrEqual(4)
      expect(JSON.stringify(mark), `${mark.key} 写死了颜色`).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    }
  })
})
