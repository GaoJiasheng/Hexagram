// 参同契月相纳甲盘的校验闸(design-v24 §0.2 / §3)。数据:src/data/dao/cantongqi-moon.json(人工策展)。
//
// 逐条回查:
//   · 每一句 quote 是所指章(ch)原文的精确子串 —— 不许凭记忆引;
//   · hex 为 1–64 的整数,且对上 hexagram-table 的卦名,并且是该经卦重叠而成的八纯卦;
//   · 每一相:原句里确有卦名、天干、日数;dir 与天干五方一致(dirFrom=text 时原句里确有方位字);
//     seenFrom=text 时原句里确有「平明」/「昏」;第十八章的 echo 句含卦名、yao 句含第 i 爻的爻题;
//   · 坎离居中(方位属中、原句含卦名与天干);朔与合符两格齐;
//   · **十干恰好分完**:六相 6 干 + 坎离 2 干 + 朔 2 干 = 十干各一次;
//   · chapters 表的章题与原文章题一致;我方文字(note/intro)不带断语与工法用字。
//
// 默认导出 check(ctx),由 check-data.mjs 统一调用;validateMoonData 另供单测直接调。

import path from 'node:path'
import { buildHexagramIndex } from './hexagram-table.mjs'
import { GAN } from '../../src/features/shared/ganzhi/index.js'
import { ganFang, cnDay, MOON_STATIONS, stationsOf } from '../../src/features/shared/widgets/moon.js'

const HEX = buildHexagramIndex()
const YAO_TITLES = ['初九', '九二', '九三', '九四', '九五', '上九']
// 我方文字的红线:不下吉凶/成仙断语,不演火候工法(原文引句不在此列)。
const REDLINE_RE = /吉|凶|成仙|飞升|长生不死|火候|进火|退符|采药|结丹|服食/

/**
 * @param data  cantongqi-moon.json
 * @param ctx   { chapterText(corpus, slug, ch) → string|null, chapterTitle(slug, ch) → string|null }
 * @returns {{ errors: string[], warnings: string[], stats: { quotes: number, bridges: number } }}
 */
