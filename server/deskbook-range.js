// 书房上传的服务端轻校验:**不把整个书包读进内存**,只按区间读 zip 的中央目录与个别条目。
//
// Worker 内存约 128 MB,而标准允许书包到 300 MB —— 所以书包先原样流进 R2,再用这里的函数
// 从存好的对象里按 Range 读:结尾(EOCD,≤ 64 KB)→ 中央目录 → book.json / 封面 / 题图各一条。
// 完整校验(每一章、每一块)在浏览器里上传前已经用 scripts/desk/deskbook-core.mjs 做过。
//
// readRange(offset, length) → Promise<Uint8Array>,由调用方接到 R2 的 get(key, {range})。
// 只依赖 Web 标准 API(DataView / DecompressionStream),Workers 与 Node 18+ 都能跑。
//
// 注:核心库日后若提供 readDirectory / extractEntry(区间读单条),可以换过去;这里先自带一份,
// 规则与 deskbook-core.mjs 的 unzip 一致(拒绝加密、分卷、超限 zip64、重名、违规路径)。
import { LIMITS, checkPath, crc32 } from '../scripts/desk/deskbook-core.mjs'

export class ZipRangeError extends Error {
  constructor(msg) { super(msg); this.name = 'ZipRangeError' }
}

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50
// 中央目录本身的上限:一万条 × (46 字节 + 255 字节路径) ≈ 3 MB,给 4 MB
const MAX_CD_BYTES = 4 * 1024 * 1024

const dvOf = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength)
const u64 = (dv, o) => {
  const v = dv.getBigUint64(o, true)
  if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipRangeError('zip64 数值过大')
  return Number(v)
}

// 读目录:返回 Map<路径, {name, method, crc, csize, usize, off}>(目录条目略去)
export async function readZipDirectory(readRange, size) {
  if (!Number.isFinite(size) || size < 22) throw new ZipRangeError('不是 zip:文件太短')
  if (size > LIMITS.totalBytes) throw new ZipRangeError(`书包文件超过 ${LIMITS.totalBytes / 1048576} MB`)
  const tailLen = Math.min(size, 22 + 65535 + 20)
  const tailStart = size - tailLen
  const tail = await readRange(tailStart, tailLen)
  const tdv = dvOf(tail)
  let eocd = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tdv.getUint32(i, true) === EOCD_SIG && i + 22 + tdv.getUint16(i + 20, true) === tail.length) { eocd = i; break }
  }
  if (eocd < 0) throw new ZipRangeError('不是 zip:找不到中央目录结尾')
  if (tdv.getUint16(eocd + 4, true) !== 0 || tdv.getUint16(eocd + 6, true) !== 0) throw new ZipRangeError('不支持分卷 zip')
  let count = tdv.getUint16(eocd + 10, true)
  let cdSize = tdv.getUint32(eocd + 12, true)
  let cdOff = tdv.getUint32(eocd + 16, true)
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
    const loc = eocd - 20
    if (loc < 0 || tdv.getUint32(loc, true) !== 0x07064b50) throw new ZipRangeError('zip64 结构不完整')
    const z = u64(tdv, loc + 8)
    if (z + 56 > size) throw new ZipRangeError('zip64 结构不完整')
    const rec = await readRange(z, 56)
    const rdv = dvOf(rec)
    if (rdv.getUint32(0, true) !== 0x06064b50) throw new ZipRangeError('zip64 结构不完整')
    count = u64(rdv, 32); cdSize = u64(rdv, 40); cdOff = u64(rdv, 48)
  }
  if (count > LIMITS.entries) throw new ZipRangeError(`条目超过 ${LIMITS.entries} 个`)
  if (cdSize > MAX_CD_BYTES) throw new ZipRangeError('中央目录过大')
  if (cdOff + cdSize > size) throw new ZipRangeError('中央目录越界')

  const cd = cdSize ? await readRange(cdOff, cdSize) : new Uint8Array(0)
  const dv = dvOf(cd)
  const dec = new TextDecoder('utf-8', { fatal: true })
  const out = new Map()
  let p = 0
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== CD_SIG) throw new ZipRangeError(`中央目录第 ${i + 1} 条损坏`)
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const crc = dv.getUint32(p + 16, true)
    let csize = dv.getUint32(p + 20, true)
    let usize = dv.getUint32(p + 24, true)
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true)
    const disk = dv.getUint16(p + 34, true)
    let off = dv.getUint32(p + 42, true)
    if (p + 46 + nLen + xLen + cLen > cd.length) throw new ZipRangeError(`中央目录第 ${i + 1} 条越界`)
    let name
    try { name = dec.decode(cd.subarray(p + 46, p + 46 + nLen)) } catch { throw new ZipRangeError(`第 ${i + 1} 条的文件名不是合法 UTF-8`) }
    let x = p + 46 + nLen
    const xEnd = x + xLen
    while (x + 4 <= xEnd) {
      const id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true)
      if (id === 0x0001) {
        let q = x + 4
        if (usize === 0xffffffff) { usize = u64(dv, q); q += 8 }
        if (csize === 0xffffffff) { csize = u64(dv, q); q += 8 }
        if (off === 0xffffffff) { off = u64(dv, q); q += 8 }
      }
      x += 4 + sz
    }
    p = xEnd + cLen
    if (flags & 0x0041) throw new ZipRangeError(`「${name}」是加密条目,书包不许加密`)
    if (disk !== 0) throw new ZipRangeError('不支持分卷 zip')
    const pathErr = checkPath(name)
    if (pathErr) throw new ZipRangeError(`「${name}」路径不合规:${pathErr}`)
    if (name.endsWith('/')) continue
    if (out.has(name)) throw new ZipRangeError(`「${name}」在 zip 里出现了两次`)
    if (method !== 0 && method !== 8) throw new ZipRangeError(`「${name}」的压缩方式 ${method} 不支持`)
    if (off + 30 > size) throw new ZipRangeError(`「${name}」的偏移越界`)
    out.set(name, { name, method, crc, csize, usize, off })
  }
  return out
}

