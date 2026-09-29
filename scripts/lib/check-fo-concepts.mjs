// 校验闸 · 释典名相索引 + 名相环(design-v24 §4 / §0.2)。
// 与观数概念闸同规则:① 每个落点的书、章存在,kw 是该章(标题 + 原文)里确有的字样——不凭记忆指章;
// ② gloss 不含劝信 / 果报用字(研习不宣化);另加 ③ rings.json 每条引文回查为该章原文精确子串,
// 环的 props 过 ring 件的 schema,十二因缘须是十二支、按经典次第。
import path from 'node:path'
import fs from 'node:fs'
import { validateRing } from '../../src/features/shared/widgets/ring.schema.js'

const CONCEPTS = 'src/data/fo/concepts.json'
const RINGS = 'src/data/fo/rings.json'
const CLASSICS = 'src/data/fo/classics'

// 佛组铁律:研习不宣化。闸扫这几个劝信 / 果报用字(design-v24 §4)。
export const BANNED_RE = /必得|往生|消业|福报|灭罪/g
export const TWELVE_LINKS = ['无明', '行', '识', '名色', '六入', '触', '受', '爱', '取', '有', '生', '老死']
export const EIGHT_PATH = ['正见', '正思惟', '正语', '正业', '正命', '正精进', '正念', '正定']
export const MIN_TERMS = 25
export const MAX_TERMS = 35

const banned = (s) => [...new Set((String(s || '').match(BANNED_RE) || []))]

/**
 * 纯函数版,便于单测。
 * getText(slug, ch) → 该章 title + 全部 paragraphs.original 拼接;书不存在返回 undefined,章不存在返回 null。
 * 返回 { errors, warnings, stats }。
 */
