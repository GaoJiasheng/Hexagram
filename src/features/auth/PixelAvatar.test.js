import { describe, expect, it } from 'vitest'
import { avatarPixels } from './PixelAvatar.jsx'

describe('PixelAvatar', () => {
  it('generates the same non-empty pattern for the same seed', () => {
    const first = avatarPixels('stable-avatar-seed')
    const second = avatarPixels('stable-avatar-seed')
    expect(first.length).toBeGreaterThan(0)
    expect(second).toEqual(first)
  })

  it('mirrors every non-centre pixel across the vertical axis', () => {
    const pixels = avatarPixels('mirror-avatar-seed')
    const coordinates = new Set(pixels.map(([x, y]) => `${x}:${y}`))
    for (const [x, y] of pixels) {
      expect(coordinates.has(`${4 - x}:${y}`)).toBe(true)
    }
  })
})
