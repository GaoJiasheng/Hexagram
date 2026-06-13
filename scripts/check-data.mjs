// 数据校验:独立于抓取逻辑,从磁盘读取生成的数据文件做三层校验。
// 1) 结构:64 卦齐全、字段完整、binary 与上下卦一致、爻题与卦画阴阳互证
// 2) 内容抽查:若干已知原文片段必须存在(防解析错位/繁简事故)
// 3) 卦变自检:互/错/综的推演结果必须命中已知事实(如屯互剥、屯错鼎、屯综蒙)
// 错误 → 退出码 1;译文缺失等只作为信息项报告。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { TRIGRAMS, buildHexagramIndex, lineTitle } from './lib/hexagram-table.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const infos = []

function err(msg) {
  errors.push(msg)
}

// ---------- 读取 ----------
const hexagrams = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
const trigrams = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/trigrams.json'), 'utf8'))

// ---------- 1. 结构校验 ----------
if (hexagrams.length !== 64) err(`卦数应为 64,实为 ${hexagrams.length}`)

const index = buildHexagramIndex()
const byBinary = new Map()
const byId = new Map()

for (const h of hexagrams) {
  const ref = index.find((r) => r.id === h.id)
  if (!ref) {
    err(`未知卦序: ${h.id}`)
    continue
  }
  if (byId.has(h.id)) err(`卦序重复: ${h.id}`)
  byId.set(h.id, h)
  if (byBinary.has(h.binary)) err(`binary 重复: ${h.binary}`)
  byBinary.set(h.binary, h)

  if (h.name !== ref.name) err(`#${h.id} 卦名 ${h.name} 与基准表 ${ref.name} 不符`)
  if (h.binary !== ref.binary) err(`#${h.id} ${h.name} binary ${h.binary} 与基准表 ${ref.binary} 不符`)
  if (!/^[01]{6}$/.test(h.binary)) err(`#${h.id} binary 非法: ${h.binary}`)

  const lower = TRIGRAMS[h.lowerTrigram]
  const upper = TRIGRAMS[h.upperTrigram]
  if (!lower || !upper) err(`#${h.id} 上下卦 key 非法`)
  else if (lower.binary + upper.binary !== h.binary) err(`#${h.id} binary 与上下卦组成不一致`)

  for (const field of ['fullName', 'pinyin', 'summary', 'imagery']) {
    if (!h[field]) err(`#${h.id} ${h.name} 缺 ${field}`)
  }
  for (const field of ['judgment', 'tuan', 'daxiang']) {
    if (!h[field]?.original) err(`#${h.id} ${h.name} 缺 ${field}.original`)
  }
  if (h.summary && h.summary.length > 14) err(`#${h.id} summary 超过 14 字: ${h.summary}`)

  if (!Array.isArray(h.lines) || h.lines.length !== 6) {
    err(`#${h.id} ${h.name} 爻数应为 6`)
    continue
  }
  h.lines.forEach((line, i) => {
    const expected = lineTitle(i + 1, h.binary[i] === '1')
    if (line.title !== expected) err(`#${h.id} ${h.name} 第 ${i + 1} 爻题 ${line.title},按卦画应为 ${expected}`)
    if (!line.original) err(`#${h.id} ${h.name} ${line.title} 缺爻辞`)
    if (!line.xiaoxiang?.original) err(`#${h.id} ${h.name} ${line.title} 缺小象`)
  })

  if (h.id === 1 || h.id === 2) {
    if (!h.extra?.use?.original) err(`#${h.id} ${h.name} 缺用九/用六`)
    if (!h.extra?.wenyan?.length) err(`#${h.id} ${h.name} 缺文言`)
    const expectUse = h.id === 1 ? '用九' : '用六'
    if (h.extra?.use?.title !== expectUse) err(`#${h.id} use.title 应为 ${expectUse}`)
  } else if (h.extra !== null) {
    err(`#${h.id} ${h.name} 不应有 extra`)
  }
}

