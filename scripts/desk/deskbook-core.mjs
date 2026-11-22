// 观象 · 书桌 —— 书包格式(deskbook)标准 v1 的核心库:解包 / 打包 / 校验。
// 规格:docs/deskbook-standard.md(唯一依据);图解 fig 的字段沿用 docs/desk-baihua-spec.md §2。
//
// 只用 Web 标准 API(TextEncoder / TextDecoder / DataView / CompressionStream / DecompressionStream),
// 不 import 任何东西:同一份代码跑在 Node 18+、Cloudflare Workers,并被内联进单文件命令行 deskbook.mjs
// (scripts/desk/build-deskbook-cli.mjs 负责内联)。改这里之后跑 `npm run desk:standard` 重出。

// ───────────────────────────── 常量 ─────────────────────────────

export const FORMAT = 'deskbook'
export const FORMAT_VERSION = 1
export const CORE_VERSION = '1.0.0'

const MB = 1024 * 1024
// 标准 §1 / §2 / §3 / §4 / §5 里写明的数;少数标准没写、为防御而加的另行注明
export const LIMITS = Object.freeze({
  totalBytes: 300 * MB, // 整包(解开后的总字节)
  chapterBytes: 2 * MB, // 章文件
  bookJsonBytes: 2 * MB, // book.json —— 标准未写,按章文件同等对待
  imageBytes: 4 * MB,
  videoBytes: 24 * MB,
  chapters: 2000,
  entries: 10000, // zip 里的条目数 —— 标准未写,防目录炸弹
  pathLength: 255, // 路径长度 —— 标准未写
  imageLongSide: 4096,
  videoLongSide: 1280,
  videoSeconds: 60,
  summary: 60,
  description: 400,
  tags: 8,
  disclaimer: 120,
  idea: 200,
  noteD: 40,
  noteXMin: 40, // 低于此只提示
  noteXMax: 150,
  quoteChars: 100, // digest:每条直接引用
  quotesPerChapter: 16, // digest:每章引用条数
  pullPerChapter: 1,
  outlineDepth: 4,
  figString: 120, // fig 里单个字符串(desk-baihua-spec §2 闸第 3 条)
  calloutLabel: 24, // 标准未写上限,超了只提示
  maxReported: 500, // 错误最多报这么多条
})

export const KINDS = ['classic', 'book', 'collection']
export const SOURCE_TYPES = ['original', 'digest', 'public-domain', 'licensed']
export const BLOCK_TYPES = ['lead', 'h2', 'h3', 'p', 'quote', 'callout', 'pull', 'steps', 'list', 'outline', 'fig', 'img', 'video', 'code', 'divider', 'refs']
export const CALLOUT_TONES = ['note', 'tip', 'warn']
export const FIG_KINDS = ['quote', 'cols', 'rows', 'flow', 'tree', 'timeline', 'table', 'gua', 'ring', 'notes']
export const IMAGE_EXTS = ['jpg', 'png', 'webp']
export const VIDEO_EXTS = ['mp4']
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/

// 书桌显示的两句声明(标准 §6)
export const DISCLAIMERS = Object.freeze({
  medical: '本书为知识研习，不构成医疗建议；身体不适请就医',
  divination: '本书为文化与文献研习，不作预测与决断依据',
})

// §6 两个领域的词表(唯一一处定义)。中文按「包含」匹配,英文按整词、不分大小写。
// 有意不收的宽词:「运动」(五四运动)、「训练」(思维训练)、「星座」(天文)、fortune(财经)、exercise(习题)。
// 「易经」「周易」不在占卜表里:它们首先是典籍;讲用《易》占断的书,标签里自然会有「占卜」「卜筮」「六爻」一类词。
export const DISCLAIMER_VOCAB = Object.freeze({
  medical: {
    zh: ['医学', '医疗', '医药', '中医', '西医', '中药', '药学', '药理', '方剂', '针灸', '推拿', '按摩', '经络', '养生', '保健', '健康',
      '健身', '运动医学', '运动康复', '锻炼', '力量训练', '体能训练', '康复', '理疗', '瑜伽', '普拉提', '减脂', '减肥', '增肌', '拉伸',
      '营养', '膳食', '饮食', '食疗', '节食', '断食', '心理治疗', '心理咨询', '心理健康', '抑郁', '焦虑', '失眠',
      '疾病', '病症', '诊断', '治疗', '疗法', '解剖', '生理学'],
    en: ['medicine', 'medical', 'health', 'healthcare', 'fitness', 'workout', 'strength training', 'bodybuilding', 'yoga', 'pilates',
      'rehab', 'rehabilitation', 'physiotherapy', 'nutrition', 'diet', 'dieting', 'fasting', 'wellness', 'therapy', 'psychotherapy',
      'counseling', 'counselling', 'mental health', 'anatomy', 'physiology', 'disease', 'diagnosis', 'acupuncture', 'tcm'],
  },
  divination: {
    zh: ['命理', '算命', '八字', '四柱', '紫微', '斗数', '占卜', '卜筮', '占筮', '起卦', '六爻', '梅花易数', '奇门', '遁甲', '六壬',
      '风水', '堪舆', '相术', '面相', '手相', '骨相', '星座运势', '占星', '塔罗', '择日', '解梦', '测字', '生肖运势', '运势'],
    en: ['divination', 'astrology', 'horoscope', 'tarot', 'fortune-telling', 'feng shui', 'fengshui', 'numerology',
      'palmistry', 'physiognomy', 'geomancy', 'i ching divination'],
  },
})

// 卦名(图解 gua 用):八经卦 + 六十四卦,与 scripts/lib/hexagram-table.mjs 一致(单测核对)
export const TRIGRAM_NAMES = Object.freeze('乾兑离震巽坎艮坤'.split(''))
export const HEXAGRAM_NAMES = Object.freeze(('乾 履 同人 无妄 姤 讼 遁 否 夬 兑 革 随 大过 困 咸 萃 大有 睽 离 噬嗑 鼎 未济 旅 晋 大壮 归妹 丰 震 恒 解 小过 豫 '
  + '小畜 中孚 家人 益 巽 涣 渐 观 需 节 既济 屯 井 坎 蹇 比 大畜 损 贲 颐 蛊 蒙 艮 剥 泰 临 明夷 复 升 师 谦 坤').split(' '))
const TRI_SET = new Set(TRIGRAM_NAMES)
const HEX_SET = new Set(HEXAGRAM_NAMES)
const AT_SET = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])

// ───────────────────────────── 小工具 ─────────────────────────────

const enc = new TextEncoder()
const utf8 = (s) => enc.encode(s)
const decodeUtf8 = (b) => new TextDecoder('utf-8', { fatal: true }).decode(b)
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isInt = (v) => Number.isInteger(v)
const extOf = (p) => { const m = /\.([a-z0-9]+)$/.exec(p); return m ? m[1] : '' }

// 「字数」:去掉空白与行内记号 ** 之后的码点数
export const textLen = (s) => [...String(s).replace(/\*\*/g, '').replace(/\s+/g, '')].length

// 章文件名:章号补零到(至少)三位
export const chapterFile = (no) => `chapters/${String(no).padStart(3, '0')}.json`

// §1 路径规则。返回错误说明;合法返回 null。dir=true 表示目录条目(去掉末尾 / 再判)
export function checkPath(p) {
  if (typeof p !== 'string' || !p) return '路径为空'
  if (p.length > LIMITS.pathLength) return `路径超过 ${LIMITS.pathLength} 字符`
  if (p.includes('\\')) return '路径里有反斜杠,一律用 /'
  if (p.startsWith('/')) return '不许绝对路径'
  if (/^[a-zA-Z]:/.test(p)) return '不许带盘符的路径'
  const segs = p.replace(/\/$/, '').split('/')
  for (const s of segs) {
    if (s === '') return '路径里有空的一段(连续的 /)'
    if (s === '.' || s === '..') return '不许 . 或 .. 段'
    if (s.startsWith('.')) return `不许隐藏文件或目录「${s}」`
    if (!/^[a-z0-9._-]+$/.test(s)) return `「${s}」含不允许的字符(只许小写字母、数字、- _ .)`
  }
  return null
}

