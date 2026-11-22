// 详注层(docs/xiangzhu-spec.md)的共用底座:站内坐标、原文取段、校验规则、真源读写、全站书单。
// 用的地方:scripts/desk/notes-*.mjs(生产管线)、scripts/lib/check-xiangzhu.mjs(check-data 闸)、
// scripts/build-desk-packs.mjs(书桌内容包)、scripts/build-content-assets.mjs(网站分片)。
//
// 坐标:
//   · 读经类(corpus 各站、道藏、易经十翼五种):章号 = classics/<slug>.json 的 chapters[].no,段 = paragraphs[] 下标(0 起)
//   · 易经六十四卦(yijing/hexagrams):章号 = 卦序 1–64,段 = 部位键(judgment / tuan / daxiang / l1…l6 / x1…x6 / use / xuse / w0…)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const DATA = path.join(ROOT, 'src/data')
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

export const YIJING_TEXTS = ['xici-shang', 'xici-xia', 'shuogua', 'xugua', 'zagua']
export const len = (s) => [...String(s ?? '')].length
export const FIELDS = new Set(['k', 'd', 'x', 'r'])
export const LIMITS = { dMin: 1, dMax: 40, xMin: 40, xMax: 150 }

// 「<corpus>/<slug>」→ { corpus, slug };不合形态返回 null
export function parseBookId(s) {
  const m = /^([a-z]+)\/([a-z0-9-]+)$/.exec(String(s || ''))
  return m ? { corpus: m[1], slug: m[2], id: `${m[1]}/${m[2]}` } : null
}

export const truthFile = (corpus, slug) => path.join(DATA, corpus, 'xiangzhu', `${slug}.json`)

// ── 一卦的各部位,次序与 build-desk-packs.mjs 的 buildYijing 一致:
//    卦辞 → 彖 → 大象 → 六爻(爻辞 + 小象)→ 用九 / 用六 + 小象(乾坤)→ 文言逐段。原文缺的部位不列。
export function hexParts(h) {
  const out = []
  const add = (key, node, label) => { if (node && typeof node.original === 'string' && node.original) out.push({ key, o: node.original, t: node.translation || '', label }) }
  add('judgment', h.judgment, '卦辞')
  add('tuan', h.tuan, '彖传')
  add('daxiang', h.daxiang, '大象')
  ;(h.lines || []).forEach((ln, j) => {
    add(`l${j + 1}`, ln, ln.title || `第 ${j + 1} 爻`)
    if (ln.xiaoxiang) add(`x${j + 1}`, ln.xiaoxiang, `${ln.title || `第 ${j + 1} 爻`} · 小象`)
  })
  if (h.extra?.use) {
    add('use', h.extra.use, h.extra.use.title || '用')
    if (h.extra.use.xiaoxiang) add('xuse', h.extra.use.xiaoxiang, `${h.extra.use.title || '用'} · 小象`)
  }
  ;(h.extra?.wenyan || []).forEach((p, j) => add(`w${j}`, p, '文言'))
  return out
}
// 部位键的排序位次(写真源时用)
export function partRank(key) {
  if (key === 'judgment') return 0
  if (key === 'tuan') return 1
  if (key === 'daxiang') return 2
  let m = /^([lx])([1-6])$/.exec(key)
  if (m) return 10 + (+m[2]) * 2 + (m[1] === 'x' ? 1 : 0)
  if (key === 'use') return 30
  if (key === 'xuse') return 31
  m = /^w(\d+)$/.exec(key)
  if (m) return 100 + (+m[1])
  return 10000
}

// ── 一本书的原文,统一成 [{ no, title, segs: [{ seg, o, t, label? }] }](原文为空的段不列)
const bookCache = new Map()
export function loadBook(corpus, slug) {
  const key = `${corpus}/${slug}`
  if (bookCache.has(key)) return bookCache.get(key)
  let res = null
  if (corpus === 'yijing' && slug === 'hexagrams') {
    const hexes = readJson(path.join(DATA, 'yijing/hexagrams.json'))
    res = {
      corpus, slug, title: '周易', hexagram: true,
      chapters: [...hexes].sort((a, b) => a.id - b.id).map((h) => ({
        no: h.id, title: h.fullName || h.name,
        segs: hexParts(h).map((p) => ({ seg: p.key, o: p.o, t: p.t, label: p.label })),
      })),
    }
  } else {
    const f = path.join(DATA, corpus, 'classics', `${slug}.json`)
    if (fs.existsSync(f)) {
      const book = readJson(f)
      const meta = corpus === 'yijing' ? null : textsOf(corpus).find((t) => t.slug === slug)
      res = {
        corpus, slug, title: meta?.title || book.title || slug,
        chapters: (book.chapters || book).map((c) => ({
          no: c.no,
          title: meta?.chapterNames?.[String(c.no)] || c.title || '',
          segs: c.paragraphs.map((p, i) => ({ seg: i, o: typeof p === 'string' ? p : p?.original || '', t: (typeof p === 'object' && p?.translation) || '' }))
            .filter((s) => s.o),
        })),
      }
    }
  }
  bookCache.set(key, res)
  return res
}

