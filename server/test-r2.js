// 测试专用:内存里的 R2 绑定(只实现书房用到的那几样:put 收流 / get 带区间 / head / delete / list / 分片上传)。
// 只给 vitest 用,线上代码不引用。行为照 Cloudflare R2 Workers API 的文档写:
//   put(key, value, {httpMetadata, customMetadata, sha256}) —— 带 sha256 时内容对不上即抛错
//   get(key, {range: {offset, length} | {suffix}}) —— 返回 {body, size, arrayBuffer(), httpMetadata, customMetadata, range}
//   分片:除最后一片外各片须等大且 ≥ 5 MB(这里把门槛做成可调,测试用小片)
import { createHash, randomUUID } from 'node:crypto'

async function toBytes(value) {
  if (value == null) return new Uint8Array(0)
  if (value instanceof Uint8Array) return new Uint8Array(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0))
  if (typeof value === 'string') return new TextEncoder().encode(value)
  if (typeof value.getReader === 'function') {
    const reader = value.getReader()
    const chunks = []
    let n = 0
    for (;;) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      chunks.push(chunk); n += chunk.length
    }
    const out = new Uint8Array(n)
    let o = 0
    for (const c of chunks) { out.set(c, o); o += c.length }
    return out
  }
  throw new TypeError('unsupported R2 value')
}

const md5 = (b) => createHash('md5').update(b).digest('hex')
const sha256Hex = (b) => createHash('sha256').update(b).digest('hex')

function objectOf(key, rec, range) {
  const bytes = range ? rec.bytes.subarray(range.offset, range.offset + range.length) : rec.bytes
  return {
    key,
    size: rec.bytes.length,
    etag: rec.etag,
    httpEtag: `"${rec.etag}"`,
    httpMetadata: { ...rec.httpMetadata },
    customMetadata: { ...rec.customMetadata },
    uploaded: rec.uploaded,
    range,
    get body() { return new Response(bytes).body },
    async arrayBuffer() { return bytes.slice().buffer },
    async text() { return new TextDecoder().decode(bytes) },
  }
}

export function createTestR2({ minPartSize = 5 * 1024 * 1024 } = {}) {
  const store = new Map()
  const uploads = new Map()
  const calls = { put: 0, get: 0, ranges: [] }

  const bucket = {
    store,
    uploads,
    calls,
    async put(key, value, opts = {}) {
      calls.put++
      const bytes = await toBytes(value)
      if (opts.sha256 && sha256Hex(bytes) !== String(opts.sha256).toLowerCase()) {
        throw new Error('put: The SHA-256 checksum you specified did not match what we received.')
      }
      const rec = { bytes, etag: md5(bytes), httpMetadata: opts.httpMetadata || {}, customMetadata: opts.customMetadata || {}, uploaded: new Date() }
      store.set(key, rec)
      return objectOf(key, rec)
    },
    async get(key, opts = {}) {
      calls.get++
      const rec = store.get(key)
      if (!rec) return null
      let range
      if (opts.range) {
        const size = rec.bytes.length
        if (opts.range.suffix !== undefined) {
          const n = Math.min(opts.range.suffix, size)
          range = { offset: size - n, length: n }
        } else {
          const offset = opts.range.offset ?? 0
          const length = Math.min(opts.range.length ?? size - offset, size - offset)
          if (offset > size || length < 0) throw new Error('get: range out of bounds')
          range = { offset, length }
        }
        calls.ranges.push(range)
      }
      return objectOf(key, rec, range)
    },
    async head(key) {
      const rec = store.get(key)
      return rec ? objectOf(key, rec) : null
    },
    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) store.delete(k)
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort()
      const start = cursor ? Number(cursor) : 0
      const page = all.slice(start, start + limit)
      const truncated = start + limit < all.length
      return { objects: page.map((k) => objectOf(k, store.get(k))), truncated, cursor: truncated ? String(start + limit) : undefined }
    },
    async createMultipartUpload(key, opts = {}) {
      const uploadId = randomUUID()
      uploads.set(uploadId, { key, parts: new Map(), opts })
      return bucket.resumeMultipartUpload(key, uploadId)
    },
    resumeMultipartUpload(key, uploadId) {
      const state = () => {
        const u = uploads.get(uploadId)
        if (!u || u.key !== key) throw new Error('multipart: upload does not exist')
        return u
      }
      return {
        key,
        uploadId,
        async uploadPart(partNumber, value) {
          const u = state()
          const bytes = await toBytes(value)
          const etag = md5(bytes)
          u.parts.set(partNumber, { bytes, etag })
          return { partNumber, etag }
        },
        async abort() { state(); uploads.delete(uploadId) },
        async complete(parts) {
          const u = state()
          const chunks = parts.map((p, i) => {
            const got = u.parts.get(p.partNumber)
            if (!got || got.etag !== p.etag) throw new Error(`multipart: part ${p.partNumber} missing or etag mismatch`)
            if (i < parts.length - 1 && got.bytes.length < minPartSize) throw new Error('multipart: part too small')
            if (i < parts.length - 1 && got.bytes.length !== u.parts.get(parts[0].partNumber).bytes.length) throw new Error('multipart: parts must be equal size')
            return got.bytes
          })
          const n = chunks.reduce((a, c) => a + c.length, 0)
          const bytes = new Uint8Array(n)
          let o = 0
          for (const c of chunks) { bytes.set(c, o); o += c.length }
          const rec = { bytes, etag: `${md5(bytes)}-${parts.length}`, httpMetadata: u.opts.httpMetadata || {}, customMetadata: u.opts.customMetadata || {}, uploaded: new Date() }
          store.set(key, rec)
          uploads.delete(uploadId)
          return objectOf(key, rec)
        },
      }
    },
  }
  return bucket
}
