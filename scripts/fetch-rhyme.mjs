// 韵书三种抓取与解析(design-v24 §7.1)——诗词曲格律层的数据底座。
// 用法:node scripts/fetch-rhyme.mjs
// 产出:src/data/rhyme/{pingshui,cilin,zhongyuan}.json
//   平水韵 106 部(近体诗 平仄 + 韵脚)· 词林正韵 19 部(宋词韵脚)· 中原音韵 19 韵(元曲韵脚)
// 来源:维基文库《平水韻》《詞林正韻》《中原音韻》三页(公版),走 wikisource.mjs 的 createFetcher,
// 与易经/道藏/corpus 管线同一份缓存 scripts/.cache/wikisource.json。
//
// 铁律:韵书字表一律来自抓取,**不手补一字**;部数不对(平水 106 = 上平15/下平15/上29/去30/入17、
// 词林 19、中原 19)即报错、不落盘。繁体原样收,另以 t2s 出简体键双收(站内诗词正文是简体)。
//
// 页面里的非字表成分(括注释义、方括号注、拆字描述、OCR 残字)一律剔除,剔了什么打印在末尾,
// 以便核对;不认识的行结构直接报错,不静默跳过。

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json') // 与其他管线共享缓存
const OUT_DIR = path.join(ROOT, 'src/data/rhyme')
const PAGES = { pingshui: '平水韻', cilin: '詞林正韻', zhongyuan: '中原音韻' }

const HAN = /\p{Script=Han}/u
const notes = [] // 解析中处理过的页面格式异常,末尾统一打印
const note = (s) => notes.push(s)

// ---------- 缓存安全抓取 ----------
// createFetcher 的 saveCache 会用「创建时读到的快照」整体覆盖缓存文件;其他管线可能同时在写,
// 故新页先抓进临时缓存,再「读最新 → 合并 → 原子写回」共享缓存,不覆盖别人的条目。
function readShared() {
  return fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {}
}
async function fetchPagesSafe(titles) {
  const shared = readShared()
  if (titles.every((t) => t in shared)) return Object.fromEntries(titles.map((t) => [t, shared[t]]))
  const staging = path.join(os.tmpdir(), `hexagram-rhyme-staging-${process.pid}.json`)
  fs.writeFileSync(staging, JSON.stringify(Object.fromEntries(titles.filter((t) => t in shared).map((t) => [t, shared[t]]))))
  try {
    const { fetchPages } = createFetcher(staging)
    const pages = await fetchPages(titles)
    const latest = readShared()
    for (const t of titles) latest[t] = pages[t]
    const tmp = `${CACHE_FILE}.tmp-${process.pid}`
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(latest))
    fs.renameSync(tmp, CACHE_FILE)
    return pages
  } finally {
    fs.rmSync(staging, { force: true })
  }
}

// ---------- 工具 ----------
const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
function cnNum(s) {
  // 一…三十(韵书部序最多三十)
  if (!/^[一二三四五六七八九十]+$/.test(s)) throw new Error(`不是中文序数: ${s}`)
  if (s === '十') return 10
  const i = s.indexOf('十')
  if (i < 0) return CN_DIGIT[s]
  const tens = i === 0 ? 1 : CN_DIGIT[s.slice(0, i)]
  const ones = i === s.length - 1 ? 0 : CN_DIGIT[s.slice(i + 1)]
  return tens * 10 + ones
}
const chars = (s) => [...s]
function assertHan(s, where) {
  const bad = chars(s).filter((c) => !HAN.test(c))
  if (bad.length) throw new Error(`${where}: 字表中含非汉字 ${JSON.stringify(bad.join(''))}`)
}
function addIndex(index, c, id) {
  const put = (k) => {
    const arr = index[k] || (index[k] = [])
    if (!arr.includes(id)) arr.push(id)
  }
  put(c)
  const s = t2s(c)
  if (s && s !== c && [...s].length === 1) put(s)
}
const sortIndex = (index) => Object.fromEntries(Object.keys(index).sort().map((k) => [k, index[k]]))
const countChars = (index) => Object.keys(index).length

