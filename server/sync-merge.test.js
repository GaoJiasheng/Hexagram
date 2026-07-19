import { describe, expect, it } from 'vitest'
import {
  mergeCollectionEntry,
  mergeDivinations,
  mergeProgress,
  mergeRecordMaps,
  mergeScalar,
} from './sync-merge.js'

const NOW = 1_800_000_000_000
const iso = (offset) => new Date(NOW + offset).toISOString()

describe('scalar sync merge', () => {
  it('uploads the client value on a first login with an empty cloud', () => {
    expect(mergeScalar(undefined, { value: { theme: 'dark' }, at: NOW - 100 }, NOW)).toEqual({
      value: { theme: 'dark' },
      at: NOW - 100,
    })
  })

  it('lets the numerically newer whole value win', () => {
    const cloud = { value: { theme: 'light' }, at: NOW - 200 }
    const client = { value: { theme: 'dark' }, at: NOW - 100 }
    expect(mergeScalar(cloud, client, NOW)).toEqual({ value: client.value, at: client.at })
    expect(mergeScalar({ ...cloud, at: NOW }, client, NOW)).toEqual({ ...cloud, at: NOW })
  })

  it('clamps a winning client timestamp to five minutes into the server future', () => {
    const result = mergeScalar(undefined, { value: 'moon', at: NOW + 60 * 60 * 1000 }, NOW)
    expect(result.at).toBe(NOW + 5 * 60 * 1000)
  })

  it('keeps the cloud entry unchanged when the client omitted the key', () => {
    const cloud = { value: { dao: 4 }, at: NOW - 10 }
    expect(mergeScalar(cloud, undefined, NOW)).toBe(cloud)
  })
})

describe('map collection sync merge', () => {
  it('unions non-conflicting additions from both devices', () => {
    const cloud = { 'ru:lunyu:1:0': { snippet: '学而', at: iso(-200) } }
    const client = { 'dao:daodejing:1:0': { snippet: '道可道', at: iso(-100) } }
    expect(mergeRecordMaps(cloud, client)).toEqual({ ...cloud, ...client })
  })

  it('uses the newer complete record rather than merging its fields', () => {
    const recordKey = 'ru:lunyu:1:0'
    const cloud = { [recordKey]: { text: '旧批注', snippet: '旧', at: iso(-200) } }
    const client = { [recordKey]: { text: '新批注', at: iso(-100) } }
    expect(mergeRecordMaps(cloud, client)[recordKey]).toEqual(client[recordKey])
    expect(mergeRecordMaps(cloud, client)[recordKey]).not.toHaveProperty('snippet')
  })

  it('lets a newer tombstone replace the whole live record and prevents resurrection', () => {
    const recordKey = '1'
    const live = { [recordKey]: { at: iso(-300) } }
    const tombstone = { [recordKey]: { deleted: true, at: iso(-100) } }
    const deletedCloud = mergeRecordMaps(live, tombstone)
    expect(deletedCloud).toEqual(tombstone)
    expect(mergeRecordMaps(deletedCloud, live)).toEqual(tombstone)
  })

  it('allows a deliberate newer recreation to replace an older tombstone', () => {
    const recordKey = '1'
    const tombstone = { [recordKey]: { deleted: true, at: iso(-200) } }
    const restored = { [recordKey]: { at: iso(-100) } }
    expect(mergeRecordMaps(tombstone, restored)).toEqual(restored)
  })

  it('wraps a submitted collection with the server time but preserves an omitted cloud entry', () => {
    const cloud = { value: { 1: { at: iso(-200) } }, at: NOW - 500 }
    const client = { value: { 2: { at: iso(-100) } }, at: NOW - 100 }
    expect(mergeCollectionEntry(cloud, client, NOW, mergeRecordMaps)).toEqual({
      value: { ...cloud.value, ...client.value },
      at: NOW,
    })
    expect(mergeCollectionEntry(cloud, undefined, NOW, mergeRecordMaps)).toBe(cloud)
  })
})