export function checkFoData({ concepts, rings, getText }) {
  const errors = [], warnings = []
  const stats = { terms: 0, loci: 0, ringItems: 0, ringQuotes: 0 }

  // ---- 名相索引 ----
  const clusters = concepts?.clusters
  if (!Array.isArray(clusters)) errors.push('佛名相: concepts.json 缺 clusters 数组')
  else {
    stats.terms = clusters.length
    if (clusters.length < MIN_TERMS) errors.push(`佛名相: 只有 ${clusters.length} 个名相,至少 ${MIN_TERMS}`)
    if (clusters.length > MAX_TERMS) warnings.push(`佛名相: ${clusters.length} 个名相,超过规划上限 ${MAX_TERMS}`)
    const terms = new Set()
    for (const cl of clusters) {
      const t = `佛名相 ${cl.term || '(无名)'}`
      if (!cl.term || !cl.gloss) errors.push(`${t}: 缺 term/gloss`)
      if (terms.has(cl.term)) errors.push(`${t}: 名相重复`)
      terms.add(cl.term)
      for (const w of banned(cl.gloss)) errors.push(`${t}: gloss 含劝信/果报用字「${w}」`)
      const loci = cl.loci || []
      if (!loci.length) errors.push(`${t}: 没有落点`)
      else if (loci.length < 2) warnings.push(`${t}: 只有 1 个落点,横切不出对读`)
      const seen = new Set()
      for (const l of loci) {
        stats.loci++
        const where = `${t}: ${l.slug}#${l.ch}`
        if (l.corpus !== 'fo') errors.push(`${where} corpus 须为 fo`)
        if (!l.label || !l.label.includes('·')) errors.push(`${where} label 须为「书短名·位置」`)
        const key = `${l.slug}#${l.ch}`
        if (seen.has(key)) errors.push(`${where} 同一名相下重复指向同一章`)
        seen.add(key)
        const txt = getText(l.slug, l.ch)
        if (txt === undefined) { errors.push(`${t}: 无此书 ${l.slug}`); continue }
        if (txt === null) { errors.push(`${t}: ${l.slug} 无第 ${l.ch} 章`); continue }
        if (!l.kw || !txt.includes(l.kw)) errors.push(`${where} 原文中查不到「${l.kw}」`)
      }
    }
  }

  // ---- 名相环 ----
  const list = rings?.rings
  if (!Array.isArray(list)) errors.push('佛名相环: rings.json 缺 rings 数组')
  else {
    const ids = new Set()
    for (const ring of list) {
      const t = `佛名相环 ${ring.id || '(无 id)'}`
      if (!ring.id || !ring.title) errors.push(`${t}: 缺 id/title`)
      if (ids.has(ring.id)) errors.push(`${t}: id 重复`)
      ids.add(ring.id)
      const entries = [...(ring.center && typeof ring.center === 'object' ? [['center', ring.center]] : []), ...(ring.items || []).map((it, i) => [`items[${i}]`, it])]
      // 过 ring 件的 schema(按页面传给件的形状:src 只影响 quote/cite/href,这里用占位检形)
      const props = {
        items: (ring.items || []).map((it) => ({ label: it.label, ...(it.note ? { note: it.note } : {}) })),
        arrows: !!ring.arrows,
        ...(ring.loop !== undefined ? { loop: ring.loop } : {}),
        ...(ring.center ? { center: typeof ring.center === 'string' ? ring.center : { label: ring.center.label } } : {}),
        ...(ring.foot !== undefined ? { foot: ring.foot } : {}),
      }
      for (const m of validateRing(props)) errors.push(`${t}: ${m}`)
      for (const [where, e] of entries) {
        if (where !== 'center') stats.ringItems++
        if (!e.note) errors.push(`${t} ${e.label || where}: 缺 note`)
        for (const w of banned(e.note)) errors.push(`${t} ${e.label || where}: note 含劝信/果报用字「${w}」`)
        if (!e.src) continue
        const s = e.src
        const txt = getText(s.slug, s.ch)
        if (txt === undefined) { errors.push(`${t} ${e.label}: 无此书 ${s.slug}`); continue }
        if (txt === null) { errors.push(`${t} ${e.label}: ${s.slug} 无第 ${s.ch} 章`); continue }
        if (!s.quote || !txt.includes(s.quote)) errors.push(`${t} ${e.label}: 引文「${s.quote}」不是 ${s.slug}#${s.ch} 原文的精确子串`)
        else stats.ringQuotes++
        if (!s.label) errors.push(`${t} ${e.label}: src 缺 label(出处短名)`)
      }
      for (const w of banned(ring.foot)) errors.push(`${t}: foot 含劝信/果报用字「${w}」`)
      const labels = (ring.items || []).map((it) => it.label)
      if (ring.id === 'shieryinyuan' && labels.join('|') !== TWELVE_LINKS.join('|')) errors.push(`${t}: 须为十二支且按次第「${TWELVE_LINKS.join('→')}」,现为「${labels.join('→')}」`)
      if (ring.id === 'bazhengdao' && labels.join('|') !== EIGHT_PATH.join('|')) errors.push(`${t}: 须为八支「${EIGHT_PATH.join('、')}」,现为「${labels.join('、')}」`)
    }
  }
  return { errors, warnings, stats }
}

export default function check({ ROOT, err, warn, info, readJson }) {
  const cp = path.join(ROOT, CONCEPTS)
  const rp = path.join(ROOT, RINGS)
  if (!fs.existsSync(cp) && !fs.existsSync(rp)) return
  const read = readJson || ((p) => JSON.parse(fs.readFileSync(p, 'utf8')))
  const books = {}
  const getText = (slug, ch) => {
    if (!(slug in books)) {
      const bp = path.join(ROOT, CLASSICS, `${slug}.json`)
      books[slug] = fs.existsSync(bp) ? read(bp) : undefined
    }
    const b = books[slug]
    if (!b) return undefined
    const c = (b.chapters || []).find((x) => x.no === ch)
    if (!c) return null
    return (c.title || '') + c.paragraphs.map((p) => p.original).join('')
  }
  const concepts = fs.existsSync(cp) ? read(cp) : null
  const rings = fs.existsSync(rp) ? read(rp) : null
  if (!concepts) err(`佛名相: 缺 ${CONCEPTS}`)
  if (!rings) err(`佛名相环: 缺 ${RINGS}`)
  const { errors, warnings, stats } = checkFoData({ concepts: concepts || { clusters: [] }, rings: rings || { rings: [] }, getText })
  errors.forEach((m) => err(m))
  warnings.forEach((m) => warn(m))
  info(`佛名相索引: ${stats.terms} 概念 · ${stats.loci} 落点`)
  info(`佛名相环: ${(rings?.rings || []).length} 环 · ${stats.ringItems} 项 · 引经 ${stats.ringQuotes} 处`)
}