// ---------- 平水韵 ----------
const PS_SECTIONS = { 上平聲部: '上平', 下平聲部: '下平', 上聲部: '上', 去聲部: '去', 入聲部: '入' }
const PS_EXPECT = { 上平: 15, 下平: 15, 上: 29, 去: 30, 入: 17 }
function parsePingshui(raw) {
  const parts = []
  let section = null
  let cur = null
  const lines = raw.split('\n')
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim()
    if (!line) continue
    if (/^\{\{/.test(line) || /^\[\[Category:/i.test(line)) continue // Header / PD-old / wikipedia / 分类
    let m
    if ((m = /^==\s*([^=]+?)\s*==$/.exec(line))) {
      section = PS_SECTIONS[m[1]]
      if (!section) throw new Error(`平水韵 L${n + 1}: 未知节题 ${m[1]}`)
      cur = null
      continue
    }
    if ((m = /^(上平|下平|上|去|入)聲([一二三四五六七八九十]+)\{\{\+\+\|(.+?)\}\}$/.exec(line))) {
      if (m[1] !== section) throw new Error(`平水韵 L${n + 1}: 部题「${line}」不在其节(${section})`)
      const no = cnNum(m[2])
      cur = {
        id: `${m[1]}${m[2]}${m[3]}`,
        sheng: m[1],
        tone: m[1] === '上平' || m[1] === '下平' ? '平' : '仄',
        no,
        name: m[3],
        label: t2s(`${m[2]}${m[3]}`),
        chars: '',
        ciChars: '',
      }
      parts.push(cur)
      continue
    }
    if (!cur) throw new Error(`平水韵 L${n + 1}: 部题之前出现字行「${line.slice(0, 20)}」`)
    if ((m = /^【(.)】(.*)$/.exec(line))) {
      const body = m[2].trim()
      assertHan(body, `平水韵 ${cur.id} 【${m[1]}】`)
      if (m[1] === '詞') {
        if (cur.ciChars) throw new Error(`平水韵 ${cur.id}: 【詞】行重复`)
        cur.ciChars = body
      } else if (m[1] === '辭') {
        // 页面另有 6 处【辭】行(服/濘/族陸瀆/祿谷/蒲/伏),页内无说明、义未详:
        // 原样存于该部 ciXChars,**不入索引**(其中「蒲」本在上平虞部,入索引会平白造出多音)。
        cur.ciXChars = (cur.ciXChars || '') + body
        note(`平水韵 ${cur.id}: 【辭】${body} —— 存 ciXChars,不入索引`)
      } else {
        throw new Error(`平水韵 ${cur.id}: 未知标记【${m[1]}】`)
      }
      continue
    }
    assertHan(line, `平水韵 ${cur.id}`)
    if (cur.chars) throw new Error(`平水韵 ${cur.id}: 出现第二行字表`)
    cur.chars = line
  }

  // 部数与部序校验:不对即报错,不落盘
  for (const [sheng, want] of Object.entries(PS_EXPECT)) {
    const got = parts.filter((p) => p.sheng === sheng)
    if (got.length !== want) throw new Error(`平水韵 ${sheng}声 应 ${want} 部,实得 ${got.length}`)
    got.forEach((p, i) => { if (p.no !== i + 1) throw new Error(`平水韵 ${p.id}: 部序应为 ${i + 1}`) })
  }
  if (parts.length !== 106) throw new Error(`平水韵应 106 部,实得 ${parts.length}`)
  for (const p of parts) {
    if (!p.chars) throw new Error(`平水韵 ${p.id}: 缺字表`)
    if (chars(p.chars)[0] !== p.name) note(`平水韵 ${p.id}: 部名「${p.name}」不是字表首字「${chars(p.chars)[0]}」`)
    if (!p.ciChars) note(`平水韵 ${p.id}: 无【詞】增补行`)
  }

  const index = {}
  const ciIndex = {}
  for (const p of parts) {
    for (const c of chars(p.chars)) addIndex(index, c, p.id)
    for (const c of chars(p.ciChars)) addIndex(ciIndex, c, p.id)
  }
  for (const p of parts) if (!p.ciXChars) delete p.ciXChars
  return { parts, index: sortIndex(index), ciIndex: sortIndex(ciIndex) }
}

// ---------- 词林正韵 ----------
const CL_TONE = { 平聲: '平', 仄聲: '仄', 入聲: '入' }
function cleanCilinChars(body, where) {
  let s = body
  s = s.replace(/\{\{!\|([^|{}]+)\|[^{}]*\}\}/g, '$1') // {{!|𣘼|上「啟」下「木」}}:首参即字
  // 括注:单个汉字者为前字异体(嵩（崧）、壠（隴）…共 8 处),作字收;余皆释义/互见注(（中間）（東韻同）),剔除
  s = s.replace(/（([^（）]*)）/g, (_, inner) => {
    if (chars(inner).length === 1 && HAN.test(inner)) { note(`词林 ${where}: 括注单字「${inner}」作异体收入`); return inner }
    return ''
  })
  s = s.replace(/\[[^\][]*\]/g, '') // [骯髒] [輓聯] [馥鬱，鬱鬱乎文哉] 方括号释义
  s = s.replace(/\s+/g, '')
  assertHan(s, `词林 ${where}`)
  return s
}
function parseCilin(raw) {
  const parts = []
  let cur = null
  let sec = null
  const lines = raw.split('\n')
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].trim()
    if (!line) continue
    let m
    if ((m = /^==\s*第([一二三四五六七八九十]+)部\s*==$/.exec(line))) {
      const no = cnNum(m[1])
      cur = { no, name: `第${m[1]}部`, tone: '', chars: '', sections: [] }
      parts.push(cur)
      sec = null
      continue
    }
    if ((m = /^===\s*(平聲|仄聲|入聲)[\uFF1A:](.+?)\s*===$/.exec(line))) {
      if (!cur) throw new Error(`词林 L${n + 1}: 部题之前出现声类行`)
      sec = { tone: CL_TONE[m[1]], title: m[2].replace(/<半>/g, '半').replace(/\s+/g, ' ').trim(), groups: [] }
      cur.sections.push(sec)
      continue
    }
    if ((m = /^【([^】]+)】(.*)$/.exec(line))) {
      if (!sec) throw new Error(`词林 L${n + 1}: 声类行之前出现字行`)
      const name = m[1].replace(/<半>/g, '半')
      sec.groups.push({ name, chars: cleanCilinChars(m[2], `${cur.name}【${name}】`) })
      continue
    }
    if (/^\{\{|^\||^\}\}|^\[\[Category:/i.test(line)) continue // header 模板各行、PD-old、分类
    throw new Error(`词林 L${n + 1}: 未识别行「${line.slice(0, 30)}」`)
  }
  if (parts.length !== 19) throw new Error(`词林正韵应 19 部,实得 ${parts.length}`)
  parts.forEach((p, i) => { if (p.no !== i + 1) throw new Error(`词林 ${p.name}: 部序应为 ${i + 1}`) })

  const index = {}
  for (const p of parts) {
    const tones = [...new Set(p.sections.map((s) => s.tone))]
    p.tone = tones.join('')
    if (p.no <= 14 && p.tone !== '平仄') throw new Error(`词林 ${p.name}: 舒声部应有平、仄两类,实为 ${p.tone}`)
    if (p.no >= 15 && p.tone !== '入') throw new Error(`词林 ${p.name}: 入声部应只有入声,实为 ${p.tone}`)
    const seen = new Set()
    for (const s of p.sections) {
      if (!s.groups.length) throw new Error(`词林 ${p.name} ${s.title}: 无字组`)
      for (const g of s.groups) {
        for (const c of chars(g.chars)) {
          addIndex(index, c, `${p.no}${s.tone}`)
          seen.add(c)
        }
      }
    }
    p.chars = [...seen].join('')
  }
  return { parts, index: sortIndex(index) }
}

// ---------- 中原音韵 ----------
const ZY_GROUP = { 平聲: '平', 上聲: '上', 去聲: '去', 入聲作平聲: '入作平', 入聲作上聲: '入作上', 入聲作去聲: '入作去', 去聲作平聲: '去作平' }
function cleanZhongyuan(body, where) {
  let s = body
  s = s.replace(/\{\{[^{}]*\}\}/g, '')
  s = s.replace(/\[[^\][]*\]/g, '') // [煙突][伍員人名][A264]…释义/占位
  s = s.replace(/（[^（）]*）|\([^()]*\)/g, '') // （音史）（木+洪）(目+𧈧)…释音/拆字
  s = s.replace(/\{[^{}]*\}|<[^<>]*>/g, '') // {囟兒} <疒曷> <厂西>:拆字描述
  const out = []
  for (const piece of s.split('○')) {
    const kept = chars(piece).filter((c) => HAN.test(c)).join('')
    const dropped = chars(piece).filter((c) => !HAN.test(c) && !/\s/.test(c)).join('')
    if (dropped) note(`中原 ${where}: 小韵「${piece.trim()}」剔非汉字残文「${dropped}」`)
    if (kept) out.push(kept)
  }
  return out
}
function parseZhongyuan(raw) {
  const lines = raw.split('\n')
  const start = lines.findIndex((l) => /^=中原音韻卷上=\s*$/.test(l.trim()))
  const end = lines.findIndex((l) => /^=中原音韻卷下=\s*$/.test(l.trim()))
  if (start < 0 || end < 0 || end < start) throw new Error('中原音韵: 找不到卷上/卷下分界')
  const parts = []
  let cur = null
  let group = null // '平'|'上'|…
  let sub = null // 平声下的 陰/陽
  const put = (text, n) => {
    if (!cur || !group) throw new Error(`中原 L${n + 1}: 韵目/声类之前出现字行`)
    let key
    if (group === '平') {
      if (!sub) throw new Error(`中原 ${cur.name} L${n + 1}: 平声字行缺 △陰/△陽`)
      key = sub === '陰' ? '阴平' : '阳平'
    } else key = group
    if (cur.groups[key]) throw new Error(`中原 ${cur.name} ${key}: 字行重复`)
    cur.groups[key] = cleanZhongyuan(text, `${cur.name}·${key}`)
  }
  for (let n = start + 1; n < end; n++) {
    const line = lines[n].trim()
    if (!line) continue
    let m
    if ((m = /^==\s*([^=]+?)\s*==$/.exec(line))) {
      cur = { no: parts.length + 1, name: m[1], label: t2s(m[1]), groups: {} }
      parts.push(cur)
      group = sub = null
      continue
    }
    if ((m = /^【([^】]+)】(.*)$/.exec(line))) {
      group = ZY_GROUP[m[1]]
      if (!group) throw new Error(`中原 ${cur?.name} L${n + 1}: 未知声类【${m[1]}】`)
      sub = null
      let rest = m[2].trim()
      const mk = /^△(陰|陽)/.exec(rest)
      if (mk) { sub = mk[1]; rest = rest.slice(2).trim() }
      if (/^（[^）]*）/.test(rest)) { note(`中原 ${cur.name}【${m[1]}】: 题注「${rest.match(/^（[^）]*）/)[0]}」剔除`); rest = rest.replace(/^（[^）]*）/, '').trim() }
      if (group === '入作平' || group === '去作平') sub = null // 派入平声者不分陰陽,单列一组
      if (rest) { note(`中原 ${cur.name}【${m[1]}】: 字表与声类题同行「${rest.slice(0, 12)}」`); put(rest, n) }
      continue
    }
    if ((m = /^△(陰|陽)$/.exec(line))) {
      if (group !== '平') throw new Error(`中原 ${cur?.name} L${n + 1}: △${m[1]} 不在平声下`)
      sub = m[1]
      continue
    }
    if (/^\{\{/.test(line)) continue
    // 支思、廉纖二韵把「△陽」写在陰平字行的行尾(…○雌△陽 / …○添△陽),下一行才是陽平字:
    // 按标记切开,标记前归当前组,标记后(若有)归新组。
    const segs = line.split(/△(陰|陽)/)
    if (segs.length > 1) note(`中原 ${cur?.name}: 「△${segs[1]}」标记写在字行行尾,按标记切分`)
    if (segs[0].trim()) put(segs[0], n)
    for (let k = 1; k < segs.length; k += 2) {
      if (group !== '平') throw new Error(`中原 ${cur?.name} L${n + 1}: △${segs[k]} 不在平声下`)
      sub = segs[k]
      if (segs[k + 1].trim()) put(segs[k + 1], n)
    }
  }
  if (parts.length !== 19) throw new Error(`中原音韵应 19 韵,实得 ${parts.length}`)
  const index = {}
  for (const p of parts) {
    for (const k of ['阴平', '阳平', '上', '去']) if (!p.groups[k]?.length) throw new Error(`中原 ${p.name}: 缺 ${k}`)
    for (const list of Object.values(p.groups)) for (const xy of list) for (const c of chars(xy)) addIndex(index, c, p.name)
  }
  return { parts, index: sortIndex(index) }
}

// ---------- 主流程 ----------
const pages = await fetchPagesSafe(Object.values(PAGES))
const ps = parsePingshui(pages[PAGES.pingshui])
const cl = parseCilin(pages[PAGES.cilin])
const zy = parseZhongyuan(pages[PAGES.zhongyuan])

// 站内诗词正文里的字,韵书页面只收其异体(同字异写)时的退查表:键为正文用字,值为韵书里可能的写法(按序试)。
// 只收**同字异写**(隣/鄰、谿/溪、檐/簷…),不收同音借字、不收意近字;逐条对三种韵书字表核过(见 cov/alias 核对)。
// 每部韵书只保留「本字未收、而所指写法已收」的条目写进该书 json 的 variants;表外查不到的字如实显示「韵书未收」
// (如「啼」:平水韵页面八齊部漏收,亦无「嗁」,不补)。
const VARIANTS = {
  隣: '鄰', 溪: '谿', 劒: '劍', 扫: '掃埽', 迹: '跡蹟', 樽: '罇尊', 遍: '徧', 沉: '沈', 浣: '澣', 棹: '櫂',
  疎: '疏', 覩: '睹', 緜: '綿', 炉: '爐鑪', 猨: '猿', 盌: '椀碗', 簷: '檐', 筯: '箸', 斾: '旆', 鬬: '鬭鬥',
  珮: '佩', 廻: '迴回', 牕: '窗窻', 窗: '窻牕窓', 慙: '慚', 粧: '妝', 涩: '澀濇', 妬: '妒', 厓: '崖', 羗: '羌',
  昂: '卬', 燃: '然', 臯: '皋', 幷: '并並', 秪: '祇', 衞: '衛', 觧: '解', 甞: '嘗', 灶: '竈', 迳: '逕徑',
  着: '著', 袴: '絝', 堤: '隄', 剪: '翦', 翦: '剪', 砧: '碪', 屡: '屢', 簪: '簮', 雁: '鴈', 却: '卻',
  峰: '峯', 彻: '徹', 呵: '訶',
}
function variantsFor(has) {
  const out = {}
  for (const [v, alts] of Object.entries(VARIANTS)) {
    if (has(v)) continue
    const hit = [...alts].find(has)
    if (hit) out[v] = hit
  }
  return out
}
const psVariants = variantsFor((c) => !!(ps.index[c] || ps.ciIndex[c]))
if (psVariants['隣'] !== '鄰') throw new Error('异体表: 「隣」应退查平水韵「鄰」')

const meta = (page, extra) => ({
  source: `维基文库《${page}》`,
  note: '字表照页面原样收录(繁体),另以简体键双收;括注释义与拆字描述已剔。一字多部照列,不作取舍。',
  ...extra,
})
const outputs = {
  pingshui: {
    ...meta(PAGES.pingshui, {
      counts: Object.fromEntries(Object.keys(PS_EXPECT).map((s) => [s, ps.parts.filter((p) => p.sheng === s).length])),
      ciNote: '【詞】行为词韵增补字,存各部 ciChars 与 ciIndex(即 ci:true),本字表查不到时方退查;【辭】行义未详,存 ciXChars 不入索引。',
    }),
    variants: psVariants,
    parts: ps.parts,
    index: ps.index,
    ciIndex: ps.ciIndex,
  },
  cilin: {
    ...meta(PAGES.cilin, { idNote: '索引值为「部序+声类」,如 1平 / 1仄 / 15入。' }),
    variants: variantsFor((c) => !!cl.index[c]),
    parts: cl.parts,
    index: cl.index,
  },
  zhongyuan: {
    ...meta(PAGES.zhongyuan, { groupsNote: '各声类下为小韵(同音字组,页面以 ○ 分隔)数组。入作平/入作上/入作去 即「入派三声」。' }),
    variants: variantsFor((c) => !!zy.index[c]),
    parts: zy.parts,
    index: zy.index,
  },
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const [key, data] of Object.entries(outputs)) {
  const file = path.join(OUT_DIR, `${key}.json`)
  fs.writeFileSync(file, JSON.stringify(data) + '\n')
  console.log(`✓ ${path.relative(ROOT, file)}  ${data.parts.length} 部 · 索引 ${countChars(data.index)} 键 · ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
const uniqTrad = (parts, get) => new Set(parts.flatMap((p) => chars(get(p)))).size
console.log(`平水韵 本字 ${uniqTrad(ps.parts, (p) => p.chars)} 字(另【詞】增补 ${uniqTrad(ps.parts, (p) => p.ciChars)} 字)· 词林 ${uniqTrad(cl.parts, (p) => p.chars)} 字 · 中原 ${uniqTrad(zy.parts, (p) => Object.values(p.groups).flat().join(''))} 字`)
if (notes.length) {
  console.log(`\n页面格式异常与处理(${notes.length} 条):`)
  for (const s of notes) console.log('  · ' + s)
}