describe('divination sync merge', () => {
  it('unions by id, replaces a conflict wholesale, and sorts newest createdAt first', () => {
    const cloud = [
      { id: 1, gua: 1, note: 'cloud old', createdAt: iso(-300), at: iso(-300) },
      { id: 2, gua: 2, createdAt: iso(-200), at: iso(-200) },
    ]
    const client = [
      { id: 1, deleted: true, at: iso(-100) },
      { id: 3, gua: 3, createdAt: iso(-50), at: iso(-50) },
    ]
    const result = mergeDivinations(cloud, client)
    expect(result.map(({ id }) => id)).toEqual([3, 2, 1])
    expect(result.find(({ id }) => id === 1)).toEqual(client[0])
  })

  it('caps the total at 400 including tombstones and keeps newer createdAt records', () => {
    const cloud = Array.from({ length: 250 }, (_, index) => ({
      id: `cloud-${index}`,
      createdAt: iso(-10_000 - index),
      at: iso(-10_000 - index),
    }))
    const client = Array.from({ length: 250 }, (_, index) => index < 25
      ? { id: `deleted-${index}`, deleted: true, at: iso(-index) }
      : {
          id: `client-${index}`,
          createdAt: iso(-index),
          at: iso(-index),
        })
    const result = mergeDivinations(cloud, client)
    expect(result).toHaveLength(400)
    expect(result.some(({ id }) => id === 'client-249')).toBe(true)
    expect(result.some(({ id }) => id === 'cloud-249')).toBe(false)
  })

  it('counts tombstones toward the 400-record limit', () => {
    const live = Array.from({ length: 375 }, (_, index) => ({
      id: `live-${index}`,
      createdAt: iso(-index),
      at: iso(-index),
    }))
    const tombstones = Array.from({ length: 25 }, (_, index) => ({
      id: `deleted-${index}`,
      deleted: true,
      at: iso(-index),
    }))
    const result = mergeDivinations(live, tombstones)
    expect(result).toHaveLength(400)
    expect(result.filter(({ deleted }) => deleted === true)).toHaveLength(25)
  })
})

describe('progress sync merge', () => {
  it('unions read/used topics and preserves the earlier first-seen timestamp', () => {
    const cloud = {
      read: { bagong: iso(-500), meihua: iso(-300) },
      used: { dayan: iso(-200) },
      quiz: {},
    }
    const client = {
      read: { bagong: iso(-400), jinqian: iso(-100) },
      used: { dayan: iso(-600), meihua: iso(-50) },
      quiz: {},
    }
    const result = mergeProgress(cloud, client)
    expect(result.read).toEqual({
      bagong: iso(-500),
      meihua: iso(-300),
      jinqian: iso(-100),
    })
    expect(result.used).toEqual({ dayan: iso(-600), meihua: iso(-50) })
  })

  it('merges quiz history field by field and takes total from the newer score sheet', () => {
    const cloud = {
      read: {}, used: {},
      quiz: { guahua: { passed: true, best: 7, total: 8, at: iso(-300) } },
    }
    const client = {
      read: {}, used: {},
      quiz: { guahua: { passed: false, best: 9, total: 12, at: iso(-100) } },
    }
    expect(mergeProgress(cloud, client).quiz.guahua).toEqual({
      passed: true,
      best: 9,
      total: 12,
      at: iso(-100),
    })
  })

  it('keeps best/passed history while taking total from the newer cloud record', () => {
    const cloud = {
      read: {}, used: {},
      quiz: { guahua: { passed: false, best: 5, total: 6, at: iso(-50) } },
    }
    const client = {
      read: {}, used: {},
      quiz: { guahua: { passed: true, best: 4, total: 4, at: iso(-100) } },
    }
    expect(mergeProgress(cloud, client).quiz.guahua).toEqual({
      passed: true,
      best: 5,
      total: 6,
      at: iso(-50),
    })
  })
})
