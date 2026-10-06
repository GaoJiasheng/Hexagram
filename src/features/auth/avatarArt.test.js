import { describe, expect, it } from 'vitest'
import { AVATAR_SEED_RE, artForSeed, randomArtSeed } from './avatarArt.js'
import { markForSeed } from './SchoolAvatar.jsx'

describe('avatarArt', () => {
  it('同一种子画出同一张图', () => {
    expect(artForSeed('g:abc123xyz')).toEqual(artForSeed('g:abc123xyz'))
  })
  it('随机种子合乎服务端形态', () => {
    for (let i = 0; i < 50; i += 1) expect(AVATAR_SEED_RE.test(randomArtSeed())).toBe(true)
  })
  it('拒收上传式 / 超长 / 怪字符种子', () => {
    for (const bad of ['', 'g:', 'g:ABC123', 'data:image/png;base64,xx', 'http://x', `g:${'a'.repeat(30)}`, 'm:Yi-jing']) {
      expect(AVATAR_SEED_RE.test(bad)).toBe(false)
    }
  })
  it('一批图案彼此有差别', () => {
    const shapes = new Set(Array.from({ length: 30 }, () => JSON.stringify(artForSeed(randomArtSeed()))))
    expect(shapes.size).toBeGreaterThan(25)
  })
  it('m: 指定印记,老 UUID 种子照旧散列', () => {
    expect(markForSeed('m:dao').key).toBe('dao')
    expect(markForSeed('m:nosuch').key).toBe(markForSeed('m:nosuch').key)
    expect(markForSeed('seed-1')).toBe(markForSeed('seed-1'))
  })
})
