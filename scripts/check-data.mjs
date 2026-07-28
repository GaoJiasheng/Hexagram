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
const warns = []

function err(msg) {
  errors.push(msg)
}
function warn(msg) {
  warns.push(msg)
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
const xinBooks = checkReadingCorpus('心学', 'xin', '卷')
const faBooks = checkReadingCorpus('法家', 'fa', '篇')
const moBooks = checkReadingCorpus('墨家', 'mo', '篇')
const bingBooks = checkReadingCorpus('兵家', 'bing', '篇')
const zongBooks = checkReadingCorpus('纵横', 'zong', '篇')
const zhongyiBooks = checkReadingCorpus('中医', 'zhongyi', '篇')
const moulueBooks = checkReadingCorpus('谋略', 'moulue', '篇')

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
  checkCorpusAnchors('心学', 'xin', xinBooks, false)
  checkCorpusAnchors('法家', 'fa', faBooks, false)
  checkCorpusAnchors('墨家', 'mo', moBooks, false)
  checkCorpusAnchors('兵家', 'bing', bingBooks, false)
  checkCorpusAnchors('纵横', 'zong', zongBooks, false)
  checkCorpusAnchors('中医', 'zhongyi', zhongyiBooks, false)
  checkCorpusAnchors('谋略', 'moulue', moulueBooks, false)

  // 覆盖率报告(信息项,断点续作的进度仪表;分母为可注单元总数)
  const xiaoxiangTotal = 64 * 6 + 2
  infos.push(
    `注疏覆盖: 彖 ${cover.tuan}/64 · 大象 ${cover.daxiang}/64 · 小象 ${cover.xiaoxiang}/${xiaoxiangTotal} · 文言 ${cover.wenyan}/35 | ${classicCover.join(' · ')}(共 ${yiEntryCount} 条锚注)`
  )
}

