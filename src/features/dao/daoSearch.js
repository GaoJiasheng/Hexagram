// 道藏全站检索(批D)——补齐与读经类站一致的站内搜索(此前 dao 独缺)。
// 与 corpusSearch 同构,但走 dao 自己的装载器(data.js / daoAnchored / yanyi.json)。
// 链接:singlePage 短经 → /dao/<slug>#dao-ch-<章>(命中定位);分章经 → /dao/<slug>/<章>。
import { DAO_TEXTS, loadDaoText } from './data.js'
import { getDaoAnchors } from './daoAnchored.js'
import yanyi from '../../data/dao/yanyi.json'

const GROUP_CAP = 6

function snippet(text, q, ctx = 12) {
  const i = text.indexOf(q)
  if (i === -1) return text.slice(0, 28)
  const s = Math.max(0, i - ctx)
  const e = Math.min(text.length, i + q.length + ctx)
  return (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '')
}

let cache = null   // { paras, notes, yy }

/** 懒建索引:载入全部非 pending 道藏经的章节正文 + 译文 + 注疏 + 延伸。 */
export async function ensureDaoIndexed() {
  if (cache) return
  const metas = DAO_TEXTS.filter((t) => t.status !== 'pending')
  const paras = [], notes = [], yy = []
  await Promise.all(metas.map(async (m) => {
    const book = await loadDaoText(m.slug)
    if (!book) return
    for (const c of book.chapters) {
      c.paragraphs.forEach((p, i) => {
        paras.push({ slug: m.slug, title: m.title, ch: c.no, original: p.original, translation: p.translation || '' })
        const ents = getDaoAnchors(m.slug, c.no, i)
        if (ents) for (const e of ents) notes.push({ slug: m.slug, title: m.title, ch: c.no, term: e.term, note: e.note || '' })
      })
      const yList = yanyi[m.slug]?.[String(c.no)]
      if (yList) yList.forEach((t) => yy.push({ slug: m.slug, title: m.title, ch: c.no, text: t }))
    }
  }))
  cache = { paras, notes, yy }
}

/** 查询,返回分组结果 [{key,label,items:[{id,label,sub,to}]}]。索引未建好时只返回经名组。 */
export function searchDao(query) {
  const q = (query || '').trim()
  if (!q) return []
  const sp = Object.fromEntries(DAO_TEXTS.map((t) => [t.slug, !!t.singlePage]))
  const link = (slug, ch) => (sp[slug] ? `/dao/${slug}#dao-ch-${ch}` : `/dao/${slug}/${ch}`)
  const groups = []

  const books = DAO_TEXTS
    .filter((t) => t.status !== 'pending' && (t.title.includes(q) || (t.alias && t.alias.includes(q))))
    .slice(0, GROUP_CAP)
    .map((t) => ({ id: `bk-${t.slug}`, label: t.title, sub: '经', to: `/dao/${t.slug}` }))
  if (books.length) groups.push({ key: 'book', label: '经', items: books })

  if (q.length < 2 || !cache) return groups

  const text = []
  for (const p of cache.paras) {
    if (p.original.includes(q)) {
      text.push({ id: `o-${p.slug}-${p.ch}-${text.length}`, label: snippet(p.original, q), sub: `${p.title}·正文`, to: link(p.slug, p.ch) })
    } else if (p.translation.includes(q)) {
      text.push({ id: `t-${p.slug}-${p.ch}-${text.length}`, label: snippet(p.translation, q), sub: `${p.title}·译文`, to: link(p.slug, p.ch) })
    }
    if (text.length >= GROUP_CAP) break
  }
  if (text.length) groups.push({ key: 'text', label: '正文 / 译文', items: text })

  const nt = []
  for (const n of cache.notes) {
    if (n.term.includes(q) || n.note.includes(q)) {
      nt.push({ id: `n-${n.slug}-${n.ch}-${nt.length}`, label: `${n.term}：${snippet(n.note, q)}`, sub: `${n.title}·注疏`, to: link(n.slug, n.ch) })
      if (nt.length >= GROUP_CAP) break
    }
  }
  if (nt.length) groups.push({ key: 'zhushi', label: '注疏', items: nt })

  const yl = []
  for (const y of cache.yy) {
    if (y.text.includes(q)) {
      yl.push({ id: `y-${y.slug}-${y.ch}-${yl.length}`, label: snippet(y.text, q), sub: `${y.title}·延伸`, to: link(y.slug, y.ch) })
      if (yl.length >= GROUP_CAP) break
    }
  }
  if (yl.length) groups.push({ key: 'yanyi', label: '延伸', items: yl })

  return groups
}
