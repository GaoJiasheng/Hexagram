// 诗词曲格律层运行时(design-v24 §7.2)。
//
// 只把韵书所记摆出来:每字在《平水韵》里属平还是仄(一字两收而平仄不一者为「多」,标 ◐ 不硬判),
// 句末字属哪一部。**不判出律、不判合律与否**——那是读者对着韵书自己看的事。
//
// 韵书 json 体量不小(平水韵 ~340KB),一律 loadRhymeBook() 动态 import,开「格律」开关才载。
// 同步查询函数(toneOf / rhymePart / analyzeLine…)读已载入的缓存;也可显式传 book(单测即如此)。

const LOADERS = {
  pingshui: () => import('../../data/rhyme/pingshui.json'),
  cilin: () => import('../../data/rhyme/cilin.json'),
  zhongyuan: () => import('../../data/rhyme/zhongyuan.json'),
}
export const SCHEMES = Object.keys(LOADERS)
export const SCHEME_TITLE = { pingshui: '平水韵', cilin: '词林正韵', zhongyuan: '中原音韵' }

const cache = {}
const pending = {}

/** 载入一部韵书(按需、只载一次)。 */
export function loadRhymeBook(scheme) {
  if (!LOADERS[scheme]) return Promise.reject(new Error(`未知韵书: ${scheme}`))
  if (cache[scheme]) return Promise.resolve(cache[scheme])
  if (!pending[scheme]) {
    pending[scheme] = LOADERS[scheme]()
      .then((m) => (cache[scheme] = prepare(scheme, m.default ?? m)))
      .finally(() => { delete pending[scheme] })
  }
  return pending[scheme]
}
/** 已载入的韵书(未载入返回 null)。 */
export const getRhymeBook = (scheme) => cache[scheme] || null
/** 格律层要用的书:韵脚那部 +(标平仄时)平水韵。 */
export function loadProsodyBooks({ scheme, tones }) {
  const need = new Set([scheme])
  if (tones) need.add('pingshui')
  return Promise.all([...need].map(loadRhymeBook))
}

// 给 json 挂上 部 id → 部 的查表(不改原对象的数据字段)。
function prepare(scheme, data) {
  if (data.__scheme) return data
  const byId = {}
  if (scheme === 'pingshui') for (const p of data.parts) byId[p.id] = p
  else if (scheme === 'cilin') for (const p of data.parts) for (const s of p.sections) byId[`${p.no}${s.tone}`] = { part: p, tone: s.tone }
  else for (const p of data.parts) byId[p.name] = p
  Object.defineProperty(data, '__scheme', { value: scheme })
  Object.defineProperty(data, '__byId', { value: byId })
  return data
}
const ensure = (scheme, book) => (book ? prepare(scheme, book) : cache[scheme] || null)

// 查一字:本字 → (平水韵)【詞】增补 → 异体退查表(json 的 variants,只收同字异写)。
function lookup(book, c) {
  if (!book || !c) return null
  const hit = (ch) => {
    if (book.index[ch]) return { ids: book.index[ch], ci: false }
    if (book.ciIndex?.[ch]) return { ids: book.ciIndex[ch], ci: true }
    return null
  }
  const own = hit(c)
  if (own) return { ...own, as: c, variant: false }
  const alt = book.variants?.[c]
  const via = alt && hit(alt)
  return via ? { ...via, as: alt, variant: true } : null
}

/**
 * 平水韵平仄:'平' | '仄' | '多'(韵书一字两收而平仄不一)| null(韵书未收)。简繁皆查。
 * @param {string} char
 * @param {object} [book] 平水韵 json(缺省用已载入的缓存)
 */
export function toneOf(char, book) {
  const b = ensure('pingshui', book)
  const r = lookup(b, char)
  if (!r) return null
  const tones = new Set(r.ids.map((id) => b.__byId[id]?.tone).filter(Boolean))
  if (tones.size === 0) return null
  return tones.size > 1 ? '多' : [...tones][0]
}

/**
 * 该字在平水韵里是否只归入声。入声字今普通话已分派四声(国、竹、白今读平),页面依韵书标仄,
 * 悬停注明「入声」,即 §0.4「今音异者以韵书为准并说明」。去入两收之类不算(本就仄,不必注);未收返回 false。
 */
export function isRusheng(char, book) {
  const b = ensure('pingshui', book)
  const r = lookup(b, char)
  return !!r && r.ids.every((id) => b.__byId[id]?.sheng === '入')
}

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九']
const CL_TONE_WORD = { 平: '平声', 仄: '仄声(上去)', 入: '入声' }
function describe(scheme, b, id) {
  if (scheme === 'pingshui') {
    const p = b.__byId[id]
    return p && { id, key: `ps:${id}`, label: p.label, tone: p.tone, title: `平水韵 · ${p.sheng}声${p.label}(${p.tone})` }
  }
  if (scheme === 'cilin') {
    const e = b.__byId[id]
    return e && { id, key: `cl:${e.part.no}`, no: e.part.no, label: `${CN[e.part.no]}部`, tone: e.tone }
  }
  const p = b.__byId[id]
  return p && { id, key: `zy:${id}`, label: p.label, tone: null, title: `中原音韵 · ${p.label}` }
}