// 文件归类:book | chapter | image | video | null(不该出现)
export function classifyPath(p) {
  if (p === 'book.json') return 'book'
  if (/^chapters\/\d{3,}\.json$/.test(p)) return 'chapter'
  if (p.startsWith('media/') && p.length > 6) {
    const e = extOf(p)
    if (IMAGE_EXTS.includes(e)) return 'image'
    if (VIDEO_EXTS.includes(e)) return 'video'
  }
  return null
}

function perFileLimit(p) {
  const c = classifyPath(p)
  if (c === 'image') return LIMITS.imageBytes
  if (c === 'video') return LIMITS.videoBytes
  if (c === 'book') return LIMITS.bookJsonBytes
  return LIMITS.chapterBytes // 章文件,以及不该出现的文件(交给 validate 报)
}

// ───────────────────────────── CRC32 ─────────────────────────────

let CRC_TABLE = null
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0 }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ───────────────────────────── 压缩流 ─────────────────────────────

function concat(chunks, total) {
  if (total === undefined) total = chunks.reduce((a, c) => a + c.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

let RAW_OK = null
function rawSupported() {
  if (RAW_OK === null) { try { new DecompressionStream('deflate-raw'); new CompressionStream('deflate-raw'); RAW_OK = true } catch { RAW_OK = false } }
  return RAW_OK
}

// 边解边数:超过 max 立刻停,不等解完(防 zip 炸弹)
async function inflateRaw(data, max, crc, usize) {
  let format = 'deflate-raw'
  let input = data
  if (!rawSupported()) {
    // 老运行时没有 deflate-raw:用中央目录里的 CRC 与原长包成 gzip 再解(gzip 会顺带核 CRC)
    format = 'gzip'
    const head = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 0xff])
    const tail = new Uint8Array(8)
    const dv = new DataView(tail.buffer)
    dv.setUint32(0, crc, true); dv.setUint32(4, usize >>> 0, true)
    input = concat([head, data, tail])
  }
  const ds = new DecompressionStream(format)
  const writer = ds.writable.getWriter()
  const reader = ds.readable.getReader()
  const STEP = 16 * 1024
  let stopped = false
  const pump = (async () => {
    try {
      for (let i = 0; i < input.length && !stopped; i += STEP) { await writer.ready; await writer.write(input.subarray(i, i + STEP)) }
      if (!stopped) await writer.close()
    } catch { /* 读端出错时这里也会出错,以读端为准 */ }
  })()
  const chunks = []
  let n = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      n += value.length
      if (n > max) {
        stopped = true
        reader.cancel().catch(() => {}); writer.abort().catch(() => {})
        throw new ZipError(`解压后超过上限 ${max} 字节`)
      }
      chunks.push(value)
    }
  } catch (e) {
    stopped = true
    if (e instanceof ZipError) throw e
    throw new ZipError(`deflate 数据损坏:${e?.message || e}`)
  }
  await pump
  return concat(chunks, n)
}

async function deflateRaw(data) {
  const raw = rawSupported()
  const cs = new CompressionStream(raw ? 'deflate-raw' : 'deflate')
  const writer = cs.writable.getWriter()
  writer.write(data); writer.close()
  const chunks = []
  const reader = cs.readable.getReader()
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value) }
  const out = concat(chunks)
  return raw ? out : out.subarray(2, out.length - 4) // zlib 包装:去掉 2 字节头与 4 字节 adler32
}

// ───────────────────────────── 解包 ─────────────────────────────

export class ZipError extends Error {
  constructor(msg) { super(msg); this.name = 'ZipError' }
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const startsWith = (b, sig) => sig.every((x, i) => b[i] === x)

// 读 zip(存储 / deflate)。拒绝:加密、分卷、超限的 zip64、嵌套 zip、违反路径规则的条目、符号链接、
// 重名、数据区重叠(重叠式炸弹)、解压超限(边解边判)。目录条目忽略。
export async function unzip(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new ZipError('输入应为 Uint8Array')
  if (bytes.length > LIMITS.totalBytes) throw new ZipError(`书包文件超过 ${LIMITS.totalBytes / MB} MB`)
  if (bytes.length < 22) throw new ZipError('不是 zip:文件太短')
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (o) => dv.getUint16(o, true)
  const u32 = (o) => dv.getUint32(o, true)
  const u64 = (o) => { const v = dv.getBigUint64(o, true); if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipError('zip64 数值过大'); return Number(v) }

  // 找中央目录结尾(EOCD)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { eocd = i; break }
  }
  if (eocd < 0) throw new ZipError('不是 zip:找不到中央目录结尾')
  if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0) throw new ZipError('不支持分卷 zip')
  let count = u16(eocd + 10)
  let cdSize = u32(eocd + 12)
  let cdOff = u32(eocd + 16)
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
    const loc = eocd - 20
    if (loc < 0 || u32(loc) !== 0x07064b50) throw new ZipError('zip64 结构不完整')
    const z = u64(loc + 8)
    if (z + 56 > bytes.length || u32(z) !== 0x06064b50) throw new ZipError('zip64 结构不完整')
    count = u64(z + 32); cdSize = u64(z + 40); cdOff = u64(z + 48)
  }
  if (count > LIMITS.entries) throw new ZipError(`条目超过 ${LIMITS.entries} 个`)
  if (cdOff + cdSize > bytes.length) throw new ZipError('中央目录越界')

  const entries = []
  const names = new Set()
  let declaredTotal = 0
  let p = cdOff
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(p) !== 0x02014b50) throw new ZipError(`中央目录第 ${i + 1} 条损坏`)
    const flags = u16(p + 8)
    const method = u16(p + 10)
    const crc = u32(p + 16)
    let csize = u32(p + 20)
    let usize = u32(p + 24)
    const nLen = u16(p + 28), xLen = u16(p + 30), cLen = u16(p + 32)
    const disk = u16(p + 34)
    const ext = u32(p + 38)
    let off = u32(p + 42)
    if (p + 46 + nLen + xLen + cLen > bytes.length) throw new ZipError(`中央目录第 ${i + 1} 条越界`)
    let name
    try { name = decodeUtf8(bytes.subarray(p + 46, p + 46 + nLen)) } catch { throw new ZipError(`第 ${i + 1} 条的文件名不是合法 UTF-8`) }
    // zip64 扩展字段
    let x = p + 46 + nLen
    const xEnd = x + xLen
    while (x + 4 <= xEnd) {
      const id = u16(x), sz = u16(x + 2)
      if (id === 0x0001) {
        let q = x + 4
        if (usize === 0xffffffff) { usize = u64(q); q += 8 }
        if (csize === 0xffffffff) { csize = u64(q); q += 8 }
        if (off === 0xffffffff) { off = u64(q); q += 8 }
      }
      x += 4 + sz
    }
    p = xEnd + cLen
    if (flags & 0x0001 || flags & 0x0040) throw new ZipError(`「${name}」是加密条目,书包不许加密`)
    if (disk !== 0) throw new ZipError('不支持分卷 zip')
    const mode = (ext >>> 16) & 0xf000
    if (mode === 0xa000) throw new ZipError(`「${name}」是符号链接,不收`)
    const pathErr = checkPath(name)
    if (pathErr) throw new ZipError(`「${name}」路径不合规:${pathErr}`)
    if (name.endsWith('/')) continue // 目录条目
    if (names.has(name)) throw new ZipError(`「${name}」在 zip 里出现了两次`)
    names.add(name)
    if (method !== 0 && method !== 8) throw new ZipError(`「${name}」的压缩方式 ${method} 不支持(只认存储与 deflate)`)
    if (/\.(zip|deskbook|jar|apk|ipa|epub|docx|xlsx|pptx|7z|rar|gz|tgz)$/.test(name)) throw new ZipError(`「${name}」是压缩包,书包里不许嵌套压缩包`)
    const max = perFileLimit(name)
    if (usize > max) throw new ZipError(`「${name}」解开后 ${usize} 字节,超过上限 ${max}`)
    if (method === 0 && csize !== usize) throw new ZipError(`「${name}」存储条目的大小前后不一`)
    declaredTotal += usize
    if (declaredTotal > LIMITS.totalBytes) throw new ZipError(`解开后总量超过 ${LIMITS.totalBytes / MB} MB`)
    entries.push({ name, method, crc, csize, usize, off, max })
  }

  // 本地文件头,数据区不许重叠
  const ranges = []
  for (const e of entries) {
    if (e.off + 30 > bytes.length || u32(e.off) !== 0x04034b50) throw new ZipError(`「${e.name}」的本地文件头损坏`)
    const lnLen = u16(e.off + 26), lxLen = u16(e.off + 28)
    let lname
    try { lname = decodeUtf8(bytes.subarray(e.off + 30, e.off + 30 + lnLen)) } catch { lname = null }
    if (lname !== e.name) throw new ZipError(`「${e.name}」本地文件头里的文件名与目录不一致`)
    if (u16(e.off + 6) & 0x0001) throw new ZipError(`「${e.name}」是加密条目,书包不许加密`)
    e.start = e.off + 30 + lnLen + lxLen
    if (e.start + e.csize > bytes.length) throw new ZipError(`「${e.name}」的数据越界`)
    ranges.push([e.off, e.start + e.csize, e.name])
  }
  ranges.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) throw new ZipError(`「${ranges[i][2]}」与「${ranges[i - 1][2]}」的数据区重叠(疑似 zip 炸弹)`)

  const out = new Map()
  let total = 0
  for (const e of entries) {
    const raw = bytes.subarray(e.start, e.start + e.csize)
    const data = e.method === 0 ? raw.slice() : await inflateRaw(raw, Math.min(e.max, LIMITS.totalBytes - total), e.crc, e.usize)
    if (data.length !== e.usize) throw new ZipError(`「${e.name}」解开后的大小与目录记载不符`)
    if (crc32(data) !== e.crc) throw new ZipError(`「${e.name}」CRC 校验不过,文件已损坏`)
    if (startsWith(data, ZIP_MAGIC)) throw new ZipError(`「${e.name}」内容是一个 zip,书包里不许嵌套压缩包`)
    total += data.length
    if (total > LIMITS.totalBytes) throw new ZipError(`解开后总量超过 ${LIMITS.totalBytes / MB} MB`)
    out.set(e.name, data)
  }
  return out
}

