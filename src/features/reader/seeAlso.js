import concepts from '../../data/concepts.json'
import { bookBySlug, chapterHref } from './booksIndex.js'

// 义理互见(#141/B2)——给定某书某章,若它是某概念聚类的代表章,返回同聚类「其他书」的代表章。
// 数据 src/data/concepts.json(grep 验证的跨派概念→章节)。与「桥」(道藏→易经卦)同精神:
// 显式、人工策展、只在经典互指处给跳转,不作泛滥自动链。链接经 booksIndex 解析(含短经单页锚)。

// 返回 [{ term, gloss, items: [{ to, label }] }];当前章不入 items(不自链)。无则空数组。
export function seeAlsoFor(corpus, slug, ch) {
  const n = String(ch)
  const out = []
  for (const cluster of concepts.clusters) {
    const inThis = cluster.loci.some((l) => l.corpus === corpus && l.slug === slug && String(l.ch) === n)
    if (!inThis) continue
    const items = cluster.loci
      .filter((l) => !(l.corpus === corpus && l.slug === slug && String(l.ch) === n))
      .map((l) => {
        const book = bookBySlug(l.slug)
        return book ? { to: chapterHref(book, l.ch), label: l.label } : null
      })
      .filter(Boolean)
    if (items.length) out.push({ term: cluster.term, gloss: cluster.gloss, items })
  }
  return out
}
