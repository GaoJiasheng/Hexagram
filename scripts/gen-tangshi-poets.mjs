// 唐诗「体裁 × 诗人」矩阵的数据(design-v24 §14)。**从底本派生,不手填**:
//   诗人 —— 维基文库每首诗页的 {{header | author = 某某}},取自抓取缓存 scripts/.cache/wikisource.json(与原文同源同批)
//   位置 —— 站内 tangshi300.json 七章(一体裁一章),诗题段「《题》」按序与目录页 _poetry-lists.json 的页名对齐
// 输出 src/data/tangshi/tangshi-poets.json:{ groups:[{ch,title,n}], poets:[{name, n, poems:[{ch, para, title}]}] }
// 重跑:node scripts/gen-tangshi-poets.mjs;check-data 的 check-tangshi-poets 闸回查每首的 (ch,para) 确是诗题段。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { t2s } from './lib/wikisource.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SRC = 'src/data/tangshi/classics/tangshi300.json'
export const OUT = 'src/data/tangshi/tangshi-poets.json'
const CACHE = 'scripts/.cache/wikisource.json'
const PL = createRequire(import.meta.url)('./corpus/_poetry-lists.json')

// 页面 header 里的作者:| author = 元結 / | author = [[Author:杜甫|杜甫]] 两种写法都见过
function authorOf(wikitext) {
  // 多行 header(| author   = 杜甫)与单行 header({{header | times = 唐 | author = 韓愈|from2=…}})两种写法都见过
  const m = /\|\s*author\s*=\s*([^|}\n]+)/.exec(wikitext || '')
  if (!m) return null
  let a = m[1].replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').trim()
  a = a.split(/[、,，/／]/)[0].trim()
  return a ? t2s(a) : null
}

export function derive(book, cache) {
  const groups = PL.tangshi.groups
  const poets = new Map()
  const problems = []
  const chapters = []
  groups.forEach((g, gi) => {
    const ch = book.chapters.find((c) => c.no === gi + 1)
    if (!ch) { problems.push(`第 ${gi + 1} 章不存在`); return }
    const heads = []
    ch.paragraphs.forEach((p, i) => { if (/^《.+》$/.test(p.original)) heads.push({ para: i, title: p.original.slice(1, -1) }) })
    const pages = g.pages.map((p) => (typeof p === 'string' ? p : p.page))
    if (heads.length !== pages.length) problems.push(`第 ${gi + 1} 章诗题 ${heads.length} 首 ≠ 目录页 ${pages.length} 首`)
    chapters.push({ ch: ch.no, title: ch.title, n: heads.length })
    heads.forEach((h, k) => {
      const page = pages[k]
      if (page === undefined) return
      if (t2s(page) !== h.title && t2s(page.split('/').pop()) !== h.title) problems.push(`第 ${gi + 1} 章第 ${k + 1} 首「${h.title}」与目录页「${t2s(page)}」不对应`)
      const raw = cache[page]
      const text = typeof raw === 'string' ? raw : raw?.wikitext || raw?.text || (raw ? JSON.stringify(raw) : '')
      const name = authorOf(text)
      if (!name) { problems.push(`「${h.title}」页无 author`); return }
      if (!poets.has(name)) poets.set(name, { name, n: 0, poems: [] })
      const rec = poets.get(name)
      rec.n++
      rec.poems.push({ ch: ch.no, para: h.para, title: h.title })
    })
  })
  const list = [...poets.values()].sort((a, b) => b.n - a.n || a.poems[0].ch - b.poems[0].ch || a.poems[0].para - b.poems[0].para)
  return { book: 'tangshi300', source: SRC, groups: chapters, poets: list, problems }
}

function main() {
  const book = JSON.parse(readFileSync(join(ROOT, SRC), 'utf8'))
  const cache = JSON.parse(readFileSync(join(ROOT, CACHE), 'utf8'))
  const out = derive(book, cache)
  if (out.problems.length) { console.error(out.problems.join('\n')); process.exit(1) }
  const { problems, ...data } = out
  writeFileSync(join(ROOT, OUT), JSON.stringify(data, null, 2) + '\n')
  const total = data.poets.reduce((n, p) => n + p.n, 0)
  console.log(`${OUT}: ${data.poets.length} 家 · ${total} 首 · ${data.groups.map((g) => `${g.title} ${g.n}`).join(' / ')}`)
  console.log(data.poets.slice(0, 12).map((p) => `${p.name} ${p.n}`).join(' · '))
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