// ───────────────────────────── 打包 ─────────────────────────────

const STORED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'zip', 'deskbook'])

// 写 zip。确定性:条目按路径排序、时间戳固定为 1980-01-01 00:00、无额外字段、无注释;
// 同样的输入出同样的字节。已压缩的媒体用存储,其余 deflate(压不小就存储)。
export async function zip(files) {
  const names = [...files.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const locals = []
  const centrals = []
  let offset = 0
  const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01
  for (const name of names) {
    const data = files.get(name)
    if (!(data instanceof Uint8Array)) throw new ZipError(`「${name}」的内容不是 Uint8Array`)
    const nameBytes = utf8(name)
    const crc = crc32(data)
    let method = 0
    let body = data
    if (!STORED_EXTS.has(extOf(name.toLowerCase())) && data.length > 0) {
      const d = await deflateRaw(data)
      if (d.length < data.length) { method = 8; body = d }
    }
    const utf8Flag = /^[\x20-\x7e]*$/.test(name) ? 0 : 0x0800
    const lh = new Uint8Array(30 + nameBytes.length)
    const l = new DataView(lh.buffer)
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, utf8Flag, true); l.setUint16(8, method, true)
    l.setUint16(10, 0, true); l.setUint16(12, DOS_DATE, true); l.setUint32(14, crc, true)
    l.setUint32(18, body.length, true); l.setUint32(22, data.length, true); l.setUint16(26, nameBytes.length, true); l.setUint16(28, 0, true)
    lh.set(nameBytes, 30)
    const ch = new Uint8Array(46 + nameBytes.length)
    const c = new DataView(ch.buffer)
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, utf8Flag, true); c.setUint16(10, method, true)
    c.setUint16(12, 0, true); c.setUint16(14, DOS_DATE, true); c.setUint32(16, crc, true); c.setUint32(20, body.length, true); c.setUint32(24, data.length, true)
    c.setUint16(28, nameBytes.length, true); c.setUint32(42, offset, true)
    ch.set(nameBytes, 46)
    locals.push(lh, body)
    centrals.push(ch)
    offset += lh.length + body.length
    if (offset > 0xffffffff) throw new ZipError('超过 4 GB,不支持')
  }
  if (names.length > 0xffff) throw new ZipError('条目过多')
  const cdSize = centrals.reduce((a, x) => a + x.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, names.length, true); e.setUint16(10, names.length, true)
  e.setUint32(12, cdSize, true); e.setUint32(16, offset, true)
  return concat([...locals, ...centrals, end])
}

// ───────────────────────────── 媒体头 ─────────────────────────────

// 读图片像素尺寸:{ type, w, h };读不出 w/h 为 null。type 由魔数判定(jpg / png / webp / null)
export function readImageInfo(b) {
  if (b.length >= 24 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
    if (String.fromCharCode(b[12], b[13], b[14], b[15]) === 'IHDR') return { type: 'png', w: dv.getUint32(16), h: dv.getUint32(20) }
    return { type: 'png', w: null, h: null }
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) break
      while (b[i] === 0xff && i < b.length) i++
      const m = b[i++]
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) continue
      if (m === 0xd9 || m === 0xda) break
      if (i + 2 > b.length) break
      const len = (b[i] << 8) | b[i + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && i + 7 <= b.length) {
        return { type: 'jpg', h: (b[i + 3] << 8) | b[i + 4], w: (b[i + 5] << 8) | b[i + 6] }
      }
      i += len
    }
    return { type: 'jpg', w: null, h: null }
  }
  if (b.length >= 16 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') {
    const chunk = String.fromCharCode(...b.subarray(12, 16))
    if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { type: 'webp', w: (b[26] | (b[27] << 8)) & 0x3fff, h: (b[28] | (b[29] << 8)) & 0x3fff }
    }
    if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return { type: 'webp', w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X' && b.length >= 30) {
      return { type: 'webp', w: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, h: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 }
    }
    return { type: 'webp', w: null, h: null }
  }
  return { type: null, w: null, h: null }
}

// 读 mp4:{ ok, w, h, sec, video, audio, faststart }。video / audio 为编码四字码(avc1 / mp4a …),没有为 null
export function readMp4Info(b) {
  const info = { ok: false, w: null, h: null, sec: null, video: null, audio: null, faststart: null, tracks: 0 }
  if (b.length < 12 || String.fromCharCode(...b.subarray(4, 8)) !== 'ftyp') return info
  info.ok = true
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const str = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3])
  const boxes = (start, end, fn, depth = 0) => {
    let o = start
    while (o + 8 <= end && depth < 12) {
      let size = dv.getUint32(o)
      const type = str(o + 4)
      let head = 8
      if (size === 1) { if (o + 16 > end) return; const big = dv.getBigUint64(o + 8); size = big > BigInt(end - o) ? end - o : Number(big); head = 16 } else if (size === 0) size = end - o
      if (size < head || o + size > end) return
      if (fn(type, o + head, o + size, depth) === false) return
      o += size
    }
  }
  let moovAt = -1, moovEnd = -1, mdatAt = -1
  boxes(0, b.length, (type, s, e) => {
    if (type === 'moov' && moovAt < 0) { moovAt = s; moovEnd = e }
    if (type === 'mdat' && mdatAt < 0) mdatAt = s
  })
  if (moovAt >= 0 && mdatAt >= 0) info.faststart = moovAt < mdatAt
  if (moovAt < 0) return info
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl'])
  let cur = null
  const walk = (type, s, e, depth) => {
    if (type === 'trak') { cur = { w: 0, h: 0, handler: null, codec: null }; boxes(s, e, walk, depth + 1); finish(cur); cur = null; return }
    if (CONTAINERS.has(type)) { boxes(s, e, walk, depth + 1); return }
    if (type === 'mvhd' && e - s >= 32) {
      const v = b[s]
      const ts = v === 1 ? dv.getUint32(s + 20) : dv.getUint32(s + 12)
      const du = v === 1 ? Number(dv.getBigUint64(s + 24)) : dv.getUint32(s + 16)
      if (ts > 0) info.sec = Math.round((du / ts) * 100) / 100
    }
    if (type === 'tkhd' && cur) {
      const v = b[s]
      const at = v === 1 ? 88 : 76
      if (e - s >= at + 8) { cur.w = Math.round(dv.getUint32(s + at) / 65536); cur.h = Math.round(dv.getUint32(s + at + 4) / 65536) }
    }
    if (type === 'hdlr' && cur && e - s >= 12) cur.handler = str(s + 8)
    if (type === 'stsd' && cur && e - s >= 16) cur.codec = str(s + 12)
  }
  const finish = (t) => {
    info.tracks++
    if (t.handler === 'vide' && !info.video) { info.video = t.codec || '?'; info.w = t.w; info.h = t.h }
    if (t.handler === 'soun' && !info.audio) info.audio = t.codec || '?'
  }
  boxes(moovAt, moovEnd, walk)
  return info
}

