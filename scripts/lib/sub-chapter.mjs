// 「组-序」子章(细粒度白话:一章太长、一篇一篇写)的段落切片——三处共用一份规则:
//   gen-baihua-wf(出单元)· assemble-baihua(装配核引文)· check-baihua-draft(代理自查)。check-data 里 chapterText 的同名逻辑与此一致。
// 键 `${章号}-${序}`:先查 texts.json 该书的 pieces(人工策展区间 {key,ch,from,to,title},from 含 to 不含、下标 0 起),
// 没有 pieces 再退回《诗题》识别(独立成段的 `《X》` 为一首之首,第 N 个诗题起到下一诗题前)。
import fs from 'node:fs'
import path from 'node:path'

export const isSubKey = (key) => /^\d+-\d+$/.test(String(key))

export function bookPieces(ROOT, corpus, slug) {
  const f = path.join(ROOT, `src/data/${corpus}/texts.json`)
  if (!fs.existsSync(f)) return null
  return JSON.parse(fs.readFileSync(f, 'utf8')).find((b) => b.slug === slug)?.pieces || null
}

// 返回 { chapter, from, to, paragraphs, title } 或 null(键不合法 / 章不存在 / 没有那一篇)
export function subChapter(ROOT, corpus, slug, book, key) {
  const m = /^(\d+)-(\d+)$/.exec(String(key))
  if (!m) return null
  const chapter = book.chapters.find((x) => x.no === Number(m[1]))
  if (!chapter) return null
  const piece = bookPieces(ROOT, corpus, slug)?.find((x) => x.key === String(key))
  if (piece) return { chapter, from: piece.from, to: piece.to, paragraphs: chapter.paragraphs.slice(piece.from, piece.to), title: piece.title }
  const isTitle = (p) => /^《[^》]+》$/.test(p.original.trim())
  const heads = chapter.paragraphs.map((p, i) => (isTitle(p) ? i : -1)).filter((i) => i >= 0)
  const start = heads[Number(m[2]) - 1]
  if (start === undefined) return null
  const end = heads[Number(m[2])] ?? chapter.paragraphs.length
  return { chapter, from: start, to: end, paragraphs: chapter.paragraphs.slice(start, end), title: chapter.paragraphs[start].original.trim().replace(/^《|》$/g, '') }
}
