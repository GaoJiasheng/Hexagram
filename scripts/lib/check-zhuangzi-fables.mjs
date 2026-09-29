// 校验闸 · 庄子寓言索引(design-v24 §6 / §0.2)。
// 数据 src/data/dao/zhuangzi-fables.json:内 / 外 / 杂三部《庄子》里的寓言,一则一条。看守:
//   ① 每则的 kw 是该篇(标题 + 原文)里确有的字样,且落在 para 指的那一段——不凭记忆指篇;
//   ② part(长章拆屏后的第几屏)与阅读器的拆屏规则一致——拆屏规则一改,这里就报,免得「读原文 →」落错屏;
//   ③ 成语:from 是该篇原文精确子串;未标 later(后人概括)的,成语每个字都得在 from 里找得到,
//      找不到就是后人改写过的说法,必须如实标「后人概括」并写 note;
//   ④ 道组红线:gist / note 不宣化、不下吉凶 / 成仙断语、不演火候工法;
//   ⑤ id 唯一、总数 ≥ 60。
import path from 'node:path'
import { chapterParts } from '../../src/features/reader/chapterParts.js'

const DATA = 'src/data/dao/zhuangzi-fables.json'
const CLASSICS = 'src/data/dao/classics'
const TEXTS = 'src/data/dao/texts.json'

export const FABLE_SLUGS = ['zhuangzi-neipian', 'zhuangzi-waipian', 'zhuangzi-zapian']
export const SLUG_LABEL = { 'zhuangzi-neipian': '内', 'zhuangzi-waipian': '外', 'zhuangzi-zapian': '杂' }
export const MIN_FABLES = 60
export const MAX_FABLES = 90
// 道组红线(design-v24 §0.4):讲寓言与思想,不宣化、不下吉凶 / 成仙断语、不演火候工法
export const RED_RE = /吉凶|大吉|凶兆|成仙|飞升|长生不老|修炼|炼丹|内丹|火候|功法|保佑|灵验|福报|祈福|转运|开运/g

const len = (s) => [...String(s)].length
const HAN_RE = /\p{Script=Han}/u
const red = (s) => [...new Set(String(s || '').match(RED_RE) || [])]

/**
 * 纯函数版,便于单测。
 * getChapter(slug, ch) → 该章 { title, paragraphs:[{original}] };书或章不存在返回 null。
 * getMeta(slug) → texts.json 里该书的条目(拆屏规则要用;可为 undefined)。
 * 返回 { errors, warnings, stats }。
 */
