// 通用 corpus 搜索(C1)——给读经类站(fo/ru/xin/fa/mo/bing/zong…)各自一套站内检索。
// 默认「本组」:只索引当前 corpus 自己的书。另提供「全站」聚合(#140/B1,opt-in):
// searchAllCorpora/ensureAllIndexed 横扫 9 个 corpus 站 + 道藏(动态 import,不污染 corpus chunk),
// 结果按组分栏——搜「无为/格物/兼爱/致良知」等跨派概念遂可一面看遍诸家。
// 索引懒建(首次开搜面板时 ensureCorpusIndexed):经名(同步)+ 原文/译文 + 注疏 + 延伸。
// 链接:singlePage 书 → /<corpus>/<slug>(单页);分章书 → /<corpus>/<slug>/<章号>。
import { corpusTexts, loadText, getAnchors, getYanyi } from './corpus.js'
import { SITE_MAP } from '../../sites/registry.js'

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
  // 单页书带章锚点(命中定位到该章),分章书落该章路由顶部
  const link = (slug, ch) => (sp[slug] ? `/${corpus}/${slug}#${corpus}-ch-${ch}` : `/${corpus}/${slug}/${ch}`)
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

// ── 全站聚合检索(#140/B1)──────────────────────────────────────────────
// 9 个 corpus 站(都在 corpus chunk 内)+ 道藏(动态 import,保 dao 数据层不被静态拉进 corpus chunk)。
// 易经走自己的 SearchPalette(卦/爻为主、结果形态不同),暂不并入本聚合。
const ALL_CORPORA = ['fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu']
const PER_SITE_CAP = 5
// 组栏标签:取 portalTitle 去「研读/研习」后缀,更紧凑(释典/儒典/法家…);道藏单列。
function siteLabel(corpus) {
  if (corpus === 'dao') return '道藏'
  return (SITE_MAP[corpus]?.portalTitle || corpus).replace(/(研读|研习)$/, '')
}

let daoMod = null   // 动态载入的道藏检索模块(ensureAllIndexed 后置入)

/** 懒建全站索引:9 corpus 站 + 道藏。道藏走动态 import,首次开全站搜索时才拉其数据层。 */
export async function ensureAllIndexed() {
  await Promise.all(ALL_CORPORA.map((c) => ensureCorpusIndexed(c)))
  if (!daoMod) daoMod = await import('../dao/daoSearch.js')
  await daoMod.ensureDaoIndexed()
}

/** 全站查询:逐组跑各自 searchCorpus,合并为「按组分栏」结果(每组取前 PER_SITE_CAP 条)。 */
export function searchAllCorpora(query) {
  const q = (query || '').trim()
  if (!q) return []
  const groups = []
  for (const c of ALL_CORPORA) {
    const items = searchCorpus(c, q).flatMap((g) => g.items).slice(0, PER_SITE_CAP)
      .map((it) => ({ ...it, id: `${c}-${it.id}` }))   // 跨组 key 唯一
    if (items.length) groups.push({ key: c, label: siteLabel(c), items })
  }
  if (daoMod) {
    const items = daoMod.searchDao(q).flatMap((g) => g.items).slice(0, PER_SITE_CAP)
      .map((it) => ({ ...it, id: `dao-${it.id}` }))
    if (items.length) groups.push({ key: 'dao', label: '道藏', items })
  }
  return groups
}
