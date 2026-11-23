// 观象 · 书桌 —— 插画 prompt 预备的两套书:guanshu(观书书库)/ classics(古籍)。
// 取材料、brief、缓存目录都走两个出图脚本自己的函数(它们被 import 时不跑命令行),这里不重写一遍。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as GS from './gen-art-guanshu.mjs'
import * as GA from './gen-art.mjs'
import { chosenOf } from './art-prompts-rules.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const PROMPTS = path.join(ROOT, 'scripts/.cache/desk-art/prompts')
if (GS.STYLE !== GA.STYLE) throw new Error('两个出图脚本的画风句不一致')
export const STYLE = GS.STYLE

const headJobs = (chapters) => chapters.map((ch) => ({ kind: 'head', ch, stem: `head-${ch.n}` }))
const coverJobs = [{ kind: 'cover', stem: 'cover' }, { kind: 'banner', stem: 'banner' }]

export const SETS = {
  guanshu: {
    books: () => GS.INDEX.map((m) => m.slug),
    load: GS.loadBook,
    dir: (id) => path.join(GS.CACHE, id),
    title: (bk) => bk.meta.title,
    category: (bk) => ((bk.meta.tags || []).includes('健康') ? 'health' : ''),
    jobs: (bk) => [...coverJobs, ...headJobs(bk.chapters)],
    brief: GS.briefFor,
  },
  classics: {
    books: () => Object.keys(GA.BOOKS),
    load: GA.loadBook,
    dir: (id) => path.join(GA.CACHE, id),
    title: (bk) => bk.title,
    category: (bk) => (bk.id === 'yijing' ? '易' : GA.categoryOf(bk.id)),
    jobs: (bk) => [...coverJobs, ...headJobs(bk.chapters)],
    brief: GA.briefFor,
  },
}

export function setOf(name) {
  const s = SETS[name]
  if (!s) throw new Error(`未知套:${name}(可选 guanshu / classics)`)
  return s
}

export const has = (dir, stem, ext) => fs.existsSync(path.join(dir, `${stem}${ext}`))

// 本书已出的图(png 在)的 CHOSEN 句
export function usedOf(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const f of fs.readdirSync(dir).filter((f) => /^(cover|banner|head-\d+)\.txt$/.test(f)).sort()) {
    const stem = f.slice(0, -4)
    if (!has(dir, stem, '.png')) continue
    const c = chosenOf(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (c) out.push(`${stem}: ${c.length > 300 ? c.slice(0, 300) + '…' : c}`)
  }
  return out
}

export const unitId = (i) => 'u' + String(i + 1).padStart(3, '0')
export const setDir = (set) => path.join(PROMPTS, set)