/**
 * 一字所属韵部。scheme ∈ pingshui | cilin | zhongyuan。
 * 返回 null(韵书未收)或 { char, as, variant, ci, parts:[{id,key,label,tone,title}] }——
 * 一字多部照列(多音字),不取舍;`as` 是实际查到的写法(走异体表时与 char 不同)。
 * 词林正韵同一部平仄两收(如「中」1平/1仄)时着色键相同,并为一条、声类并记(tone:'平仄')。
 */
export function rhymePart(char, scheme = 'pingshui', book) {
  const b = ensure(scheme, book)
  const r = lookup(b, char)
  if (!r) return null
  const parts = []
  for (const id of r.ids) {
    const d = describe(scheme, b, id)
    if (!d) continue
    const prev = parts.find((x) => x.key === d.key)
    if (prev) { if (d.tone && !prev.tone.includes(d.tone)) prev.tone += d.tone; continue }
    parts.push(d)
  }
  if (scheme === 'cilin') {
    for (const d of parts) d.title = `词林正韵 · 第${d.label} · ${[...d.tone].map((t) => CL_TONE_WORD[t]).join('、')}`
  }
  return parts.length ? { char, as: r.as, variant: r.variant, ci: r.ci, parts } : null
}

// ---------- 切句 ----------
const HAN = /\p{Script=Han}/u
// 与阅读器 verse 断行同一套句读(ClassicText / AnnotatedText):逢 ，。；！？ 断
const SENT_SPLIT = /(?<=[\uFF0C\u3002\uFF1B\uFF01\uFF1F])/ // ，。；！？
const HAS_PUNCT = /[\uFF0C\u3002\uFF1B\uFF01\uFF1F]/
/** 是否韵文段:含句读,且不是诗题(《…》)/曲牌题(【…】…)一类的标题段。 */
export function isVerseText(text) {
  const t = String(text || '').trim()
  if (!t || !HAS_PUNCT.test(t)) return false
  if (/^《[^》]+》$/.test(t) || /^【/.test(t)) return false
  return true
}

/**
 * 按句读切句,逐字平仄,句末字韵部。
 * @returns {{chars:{c:string,tone:string|null|undefined,ru?:boolean}[], endChar:string, endPart:object|null}[]}
 * @param {string} text
 * @param {{scheme?:string, tones?:boolean, books?:{pingshui?:object, cilin?:object, zhongyuan?:object}}} [opts]
 */
export function analyzeLine(text, opts = {}) {
  const { scheme = 'pingshui', tones = true, books = {} } = opts
  const out = []
  for (const seg of String(text || '').split(SENT_SPLIT)) {
    const cs = [...seg].filter((c) => HAN.test(c))
    if (!cs.length) continue
    const chars = cs.map((c) => (tones ? { c, tone: toneOf(c, books.pingshui), ru: isRusheng(c, books.pingshui) } : { c, tone: undefined }))
    const endChar = cs[cs.length - 1]
    out.push({ chars, endChar, endPart: rhymePart(endChar, scheme, books[scheme]) })
  }
  return out
}

/**
 * 一首之内给句末韵部着色:同一韵部在本首句末出现两次以上者分配一色(按首现次序,6 色轮转);
 * 只出现一次的不着色(多为不入韵的出句)。多部字优先取与本首他句相同的那一部,仍无则不取。
 * 这只是「同部者同色」的排列,不是合不合韵的判断。
 * 就地给每句加 { pick, color }(color: 1..6 或 null)。
 */
export const RHYME_COLORS = 6
export function colorRhymes(lines) {
  const count = (pickOf) => {
    const n = {}
    for (const ln of lines) for (const k of new Set(pickOf(ln))) n[k] = (n[k] || 0) + 1
    return n
  }
  const cand = count((ln) => (ln.endPart ? ln.endPart.parts.map((p) => p.key) : []))
  for (const ln of lines) {
    const ps = ln.endPart?.parts || []
    if (ps.length <= 1) { ln.pick = ps[0] || null; continue }
    const shared = ps.filter((p) => cand[p.key] >= 2).sort((a, b) => cand[b.key] - cand[a.key])
    ln.pick = shared[0] || null
  }
  const picked = count((ln) => (ln.pick ? [ln.pick.key] : []))
  const colorOf = {}
  let next = 0
  for (const ln of lines) {
    const k = ln.pick?.key
    if (k && picked[k] >= 2 && !(k in colorOf)) colorOf[k] = (next++ % RHYME_COLORS) + 1
    ln.color = k && colorOf[k] ? colorOf[k] : null
  }
  return lines
}

/**
 * 一章的段落 → 与段落对齐的数组:韵文段为 lines(已着色),非韵文段为 null。
 * 连续的韵文段为一首(诗题/曲牌题/小题段即分首),着色以首为单位。
 */
export function analyzeParagraphs(texts, opts = {}) {
  const res = texts.map((t) => (isVerseText(t) ? analyzeLine(t, opts) : null))
  let poem = []
  const flush = () => { if (poem.length) colorRhymes(poem); poem = [] }
  for (const lines of res) {
    if (!lines) { flush(); continue }
    poem.push(...lines)
  }
  flush()
  return res
}

/** 符号:平 ○ · 仄 ● · 多 ◐ · 未收 ◌(供无障碍文本与凡例用;页面上的符号由 CSS 画)。 */
export const TONE_GLYPH = { 平: '○', 仄: '●', 多: '◐' }
export const toneGlyph = (t) => TONE_GLYPH[t] || '◌'
