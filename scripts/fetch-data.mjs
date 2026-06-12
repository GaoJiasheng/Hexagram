// 从维基文库(zh.wikisource.org)抓取周易原文,解析为站点数据文件。
// 产出:src/data/yijing/hexagrams.json、src/data/yijing/classics/*.json
// 原则:原文一律来自抓取结果,不允许手工凭记忆补写;译文/拼音/提要来自 scripts/authored/。
// 响应缓存在 scripts/.cache/,重跑不重复请求;改解析逻辑后直接重跑即可。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRIGRAMS, TABLE, buildHexagramIndex, TRAD_TRIGRAM_CHAR, lineTitle } from './lib/hexagram-table.mjs'
import { t2s, clean, isJunk as isJunkBase, apiGet, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json')
const OUT_HEX = path.join(ROOT, 'src/data/yijing/hexagrams.json')
const OUT_CLASSICS_DIR = path.join(ROOT, 'src/data/yijing/classics')

// 抓取/繁简/清洗工具来自共享库(v6 §1.1);此处只保留周易专属的垃圾行规则
const { fetchPages } = createFetcher(CACHE_FILE)
const isJunk = (text) => isJunkBase(text) || /^周易/.test(text) // 「周易 第三卦」一类导航行

// 页面名繁简差异的兜底别名(t2s 覆盖不到时)
const NAME_ALIAS = { 遯: '遁' }

// ---------- 卦页面解析 ----------
const LINE_TITLE_RE = /^(初[九六]|[九六][二三四五]|上[九六]|用[九六])[:\uFF1A,\uFF0C]\s*/

function parseHexagramPage(wikitext, pageName) {
  let section = null
  let judgment = null
  let composition = null
  let daxiang = null
  const jingItems = []
  const tuanParas = []
  const xiangItems = []
  const wenyanParas = []
  const warnings = []

  for (const raw of wikitext.split('\n')) {
    const m = raw.match(/^(\*#|\*{3}|\*{2}|\*:|\*|;|:)/)
    const marker = m ? m[1] : ''
    const text = clean(raw.slice(marker.length))
    if (!text || (marker === '' && isJunk(text)) || marker === ';') continue

    if (/^易經[:\uFF1A]?$/.test(text)) { section = 'jing'; continue }
    if (/^彖曰[:\uFF1A]?$/.test(text)) { section = 'tuan'; continue }
    if (/^象曰[:\uFF1A]?$/.test(text)) { section = 'xiang'; continue }
    if (/^文言曰[:\uFF1A]?$/.test(text)) { section = 'wenyan'; continue }

    if (marker === '') {
      const c = text.match(/^(.)下(.)上$/)
      if (c) composition = c
      continue
    }

    if (section === 'jing') {
      if (marker === '*#') jingItems.push(text)
      else if (marker === '**' && !judgment) judgment = text
      else if (marker === '***' && judgment) judgment += text // 卦辞续行(如坤)
      else warnings.push(`${pageName}: 易經区有未识别行(${marker})${text.slice(0, 20)}`)
    } else if (section === 'tuan') {
      tuanParas.push(text)
    } else if (section === 'xiang') {
      if (marker === '*#') xiangItems.push(text)
      else if (!daxiang) daxiang = text
      else warnings.push(`${pageName}: 象曰区有多余段落:${text.slice(0, 20)}`)
    } else if (section === 'wenyan') {
      wenyanParas.push(text)
    } else if (text && marker !== '') {
      warnings.push(`${pageName}: 无章节归属的行(${marker})${text.slice(0, 20)}`)
    }
  }

  return { judgment, composition, jingItems, tuanParas, daxiang, xiangItems, wenyanParas, warnings }
}

function assembleHexagram(record, parsed, pageName) {
  const errors = []
  const { judgment, composition, jingItems, tuanParas, daxiang, xiangItems, wenyanParas } = parsed

  // 卦体交叉校验:页面「X下Y上」必须与基准表一致
  if (!composition) errors.push(`${pageName}: 未找到「X下Y上」卦体行`)
  else {
    const lowerKey = TRAD_TRIGRAM_CHAR[composition[1]]
    const upperKey = TRAD_TRIGRAM_CHAR[composition[2]]
    if (lowerKey !== record.lowerTrigram || upperKey !== record.upperTrigram) {
      errors.push(`${pageName}: 卦体不符,页面=${composition[0]},基准表=${record.lowerTrigram}下${record.upperTrigram}上`)
    }
  }

  if (!judgment) errors.push(`${pageName}: 缺卦辞`)
  if (!tuanParas.length) errors.push(`${pageName}: 缺彖传`)
  if (!daxiang) errors.push(`${pageName}: 缺大象传`)

  // 拆出用九/用六
  const useItem = jingItems.find((t) => /^用[九六]/.test(t))
  const lineItems = jingItems.filter((t) => t !== useItem)
  if (lineItems.length !== 6) errors.push(`${pageName}: 爻辞应为 6 条,实得 ${lineItems.length}`)

  const useXiang = xiangItems.length === 7 ? xiangItems.find((t) => /^用[九六]/.test(t)) : undefined
  const lineXiangs = xiangItems.filter((t) => t !== useXiang)
  if (lineXiangs.length !== 6) errors.push(`${pageName}: 小象应为 6 条,实得 ${lineXiangs.length}`)

  const lines = lineItems.map((item, i) => {
    const tm = item.match(LINE_TITLE_RE)
    const expected = lineTitle(i + 1, record.binary[i] === '1')
    if (!tm) {
      errors.push(`${pageName}: 第 ${i + 1} 爻无法解析爻题:${item.slice(0, 12)}`)
      return null
    }
    if (tm[1] !== expected) errors.push(`${pageName}: 第 ${i + 1} 爻爻题 ${tm[1]} 与卦画(应为 ${expected})不符`)
    return {
      title: tm[1],
      original: t2s(item.slice(tm[0].length)),
      translation: null,
      xiaoxiang: { original: t2s('象曰\uFF1A' + (lineXiangs[i] ?? '')), translation: null },
    }
  })

  let extra = null
  if (record.id === 1 || record.id === 2) {
    if (!useItem || !wenyanParas.length) errors.push(`${pageName}: 乾/坤应有用九(六)与文言`)
    const um = useItem?.match(LINE_TITLE_RE)
    extra = {
      use: useItem
        ? {
            title: um[1],
            original: t2s(useItem.slice(um[0].length)),
            translation: null,
            xiaoxiang: useXiang ? { original: t2s('象曰\uFF1A' + useXiang), translation: null } : null,
          }
        : null,
      wenyan: wenyanParas.map((p) => ({ original: t2s(p), translation: null })),
    }
  } else if (useItem || wenyanParas.length) {
    errors.push(`${pageName}: 非乾坤却出现用九(六)或文言`)
  }

  const daxiangSimp = t2s(daxiang ?? '')
  const imagery = daxiangSimp.split(/[,\uFF0C;\uFF1B](?:君子|先王|大人|上|后)以/)[0]

  return {
    errors,
    hexagram: {
      id: record.id,
      name: record.name,
      fullName: record.fullName,
      pinyin: null, // 由 authored 合并
      binary: record.binary,
      upperTrigram: record.upperTrigram,
      lowerTrigram: record.lowerTrigram,
      summary: null, // 由 authored 合并
      imagery,
      judgment: { original: t2s(judgment ?? ''), translation: null },
      tuan: { original: t2s('彖曰\uFF1A' + tuanParas.join('\n')), translation: null },
      daxiang: { original: '象曰\uFF1A' + daxiangSimp, translation: null },
      lines,
      extra,
      xugua: null, // M3:从序卦传按卦提取
      zagua: null, // M3:从杂卦传按卦提取
      palace: null, // 可选:京房八宫,后续补
    },
  }
}

// ---------- 经传页面解析(==第X章== 标题 + 段落) ----------
function parseWingPage(wikitext) {
  const chapters = []
  let current = null
  for (const raw of wikitext.split('\n')) {
    const h = raw.match(/^==+\s*(.+?)\s*==+$/)
    if (h) {
      const title = t2s(clean(h[1]))
      // 跳过校勘/校诂等对照版本章节,只保留正文
      if (/校诂|校勘|考异|注疏/.test(title)) { current = { skip: true, paragraphs: [] }; continue }
      current = { no: chapters.length + 1, title, paragraphs: [] }
      chapters.push(current)
      continue
    }
    const text = clean(raw.replace(/^[*#:;]+/, '')).replace(/^[:\uFF1A]\s*/, '')
    if (isJunk(text)) continue
    if (!current) {
      current = { no: 1, title: null, paragraphs: [] }
      chapters.push(current)
    }
    current.paragraphs.push({ original: t2s(text), translation: null })
  }
  return chapters.filter((c) => !c.skip && c.paragraphs.length > 0).map((c, i) => ({ ...c, no: i + 1 }))
}

const WING_BOOKS = [
  { key: 'xici-shang', page: '周易/繫辭上', title: '系辞上' },
  { key: 'xici-xia', page: '周易/繫辭下', title: '系辞下' },
  { key: 'shuogua', page: '周易/說卦', title: '说卦' },
  { key: 'xugua', page: '周易/序卦', title: '序卦' },
  { key: 'zagua', page: '周易/雜卦', title: '杂卦' },
]

// ---------- 主流程 ----------
async function main() {
  const index = buildHexagramIndex()
  const byName = new Map(index.map((r) => [r.name, r]))

  // 1. 列出周易子页面,匹配出 64 卦页面
  const listData = await apiGet({ action: 'query', list: 'allpages', apprefix: '周易/', aplimit: '500' })
  const subpages = listData.query.allpages.map((p) => p.title)
  const hexPages = new Map() // 卦名 → 页面标题
  for (const title of subpages) {
    const part = title.split('/')[1]
    const simp = byName.has(part) ? part : (NAME_ALIAS[part] ?? t2s(part))
    if (byName.has(simp)) hexPages.set(simp, title)
  }
  const missingNames = index.filter((r) => !hexPages.has(r.name)).map((r) => r.name)
  if (missingNames.length) throw new Error(`未在维基文库找到卦页面: ${missingNames.join('、')}`)
  console.log(`匹配到 ${hexPages.size}/64 个卦页面`)

  // 2. 抓取全部页面
  const pages = await fetchPages([...hexPages.values(), ...WING_BOOKS.map((b) => b.page)])

  // 3. 解析 64 卦
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/authored/hexagram-meta.json'), 'utf8'))
  const translations = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/authored/translations.json'), 'utf8'))
  const allErrors = []
  const allWarnings = []
  const hexagrams = []

  for (const record of index) {
    const pageName = hexPages.get(record.name)
    const parsed = parseHexagramPage(pages[pageName], pageName)
    allWarnings.push(...parsed.warnings)
    const { errors, hexagram } = assembleHexagram(record, parsed, pageName)
    allErrors.push(...errors)

    const m = meta[String(record.id)]
    if (!m) allErrors.push(`缺 authored 元数据: ${record.id} ${record.name}`)
    hexagram.pinyin = m?.pinyin ?? null
    hexagram.summary = m?.summary ?? null
    hexagram.guazhu = m?.guazhu ?? null  // 卦主 { line, note }(v2 §4,渐进补)

    const tr = translations[String(record.id)]
    if (tr) {
      hexagram.judgment.translation = tr.judgment ?? null
      hexagram.tuan.translation = tr.tuan ?? null
      hexagram.daxiang.translation = tr.daxiang ?? null
      tr.lines?.forEach((lt, i) => {
        if (hexagram.lines[i]) {
          hexagram.lines[i].translation = lt.text ?? null
          hexagram.lines[i].xiaoxiang.translation = lt.xiaoxiang ?? null
        }
      })
      // 乾坤的用九/用六(extra.use)
      if (tr.use && hexagram.extra?.use) {
        hexagram.extra.use.translation = tr.use.text ?? null
        if (hexagram.extra.use.xiaoxiang) {
          hexagram.extra.use.xiaoxiang.translation = tr.use.xiaoxiang ?? null
        }
      }
      // 乾坤的文言传(按段对位)
      if (tr.wenyan && hexagram.extra?.wenyan) {
        tr.wenyan.forEach((s, i) => {
          if (hexagram.extra.wenyan[i]) hexagram.extra.wenyan[i].translation = s ?? null
        })
      }
    }
    hexagrams.push(hexagram)
  }

  // 4. 解析经传(并合并人工译文 scripts/authored/classics-translations.json)
  const classicsTrPath = path.join(ROOT, 'scripts/authored/classics-translations.json')
  const classicsTranslations = fs.existsSync(classicsTrPath)
    ? JSON.parse(fs.readFileSync(classicsTrPath, 'utf8'))
    : {}
  fs.mkdirSync(OUT_CLASSICS_DIR, { recursive: true })
  const wingData = {}
  for (const book of WING_BOOKS) {
    const chapters = parseWingPage(pages[book.page])
    if (!chapters.length) allErrors.push(`${book.page}: 未解析出任何章节`)
    const trBook = classicsTranslations[book.key] || {}
    let trCount = 0
    for (const c of chapters) {
      const trs = trBook[String(c.no)]
      if (!trs) continue
      c.paragraphs.forEach((p, i) => {
        if (trs[i] != null) { p.translation = trs[i]; trCount++ }
      })
    }
    wingData[book.key] = chapters
    const out = { book: book.key, title: book.title, chapters }
    fs.writeFileSync(path.join(OUT_CLASSICS_DIR, `${book.key}.json`), JSON.stringify(out, null, 2) + '\n')
    console.log(`${book.title}: ${chapters.length} 章,${chapters.reduce((n, c) => n + c.paragraphs.length, 0)} 段,译文 ${trCount} 段`)
  }

  // 4.5 从序卦/杂卦全文切出按卦引文(自动填 hexagram.xugua / zagua)
  const xuguaParas = (wingData.xugua || []).flatMap((c) => c.paragraphs.map((p) => p.original))
  const zaguaParas = (wingData.zagua || []).flatMap((c) => c.paragraphs.map((p) => p.original))
  let quoteCount = 0
  const xiaPianFirst = wingData.xugua?.[1]?.paragraphs?.[0]?.original ?? null
  for (const hexagram of hexagrams) {
    // 序卦:取含「受之以X」的段(底本偶作「受之X」,如既济);
    // 乾坤无此句取上篇开篇段,咸为下篇首卦取下篇开篇段
    hexagram.xugua = (hexagram.name === '乾' || hexagram.name === '坤')
      ? xuguaParas[0] ?? null
      : hexagram.name === '咸'
        ? xiaPianFirst
        : xuguaParas.find((p) => p.includes(`受之以${hexagram.name}`) || p.includes(`受之${hexagram.name}`)) ?? null
    // 杂卦:每卦名全篇仅出现一次,取含卦名的段
    hexagram.zagua = zaguaParas.find((p) => p.includes(hexagram.name)) ?? null
    if (hexagram.xugua && hexagram.zagua) quoteCount++
    if (!hexagram.xugua) allWarnings.push(`序卦引文缺失: ${hexagram.id} ${hexagram.name}`)
    if (!hexagram.zagua) allWarnings.push(`杂卦引文缺失: ${hexagram.id} ${hexagram.name}`)
  }
  console.log(`序卦/杂卦引文: ${quoteCount}/64 卦齐备`)

  // 5. 报告与落盘
  if (allWarnings.length) {
    console.log(`\n警告 ${allWarnings.length} 条:`)
    for (const w of allWarnings.slice(0, 30)) console.log('  -', w)
  }
  if (allErrors.length) {
    console.error(`\n错误 ${allErrors.length} 条:`)
    for (const e of allErrors) console.error('  -', e)
    process.exit(1)
  }

  fs.writeFileSync(OUT_HEX, JSON.stringify(hexagrams, null, 2) + '\n')
  const translated = hexagrams.filter((h) => h.judgment.translation).length
  console.log(`\n已写入 ${OUT_HEX}(64 卦,译文覆盖 ${translated}/64)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