export function checkFables(data, { getChapter, getMeta = () => undefined }) {
  const errors = [], warnings = []
  const stats = { total: 0, bySlug: { 'zhuangzi-neipian': 0, 'zhuangzi-waipian': 0, 'zhuangzi-zapian': 0 }, chengyu: 0, later: 0 }
  const list = data?.fables
  if (!Array.isArray(list)) return { errors: ['庄子寓言: 缺 fables 数组'], warnings, stats }
  stats.total = list.length
  if (list.length < MIN_FABLES) errors.push(`庄子寓言: 只有 ${list.length} 则,至少 ${MIN_FABLES}`)
  if (list.length > MAX_FABLES) warnings.push(`庄子寓言: ${list.length} 则,超过规划上限 ${MAX_FABLES}`)

  const ids = new Set(), titles = new Set(), idioms = new Map()
  let prev = null
  for (const f of list) {
    const t = `庄子寓言 ${f?.id || '(无 id)'}`
    if (!f || typeof f !== 'object') { errors.push(`${t}: 不是对象`); continue }
    if (typeof f.id !== 'string' || !/^[a-z0-9-]+$/.test(f.id)) errors.push(`${t}: id 须为小写字母/数字/连字符`)
    else if (ids.has(f.id)) errors.push(`${t}: id 重复`)
    ids.add(f.id)
    if (typeof f.title !== 'string' || len(f.title) < 2 || len(f.title) > 10) errors.push(`${t}: title 须 2–10 字`)
    else if (titles.has(f.title)) errors.push(`${t}: title「${f.title}」重复`)
    titles.add(f.title)
    for (const w of red(f.title)) errors.push(`${t}: title 含红线用字「${w}」`)

    if (!FABLE_SLUGS.includes(f.slug)) { errors.push(`${t}: slug 须为 ${FABLE_SLUGS.join(' / ')}`); continue }
    stats.bySlug[f.slug]++
    if (!Number.isInteger(f.ch)) { errors.push(`${t}: ch 须为整数`); continue }
    const chapter = getChapter(f.slug, f.ch)
    if (!chapter) { errors.push(`${t}: ${f.slug} 无第 ${f.ch} 篇`); continue }
    const text = chapter.title + chapter.paragraphs.map((p) => p.original).join('')
    const where = `${t}(${f.slug}#${f.ch} ${chapter.title})`
    if (f.pian !== chapter.title) errors.push(`${where}: pian 应为「${chapter.title}」(现为「${f.pian}」)`)

    // ① kw 回查 + 段落定位
    if (typeof f.kw !== 'string' || len(f.kw) < 4 || len(f.kw) > 30) errors.push(`${where}: kw 须 4–30 字`)
    else if (!text.includes(f.kw)) errors.push(`${where}: 原文中查不到 kw「${f.kw}」`)
    else {
      if (text.indexOf(f.kw) !== text.lastIndexOf(f.kw)) warnings.push(`${where}: kw「${f.kw}」在本篇出现不止一次,落点可能有歧义`)
      const para = chapter.paragraphs[f.para]
      if (!Number.isInteger(f.para) || !para) errors.push(`${where}: para 不是本篇的合法段下标`)
      else if (!para.original.includes(f.kw)) errors.push(`${where}: 第 ${f.para} 段里没有 kw「${f.kw}」`)
      else {
        // ② 拆屏:按阅读器同一套规则算 kw 所在的屏
        const parts = chapterParts(chapter, getMeta(f.slug))
        const expect = parts ? parts.findIndex((pt) => f.para >= pt.from && f.para < pt.to) + 1 : 1
        const got = f.part ?? 1
        if (got !== expect) errors.push(`${where}: part 应为 ${expect}(现为 ${got})——阅读器拆屏规则变了?`)
      }
      // 阅读顺序:同一部书内按篇、段、段内位置排
      if (prev && prev.slug === f.slug) {
        const a = [prev.ch, prev.para, prev.at], b = [f.ch, f.para, text.indexOf(f.kw)]
        if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) {
          warnings.push(`${where}: 排在「${prev.id}」之后,不合原书次序`)
        }
      }
      prev = { slug: f.slug, ch: f.ch, para: f.para, at: text.indexOf(f.kw), id: f.id }
    }

    // ④ gist
    if (typeof f.gist !== 'string' || len(f.gist) < 20 || len(f.gist) > 130) errors.push(`${where}: gist 须 20–130 字`)
    for (const w of red(f.gist)) errors.push(`${where}: gist 含红线用字「${w}」`)

    // ③ 成语
    if (f.chengyu === undefined) continue
    if (!Array.isArray(f.chengyu) || !f.chengyu.length || f.chengyu.length > 4) { errors.push(`${where}: chengyu 须为 1–4 条的数组`); continue }
    for (const c of f.chengyu) {
      const ct = `${where} 成语「${c?.text ?? '?'}」`
      stats.chengyu++
      if (typeof c?.text !== 'string' || len(c.text.replace(/\uFF0C/g, '')) < 3 || len(c.text) > 10) { errors.push(`${ct}: text 须 3–10 字`); continue }
      if (idioms.has(c.text)) warnings.push(`${ct}: 与「${idioms.get(c.text)}」重复`)
      idioms.set(c.text, f.id)
      if (typeof c.from !== 'string' || !c.from) { errors.push(`${ct}: 缺 from(原文出处)`); continue }
      if (len(c.from) > 40) errors.push(`${ct}: from 超 40 字`)
      if (!text.includes(c.from)) errors.push(`${ct}: from「${c.from}」不是本篇原文子串`)
      const missing = [...c.text].filter((ch) => HAN_RE.test(ch) && !c.from.includes(ch))
      if (c.later === true) {
        stats.later++
        if (typeof c.note !== 'string' || !c.note) errors.push(`${ct}: 标了后人概括,须写 note 说明原文怎么说`)
      } else {
        if (c.later !== undefined) errors.push(`${ct}: later 只许为 true 或不写`)
        if (missing.length) errors.push(`${ct}: 「${missing.join('')}」不见于原文「${c.from}」——这是后人改写的说法,应标 later 并写 note`)
      }
      if (c.note !== undefined && (typeof c.note !== 'string' || len(c.note) > 60)) errors.push(`${ct}: note 须为 ≤60 字的字符串`)
      for (const w of red(c.note)) errors.push(`${ct}: note 含红线用字「${w}」`)
    }
  }
  return { errors, warnings, stats }
}

export default function check({ ROOT, err, warn, info, readJson }) {
  const data = readJson(path.join(ROOT, DATA))
  const books = {}
  const texts = readJson(path.join(ROOT, TEXTS))
  const getBook = (slug) => {
    if (!(slug in books)) {
      try { books[slug] = readJson(path.join(ROOT, CLASSICS, `${slug}.json`)) } catch { books[slug] = null }
    }
    return books[slug]
  }
  const getChapter = (slug, ch) => getBook(slug)?.chapters?.find((c) => c.no === ch) || null
  const getMeta = (slug) => (Array.isArray(texts) ? texts.find((b) => b.slug === slug) : undefined)
  const { errors, warnings, stats } = checkFables(data, { getChapter, getMeta })
  errors.forEach(err)
  warnings.forEach(warn)
  const by = stats.bySlug
  info(`庄子寓言索引: ${stats.total} 则(内 ${by['zhuangzi-neipian']} / 外 ${by['zhuangzi-waipian']} / 杂 ${by['zhuangzi-zapian']})· 成语 ${stats.chengyu} 条(后人概括 ${stats.later})`)
}
