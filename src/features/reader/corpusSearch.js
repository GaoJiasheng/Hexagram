// 通用 corpus 搜索(C1)——给读经类站(fo/ru/xin/fa/mo/bing/zong)各自一套全站检索。
// 分组隔离:只索引「当前 corpus」自己的书,本组只搜本组、跨组零泄漏。
// 索引懒建(首次开搜面板时 ensureCorpusIndexed):经名(同步)+ 原文/译文 + 注疏 + 延伸。
// 链接:singlePage 书 → /<corpus>/<slug>(单页);分章书 → /<corpus>/<slug>/<章号>。
import { corpusTexts, loadText, getAnchors, getYanyi } from './corpus.js'

const GROUP_CAP = 6

function snippet(text, q, ctx = 12) {
  const i = text.indexOf(q)
  if (i === -1) return text.slice(0, 28)
  const s = Math.max(0, i - ctx)
  const e = Math.min(text.length, i + q.length + ctx)
  return (s > 0 ? '…' : '') + text.slice(s, e) + (e < text.length ? '…' : '')
}

const cache = {}   // corpus -> { paras, notes, yanyi }

/** 懒建索引:载入该 corpus 全部非 pending 书的章节正文 + 注疏 + 延伸。 */
export async function ensureCorpusIndexed(corpus) {
  if (cache[corpus]) return
  const metas = corpusTexts(corpus).filter((t) => t.status !== 'pending')
  const paras = [], notes = [], yanyi = []
  await Promise.all(metas.map(async (m) => {
    const book = await loadText(corpus, m.slug)
    if (!book) return
    for (const c of book.chapters) {
      c.paragraphs.forEach((p, i) => {
        paras.push({ slug: m.slug, title: m.title, ch: c.no, original: p.original, translation: p.translation || '' })
        const ents = getAnchors(corpus, m.slug, c.no, i)
        if (ents) for (const e of ents) notes.push({ slug: m.slug, title: m.title, ch: c.no, term: e.term, note: e.note || '' })
      })
      const yy = getYanyi(corpus, m.slug, c.no)
      if (yy) yy.forEach((t) => yanyi.push({ slug: m.slug, title: m.title, ch: c.no, text: t }))
    }
  }))
  cache[corpus] = { paras, notes, yanyi }
}

/** 查询,返回分组结果 [{key,label,items:[{id,label,sub,to}]}]。索引未建好时只返回经名组。 */
export function searchCorpus(corpus, query) {
  const q = (query || '').trim()
  if (!q) return []
  const metas = corpusTexts(corpus)
  const sp = Object.fromEntries(metas.map((t) => [t.slug, !!t.singlePage]))
  const link = (slug, ch) => (sp[slug] ? `/${corpus}/${slug}` : `/${corpus}/${slug}/${ch}`)
  const groups = []

  // 经名(同步,含别名)
  const books = metas
    .filter((t) => t.status !== 'pending' && (t.title.includes(q) || (t.alias && t.alias.includes(q))))
    .slice(0, GROUP_CAP)
    .map((t) => ({ id: `bk-${t.slug}`, label: t.title, sub: '经', to: `/${corpus}/${t.slug}` }))
  if (books.length) groups.push({ key: 'book', label: '经', items: books })

  const idx = cache[corpus]
  if (q.length < 2 || !idx) return groups

  // 正文 / 译文
  const text = []
  for (const p of idx.paras) {
    if (p.original.includes(q)) {
      text.push({ id: `o-${p.slug}-${p.ch}-${text.length}`, label: snippet(p.original, q), sub: `${p.title}·正文`, to: link(p.slug, p.ch) })
    } else if (p.translation.includes(q)) {
      text.push({ id: `t-${p.slug}-${p.ch}-${text.length}`, label: snippet(p.translation, q), sub: `${p.title}·译文`, to: link(p.slug, p.ch) })
    }
    if (text.length >= GROUP_CAP) break
  }
  if (text.length) groups.push({ key: 'text', label: '正文 / 译文', items: text })

  // 注疏
  const nt = []
  for (const n of idx.notes) {
    if (n.term.includes(q) || n.note.includes(q)) {
      nt.push({ id: `n-${n.slug}-${n.ch}-${nt.length}`, label: `${n.term}：${snippet(n.note, q)}`, sub: `${n.title}·注疏`, to: link(n.slug, n.ch) })
      if (nt.length >= GROUP_CAP) break
    }
  }
  if (nt.length) groups.push({ key: 'zhushi', label: '注疏', items: nt })

  // 延伸
  const yy = []
  for (const y of idx.yanyi) {
    if (y.text.includes(q)) {
      yy.push({ id: `y-${y.slug}-${y.ch}-${yy.length}`, label: snippet(y.text, q), sub: `${y.title}·延伸`, to: link(y.slug, y.ch) })
      if (yy.length >= GROUP_CAP) break
    }
  }
  if (yy.length) groups.push({ key: 'yanyi', label: '延伸', items: yy })

  return groups
}