// ---------- 2. 内容抽查(已知原文片段) ----------
const SPOT_CHECKS = [
  [1, 'judgment', '元亨'],
  [1, 'daxiang', '天行健'],
  [2, 'daxiang', '厚德载物'],
  [2, 'judgment', '利牝马之贞'],
  [3, 'judgment', '利建侯'],
  [15, 'daxiang', '地中有山'],
  [63, 'daxiang', '水在火上'],
]
for (const [id, field, fragment] of SPOT_CHECKS) {
  const h = byId.get(id)
  if (h && !h[field]?.original?.includes(fragment)) {
    err(`抽查失败: #${id} ${h?.name} ${field} 应含「${fragment}」,实为: ${h?.[field]?.original?.slice(0, 30)}`)
  }
}
const h3 = byId.get(3)
if (h3 && !h3.lines[0].original.includes('磐桓')) err('抽查失败: 屯初九应含「磐桓」')
// 繁简转换事故哨兵(经传文件在下方读取后并入)
let corpus = JSON.stringify(hexagrams)

// ---------- 3. 卦变自检 ----------
const flip = (b) => [...b].map((c) => (c === '1' ? '0' : '1')).join('')
const hu = (b) => b.slice(1, 4) + b.slice(2, 5) // 互卦:2,3,4 爻为下卦,3,4,5 爻为上卦
const zong = (b) => [...b].reverse().join('')
const nameOf = (b) => byBinary.get(b)?.name ?? `?${b}`

const DERIVATION_CHECKS = [
  ['互卦', hu, 3, '剥'],
  ['互卦', hu, 1, '乾'],
  ['错卦', flip, 3, '鼎'],
  ['错卦', flip, 1, '坤'],
  ['综卦', zong, 3, '蒙'],
  ['综卦', zong, 11, '否'],
  ['综卦', zong, 1, '乾'],
]
for (const [kind, fn, id, expected] of DERIVATION_CHECKS) {
  const h = byId.get(id)
  if (!h) continue
  const got = nameOf(fn(h.binary))
  if (got !== expected) err(`卦变自检失败: ${h.name} 的${kind}应为 ${expected},实得 ${got}`)
}

// ---------- 4. 经传文件 ----------
const BOOKS = [
  ['xici-shang', 12],
  ['xici-xia', 9], // 维基文库底本按孔颖达九章分;若换底本需同步调整
  ['shuogua', 11],
  ['xugua', 1],
  ['zagua', 1],
]
for (const [key, minChapters] of BOOKS) {
  const file = path.join(ROOT, `src/data/yijing/classics/${key}.json`)
  if (!fs.existsSync(file)) {
    err(`缺经传文件: ${key}.json`)
    continue
  }
  const book = JSON.parse(fs.readFileSync(file, 'utf8'))
  corpus += JSON.stringify(book)
  if (!book.chapters?.length || book.chapters.length < minChapters) {
    err(`${key} 章数 ${book.chapters?.length ?? 0},应不少于 ${minChapters}`)
  }
  for (const c of book.chapters ?? []) {
    if (!c.paragraphs?.length) err(`${key} 第 ${c.no} 章无段落`)
    for (const p of c.paragraphs ?? []) if (!p.original) err(`${key} 第 ${c.no} 章有空段落`)
  }
}

// 繁简转换事故哨兵(覆盖 64 卦 + 经传全文)
for (const bad of ['干道', '干卦', '干元', '遯', '無', '當', '見', '龍']) {
  if (corpus.includes(bad)) err(`正文残留繁体/误转字: ${bad}`)
}

