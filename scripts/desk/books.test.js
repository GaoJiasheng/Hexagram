// 书桌官方书单(scripts/desk/books.mjs)与内容包清单的闸。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { DESK_BOOKS, CATEGORIES, themeOfGroup } from './books.mjs'
import { FIG_SOURCES } from './fig-sources.mjs'
import { checkManifest, OUT, FIRST_SIX } from './check-desk-packs.mjs'

describe('书桌书单', () => {
  it('id 不重、形态合法', () => {
    const ids = DESK_BOOKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })
  it('首发六本照旧在前、随 App 带,拼法不变', () => {
    expect(DESK_BOOKS.slice(0, 6).map((b) => b.id)).toEqual(FIRST_SIX)
    expect(DESK_BOOKS.filter((b) => b.bundled).map((b) => b.id)).toEqual(FIRST_SIX)
    const z = DESK_BOOKS.find((b) => b.id === 'zhuangzi')
    expect(z.sources.map((s) => s[1])).toEqual(['zhuangzi-neipian', 'zhuangzi-waipian', 'zhuangzi-zapian'])
    expect(DESK_BOOKS.find((b) => b.id === 'daodejing').theme).toEqual({ accent: '#2E7D86', accent2: '#C7673F', paper: '#F7F5EE' })
  })
  it('每本都有门类,门类在次序表里;站内每部书只出现一次', () => {
    for (const b of DESK_BOOKS) expect(CATEGORIES).toContain(b.category)
    const slugs = DESK_BOOKS.flatMap((b) => (b.sources || []).map((s) => `${s[0]}/${s[1]}`))
    expect(new Set(slugs).size).toBe(slugs.length)
  })
  it('主题色是 6 位十六进制', () => {
    for (const b of DESK_BOOKS) for (const v of Object.values(b.theme)) expect(v).toMatch(/^#[0-9A-F]{6}$/i)
    expect(themeOfGroup('fo').accent).toBe('#9C7B4D')
  })
  it('图解来源表覆盖全部书', () => {
    for (const b of DESK_BOOKS) expect(Array.isArray(FIG_SOURCES[b.id])).toBe(true)
    expect(FIG_SOURCES.zhuangzi).toEqual(['dao/zhuangzi-neipian', 'dao/zhuangzi-waipian', 'dao/zhuangzi-zapian'])
    expect(FIG_SOURCES.shijing).toEqual(['ru/shijing'])
  })
})

// 打包产物不入库:本机打过包才核
describe.skipIf(!fs.existsSync(`${OUT}/manifest.json`))('书桌内容包清单', () => {
  it('文件都在、id 不重、随 App 带的是首发六本', () => {
    expect(checkManifest(OUT, { strictList: false })).toEqual([])
  })
})