// ---------- 8b. 《赛博:百家争鸣》(v21)校验 ----------
{
  const dir = path.join(ROOT, 'src/data/debates')
  if (fs.existsSync(dir)) {
    const BANNED = new Set(['zhongyi', 'moulue'])              // 中医/谋略不入场
    const WIN_RE = /(胜负|输赢|赢了|碾压|击败|完胜|败北|谁赢|分高下|谁对谁错)/  // 论点禁评胜负
    const chCache = {}
    const chapterText = (corpus, slug, ch) => {
      const k = `${corpus}/${slug}`
      if (!(k in chCache)) {
        const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
        chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
      }
      const book = chCache[k]
      if (!book) return null
      const c = book.chapters.find((x) => x.no === ch)
      return c ? c.paragraphs.map((p) => p.original).join('') : null
    }
    const dbIndex = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')
    let turnTotal = 0, partyTotal = 0
    // 跨辩一致性:key 只在文件内解析,故同 key 指两家 / 同一家两 key 在单文件校验里发现不了。
    // 曾出过 `yang` 既是杨朱又是阳明、老子有 lao/laozi 两个 key,会让「按思想家检索」串味。
    const schoolKeyMap = new Map(), schoolLabelMap = new Map()
    for (const f of files) {
      const id = f.replace(/\.json$/, '')
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      const keys = new Set(d.schools.map((s) => s.key))
      for (const s of d.schools) {
        if (BANNED.has(s.group)) err(`debate ${id}: 禁入场组「${s.group}」(${s.label})`)
        if (!s.seal) err(`debate ${id}: ${s.label} 缺 seal`)
      }
      const turns = d.rounds.flatMap((r) => r.turns)
      if (turns.length > 100) err(`debate ${id}: 轮数 ${turns.length} 超 100`)
      turnTotal += turns.length; partyTotal += d.schools.length
      for (const t of turns) {
        if (!keys.has(t.school)) err(`debate ${id}: 未知发言家 ${t.school}`)
        if (t.rebut && !keys.has(t.rebut)) err(`debate ${id}: rebut 指向未知家 ${t.rebut}`)
        if (WIN_RE.test(t.point || '')) err(`debate ${id}: 论点含评胜负字样`)
        const c = t.cite
        if (BANNED.has(c.corpus)) err(`debate ${id}: 引文出自禁入场组 ${c.corpus}`)
        const text = chapterText(c.corpus, c.slug, c.ch)
        if (text === null) err(`debate ${id}: 引文章节缺失 ${c.corpus}/${c.slug}#${c.ch}`)
        else if (!text.includes(c.quote)) err(`debate ${id}: 引文非原文子串「${c.quote.slice(0, 14)}…」(${c.corpus}/${c.slug}#${c.ch})`)
      }
      const topic = (dbIndex.topics || []).find((tp) => tp.id === id)
      if (!topic) err(`debate ${id}: index.json 未登记`)
      else if (topic.turns !== turns.length) err(`debate ${id}: index turns(${topic.turns}) ≠ 实际 ${turns.length}`)
      // 导读/逐句 gloss(均可选,老辩题不写不报错)。导读只补「真问题/词义分歧/这一驳为什么
      // 驳得到」三件事,源文交给已有白话——故限长,越界就是又写成一篇长文、喧宾夺主了。
      if (d.guide) {
        if (!Array.isArray(d.guide)) err(`debate ${id}: guide 须是数组`)
        else {
          const gl = [...d.guide.map((b) => (b.type === 'terms'
            ? (b.items || []).map((t) => `${t.t}${t.g}`).join('')
            : b.text || '')).join('')].filter((c) => /[一-鿿]/.test(c)).length
          if (gl < 500 || gl > 1500) err(`debate ${id}: 导读 ${gl} 字,应在 500–1500(目标 800–1200)`)
          for (const b of d.guide) {
            if (b.type === 'terms') {
              if (!(b.items || []).length) err(`debate ${id}: 导读 terms 块无 items`)
            } else if (!b.text) err(`debate ${id}: 导读段落缺 text`)
            if (b.ref && chapterText(b.ref.corpus, b.ref.slug, b.ref.ch) === null) {
              err(`debate ${id}: 导读 ref 指向不存在的章 ${b.ref.corpus}/${b.ref.slug}#${b.ref.ch}`)
            }
          }
        }
      }
      for (const t of turns) {
        if (!t.gloss) continue
        const n = [...t.gloss].filter((c) => /[一-鿿]/.test(c)).length
        if (n < 15 || n > 90) err(`debate ${id}: gloss ${n} 字,应在 15–90(目标 20–60)「${t.gloss.slice(0, 12)}…」`)
        if (WIN_RE.test(t.gloss)) err(`debate ${id}: gloss 含评胜负字样`)
      }
      for (const s of d.schools) {
        const prev = schoolKeyMap.get(s.key)
        if (prev && prev.group !== s.group) {
          err(`debate ${id}: 家 key「${s.key}」在 ${prev.id} 是 ${prev.group}/${prev.label},此处却是 ${s.group}/${s.label}——同 key 不可指两家`)
        } else if (!prev) schoolKeyMap.set(s.key, { id, label: s.label, group: s.group })
        const pk = schoolLabelMap.get(s.label)
        if (pk && pk.key !== s.key) {
          err(`debate ${id}: 家「${s.label}」在 ${pk.id} 用 key「${pk.key}」,此处却用「${s.key}」——同一家须同 key`)
        } else if (!pk) schoolLabelMap.set(s.label, { id, key: s.key })
      }
    }
    // 分类体系(v21.1):议题两级树(四门→类目)+ 正交的形态标签
    const DIVISIONS = new Set(['tiandao', 'xinxing', 'zhidao', 'weixue'])
    const FORMATS = new Set(['intra', 'synthesis'])
    const divCount = {}
    for (const tp of dbIndex.topics || []) {
      if (!DIVISIONS.has(tp.division)) err(`debate ${tp.id}: division 非法「${tp.division}」`)
      else divCount[tp.division] = (divCount[tp.division] || 0) + 1
      if (!tp.category) err(`debate ${tp.id}: 缺 category`)
      if (tp.format && !FORMATS.has(tp.format)) err(`debate ${tp.id}: format 非法「${tp.format}」`)
    }
    infos.push(`百家争鸣: ${files.length} 辩 · ${turnTotal} 轮 · 参辩 ${partyTotal} 家次`)
    infos.push(`  义理四门: ${['tiandao', 'xinxing', 'zhidao', 'weixue'].map((d) => `${d} ${divCount[d] || 0}`).join(' · ')}`)
  }
}

