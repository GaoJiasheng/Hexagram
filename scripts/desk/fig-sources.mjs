// 观象 · 书桌 —— 图解转换管线共用:每本书的白话图都出自站内哪些白话文件,以及从里面收图。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { figKey } from './fig-gate.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// 书 id → 站内白话文件(corpus/slug,对应 src/data/<corpus>/baihua/<slug>.json)
export const FIG_SOURCES = {
  daodejing: ['dao/daodejing'],
  lunyu: ['ru/lunyu'],
  sunzi: ['bing/sunzi'],
  guiguzi: ['zong/guiguzi'],
  zhuangzi: ['dao/zhuangzi-neipian', 'dao/zhuangzi-waipian', 'dao/zhuangzi-zapian'],
  yijing: ['yijing/hexagrams', 'yijing/xici-shang', 'yijing/xici-xia', 'yijing/shuogua', 'yijing/xugua', 'yijing/zagua'],
}

export const figsFile = (book) => path.join(ROOT, 'scripts/authored/desk-figs', `${book}.json`)
export const workDir = (book) => path.join(ROOT, 'scripts/.desk-figs', book)
export const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d)

// 收这本书的全部图:[{key, src, chapter, ftype, caption, svg}](不去重,按文件、章序)
export function collectFigs(book) {
  if (!FIG_SOURCES[book]) throw new Error(`不认识的书 ${book}(可选:${Object.keys(FIG_SOURCES).join(' / ')})`)
  const out = []
  for (const src of FIG_SOURCES[book]) {
    const [corpus, slug] = src.split('/')
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))
    for (const ch of Object.keys(j).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
      for (const b of j[ch]?.blocks || []) if (b.type === 'figure' && b.svg) out.push({ key: figKey(b.svg), src, chapter: ch, ftype: b.ftype, caption: b.caption || '', svg: b.svg })
    }
  }
  return out
}
