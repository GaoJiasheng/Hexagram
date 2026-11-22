// 观象 · 书桌 —— 图解转换管线共用:每本书的白话图都出自站内哪些白话文件,以及从里面收图。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { figKey } from './fig-gate.mjs'
import { DESK_BOOKS, baihuaSources } from './books.mjs'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// 书 id → 站内白话文件(corpus/slug,对应 src/data/<corpus>/baihua/<slug>.json):书单在 books.mjs,这里只留有白话文件的
export const FIG_SOURCES = {
  ...Object.fromEntries(DESK_BOOKS.map((b) => [b.id, baihuaSources(b).filter((s) => fs.existsSync(path.join(ROOT, `src/data/${s}`.replace(/\/([^/]+)$/, '/baihua/$1.json'))))])),
  books: [],   // 观书 153 本(collectFigs 里单独走 src/data/books)
}

export const figsFile = (book) => path.join(ROOT, 'scripts/authored/desk-figs', `${book}.json`)
export const workDir = (book) => path.join(ROOT, 'scripts/.desk-figs', book)
export const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d)

// 收这本书的全部图:[{key, src, chapter, ftype, caption, svg}](不去重,按文件、章序)
export function collectFigs(book) {
  // 观书(src/data/books/<slug>/overview.json 与 articles/*.json):一个「书」名下收全部 153 本的图,给书房的书包用
  if (book === 'books') {
    const out = []
    const dir = path.join(ROOT, 'src/data/books')
    for (const slug of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
      const files = [['overview', path.join(dir, slug, 'overview.json')]]
      const ad = path.join(dir, slug, 'articles')
      if (fs.existsSync(ad)) for (const f of fs.readdirSync(ad).filter((x) => x.endsWith('.json')).sort((x, y) => x.localeCompare(y, 'en', { numeric: true }))) files.push([f.replace('.json', ''), path.join(ad, f)])
      for (const [ch, f] of files) {
        if (!fs.existsSync(f)) continue
        for (const b of JSON.parse(fs.readFileSync(f, 'utf8')).blocks || []) if (b.type === 'figure' && b.svg) out.push({ key: figKey(b.svg), src: `books/${slug}`, chapter: ch, ftype: b.ftype, caption: b.caption || '', svg: b.svg })
      }
    }
    return out
  }
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