async function inflate(data, max) {
  const ds = new DecompressionStream('deflate-raw')
  const writer = ds.writable.getWriter()
  writer.write(data).catch(() => {})
  writer.close().catch(() => {})
  const reader = ds.readable.getReader()
  const chunks = []
  let n = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      n += value.length
      if (n > max) { reader.cancel().catch(() => {}); throw new ZipRangeError(`解压后超过上限 ${max} 字节`) }
      chunks.push(value)
    }
  } catch (e) {
    if (e instanceof ZipRangeError) throw e
    throw new ZipRangeError(`deflate 数据损坏:${e?.message || e}`)
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

// 读出一条:读本地文件头 → 数据区 → 解压(边解边数)→ 核大小与 CRC
export async function readZipEntry(readRange, entry, max) {
  if (entry.usize > max) throw new ZipRangeError(`「${entry.name}」解开后 ${entry.usize} 字节,超过上限 ${max}`)
  if (entry.method === 0 && entry.csize !== entry.usize) throw new ZipRangeError(`「${entry.name}」存储条目的大小前后不一`)
  const head = await readRange(entry.off, 30)
  const hdv = dvOf(head)
  if (head.length < 30 || hdv.getUint32(0, true) !== LOCAL_SIG) throw new ZipRangeError(`「${entry.name}」的本地文件头损坏`)
  if (hdv.getUint16(6, true) & 0x0001) throw new ZipRangeError(`「${entry.name}」是加密条目`)
  const start = entry.off + 30 + hdv.getUint16(26, true) + hdv.getUint16(28, true)
  const raw = entry.csize ? await readRange(start, entry.csize) : new Uint8Array(0)
  if (raw.length !== entry.csize) throw new ZipRangeError(`「${entry.name}」的数据越界`)
  const data = entry.method === 0 ? raw : await inflate(raw, max)
  if (data.length !== entry.usize) throw new ZipRangeError(`「${entry.name}」解开后的大小与目录记载不符`)
  if (crc32(data) !== entry.crc) throw new ZipRangeError(`「${entry.name}」CRC 校验不过,文件已损坏`)
  return data
}