// ---------- 4b. 读经类 corpus(道藏/儒/佛 共用一套;v6 §1.3;v14 §4 书目从 texts.json 派生;v16 §1 泛化) ----------
// 校验某 corpus:章数=texts.json sections、空段、繁体哨兵、译文/延伸覆盖、authorNote。
// status=pending 的书尚未录原文,跳过(不要求 classics 文件)。返回 {meta, data} 供 §7.3 锚注校验复用。
function checkReadingCorpus(label, key, yanyiUnit) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${key}/texts.json`), 'utf8'))
  const data = {}
  let str = ''
  for (const t of meta) {
    if (t.status === 'pending') continue
    const file = path.join(ROOT, `src/data/${key}/classics/${t.slug}.json`)
    if (!fs.existsSync(file)) { err(`缺${label}文件: ${t.slug}.json`); continue }
    const book = JSON.parse(fs.readFileSync(file, 'utf8'))
    data[t.slug] = book
    str += JSON.stringify(book)
    if ((book.chapters?.length ?? 0) !== t.sections) err(`${label} ${t.slug} 章数 ${book.chapters?.length ?? 0},应为 ${t.sections}`)
    for (const c of book.chapters ?? []) {
      if (!c.paragraphs?.length) err(`${label} ${t.slug} 第 ${c.no} ${t.sectionUnit}无段落`)
      for (const p of c.paragraphs ?? []) {
        if (!p.original) err(`${label} ${t.slug} 第 ${c.no} ${t.sectionUnit}有空段落`)
        // 管线残文哨兵:正文段不应以 wiki 标记起首(]] [[ | { } = * #,如断行 override_author 漏出的
        // 「]]及其弟子…」),也不应含页脚导航(「上一篇/回目录/下一篇」)。命中即管线漏切,修 fetch-corpus 后重抓。
        else if (/^[\]\[|{}=*#]/.test(p.original) || /回目[录錄]|^(?:上|下)一[篇章卷]/.test(p.original)) {
          err(`${label} ${t.slug} 第 ${c.no} ${t.sectionUnit}残留管线/导航残文: ${p.original.slice(0, 20)}`)
        }
      }
    }
    if (!t.authorNote) err(`${label} ${t.slug} 缺 authorNote 撰人小传`)
  }
  for (const bad of ['遯', '無', '當', '見', '龍', '萬', '隂', '干坤']) {
    if (str.includes(bad)) err(`${label}正文残留繁体/异体/误转字: ${bad}`)
  }
  // 译文覆盖仪表(断点续作依据)
  const trCover = []
  for (const t of meta) {
    const book = data[t.slug]
    if (!book) continue
    const total = book.chapters.reduce((n, c) => n + c.paragraphs.length, 0)
    const done = book.chapters.reduce((n, c) => n + c.paragraphs.filter((p) => p.translation).length, 0)
    trCover.push(`${book.title} ${done}/${total}`)
  }
  if (trCover.length) infos.push(`${label}译文(段): ${trCover.join(' · ')}`)

  // 每章/篇延伸(v13 §2:yanyi.json 人工 registry,脱锚叙述)
  const yanyiPath = path.join(ROOT, `src/data/${key}/yanyi.json`)
  if (fs.existsSync(yanyiPath)) {
    const yanyi = JSON.parse(fs.readFileSync(yanyiPath, 'utf8'))
    const yanyiCover = []
    for (const t of meta) {
      const book = data[t.slug]
      if (!book) continue
      const chapters = yanyi[t.slug] || {}
      for (const [no, paras] of Object.entries(chapters)) {
        const n = Number(no)
        if (!(n >= 1 && n <= t.sections)) err(`${label}延伸 ${t.slug} 章号越界: ${no}`)
        if (!Array.isArray(paras) || !paras.length || paras.some((p) => !p)) err(`${label}延伸 ${t.slug} 第 ${no} 章段落为空`)
      }
      yanyiCover.push(`${book.title} ${Object.keys(chapters).length}/${t.sections}`)
    }
    for (const slug of Object.keys(yanyi)) {
      if (!meta.some((t) => t.slug === slug)) err(`${label}延伸 slug 非书目: ${slug}`)
    }
    if (yanyiCover.length) infos.push(`${label}延伸(${yanyiUnit}): ${yanyiCover.join(' · ')}`)
  }
  return { meta, data }
}

const daoBooks = checkReadingCorpus('道藏', 'dao', '章')
const ruBooks = checkReadingCorpus('儒典', 'ru', '篇')
const foBooks = checkReadingCorpus('释典', 'fo', '品')

// ---------- 4c. 筮例(v9 §1) ----------
{
  const shiliPath = path.join(ROOT, 'src/data/yijing/shili.json')
  if (fs.existsSync(shiliPath)) {
    const shili = JSON.parse(fs.readFileSync(shiliPath, 'utf8'))
    if (shili.length < 19) err(`筮例应不少于 19 条,实为 ${shili.length}`)
    const ids = new Set()
    for (const s of shili) {
      if (ids.has(s.id)) err(`筮例 id 重复: ${s.id}`)
      ids.add(s.id)
      if (!s.paragraphs?.length || s.paragraphs.some((p) => !p.original)) err(`筮例 ${s.id} 原文为空`)
      if (!['shi', 'yin'].includes(s.kind)) err(`筮例 ${s.id} kind 非法: ${s.kind}`)
      for (const c of s.casts ?? []) {
        if (!(Number.isInteger(c.ben) && c.ben >= 1 && c.ben <= 64)) err(`筮例 ${s.id} 本卦卦序非法: ${c.ben}`)
        if (c.zhi !== null && !(Number.isInteger(c.zhi) && c.zhi >= 1 && c.zhi <= 64)) err(`筮例 ${s.id} 之卦卦序非法: ${c.zhi}`)
      }
      if (!s.casts?.length) err(`筮例 ${s.id} 无卦例`)
    }
    const bg = shili.filter((s) => s.background).length
    const tr = shili.filter((s) => s.paragraphs.every((p) => p.translation)).length
    const rd = shili.filter((s) => s.reading?.length).length
    infos.push(`筮例: ${shili.length} 条;背景 ${bg} · 全译 ${tr} · 解读 ${rd}`)
  }
}

// ---------- 4d. 史事与人物志(v9 §3,人工 registry) ----------
{
  const shishiPath = path.join(ROOT, 'src/data/yijing/shishi.json')
  if (fs.existsSync(shishiPath)) {
    const shishi = JSON.parse(fs.readFileSync(shishiPath, 'utf8'))
    const ids = new Set()
    let refCount = 0
    for (const s of shishi) {
      if (ids.has(s.id)) err(`史事 id 重复: ${s.id}`)
      ids.add(s.id)
      if (!s.title) err(`史事 ${s.id} 缺 title`)
      if (!s.paragraphs?.length || s.paragraphs.some((p) => !p)) err(`史事 ${s.id} 段落为空`)
      for (const r of s.hexRefs ?? []) {
        refCount++
        if (!(Number.isInteger(r.hex) && r.hex >= 1 && r.hex <= 64)) err(`史事 ${s.id} 卦序非法: ${r.hex}`)
        if (r.line !== null && !(Number.isInteger(r.line) && r.line >= 1 && r.line <= 6)) err(`史事 ${s.id} 爻位非法: ${r.line}`)
      }
    }
    infos.push(`史事: ${shishi.length} 节;卦爻回链 ${refCount} 处`)
  }

  const renwuPath = path.join(ROOT, 'src/data/yijing/renwu.json')
  if (fs.existsSync(renwuPath)) {
    const renwu = JSON.parse(fs.readFileSync(renwuPath, 'utf8'))
    if (renwu.length < 10) err(`人物志应不少于 10 家,实为 ${renwu.length}`)
    const ids = new Set()
    let linkCount = 0
    for (const p of renwu) {
      if (ids.has(p.id)) err(`人物 id 重复: ${p.id}`)
      ids.add(p.id)
      if (!p.name || !p.era) err(`人物 ${p.id} 缺 name/era`)
      if (!p.paragraphs?.length || p.paragraphs.some((t) => !t)) err(`人物 ${p.id} 小传为空`)
      for (const l of p.links ?? []) {
        linkCount++
        if (!l.to || !l.to.startsWith('/') || l.to.startsWith('/dao')) err(`人物 ${p.id} 链接非法(须站内易经侧): ${l.to}`)
        if (!l.label) err(`人物 ${p.id} 链接缺 label`)
      }
    }
    infos.push(`人物志: ${renwu.length} 家;站内互指 ${linkCount} 处`)
  }
}

// ---------- 5. glossary.json ----------
const glossaryPath = path.join(ROOT, 'src/data/yijing/glossary.json')
if (fs.existsSync(glossaryPath)) {
  const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'))
  const keys = new Set()
  for (const g of glossary) {
    if (!g.key) { err('glossary 词条缺 key'); continue }
    if (keys.has(g.key)) err(`glossary key 重复: ${g.key}`)
    keys.add(g.key)
    if (!g.name) err(`glossary[${g.key}] 缺 name`)
    if (!g.brief) err(`glossary[${g.key}] 缺 brief`)
    if (g.brief && [...g.brief].length > 40) err(`glossary[${g.key}].brief 超过 40 字(${[...g.brief].length})`)
    if (!Array.isArray(g.aliases)) err(`glossary[${g.key}].aliases 应为数组`)
  }
  infos.push(`glossary: ${glossary.length} 条术语，key 全部唯一`)
} else {
  infos.push('glossary.json 不存在，跳过校验')
}

// ---------- 6. 八宫纳甲自检 ----------
{
  const enginePath = path.resolve(ROOT, 'src/features/yijing/engine')
  const { getPalace, getAllPalaces } = await import(path.join(enginePath, 'bagong.js'))
  const { getNajia } = await import(path.join(enginePath, 'najia.js'))

  const VALID_ZHI = new Set(['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'])
  const VALID_LIUQIN = new Set(['兄弟','父母','子孙','官鬼','妻财'])

  const palaces = getAllPalaces()
  if (palaces.length !== 8) err(`八宫数量应为 8，实为 ${palaces.length}`)

  const allPalaceBinaries = new Set()
  const palateCounts = {}
  for (const { name, sequence } of palaces) {
    if (sequence.length !== 8) err(`${name} 序列长度应为 8，实为 ${sequence.length}`)
    palateCounts[name] = 0
    for (const b of sequence) {
      if (allPalaceBinaries.has(b)) err(`八宫 binary 重复: ${b}`)
      allPalaceBinaries.add(b)
      palateCounts[name]++
    }
  }
  if (allPalaceBinaries.size !== 64) err(`八宫覆盖 ${allPalaceBinaries.size} 卦，应为 64`)

  // 纳甲：64 卦全量检查干支合法性
  for (const h of hexagrams) {
    const najia = getNajia(h.binary)
    if (!najia || najia.length !== 6) { err(`${h.name} 纳甲返回非 6 条`); continue }
    for (const row of najia) {
      if (!VALID_ZHI.has(row.zhi)) err(`${h.name} 第${row.pos}爻地支非法: ${row.zhi}`)
      if (!VALID_LIUQIN.has(row.liuqin)) err(`${h.name} 第${row.pos}爻六亲非法: ${row.liuqin}`)
    }
  }

  // 已知断言
  const tunPalace = getPalace('100010')
  if (tunPalace?.generation !== '二世') err(`屯卦应为二世，实为 ${tunPalace?.generation}`)
  if (tunPalace?.shi !== 2) err(`屯卦世爻应为 2，实为 ${tunPalace?.shi}`)

  infos.push(`八宫: 64 卦均分 8 宫，纳甲干支六亲全部合法`)
}

// ---------- 7. 逐段注疏锚点校验(v5 §4) ----------
{
  const anchoredDir = path.join(ROOT, 'src/data/yijing/zhushi-anchored')
  const zhushiGlobal = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/zhushi.json'), 'utf8'))
  const globalTerms = new Set()
  for (const z of zhushiGlobal) {
    if (globalTerms.has(z.term)) err(`zhushi.json 词条重复: ${z.term}`)
    globalTerms.add(z.term)
  }

  // term 第 n 次出现的下标;不足 n 次返回 -1
  const nthIndex = (text, term, n) => {
    let idx = -1
    let from = 0
    for (let k = 0; k < n; k++) {
      idx = text.indexOf(term, from)
      if (idx === -1) return -1
      from = idx + 1
    }
    return idx
  }

  let entryCount = 0
  // 校验一个单元(一段原文)的全部条目;返回是否有有效条目
  // opts.forbidRef:道藏注疏禁用 ref(v6 §5,模块不互链)
  const checkEntries = (entries, text, where, opts = {}) => {
    if (!Array.isArray(entries)) {
      err(`${where} 条目应为数组`)
      return false
    }
    const ranges = []
    for (const e of entries) {
      entryCount++
      if (!e.term) { err(`${where} 有条目缺 term`); continue }
      const label = `${where}「${e.term}」`
      const n = e.n ?? 1
      if (!text) { err(`${label} 目标原文不存在`); continue }
      const idx = nthIndex(text, e.term, n)
      if (idx === -1) { err(`${label} 锚点未命中(第 ${n} 次出现)`); continue }
      if (e.ref && opts.forbidRef) {
        err(`${label} 道藏注疏不支持 ref(模块不互链)`)
      } else if (e.ref) {
        if (!globalTerms.has(e.term)) err(`${label} ref 词条不在全局词表`)
      } else if (!e.note && !e.hex && !e.to) {
        err(`${label} 缺 note(且非 ref/桥条目)`)
      }
      // v8 桥字段:仅道藏侧可用,hex 须为合法卦序
      if (e.hex !== undefined || e.to !== undefined) {
        if (!opts.allowQiao) err(`${label} 桥字段(hex/to)仅道藏注疏可用`)
        if (e.hex !== undefined && !(Number.isInteger(e.hex) && e.hex >= 1 && e.hex <= 64)) {
          err(`${label} hex 应为 1–64 的卦序,实为 ${e.hex}`)
        }
        if (e.to !== undefined && !/^\/(hexagram|hexagrams|basics|classics)/.test(e.to)) {
          err(`${label} to 应为易经模块路由,实为 ${e.to}`)
        }
      }
      if (e.note && [...e.note].length > 40) err(`${label} note 超 40 字(${[...e.note].length})`)
      const range = [idx, idx + e.term.length]
      for (const r of ranges) {
        if (range[0] < r[1] && r[0] < range[1]) err(`${label} 锚定区间与同段其他条目重叠`)
      }
      ranges.push(range)
    }
    return entries.length > 0
  }

  // 7.1 卦系传文(hexagrams.json)
  const HEX_SECTIONS = new Set(['tuan', 'daxiang', 'xiaoxiang', 'wenyan'])
  const cover = { tuan: 0, daxiang: 0, xiaoxiang: 0, wenyan: 0 }
  const hexAnchored = JSON.parse(fs.readFileSync(path.join(anchoredDir, 'hexagrams.json'), 'utf8'))
  for (const [idStr, sections] of Object.entries(hexAnchored)) {
    const h = byId.get(Number(idStr))
    if (!h) { err(`zhushi-anchored/hexagrams: 未知卦序 ${idStr}`); continue }
    for (const [sec, val] of Object.entries(sections)) {
      if (!HEX_SECTIONS.has(sec)) { err(`zhushi-anchored ${h.name} 未知节: ${sec}`); continue }
      if (sec === 'tuan' || sec === 'daxiang') {
        if (checkEntries(val, h[sec]?.original, `${h.name}·${sec === 'tuan' ? '彖' : '大象'}`)) cover[sec]++
      } else if (sec === 'xiaoxiang') {
        for (const [k, entries] of Object.entries(val)) {
          const text = k === 'use'
            ? h.extra?.use?.xiaoxiang?.original
            : (/^[1-6]$/.test(k) ? h.lines[Number(k) - 1]?.xiaoxiang?.original : null)
          if (text == null) { err(`zhushi-anchored ${h.name}·小象 键非法: ${k}`); continue }
          if (checkEntries(entries, text, `${h.name}·小象${k === 'use' ? '(用)' : k}`)) cover.xiaoxiang++
        }
      } else {
        for (const [k, entries] of Object.entries(val)) {
          const text = h.extra?.wenyan?.[Number(k)]?.original
          if (text == null) { err(`zhushi-anchored ${h.name}·文言 段下标非法: ${k}`); continue }
          if (checkEntries(entries, text, `${h.name}·文言[${k}]`)) cover.wenyan++
        }
      }
    }
  }

  // 7.2 经传(五文件,章号→段下标)
  const classicCover = []
  for (const [key] of BOOKS) {
    const anchored = JSON.parse(fs.readFileSync(path.join(anchoredDir, `${key}.json`), 'utf8'))
    const bookData = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/yijing/classics/${key}.json`), 'utf8'))
    let covered = 0
    let total = 0
    const byChapter = new Map(bookData.chapters.map((c) => [String(c.no), c]))
    for (const c of bookData.chapters) total += c.paragraphs.length
    for (const [chNo, paras] of Object.entries(anchored)) {
      const chapter = byChapter.get(chNo)
      if (!chapter) { err(`zhushi-anchored/${key}: 章号非法 ${chNo}`); continue }
      for (const [pIdx, entries] of Object.entries(paras)) {
        const text = chapter.paragraphs[Number(pIdx)]?.original
        if (text == null) { err(`zhushi-anchored/${key} 第${chNo}章 段下标非法: ${pIdx}`); continue }
        if (checkEntries(entries, text, `${key}·${chNo}章[${pIdx}]`)) covered++
      }
    }
    classicCover.push(`${bookData.title ?? key} ${covered}/${total}`)
  }

  // 7.3 读经类 corpus 锚定注疏(v6 §5 禁 ref;v16 §1 泛化:道藏/儒/佛 共用);易经覆盖行只计易经条目
  // 桥(qiao/hex)仅道藏侧允许(allowQiao);佛/儒禁桥。
  const yiEntryCount = entryCount
  function checkCorpusAnchors(label, key, corpus, allowQiao) {
    const cover = []
    for (const t of corpus.meta) {
      const file = path.join(ROOT, `src/data/${key}/zhushi-anchored/${t.slug}.json`)
      const book = corpus.data[t.slug]
      if (!fs.existsSync(file) || !book) continue
      const entryBase = entryCount
      let covered = 0
      const anchored = JSON.parse(fs.readFileSync(file, 'utf8'))
      const byChapter = new Map(book.chapters.map((c) => [String(c.no), c]))
      const total = book.chapters.reduce((n, c) => n + c.paragraphs.length, 0)
      for (const [chNo, paras] of Object.entries(anchored)) {
        const chapter = byChapter.get(chNo)
        if (!chapter) { err(`${key}/zhushi-anchored/${t.slug}: 章号非法 ${chNo}`); continue }
        for (const [pIdx, entries] of Object.entries(paras)) {
          const text = chapter.paragraphs[Number(pIdx)]?.original
          if (text == null) { err(`${key}/${t.slug} 第${chNo}章 段下标非法: ${pIdx}`); continue }
          if (checkEntries(entries, text, `${book.title}·${chNo}章[${pIdx}]`, { forbidRef: true, allowQiao })) covered++
        }
      }
      cover.push(`${book.title} ${covered}/${total}(${entryCount - entryBase} 条)`)
    }
    if (cover.length) infos.push(`${label}注疏(段): ${cover.join(' · ')}`)
  }
  checkCorpusAnchors('道藏', 'dao', daoBooks, true)
  checkCorpusAnchors('儒典', 'ru', ruBooks, false)
  checkCorpusAnchors('释典', 'fo', foBooks, false)

  // 覆盖率报告(信息项,断点续作的进度仪表;分母为可注单元总数)
  const xiaoxiangTotal = 64 * 6 + 2
  infos.push(
    `注疏覆盖: 彖 ${cover.tuan}/64 · 大象 ${cover.daxiang}/64 · 小象 ${cover.xiaoxiang}/${xiaoxiangTotal} · 文言 ${cover.wenyan}/35 | ${classicCover.join(' · ')}(共 ${yiEntryCount} 条锚注)`
  )
}

// ---------- 8. 信息项 ----------
const translated = hexagrams.filter((h) => h.judgment?.translation).length
infos.push(`译文覆盖: ${translated}/64 卦(其余待补,见 scripts/authored/translations.json)`)
if (trigrams.length !== 8) err(`经卦应为 8,实为 ${trigrams.length}`)

// ---------- 输出 ----------
for (const i of infos) console.log('ℹ', i)
if (errors.length) {
  console.error(`\n✗ 校验失败,${errors.length} 个错误:`)
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}
console.log(`✓ 校验通过:64 卦结构完整，内容抽查、卦变自检、glossary、八宫纳甲全部命中`)