// 章号 → 段 → 原文(校验用)
export function originalIndex(corpus, slug) {
  const b = loadBook(corpus, slug)
  if (!b) return null
  const m = new Map()
  for (const c of b.chapters) m.set(String(c.no), new Map(c.segs.map((s) => [String(s.seg), s.o])))
  return m
}

// ── 站内已有简注(给起草代理当 old 参考):{ 章号: { 段: [{k,d}] } }
export function oldNotes(corpus, slug) {
  const toN = (x) => ({ k: x.term, d: x.note })
  if (corpus === 'yijing') {
    const dict = readJson(path.join(DATA, 'yijing/zhushi.json'))
    const byTerm = new Map(dict.map((z) => [z.term, z]))
    const resolve = (list) => (list || []).map((e) => (e.ref ? byTerm.get(e.term) : e)).filter((e) => e?.term && e?.note).map(toN)
    if (slug === 'hexagrams') {
      // 卦辞、爻辞走词典(最长优先扫描,同网站 AnnotatedText);其余部位走逐段锚定
      const byFirst = new Map()
      for (const z of dict) { if (!byFirst.has(z.term[0])) byFirst.set(z.term[0], []); byFirst.get(z.term[0]).push(z) }
      for (const l of byFirst.values()) l.sort((a, b) => b.term.length - a.term.length)
      const scan = (o) => {
        const out = [], seen = new Set()
        for (let i = 0; i < o.length;) {
          const hit = (byFirst.get(o[i]) || []).find((z) => o.startsWith(z.term, i))
          if (hit) { if (!seen.has(hit.term)) { seen.add(hit.term); out.push(toN(hit)) } i += hit.term.length } else i++
        }
        return out
      }
      const anch = readJson(path.join(DATA, 'yijing/zhushi-anchored/hexagrams.json'))
      const res = {}
      for (const c of loadBook('yijing', 'hexagrams').chapters) {
        const A = anch[String(c.no)] || {}
        const r = {}
        for (const s of c.segs) {
          const k = s.seg
          let list
          if (k === 'judgment' || /^l\d$/.test(k) || k === 'use') list = scan(s.o)
          else if (k === 'tuan' || k === 'daxiang') list = resolve(A[k])
          else if (/^x\d$/.test(k)) list = resolve(A.xiaoxiang?.[k.slice(1)])
          else if (k === 'xuse') list = resolve(A.xiaoxiang?.use)
          else if (/^w\d+$/.test(k)) list = resolve(A.wenyan?.[k.slice(1)])
          if (list?.length) r[k] = list
        }
        res[String(c.no)] = r
      }
      return res
    }
    const f = path.join(DATA, 'yijing/zhushi-anchored', `${slug}.json`)
    if (!fs.existsSync(f)) return {}
    const z = readJson(f)
    return Object.fromEntries(Object.entries(z).map(([ch, segs]) => [ch, Object.fromEntries(Object.entries(segs).map(([s, l]) => [s, resolve(l)]))]))
  }
  const f = path.join(DATA, corpus, 'zhushi-anchored', `${slug}.json`)
  if (!fs.existsSync(f)) return {}
  const z = readJson(f)
  return Object.fromEntries(Object.entries(z).map(([ch, segs]) => [ch, Object.fromEntries(Object.entries(segs || {}).map(([s, l]) => [s, (l || []).filter((e) => e?.term && e?.note).map(toN)]))]))
}

// ── 校验一处(一段 / 一个部位)的详注。返回 { good: [...规范化后的条目], bad: [{n, why}] }。
// 规则即 spec §3:k 是原文子串;按首次出现位置不重叠、不重复;d 1–40 码点;x 40–150 码点;r 有则非空;只许 k d x r。
// strict = true(闸):多余字段算错;false(合并):多余字段剥掉
export function checkPlace(o, notes, { strict = true } = {}) {
  const good = [], bad = []
  const spans = [], seen = new Set()
  for (let n of Array.isArray(notes) ? notes : []) {
    const fail = (why) => bad.push({ n, why })
    if (!n || typeof n !== 'object' || Array.isArray(n)) { fail('不是对象'); continue }
    if (strict) { const extra = Object.keys(n).filter((k) => !FIELDS.has(k)); if (extra.length) { fail(`多余字段 ${extra.join(',')}`); continue } }
    else if (n.r === '' || n.r === null) { const { r, ...rest } = n; void r; n = rest }   // 合并时:空读音当没给
    if (typeof n.k !== 'string' || !n.k || typeof n.d !== 'string' || typeof n.x !== 'string') { fail('缺字段'); continue }
    if (n.r !== undefined && (typeof n.r !== 'string' || !n.r.trim())) { fail('r 为空'); continue }
    const at = o.indexOf(n.k)
    if (at < 0) { fail('k 不是原文子串'); continue }
    if (seen.has(n.k)) { fail('k 重复'); continue }
    if (spans.some(([a, b]) => at < b && a < at + n.k.length)) { fail('同处重叠'); continue }
    const dl = len(n.d), xl = len(n.x)
    if (dl < LIMITS.dMin || dl > LIMITS.dMax) { fail(dl > LIMITS.dMax ? 'd 超长' : 'd 为空'); continue }
    if (xl < LIMITS.xMin) { fail('x 过短'); continue }
    if (xl > LIMITS.xMax) { fail('x 过长'); continue }
    spans.push([at, at + n.k.length]); seen.add(n.k)
    good.push({ k: n.k, d: n.d, x: n.x, ...(n.r !== undefined ? { r: n.r } : {}) })
  }
  return { good, bad }
}

