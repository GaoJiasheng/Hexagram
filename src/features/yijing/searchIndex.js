// 全局搜索多源索引(v10 §1)——SearchPalette 只管渲染,本模块负责建索引与查询
// 道藏不入索引(模块边界);经传分章 JSON 为懒加载 chunk,索引异步补建
import { allHexagrams, loadClassics, CLASSICS_META } from './data.js'
import { LEARN_TOPICS } from './learnTopics.js'
import glossary from '../../data/yijing/glossary.json'
import shili from '../../data/yijing/shili.json'
import shishi from '../../data/yijing/shishi.json'
import renwu from '../../data/yijing/renwu.json'

const GROUP_CAP = 4

// 命中处前后各留 12 字
function snippet(text, q, ctx = 12) {
  const i = text.indexOf(q)
  if (i === -1) return null
  const start = Math.max(0, i - ctx)
  const end = Math.min(text.length, i + q.length + ctx)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function searchHexagrams(q) {
  const lower = q.toLowerCase()
  const items = []
  for (const h of allHexagrams) {
    if (h.name.includes(q) || h.fullName.includes(q) || h.pinyin?.toLowerCase().includes(lower) || String(h.id) === q) {
      items.push({ id: `hex-${h.id}`, label: h.fullName, sub: `第${h.id}卦`, to: `/hexagram/${h.id}` })
      if (items.length >= GROUP_CAP) break
    }
  }
  return items
}

function searchYuanwen(q) {
  if (q.length < 2) return []
  const items = []
  for (const h of allHexagrams) {
    const fields = [
      { text: h.judgment?.original, label: `${h.name}·卦辞` },
      ...h.lines.map(l => ({ text: l.original, label: `${h.name}·${l.title}` })),
    ]
    for (const f of fields) {
      if (f.text?.includes(q)) {
        items.push({ id: `yw-${h.id}-${f.label}`, label: snippet(f.text, q), sub: f.label, to: `/hexagram/${h.id}` })
        if (items.length >= GROUP_CAP) return items
      }
    }
  }
  return items
}

// 经传:篇目标题同步可搜;章节正文待 ensureClassicsIndexed() 后可搜
let classicsParas = null   // [{bookKey, bookTitle, chapter, original, translation}]
let classicsLoading = null

export function ensureClassicsIndexed() {
  if (classicsParas) return Promise.resolve()
  if (classicsLoading) return classicsLoading
  classicsLoading = Promise.all(CLASSICS_META.map(m => loadClassics(m.key))).then(books => {
    const paras = []
    books.forEach((book, i) => {
      const meta = CLASSICS_META[i]
      for (const c of book.chapters) {
        for (const p of c.paragraphs) {
          paras.push({ bookKey: meta.key, bookTitle: meta.title, chapter: c.no, original: p.original, translation: p.translation || '' })
        }
      }
    })
    classicsParas = paras
  })
  return classicsLoading
}

function searchClassics(q) {
  const items = []
  for (const m of CLASSICS_META) {
    if (m.title.includes(q)) {
      items.push({ id: `cl-${m.key}`, label: m.title, sub: '经传', to: `/classics/${m.key}/1` })
    }
  }
  if (q.length >= 2 && classicsParas) {
    for (const p of classicsParas) {
      const hitText = p.original.includes(q) ? p.original : p.translation.includes(q) ? p.translation : null
      if (hitText) {
        items.push({
          id: `cl-${p.bookKey}-${p.chapter}-${items.length}`,
          label: snippet(hitText, q),
          sub: `${p.bookTitle}·第${p.chapter}章`,
          to: `/classics/${p.bookKey}/${p.chapter}`,
        })
        if (items.length >= GROUP_CAP) break
      }
    }
  }
  return items.slice(0, GROUP_CAP)
}

function searchTopics(q) {
  const items = []
  for (const t of LEARN_TOPICS) {
    if (t.title.includes(q) || (q.length >= 2 && t.desc.includes(q))) {
      items.push({ id: `tp-${t.id}`, label: t.title, sub: '学堂', to: t.to })
      if (items.length >= GROUP_CAP) break
    }
  }
  return items
}

function searchGlossary(q) {
  const title = []
  const text = []
  for (const g of glossary) {
    if (g.name.includes(q) || g.aliases.some(a => a.includes(q))) {
      title.push({ id: `gl-${g.key}`, label: g.name, sub: g.brief, to: `/basics/glossary#${g.key}` })
    } else if (q.length >= 2 && g.brief.includes(q)) {
      text.push({ id: `gl-${g.key}`, label: g.name, sub: snippet(g.brief, q), to: `/basics/glossary#${g.key}` })
    }
  }
  return [...title, ...text].slice(0, GROUP_CAP)
}

function searchShili(q) {
  const title = []
  const text = []
  for (const s of shili) {
    const sub = `${s.era} · ${s.kind === 'shi' ? '筮占' : '引易'}`
    if (s.title.includes(q)) {
      title.push({ id: `sl-${s.id}`, label: s.title, sub, to: `/shili/${s.id}` })
    } else if (q.length >= 2) {
      const pool = [s.background, ...(s.reading || []), ...s.paragraphs.map(p => p.original)]
      const hit = pool.find(t => t?.includes(q))
      if (hit) text.push({ id: `sl-${s.id}`, label: snippet(hit, q), sub: `${s.title} · ${sub}`, to: `/shili/${s.id}` })
    }
  }
  return [...title, ...text].slice(0, GROUP_CAP)
}

function searchShishi(q) {
  const title = []
  const text = []
  for (const s of shishi) {
    if (s.title.includes(q)) {
      title.push({ id: `ss-${s.id}`, label: s.title, sub: '商周史事', to: `/basics/shishi#${s.id}` })
    } else if (q.length >= 2) {
      const hit = s.paragraphs.find(t => t.includes(q))
      if (hit) text.push({ id: `ss-${s.id}`, label: snippet(hit, q), sub: s.title, to: `/basics/shishi#${s.id}` })
    }
  }
  return [...title, ...text].slice(0, GROUP_CAP)
}

function searchRenwu(q) {
  const title = []
  const text = []
  for (const p of renwu) {
    if (p.name.includes(q)) {
      title.push({ id: `rw-${p.id}`, label: p.name, sub: `${p.era} · 人物志`, to: `/basics/yuanliu#${p.id}` })
    } else if (q.length >= 2) {
      const hit = p.paragraphs.find(t => t.includes(q))
      if (hit) text.push({ id: `rw-${p.id}`, label: snippet(hit, q), sub: `${p.name} · ${p.era}`, to: `/basics/yuanliu#${p.id}` })
    }
  }
  return [...title, ...text].slice(0, GROUP_CAP)
}

// 返回 [{key, label, items}],组序固定;空组剔除
export function searchAll(q) {
  q = q.trim()
  if (!q) return []
  const groups = [
    { key: 'hex', label: '卦', items: searchHexagrams(q) },
    { key: 'yuanwen', label: '原文', items: searchYuanwen(q) },
    { key: 'classics', label: '经传', items: searchClassics(q) },
    { key: 'topics', label: '学堂', items: searchTopics(q) },
    { key: 'glossary', label: '名词', items: searchGlossary(q) },
    { key: 'shili', label: '筮例', items: searchShili(q) },
    { key: 'shishi', label: '史事', items: searchShishi(q) },
    { key: 'renwu', label: '人物', items: searchRenwu(q) },
  ]
  return groups.filter(g => g.items.length > 0)
}