// ---------- 8c. 白话模块(design-v22)校验 ----------
{
  const corpora = ['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'yijing']
  const chCache = {}
  // 一卦全经传原文(卦辞+彖+大象+爻辞+小象+用九六+文言+序卦杂卦)——易经引文子串校验池
  const hexAllOriginal = (q) => {
    const parts = [q.judgment?.original, q.tuan?.original, q.daxiang?.original]
    for (const l of q.lines || []) { parts.push(l.original, l.xiaoxiang?.original) }
    if (q.extra?.use) { parts.push(q.extra.use.original, q.extra.use.xiaoxiang?.original) }
    for (const w of q.extra?.wenyan || []) parts.push(w.original)
    parts.push(q.xugua, q.zagua)
    return parts.filter(Boolean).join('')
  }
  const pieceCache = {}
  const bookPieces = (corpus, slug) => {
    if (!(corpus in pieceCache)) {
      const f = path.join(ROOT, `src/data/${corpus}/texts.json`)
      pieceCache[corpus] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
    }
    return pieceCache[corpus].find((b) => b.slug === slug)?.pieces
  }
  const chapterText = (corpus, slug, ch) => {
    const k = `${corpus}/${slug}`
    if (corpus === 'yijing' && slug === 'hexagrams') {   // 64 卦;经传 slug 落下方 corpus 分支(classics/<slug>.json 通用)
      if (!(k in chCache)) {
        const f = path.join(ROOT, 'src/data/yijing/hexagrams.json')
        chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
      }
      const q = chCache[k]?.find((x) => x.id === Number(ch))
      return q ? hexAllOriginal(q) : null
    }
    if (!(k in chCache)) {
      const f = path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`)
      chCache[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
    }
    const book = chCache[k]
    if (!book) return null
    // 诗级白话(诗经):键形如「组-序」(如 1-1 = 周南第一首《关雎》)。
    // 引文校验池收窄到那一首诗,而非整组——否则《关雎》的引文拿《桃夭》的句子也能过。
    const poem = /^(\d+)-(\d+)$/.exec(String(ch))
    if (poem) {
      const c = book.chapters.find((x) => x.no === Number(poem[1]))
      if (!c) return null
      // 传习录一类:无《诗题》可认,故由 texts.json 的 pieces 显式给出区间(人工策展)。
      const piece = bookPieces(corpus, slug)?.find((x) => x.key === String(ch))
      if (piece) return c.paragraphs.slice(piece.from, piece.to).map((p) => p.original).join('')
      const isTitle = (p) => /^《[^》]+》$/.test(p.original.trim())
      const heads = c.paragraphs.map((p, i) => (isTitle(p) ? i : -1)).filter((i) => i >= 0)
      const start = heads[Number(poem[2]) - 1]
      if (start === undefined) return null
      const end = heads[Number(poem[2])] ?? c.paragraphs.length
      return c.paragraphs.slice(start, end).map((p) => p.original).join('')
    }
    const c = book.chapters.find((x) => x.no === Number(ch))
    return c ? c.paragraphs.map((p) => p.original).join('') : null
  }
  // 各组红线触发词(软警告,人工复核;workflow 校对 agent 是主防线)
  const REDLINE = {
    zhongyi: /(包治|药到病除|立竿见影|疗效显著|可治愈|用法用量为|每日.{0,4}服用|建议服用|对照自诊|照方自疗)/,
    moulue: /(教你如何驭|实操技巧|职场必备|学会这招|驭人之术值得|照着用就能)/,
    dao: /(长生不老|羽化登仙|修炼成仙|包你成仙|烧符念咒可)/,
    fo: /(消业障|保佑你|必得往生|皈依方能|烧香拜佛即可)/,
    yijing: /(预示你|预示着你|你的运势|你将.{0,4}(大吉|大凶|有难)|必有.{0,3}之(灾|祸)|趋吉避凶之法|算出你|占得此卦.{0,8}(宜|忌|大吉|大凶)|你的命运)/,
  }
  let nArt = 0, nFig = 0, nBadCite = 0
  const cover = {}
  for (const corpus of corpora) {
    const dir = path.join(ROOT, `src/data/${corpus}/baihua`)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const slug = f.replace(/\.json$/, '')
      const book = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
      for (const ch of Object.keys(book)) {
        const a = book[ch]
        const tag = `白话 ${corpus}/${slug}#${ch}`
        nArt++
        cover[`${corpus}/${slug}`] = (cover[`${corpus}/${slug}`] || 0) + 1
        // 脊柱:中心思想/hero + 分节 + 逐句引文
        if (!a.centralIdea && !a.hero) err(`${tag}: 缺中心思想/hero`)
        const blocks = Array.isArray(a.blocks) ? a.blocks : []
        if (blocks.length < 3) err(`${tag}: blocks 过少(${blocks.length})`)
        if (blocks.filter((b) => b.type === 'h2').length < 1) err(`${tag}: 无分节(h2)`)
        const quotes = blocks.filter((b) => b.type === 'quote')
        if (quotes.length < 1) err(`${tag}: 无逐句引文(quote)`)
        // 引文逐字命中站内原文(仿 debate cite)
        const text = chapterText(corpus, slug, ch)
        if (text === null) err(`${tag}: 章节原文缺失,无法校引文`)
        else for (const q of quotes) {
          if (q.original && !text.includes(q.original)) { err(`${tag}: 引文非原文子串「${q.original.slice(0, 14)}…」`); nBadCite++ }
        }
        // 配图:有 svg、不写死前景色
        for (const b of blocks) {
          if (b.type !== 'figure') continue
          nFig++
          if (!b.svg || !b.svg.includes('<svg')) err(`${tag}: figure 缺 svg`)
          else if (/(fill|stroke)\s*=\s*['"]#[0-9a-fA-F]/.test(b.svg) || /(fill|stroke)\s*:\s*#[0-9a-fA-F]/.test(b.svg)) {
            warn(`${tag}: figure SVG 疑写死颜色(应用 var()/currentColor)`)
          }
        }
        // 富文本块(v22.1):pull 每章至多一处;label 只许短签;list/callout/steps 不许空
        const pulls = blocks.filter((b) => b.type === 'pull').length
        if (pulls > 1) err(`${tag}: pull 块 ${pulls} 处(每章至多 1 处)`)
        for (const b of blocks) {
          if (b.type === 'callout' && b.label && [...b.label].length > 12) {
            err(`${tag}: callout.label 过长(${[...b.label].length} 字)「${b.label}」——标签是排版短签,正文该放 items`)
          }
          if ((b.type === 'list' || b.type === 'callout' || b.type === 'steps') && !(b.items || []).length) {
            err(`${tag}: ${b.type} 块无 items`)
          }
        }
        // 红线软扫描(整篇)
        const re = REDLINE[corpus]
        if (re && re.test(JSON.stringify(a))) warn(`${tag}: 疑触组红线词,请人工复核`)
      }
    }
  }
  if (nArt) {
    const parts = Object.entries(cover).sort().map(([k, n]) => `${k} ${n}`).join(' · ')
    infos.push(`白话覆盖: ${nArt} 章 · ${nFig} 图 · ${nBadCite} 坏引文 | ${parts}`)
  }
}

// ---------- 8. 信息项 ----------
const translated = hexagrams.filter((h) => h.judgment?.translation).length
infos.push(`译文覆盖: ${translated}/64 卦(其余待补,见 scripts/authored/translations.json)`)
if (trigrams.length !== 8) err(`经卦应为 8,实为 ${trigrams.length}`)

// ---------- 输出 ----------
for (const i of infos) console.log('ℹ', i)
for (const w of warns) console.warn('⚠', w)
if (errors.length) {
  console.error(`\n✗ 校验失败,${errors.length} 个错误:`)
  for (const e of errors) console.error('  -', e)
  process.exit(1)
}
console.log(`✓ 校验通过:64 卦结构完整，内容抽查、卦变自检、glossary、八宫纳甲全部命中`)