// ───────────────────────────── 图解 fig 结构 ─────────────────────────────

// desk-baihua-spec §2 闸的第 2、3 条(结构与字符串长度)。第 1 条「与 SVG 字字相等」属于站内转换管线,书包里没有 SVG,不做。
export function checkFigShape(fig) {
  const p = []
  if (!isObj(fig)) return ['fig 不是对象']
  if (!FIG_KINDS.includes(fig.kind)) return [`fig.kind「${fig.kind}」不认识(应为 ${FIG_KINDS.join(' / ')})`]
  const strOrList = (v) => isStr(v) || (Array.isArray(v) && v.length > 0 && v.every(isStr))
  const item = (v) => isObj(v) && isStr(v.head) && (v.body === undefined || strOrList(v.body))
  const list = (v, name, min = 1) => { if (!Array.isArray(v) || v.length < min) { p.push(`${name} 应为至少 ${min} 项的数组`); return [] } return v }
  if (fig.title !== undefined && !isStr(fig.title)) p.push('title 应为非空字符串')
  if (fig.foot !== undefined && !(Array.isArray(fig.foot) && fig.foot.every(isStr))) p.push('foot 应为字符串数组')
  switch (fig.kind) {
    case 'quote':
      if (!isStr(fig.text)) p.push('quote 缺 text')
      if (fig.gloss !== undefined && !isStr(fig.gloss)) p.push('quote.gloss 应为字符串')
      if (fig.source !== undefined && !isStr(fig.source)) p.push('quote.source 应为字符串')
      break
    case 'cols': {
      const cols = list(fig.cols, 'cols', 2)
      if (cols.length > 4) p.push('cols 超过 4 栏')
      for (const c of cols) {
        if (!isObj(c) || !isStr(c.head)) p.push('cols 某栏缺 head')
        for (const l of list(c?.lines, 'cols[].lines', 0)) if (!isStr(l) && !item(l)) p.push('cols[].lines 某项既不是字符串也不是 {head, body}')
      }
      break
    }
    case 'rows':
      for (const it of list(fig.items, 'items')) if (!item(it)) p.push('rows.items 某项缺 head')
      break
    case 'flow':
      for (const it of list(fig.steps, 'steps', 2)) if (!item(it)) p.push('flow.steps 某项缺 head')
      if (fig.result !== undefined && !item(fig.result)) p.push('flow.result 缺 head')
      if (fig.loop !== undefined && typeof fig.loop !== 'boolean') p.push('flow.loop 应为 true / false')
      break
    case 'tree':
      if (fig.root !== undefined && !item(fig.root)) p.push('tree.root 缺 head')
      for (const br of list(fig.branches, 'branches', 2)) {
        if (!item(br)) p.push('tree.branches 某项缺 head')
        if (br?.children !== undefined) for (const c of list(br.children, 'children')) if (!item(c)) p.push('tree.children 某项缺 head')
      }
      break
    case 'timeline':
      for (const it of list(fig.points, 'points', 2)) {
        if (!item(it)) p.push('timeline.points 某项缺 head')
        if (it?.when !== undefined && !isStr(it.when)) p.push('timeline.points[].when 应为字符串')
      }
      break
    case 'table': {
      const rows = list(fig.rows, 'rows')
      if (fig.heads !== undefined && !(Array.isArray(fig.heads) && fig.heads.every((h) => typeof h === 'string'))) p.push('table.heads 应为字符串数组')
      const w = fig.heads?.length ?? rows[0]?.length
      for (const r of rows) if (!Array.isArray(r) || r.length !== w || !r.every((c) => typeof c === 'string')) { p.push('table.rows 各行应等长(与 heads 同宽)、每格是字符串'); break }
      break
    }
    case 'gua':
      for (const g of list(fig.guas, 'guas')) {
        if (!isObj(g) || !['hex', 'tri'].includes(g.form)) { p.push('guas[].form 应为 hex 或 tri'); continue }
        if (!(g.form === 'hex' ? HEX_SET : TRI_SET).has(g.name)) p.push(`guas[].name「${g.name}」不是合法的${g.form === 'hex' ? '六十四卦' : '八经卦'}名`)
        if (g.head !== undefined && !isStr(g.head)) p.push('guas[].head 应为字符串')
        if (g.lines !== undefined && !(Array.isArray(g.lines) && g.lines.every(isStr))) p.push('guas[].lines 应为字符串数组')
      }
      if (fig.yao !== undefined) {
        const yao = list(fig.yao, 'yao')
        if (yao.length && ![6, 7].includes(yao.length)) p.push(`yao 应为 6 项(乾坤含用九 / 用六时 7 项),现 ${yao.length} 项`)
        for (const y of yao) if (!isObj(y) || !isStr(y.label)) p.push('yao 某项缺 label')
        if (fig.guas?.length !== 1 || fig.guas[0]?.form !== 'hex') p.push('有 yao 时 guas 应只有一个六画卦')
      }
      break
    case 'ring': {
      const seen = new Set()
      if (fig.center !== undefined && !isStr(fig.center)) p.push('ring.center 应为字符串')
      for (const it of list(fig.items, 'items', 3)) {
        if (!item(it)) p.push('ring.items 某项缺 head')
        if (!AT_SET.has(it?.at)) p.push(`ring.items 的 at「${it?.at}」不合法(N NE E SE S SW W NW)`)
        else if (seen.has(it.at)) p.push(`ring.items 的 at「${it.at}」重复`)
        seen.add(it?.at)
      }
      break
    }
    case 'notes':
      for (const l of list(fig.lines, 'lines')) if (!isStr(l)) p.push('notes.lines 某项不是字符串')
      break
  }
  const strs = []
  const walk = (v, key) => {
    if (typeof v === 'string') { if (!['kind', 'form', 'at'].includes(key)) strs.push(v) } else if (Array.isArray(v)) v.forEach((x) => walk(x, key))
    else if (isObj(v)) for (const [k, x] of Object.entries(v)) walk(x, k)
  }
  walk(fig, '')
  for (const s of strs) if ([...s].length > LIMITS.figString) { p.push(`有一条字符串超过 ${LIMITS.figString} 字:「${s.slice(0, 16)}…」`); break }
  return p
}

// ───────────────────────────── 行内记号 ─────────────────────────────