// ── 真源读写
export function readTruth(corpus, slug) {
  const f = truthFile(corpus, slug)
  return fs.existsSync(f) ? readJson(f) : {}
}
// 章号数值升序;段号数值升序(卦按部位次序);1 空格缩进
export function sortTruth(t, hexagram = false) {
  const segCmp = hexagram ? (a, b) => partRank(a) - partRank(b) : (a, b) => Number(a) - Number(b)
  return Object.fromEntries(Object.keys(t).sort((a, b) => Number(a) - Number(b))
    .filter((ch) => t[ch] && Object.keys(t[ch]).length)
    .map((ch) => [ch, Object.fromEntries(Object.keys(t[ch]).sort(segCmp).filter((s) => t[ch][s]?.length).map((s) => [s, t[ch][s]]))]))
}
export function writeTruth(corpus, slug, t) {
  const f = truthFile(corpus, slug)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(sortTruth(t, corpus === 'yijing' && slug === 'hexagrams'), null, 1) + '\n')
  return f
}
export function countNotes(t) {
  let n = 0
  for (const segs of Object.values(t || {})) for (const l of Object.values(segs || {})) n += Array.isArray(l) ? l.length : 0
  return n
}
// 一本书还有哪些章没有详注(原文全空的章不算)
export function chaptersMissing(corpus, slug) {
  const b = loadBook(corpus, slug)
  if (!b) return []
  const t = readTruth(corpus, slug)
  return b.chapters.filter((c) => c.segs.length && !(t[String(c.no)] && Object.keys(t[String(c.no)]).length))
}

// ── 全站书单(spec §6 的顺序):首发六本 → 道藏其余 → 儒 → 佛 → 兵 / 法 / 墨 / 纵横其余 → 心 → 古文 → 诗词曲 → 中医 → 谋略 → 观数。
// 组内按各组 texts.json 的次序;书目只从 texts.json(与易经数据)派生,有 classics 数据的才列。
export function textsOf(corpus) {
  const f = path.join(DATA, corpus, 'texts.json')
  const t = fs.existsSync(f) ? readJson(f) : []
  return Array.isArray(t) ? t : []
}
export const FIRST_BATCH = [
  'dao/daodejing', 'bing/sunzi', 'zong/guiguzi', 'ru/lunyu',
  'yijing/hexagrams', ...YIJING_TEXTS.map((s) => `yijing/${s}`),
  'dao/zhuangzi-neipian', 'dao/zhuangzi-waipian', 'dao/zhuangzi-zapian',
]
export const GROUP_ORDER = ['dao', 'ru', 'fo', 'bing', 'fa', 'mo', 'zong', 'xin', 'guwen', 'tangshi', 'songci', 'yuanqu', 'zhongyi', 'moulue', 'mingli']
export function allBooks() {
  const has = (corpus, slug) => (corpus === 'yijing' && slug === 'hexagrams')
    ? fs.existsSync(path.join(DATA, 'yijing/hexagrams.json'))
    : fs.existsSync(path.join(DATA, corpus, 'classics', `${slug}.json`))
  const out = [], seen = new Set()
  const push = (id) => { const p = parseBookId(id); if (p && !seen.has(p.id) && has(p.corpus, p.slug)) { seen.add(p.id); out.push(p) } }
  for (const id of FIRST_BATCH) push(id)
  for (const g of GROUP_ORDER) for (const t of textsOf(g)) push(`${g}/${t.slug}`)
  // 不在上面次序表里的组(将来新加的)落在最后,免得漏
  for (const g of fs.readdirSync(DATA).sort()) {
    if (GROUP_ORDER.includes(g) || g === 'yijing') continue
    for (const t of textsOf(g)) if (t?.slug) push(`${g}/${t.slug}`)
  }
  return out
}
export const bookChars = (corpus, slug) => (loadBook(corpus, slug)?.chapters || []).reduce((a, c) => a + c.segs.reduce((b, s) => b + len(s.o), 0), 0)