export function validateMoonData(data, { chapterText, chapterTitle }) {
  const errors = [], warnings = []
  const e = (m) => errors.push(m)
  let quotes = 0
  const slugOf = (o) => o.slug ?? data.slug
  const usedCh = new Set()

  const checkQuote = (o, where) => {
    if (!o || typeof o.quote !== 'string' || o.quote.length < 2) { e(`${where}: 缺 quote`); return false }
    if (!Number.isInteger(o.ch)) { e(`${where}: ch 须为整数`); return false }
    const txt = chapterText('dao', slugOf(o), o.ch)
    if (txt == null) { e(`${where}: 找不到 dao/${slugOf(o)} 第 ${o.ch} 章`); return false }
    usedCh.add(`${slugOf(o)}:${o.ch}`)
    quotes++
    if (!txt.includes(o.quote)) { e(`${where}: quote 不是第 ${o.ch} 章原文子串:「${o.quote}」`); return false }
    return true
  }
  const checkHex = (o, where) => {
    if (!Number.isInteger(o.hex) || o.hex < 1 || o.hex > 64) { e(`${where}: hex 须为 1–64 的整数: ${o.hex}`); return }
    const h = HEX[o.hex - 1]
    if (h.name !== o.name) e(`${where}: 第 ${o.hex} 卦是「${h.name}」,不是「${o.name}」`)
    if (h.upperTrigram !== h.lowerTrigram) e(`${where}: 第 ${o.hex} 卦不是八纯卦`)
  }
  const noteOk = (s, where) => {
    if (s == null) return
    if (typeof s !== 'string' || !s) { e(`${where}: note 须为非空字符串`); return }
    const m = s.match(REDLINE_RE)
    if (m) e(`${where}: 我方文字带红线字「${m[0]}」(讲取象,不下断语、不演工法)`)
  }

  if (typeof data.slug !== 'string' || !data.slug) e('缺顶层 slug')
  if (typeof data.intro !== 'string' || !data.intro) e('缺 intro')
  else noteOk(data.intro, 'intro')
  if (!Array.isArray(data.caveats) || !data.caveats.length || !data.caveats.every((c) => typeof c === 'string' && c)) e('caveats 须为非空字符串数组')

  // ── 六相 ────────────────────────────────────────────
  const phases = Array.isArray(data.phases) ? data.phases : []
  if (phases.length !== 6) e(`phases 须为 6 相,现 ${phases.length}`)
  let lastDay = 0
  phases.forEach((p, i) => {
    const w = `phases[${i}](${p.name ?? '?'})`
    if (!Number.isInteger(p.day) || p.day < 1 || p.day > 30) e(`${w}: day 须为 1–30`)
    else if (p.day <= lastDay) e(`${w}: day 须按月内先后递增`)
    lastDay = p.day ?? lastDay
    checkHex(p, w)
    if (!GAN.includes(p.gan)) e(`${w}: gan 不是天干: ${p.gan}`)
    else if (ganFang(p.gan) !== p.dir) e(`${w}: ${p.gan} 属${ganFang(p.gan)}方,dir 却是「${p.dir}」`)
    if (!['text', 'gan'].includes(p.dirFrom)) e(`${w}: dirFrom 只许 text/gan`)
    if (!['昏', '旦'].includes(p.seen)) e(`${w}: seen 只许 昏/旦`)
    if (!['text', 'trad'].includes(p.seenFrom)) e(`${w}: seenFrom 只许 text/trad`)
    if (!(typeof p.label === 'string' && p.label)) e(`${w}: 缺 label`)
    if (checkQuote(p, w)) {
      if (!p.quote.includes(p.name)) e(`${w}: 原句里没有卦名「${p.name}」`)
      if (!p.quote.includes(p.gan)) e(`${w}: 原句里没有天干「${p.gan}」`)
      if (Number.isInteger(p.day) && !p.quote.includes(cnDay(p.day))) e(`${w}: 原句里没有日数「${cnDay(p.day)}」`)
      if (p.dirFrom === 'text' && !p.quote.includes(p.dir)) e(`${w}: dirFrom=text 但原句里没有「${p.dir}」`)
      if (p.seenFrom === 'text' && !p.quote.includes(p.seen === '旦' ? '平明' : '昏')) e(`${w}: seenFrom=text 但原句里没有见月时刻`)
    }
    if (checkQuote(p.echo, `${w}.echo`) && !p.echo.quote.includes(p.name)) e(`${w}.echo: 对读句里没有卦名「${p.name}」`)
    if (checkQuote(p.yao, `${w}.yao`) && !p.yao.quote.includes(YAO_TITLES[i])) e(`${w}.yao: 第 ${i + 1} 相应对「${YAO_TITLES[i]}」,原句是「${p.yao?.quote}」`)
    noteOk(p.note, w)
  })
  // 六相的昏旦须前三后三(盘上内外两圈由它排),方位须两回都走 西→南→东
  const seens = phases.map((p) => p.seen).join('')
  if (phases.length === 6 && seens !== '昏昏昏旦旦旦') e(`phases 的 seen 须前半月三昏、后半月三旦,现「${seens}」`)
  const dirs = phases.map((p) => p.dir).join('')
  if (phases.length === 6 && dirs !== '西南东西南东') warnings.push(`phases 的方位序为「${dirs}」,盘面按 西南东 两回布局`)

  // ── 坎离居中 ─────────────────────────────────────────
  const center = Array.isArray(data.center) ? data.center : []
  if (center.length !== 2) e(`center 须为坎离二卦,现 ${center.length}`)
  center.forEach((c, i) => {
    const w = `center[${i}](${c.name ?? '?'})`
    checkHex(c, w)
    if (!GAN.includes(c.gan)) e(`${w}: gan 不是天干: ${c.gan}`)
    else if (ganFang(c.gan) !== '中') e(`${w}: ${c.gan} 不属中央,不能居中`)
    if (checkQuote(c, w)) {
      if (!c.quote.includes(c.name)) e(`${w}: 原句里没有卦名「${c.name}」`)
      if (!c.quote.includes(c.gan)) e(`${w}: 原句里没有天干「${c.gan}」`)
    }
  })
  if (checkQuote(data.centerNote, 'centerNote') && center.length && !center.every((c) => data.centerNote.quote.includes(c.gan))) e('centerNote: 原句须点出戊己')

  // ── 朔 · 晦朔合符 ────────────────────────────────────
  const junctions = Array.isArray(data.junctions) ? data.junctions : []
  const shuo = junctions.find((j) => j.key === 'shuo')
  const hefu = junctions.find((j) => j.key === 'hefu')
  if (!shuo) e('junctions 缺 shuo(朔)')
  else {
    if (!Number.isInteger(shuo.day) || shuo.day < 1 || shuo.day >= (phases[0]?.day ?? 3)) e('shuo.day 须在第一相之前')
    if (!Array.isArray(shuo.gan) || !shuo.gan.length || !shuo.gan.every((g) => GAN.includes(g))) e('shuo.gan 须为天干数组')
    else if (!shuo.gan.every((g) => ganFang(g) === '北')) e('shuo.gan 须为北方之干(壬癸)')
    checkQuote(shuo, 'shuo')
    if (checkQuote(shuo.also, 'shuo.also') && Array.isArray(shuo.gan) && !shuo.gan.every((g) => shuo.also.quote.includes(g))) e('shuo.also: 原句里须有壬癸')
    noteOk(shuo.note, 'shuo')
  }
  if (!hefu) e('junctions 缺 hefu(晦朔合符)')
  else {
    if (checkQuote(hefu, 'hefu') && !/晦|朔/.test(hefu.quote)) e('hefu: 原句里须有晦朔')
    noteOk(hefu.note, 'hefu')
  }

  // ── 十干恰好分完 ────────────────────────────────────
  const all = [...phases.map((p) => p.gan), ...center.map((c) => c.gan), ...(Array.isArray(shuo?.gan) ? shuo.gan : [])]
  const missing = GAN.filter((g) => !all.includes(g))
  const dup = all.filter((g, i) => all.indexOf(g) !== i)
  if (missing.length || dup.length) e(`十干须恰好分完:缺 ${missing.join('') || '无'},重复 ${dup.join('') || '无'}`)

  // ── 盘上八格 ────────────────────────────────────────
  try {
    const st = stationsOf(data)
    if (st.length !== MOON_STATIONS) e(`盘上格数须为 ${MOON_STATIONS},现 ${st.length}`)
  } catch (ex) { e(`盘上八格排不出来: ${ex.message}`) }

  // ── 章题 ────────────────────────────────────────────
  if (typeof data.chapters !== 'object' || !data.chapters) e('缺 chapters(章号 → 章题)')
  else {
    for (const k of usedCh) {
      const [slug, ch] = k.split(':')
      const want = chapterTitle(slug, Number(ch))
      const got = data.chapters[ch]
      if (!got) e(`chapters 缺第 ${ch} 章的章题`)
      else if (want !== got) e(`chapters[${ch}]「${got}」与原文章题「${want}」不符`)
    }
  }

  const bridges = new Set([...phases, ...center].map((o) => o.hex).filter(Number.isInteger)).size
  return { errors, warnings, stats: { quotes, bridges } }
}

export default function check({ ROOT, err, warn, info, readJson, chapterText }) {
  const f = path.join(ROOT, 'src/data/dao/cantongqi-moon.json')
  let data
  try { data = readJson(f) } catch (ex) { err(`参同契月相盘: 读不到 ${f}——${ex.message}`); return }
  const books = {}
  const chapterTitle = (slug, ch) => {
    if (!(slug in books)) {
      try { books[slug] = readJson(path.join(ROOT, `src/data/dao/classics/${slug}.json`)) } catch { books[slug] = null }
    }
    return books[slug]?.chapters?.find((c) => c.no === ch)?.title ?? null
  }
  const { errors, warnings, stats } = validateMoonData(data, { chapterText, chapterTitle })
  for (const m of errors) err(`参同契月相盘: ${m}`)
  for (const m of warnings) warn(`参同契月相盘: ${m}`)
  info(`参同契月相纳甲盘: 6 相 + 坎离 2 中 + 朔/合符 · ${stats.quotes} 句引文逐字回查 · 桥 ${stats.bridges} 卦(八纯卦)· 十干分完`)
}