// §3:只有 **加粗**(成对)、`等宽`、[文字](https://…)。返回问题列表
export function checkInline(s) {
  const p = []
  if (typeof s !== 'string') return p
  const noCode = s.replace(/`[^`\n]*`/g, '')
  const stars = (noCode.match(/\*\*/g) || []).length
  if (stars % 2) p.push('加粗记号 ** 不成对')
  for (const m of noCode.matchAll(/\[([^\]\n]*)\]\(([^)\n]*)\)/g)) {
    if (!m[1].trim()) p.push(`链接「${m[2]}」没有文字`)
    if (!/^https:\/\/[^\s/]+\.[^\s]*$/.test(m[2])) p.push(`链接只许 https 地址,「${m[2].slice(0, 60)}」不行`)
  }
  return p
}

// ───────────────────────────── 校验 ─────────────────────────────

const BOOK_KEYS = new Set(['format', 'version', 'id', 'revision', 'kind', 'title', 'subtitle', 'authors', 'lang', 'summary', 'description', 'category', 'tags',
  'source', 'disclaimer', 'unit', 'theme', 'cover', 'banner', 'parts', 'chapters', 'generator'])
const CH_ENTRY_KEYS = new Set(['no', 'file', 'title', 'subtitle', 'minutes', 'author', 'date', 'head'])
const CHAPTER_KEYS = new Set(['no', 'title', 'segs', 'yanyi', 'article'])
const BLOCK_FIELDS = {
  lead: ['x'], h2: ['x'], h3: ['x'], p: ['x'], pull: ['x'],
  quote: ['o', 'tr', 'x', 'by'], callout: ['tone', 'label', 'items'], steps: ['items'], list: ['ordered', 'items'], outline: ['items'],
  fig: ['fig', 'cap'], img: ['src', 'alt', 'cap', 'w', 'h'], video: ['src', 'poster', 'cap', 'w', 'h', 'sec', 'loop', 'sound'],
  code: ['x', 'lang'], divider: [], refs: ['items'],
}

function vocabHit(domain, terms) {
  const v = DISCLAIMER_VOCAB[domain]
  for (const raw of terms) {
    if (typeof raw !== 'string') continue
    const t = raw.toLowerCase()
    for (const z of v.zh) if (t.includes(z)) return `${raw}(含「${z}」)`
    for (const e of v.en) if (new RegExp(`(^|[^a-z])${e.replace(/[-\s]/g, '[-\\s]?')}($|[^a-z])`).test(t)) return `${raw}(英文「${e}」)`
  }
  return null
}

const validDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function parseJson(bytes, file, err) {
  let s
  try { s = decodeUtf8(bytes) } catch { err(file, '', '不是合法的 UTF-8 文本'); return undefined }
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  try { return JSON.parse(s) } catch (e) { err(file, '', `JSON 解析失败:${e.message}`); return undefined }
}

// 校验一个书包(Map<路径, 字节>)。返回 { ok, errors, warnings, book, stats };errors / warnings 每条 { file, where, msg }
export function validate(files) {
  const errors = []
  const warnings = []
  const err = (file, where, msg) => { if (errors.length < LIMITS.maxReported) errors.push({ file, where, msg }) }
  const warn = (file, where, msg) => { if (warnings.length < LIMITS.maxReported) warnings.push({ file, where, msg }) }
  const stats = { chapters: 0, chars: 0, segs: 0, notes: 0, blocks: 0, blockTypes: {}, figs: {}, images: 0, videos: 0, mediaBytes: 0, totalBytes: 0, quotes: 0 }
  if (!(files instanceof Map)) { err('', '', '输入应为 Map<路径, Uint8Array>'); return { ok: false, errors, warnings, book: null, stats } }

  // ── §1 文件与路径 ──
  const media = new Map() // 路径 → { kind, info }
  for (const [path, data] of files) {
    const pe = checkPath(path)
    if (pe) { err(path, '', `路径不合规:${pe}`); continue }
    if (!(data instanceof Uint8Array)) { err(path, '', '内容不是字节'); continue }
    stats.totalBytes += data.length
    const c = classifyPath(path)
    if (!c) {
      const e = extOf(path)
      if (['html', 'htm', 'js', 'mjs', 'css', 'svg', 'xml', 'ttf', 'otf', 'woff', 'woff2', 'sh', 'py', 'exe'].includes(e)) err(path, '', `书包不收可执行或排版类内容(.${e})`)
      else if (e === 'gif') err(path, '', 'GIF 不进包:用 `deskbook.mjs gif2mp4` 转成 mp4 视频')
      else if (path.startsWith('chapters/')) err(path, '', '章文件名应为 chapters/NNN.json(章号补零到三位)')
      else if (path.startsWith('media/')) err(path, '', `媒体只收 ${[...IMAGE_EXTS, ...VIDEO_EXTS].map((x) => '.' + x).join(' ')}`)
      else err(path, '', '书包里只许有 book.json、chapters/、media/')
      continue
    }
    if (startsWith(data, ZIP_MAGIC)) { err(path, '', '内容是一个 zip,书包里不许嵌套压缩包'); continue }
    const lim = perFileLimit(path)
    if (data.length > lim) err(path, '', `${(data.length / MB).toFixed(1)} MB,超过上限 ${lim / MB} MB`)
    if (c === 'image') {
      const info = readImageInfo(data)
      const e = extOf(path)
      if (info.type !== e) err(path, '', info.type ? `扩展名是 .${e},内容却是 ${info.type}` : `不是可识别的 ${e} 图片`)
      else if (info.w == null) warn(path, '', '读不出像素尺寸,未能核对 w / h')
      else if (Math.max(info.w, info.h) > LIMITS.imageLongSide) err(path, '', `图片 ${info.w}×${info.h},长边超过 ${LIMITS.imageLongSide}`)
      media.set(path, { kind: 'image', info })
      stats.images++; stats.mediaBytes += data.length
    } else if (c === 'video') {
      const info = readMp4Info(data)
      if (!info.ok) err(path, '', '不是 mp4(文件开头没有 ftyp)')
      else {
        if (info.video && !['avc1', 'avc3'].includes(info.video)) err(path, '', `视频编码是 ${info.video},须为 H.264(avc1)`)
        if (!info.video) warn(path, '', '读不出视频轨,未能核对编码与尺寸')
        if (info.audio && info.audio !== 'mp4a') err(path, '', `音轨编码是 ${info.audio},须无声或 AAC(mp4a)`)
        if (info.w && Math.max(info.w, info.h) > LIMITS.videoLongSide) err(path, '', `视频 ${info.w}×${info.h},长边超过 ${LIMITS.videoLongSide}`)
        if (info.sec != null && info.sec > LIMITS.videoSeconds) err(path, '', `视频 ${info.sec} 秒,超过 ${LIMITS.videoSeconds} 秒`)
        if (info.faststart === false) warn(path, '', '索引(moov)在数据之后:转码时加 -movflags +faststart,边下边播才快')
      }
      media.set(path, { kind: 'video', info })
      stats.videos++; stats.mediaBytes += data.length
    }
  }
  if (stats.totalBytes > LIMITS.totalBytes) err('', '', `整包 ${(stats.totalBytes / MB).toFixed(1)} MB,超过 ${LIMITS.totalBytes / MB} MB`)

  // ── §2 book.json ──
  const B = 'book.json'
  if (!files.has(B)) { err(B, '', '缺 book.json'); return { ok: false, errors, warnings, book: null, stats } }
  const book = parseJson(files.get(B), B, err)
  if (!isObj(book)) { if (book !== undefined) err(B, '', '顶层应为对象'); return { ok: false, errors, warnings, book: null, stats } }

  for (const k of Object.keys(book)) if (!BOOK_KEYS.has(k)) warn(B, k, `标准里没有字段「${k}」,书桌会忽略`)
  if (book.format !== FORMAT) err(B, 'format', `应为 "${FORMAT}"`)
  if (book.version !== FORMAT_VERSION) {
    if (isInt(book.version) && book.version > FORMAT_VERSION) err(B, 'version', `version ${book.version} 比本校验器认识的(${FORMAT_VERSION})新:请用新版 deskbook.mjs`)
    else err(B, 'version', `应为 ${FORMAT_VERSION}`)
  }
  if (typeof book.id !== 'string' || !ID_PATTERN.test(book.id)) err(B, 'id', 'id 须为 3–64 位小写字母、数字、-,以字母或数字开头')
  else if (!/^[ug]-/.test(book.id)) warn(B, 'id', '不带前缀的短 id 留给官方典籍;自己做的书用 u-<名>-<8 位十六进制>')
  if (!isInt(book.revision) || book.revision < 1) err(B, 'revision', '应为 ≥ 1 的整数,每次重出 +1')
  const kind = book.kind
  if (!KINDS.includes(kind)) err(B, 'kind', `应为 ${KINDS.join(' / ')}`)
  if (!isStr(book.title)) err(B, 'title', '缺书名')
  if (book.subtitle !== undefined && !isStr(book.subtitle)) err(B, 'subtitle', '应为非空字符串(没有就删掉这个字段)')
  if (!Array.isArray(book.authors) || !book.authors.every(isStr)) err(B, 'authors', '应为字符串数组(可为空数组)')
  if (typeof book.lang !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(book.lang)) err(B, 'lang', '应为语言标记,如 zh-Hans')
  if (!isStr(book.summary)) err(B, 'summary', '缺一句话简介')
  else if (textLen(book.summary) > LIMITS.summary) err(B, 'summary', `${textLen(book.summary)} 字,超过 ${LIMITS.summary} 字`)
  if (book.description !== undefined) {
    if (!isStr(book.description)) err(B, 'description', '应为非空字符串')
    else if (textLen(book.description) > LIMITS.description) err(B, 'description', `${textLen(book.description)} 字,超过 ${LIMITS.description} 字`)
  }
  if (book.category !== undefined && (!isStr(book.category) || /\s/.test(book.category.trim()))) err(B, 'category', '应为一个词')
  if (book.tags !== undefined) {
    if (!Array.isArray(book.tags) || !book.tags.every(isStr)) err(B, 'tags', '应为字符串数组')
    else if (book.tags.length > LIMITS.tags) err(B, 'tags', `${book.tags.length} 个,至多 ${LIMITS.tags} 个`)
  }
  if (!isStr(book.unit)) err(B, 'unit', '缺章的叫法(章 / 篇 / 卦 / 讲 / 期…)')
  if (book.generator !== undefined && !isStr(book.generator)) err(B, 'generator', '应为字符串')

  // source
  const src = book.source
  if (!isObj(src)) err(B, 'source', '缺 source(内容从哪来)')
  else {
    if (!SOURCE_TYPES.includes(src.type)) err(B, 'source.type', `应为 ${SOURCE_TYPES.join(' / ')}`)
    if (src.type === 'digest' || src.type === 'licensed') {
      if (!isObj(src.of)) err(B, 'source.of', `source.type 为 ${src.type} 时必须写明原书(of: {title, author, …})`)
      else {
        if (!isStr(src.of.title)) err(B, 'source.of.title', '缺原书名')
        if (!isStr(src.of.author)) err(B, 'source.of.author', '缺原作者')
        if (src.of.publisher !== undefined && !isStr(src.of.publisher)) err(B, 'source.of.publisher', '应为字符串')
        if (src.of.year !== undefined && !isInt(src.of.year)) err(B, 'source.of.year', '应为整数年份')
      }
    } else if (src.of !== undefined && !isObj(src.of)) err(B, 'source.of', '应为对象')
    if (src.note !== undefined && !isStr(src.note)) err(B, 'source.note', '应为非空字符串')
    if (kind === 'classic' && !isStr(src.note)) warn(B, 'source.note', '典籍请在 source.note 写明所用底本(标准 §5.2)')
  }

  // disclaimer(§6)
  const disc = book.disclaimer
  if (disc !== undefined) {
    if (!isStr(disc)) err(B, 'disclaimer', '应为 medical / divination 或自写的一句话')
    else if (!DISCLAIMERS[disc] && textLen(disc) > LIMITS.disclaimer) err(B, 'disclaimer', `自写声明 ${textLen(disc)} 字,超过 ${LIMITS.disclaimer} 字`)
  }
  const terms = [book.category, ...(Array.isArray(book.tags) ? book.tags : [])]
  const need = {}
  for (const d of Object.keys(DISCLAIMERS)) { const h = vocabHit(d, terms); if (h) need[d] = h }
  const needed = Object.keys(need)
  if (needed.length && !needed.includes(disc)) {
    for (const d of needed) err(B, 'disclaimer', `分类 / 标签「${need[d]}」属于${d === 'medical' ? '医学 / 养生 / 健身' : '命理 / 占卜'}领域,须带 "disclaimer": "${d}"`)
  } else if (needed.length > 1) {
    const other = needed.find((d) => d !== disc)
    warn(B, 'disclaimer', `分类 / 标签同时命中 ${needed.join(' 与 ')} 两个领域;disclaimer 只能填一个,已填 ${disc},${other} 的内容约束(§6)仍须守`)
  }

  // theme
  if (book.theme !== undefined) {
    if (!isObj(book.theme)) err(B, 'theme', '应为对象')
    else for (const [k, v] of Object.entries(book.theme)) {
      if (!['accent', 'accent2', 'paper'].includes(k)) warn(B, `theme.${k}`, '标准里没有这个颜色,书桌会忽略')
      else if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) err(B, `theme.${k}`, '颜色写成 #RRGGBB')
    }
  }

  // 媒体引用登记:path → [{ file, where, w?, h?, as }]
  const refs = new Map()
  const ref = (path, file, where, as, w, h) => {
    if (typeof path !== 'string' || !path) { err(file, where, '缺媒体路径'); return }
    const c = classifyPath(path)
    if (as === 'image' && c !== 'image') { err(file, where, `「${path}」应为 media/ 下的 ${IMAGE_EXTS.join(' / ')} 图片`); return }
    if (as === 'video' && c !== 'video') { err(file, where, `「${path}」应为 media/ 下的 .mp4 视频`); return }
    if (!files.has(path)) { err(file, where, `引用的「${path}」不在包里`); return }
    if (!refs.has(path)) refs.set(path, [])
    refs.get(path).push({ file, where, w, h })
  }
  const aspect = (path, want, label, where) => {
    const m = media.get(path)
    if (m?.info?.w && m.info.h) {
      const r = m.info.w / m.info.h
      if (Math.abs(r - want) / want > 0.05) warn(B, where, `${label}建议 ${want > 1 ? '3:2 横版' : '2:3 竖版'},现为 ${m.info.w}×${m.info.h}`)
    }
  }
  if (book.cover !== undefined) { ref(book.cover, B, 'cover', 'image'); aspect(book.cover, 2 / 3, '封面', 'cover') }
  if (book.banner !== undefined) { ref(book.banner, B, 'banner', 'image'); aspect(book.banner, 3 / 2, '题图', 'banner') }

  // chapters
  const chapters = Array.isArray(book.chapters) ? book.chapters : null
  if (!chapters || !chapters.length) err(B, 'chapters', '至少一章')
  else if (chapters.length > LIMITS.chapters) err(B, 'chapters', `${chapters.length} 章,超过 ${LIMITS.chapters} 章`)
  const listed = new Set()
  if (chapters) chapters.forEach((c, i) => {
    const w = `chapters[${i}]`
    if (!isObj(c)) { err(B, w, '应为对象'); return }
    for (const k of Object.keys(c)) if (!CH_ENTRY_KEYS.has(k)) warn(B, `${w}.${k}`, `标准里没有字段「${k}」`)
    if (c.no !== i + 1) err(B, `${w}.no`, `章号应从 1 连续,这里应为 ${i + 1},现为 ${JSON.stringify(c.no)}`)
    const expect = chapterFile(i + 1)
    if (c.file !== expect) err(B, `${w}.file`, `应为 "${expect}"`)
    else if (!files.has(c.file)) err(B, `${w}.file`, `「${c.file}」不在包里`)
    listed.add(c.file)
    if (!isStr(c.title)) err(B, `${w}.title`, '缺章题')
    if (c.subtitle !== undefined && !isStr(c.subtitle)) err(B, `${w}.subtitle`, '应为非空字符串')
    if (c.minutes !== undefined && !(typeof c.minutes === 'number' && c.minutes > 0 && c.minutes < 1000)) err(B, `${w}.minutes`, '应为正数(分钟)')
    if (c.author !== undefined && !isStr(c.author)) err(B, `${w}.author`, '应为非空字符串')
    if (c.date !== undefined && !validDate(c.date)) err(B, `${w}.date`, '日期写成 YYYY-MM-DD')
    if (c.head !== undefined) { ref(c.head, B, `${w}.head`, 'image'); aspect(c.head, 3 / 2, '章题头图', `${w}.head`) }
    if (kind === 'collection') {
      if (c.author === undefined) warn(B, `${w}.author`, '文集的每篇宜写作者')
      if (c.date === undefined) warn(B, `${w}.date`, '文集的每篇宜写日期')
    }
  })
  for (const p of files.keys()) if (classifyPath(p) === 'chapter' && !listed.has(p)) err(p, '', 'book.json 的 chapters 里没有登记这个章文件')

  // parts
  if (book.parts !== undefined) {
    const n = chapters?.length || 0
    if (!Array.isArray(book.parts) || !book.parts.length) err(B, 'parts', '应为非空数组(没有就删掉)')
    else {
      let next = 1
      book.parts.forEach((pt, i) => {
        const w = `parts[${i}]`
        if (!isObj(pt)) { err(B, w, '应为对象'); return }
        if (!isStr(pt.title)) err(B, `${w}.title`, '缺篇名')
        if (!isInt(pt.from) || !isInt(pt.to) || pt.from > pt.to) { err(B, w, 'from / to 应为整数且 from ≤ to'); return }
        if (pt.from !== next) err(B, `${w}.from`, `应为 ${next}(各部分须连续、不重不漏)`)
        next = pt.to + 1
      })
      if (next !== n + 1) err(B, 'parts', `各部分须覆盖全部 ${n} 章,现覆盖到第 ${next - 1} 章`)
    }
  }

  // ── §3 章文件 ──
  const digest = src?.type === 'digest'
  if (chapters) chapters.forEach((entry, i) => {
    if (!isObj(entry) || entry.file !== chapterFile(i + 1) || !files.has(entry.file)) return
    const F = entry.file
    const bytes = files.get(F)
    if (bytes.length > LIMITS.chapterBytes) return // 上面已报
    const ch = parseJson(bytes, F, err)
    if (ch === undefined) return
    if (!isObj(ch)) { err(F, '', '顶层应为对象'); return }
    stats.chapters++
    for (const k of Object.keys(ch)) if (!CHAPTER_KEYS.has(k)) warn(F, k, `标准里没有字段「${k}」`)
    if (ch.no !== i + 1) err(F, 'no', `应为 ${i + 1}`)
    if (!isStr(ch.title)) err(F, 'title', '缺章题')
    else if (isStr(entry.title) && ch.title !== entry.title) warn(F, 'title', `与 book.json 里的章题「${entry.title}」不一致`)

    // 典籍层
    if (kind === 'classic') {
      if (!Array.isArray(ch.segs) || !ch.segs.length) err(F, 'segs', '典籍每章必有原文分段 segs')
      else ch.segs.forEach((s, j) => checkSeg(s, `segs[${j}]`))
      if (ch.yanyi !== undefined) {
        if (!Array.isArray(ch.yanyi) || !ch.yanyi.length || !ch.yanyi.every(isStr)) err(F, 'yanyi', '应为非空字符串数组,一段一项')
        else ch.yanyi.forEach((y, j) => inline(y, F, `yanyi[${j}]`))
      }
    } else if (kind) {
      if (ch.segs !== undefined) err(F, 'segs', `segs 只许出现在典籍(classic)里,本书 kind 为 ${kind}`)
      if (ch.yanyi !== undefined) err(F, 'yanyi', `yanyi 属典籍层,只许出现在典籍(classic)里`)
    }
    function checkSeg(s, w) {
      if (!isObj(s)) { err(F, w, '应为对象'); return }
      for (const k of Object.keys(s)) if (!['o', 't', 'label', 'n'].includes(k)) warn(F, `${w}.${k}`, `标准里没有字段「${k}」`)
      stats.segs++
      if (!isStr(s.o)) { err(F, `${w}.o`, '缺原文'); return }
      stats.chars += textLen(s.o)
      if (s.t !== undefined) { if (!isStr(s.t)) err(F, `${w}.t`, '应为非空字符串'); else stats.chars += textLen(s.t) }
      if (s.label !== undefined && !isStr(s.label)) err(F, `${w}.label`, '应为非空字符串')
      if (s.n === undefined) return
      if (!Array.isArray(s.n)) { err(F, `${w}.n`, '应为数组'); return }
      const spans = []
      s.n.forEach((n, k) => {
        const wn = `${w}.n[${k}]`
        if (!isObj(n)) { err(F, wn, '应为对象'); return }
        stats.notes++
        for (const key of Object.keys(n)) if (!['k', 'd', 'x', 'r'].includes(key)) warn(F, `${wn}.${key}`, `标准里没有字段「${key}」`)
        if (!isStr(n.k)) { err(F, `${wn}.k`, '缺被注的词'); return }
        const at = s.o.indexOf(n.k)
        if (at < 0) err(F, `${wn}.k`, `「${n.k}」不是该段原文的精确子串`)
        else spans.push([at, at + n.k.length, n.k, k])
        if (!isStr(n.d)) err(F, `${wn}.d`, '缺释义')
        else if (textLen(n.d) > LIMITS.noteD) err(F, `${wn}.d`, `释义 ${textLen(n.d)} 字,超过 ${LIMITS.noteD} 字`)
        if (n.x !== undefined) {
          if (!isStr(n.x)) err(F, `${wn}.x`, '应为非空字符串')
          else if (textLen(n.x) > LIMITS.noteXMax) err(F, `${wn}.x`, `展开 ${textLen(n.x)} 字,超过 ${LIMITS.noteXMax} 字`)
          else if (textLen(n.x) < LIMITS.noteXMin) warn(F, `${wn}.x`, `展开只有 ${textLen(n.x)} 字(标准建议 ${LIMITS.noteXMin}–${LIMITS.noteXMax})`)
        }
        if (n.r !== undefined && !isStr(n.r)) err(F, `${wn}.r`, '读音应为字符串')
      })
      spans.sort((a, b) => a[0] - b[0])
      for (let k = 1; k < spans.length; k++) if (spans[k][0] < spans[k - 1][1]) err(F, `${w}.n[${spans[k][3]}]`, `「${spans[k][2]}」与「${spans[k - 1][2]}」按首次出现位置重叠`)
    }

    // 文章层
    if (ch.article === undefined) {
      if (kind === 'book' || kind === 'collection') err(F, 'article', `${kind === 'book' ? '现代书' : '文集'}每章必有 article`)
      return
    }
    const a = ch.article
    if (!isObj(a)) { err(F, 'article', '应为对象'); return }
    for (const k of Object.keys(a)) if (!['title', 'subtitle', 'idea', 'blocks'].includes(k)) warn(F, `article.${k}`, `标准里没有字段「${k}」`)
    for (const k of ['title', 'subtitle']) if (a[k] !== undefined && !isStr(a[k])) err(F, `article.${k}`, '应为非空字符串')
    if (a.idea !== undefined) {
      if (!isStr(a.idea)) err(F, 'article.idea', '应为非空字符串')
      else if (textLen(a.idea) > LIMITS.idea) err(F, 'article.idea', `${textLen(a.idea)} 字,超过 ${LIMITS.idea} 字`)
    }
    if (!Array.isArray(a.blocks) || !a.blocks.length) { err(F, 'article.blocks', '至少一块'); return }
    const st = { pull: 0, quotes: 0, hasBody: false }
    a.blocks.forEach((b, j) => checkBlock(b, `article.blocks[${j}]`, st))
    if (!st.hasBody) err(F, 'article.blocks', '每章至少一个 p 或 lead')
    if (st.pull > LIMITS.pullPerChapter) err(F, 'article.blocks', `pull 金句 ${st.pull} 处,一章至多 ${LIMITS.pullPerChapter} 处`)
    if (digest && st.quotes > LIMITS.quotesPerChapter) err(F, 'article.blocks', `讲别人的书(digest)每章直接引用至多 ${LIMITS.quotesPerChapter} 条,本章 ${st.quotes} 条`)

    function strItems(b, w) {
      if (!Array.isArray(b.items) || !b.items.length) { err(F, `${w}.items`, '应为非空数组'); return }
      b.items.forEach((x, k) => { if (!isStr(x)) err(F, `${w}.items[${k}]`, '应为非空字符串'); else { inline(x, F, `${w}.items[${k}]`); stats.chars += textLen(x) } })
    }
    function checkBlock(b, w0, st) {
      if (!isObj(b)) { err(F, w0, '块应为对象'); return }
      const t = b.t
      const w = `${w0}(${t})`
      if (!BLOCK_TYPES.includes(t)) { err(F, w0, `不认识的块类型「${t}」`); return }
      stats.blocks++
      stats.blockTypes[t] = (stats.blockTypes[t] || 0) + 1
      for (const k of Object.keys(b)) if (k !== 't' && !BLOCK_FIELDS[t].includes(k)) warn(F, `${w}.${k}`, `${t} 块没有字段「${k}」`)
      const text = (k) => { if (!isStr(b[k])) { err(F, `${w}.${k}`, '缺文字(空块不许有)'); return false } inline(b[k], F, `${w}.${k}`); stats.chars += textLen(b[k]); return true }
      const optText = (k) => { if (b[k] === undefined) return; if (!isStr(b[k])) err(F, `${w}.${k}`, '应为非空字符串'); else { inline(b[k], F, `${w}.${k}`); stats.chars += textLen(b[k]) } }
      const dims = () => {
        for (const k of ['w', 'h']) if (!isInt(b[k]) || b[k] <= 0) err(F, `${w}.${k}`, '应为正整数(像素)')
      }
      switch (t) {
        case 'lead': case 'p': if (text('x')) st.hasBody = true; break
        case 'h2': case 'h3': text('x'); break
        case 'pull': text('x'); st.pull++; break
        case 'quote': {
          for (const k of ['o', 'tr', 'x', 'by']) optText(k)
          if (!isStr(b.o) && !isStr(b.x) && !isStr(b.tr)) { err(F, w, '引文块至少要有 o(原文)或 x(引的话)'); break }
          if (!isStr(b.o) && !isStr(b.x)) warn(F, w, '只有 tr 的引文块:书桌按提示语显示')
          stats.quotes++; st.quotes++
          if (digest) {
            const q = isStr(b.x) ? b.x : b.o
            if (q && textLen(q) > LIMITS.quoteChars) err(F, w, `讲别人的书(digest)每条直接引用至多 ${LIMITS.quoteChars} 字,这条 ${textLen(q)} 字`)
          }
          break
        }
        case 'callout':
          if (!CALLOUT_TONES.includes(b.tone)) err(F, `${w}.tone`, `应为 ${CALLOUT_TONES.join(' / ')}`)
          optText('label')
          if (isStr(b.label) && textLen(b.label) > LIMITS.calloutLabel) warn(F, `${w}.label`, `标签 ${textLen(b.label)} 字,偏长`)
          strItems(b, w)
          break
        case 'steps': case 'refs': strItems(b, w); break
        case 'list':
          if (typeof b.ordered !== 'boolean') err(F, `${w}.ordered`, '应为 true / false')
          strItems(b, w)
          break
        case 'outline': {
          const walk = (items, wp, depth) => {
            if (!Array.isArray(items) || !items.length) { err(F, wp, '应为非空数组'); return }
            if (depth > LIMITS.outlineDepth) { err(F, wp, `提纲最多 ${LIMITS.outlineDepth} 层`); return }
            items.forEach((it, k) => {
              const wi = `${wp}[${k}]`
              if (!isObj(it)) { err(F, wi, '应为 {x, children?}'); return }
              for (const key of Object.keys(it)) if (!['x', 'children'].includes(key)) warn(F, `${wi}.${key}`, `提纲项没有字段「${key}」`)
              if (!isStr(it.x)) err(F, `${wi}.x`, '缺文字')
              else { inline(it.x, F, `${wi}.x`); stats.chars += textLen(it.x) }
              if (it.children !== undefined) walk(it.children, `${wi}.children`, depth + 1)
            })
          }
          walk(b.items, `${w}.items`, 1)
          break
        }
        case 'fig': {
          optText('cap')
          const probs = checkFigShape(b.fig)
          for (const pr of probs) err(F, `${w}.fig`, pr)
          if (isObj(b.fig) && FIG_KINDS.includes(b.fig.kind)) stats.figs[b.fig.kind] = (stats.figs[b.fig.kind] || 0) + 1
          break
        }
        case 'img':
          if (!isStr(b.alt)) err(F, `${w}.alt`, '缺替代文字 alt(给读屏与加载失败时用)')
          else inline(b.alt, F, `${w}.alt`)
          optText('cap'); dims()
          ref(b.src, F, `${w}.src`, 'image', b.w, b.h)
          break
        case 'video':
          optText('cap'); dims()
          if (typeof b.sec !== 'number' || !(b.sec > 0)) err(F, `${w}.sec`, '应为正数(秒)')
          else if (b.sec > LIMITS.videoSeconds) err(F, `${w}.sec`, `${b.sec} 秒,超过 ${LIMITS.videoSeconds} 秒`)
          for (const k of ['loop', 'sound']) if (b[k] !== undefined && typeof b[k] !== 'boolean') err(F, `${w}.${k}`, '应为 true / false')
          ref(b.src, F, `${w}.src`, 'video', b.w, b.h)
          ref(b.poster, F, `${w}.poster`, 'image')
          if (typeof b.src === 'string' && media.get(b.src)?.kind === 'video') {
            const info = media.get(b.src).info
            if (info.sec != null && typeof b.sec === 'number' && Math.abs(info.sec - b.sec) > 1) warn(F, `${w}.sec`, `标的 ${b.sec} 秒,文件实长 ${info.sec} 秒`)
            if (info.audio && b.sound !== true) warn(F, `${w}.sound`, '视频带音轨却没标 sound: true:书桌会静音自动播')
          }
          if (typeof b.poster === 'string' && media.get(b.poster)?.info?.w && isInt(b.w) && isInt(b.h)) {
            const pi = media.get(b.poster).info
            if (Math.abs(pi.w / pi.h - b.w / b.h) > 0.02) warn(F, `${w}.poster`, `封面图 ${pi.w}×${pi.h} 与视频比例不一致`)
          }
          break
        case 'code':
          if (typeof b.x !== 'string' || !b.x.length) err(F, `${w}.x`, '缺内容')
          if (b.lang !== undefined && !isStr(b.lang)) err(F, `${w}.lang`, '应为字符串')
          break
        case 'divider': break
      }
    }
  })

  function inline(s, file, where) { for (const pr of checkInline(s)) err(file, where, pr) }

  // ── §4 媒体:尺寸核对、未被引用 ──
  for (const [path, list] of refs) {
    const m = media.get(path)
    if (!m?.info?.w) continue
    for (const r of list) {
      if (r.w === undefined || r.h === undefined || !isInt(r.w) || !isInt(r.h)) continue
      if (r.w !== m.info.w || r.h !== m.info.h) err(r.file, r.where, `标的 ${r.w}×${r.h},「${path}」实际是 ${m.info.w}×${m.info.h}`)
    }
  }
  for (const path of media.keys()) if (!refs.has(path)) warn(path, '', '包里有这个媒体,但没有任何地方引用它')

  return { ok: errors.length === 0, errors, warnings, book, stats }
}

// 给 App / 服务端看的摘要。参数:validate() 的结果,或文件 Map(会先校验)
export function summarize(x) {
  const r = x instanceof Map ? validate(x) : x
  const b = r?.book || {}
  const s = r?.stats || {}
  return {
    id: b.id ?? null, title: b.title ?? null, kind: b.kind ?? null, revision: b.revision ?? null,
    chapters: Array.isArray(b.chapters) ? b.chapters.length : 0, chars: s.chars || 0,
    mediaFiles: (s.images || 0) + (s.videos || 0), mediaBytes: s.mediaBytes || 0, totalBytes: s.totalBytes || 0,
    disclaimer: b.disclaimer ?? null, ok: !!r?.ok,
  }
}

// 把一条问题排成一行中文:「chapters/002.json · article.blocks[3](quote):……」
export const formatIssue = (e) => [e.file || '(书包)', e.where].filter(Boolean).join(' · ') + ':' + e.msg
