// 书房书架(2026-11-22):管理员上传的 .deskbook 书包 —— 对象在 R2(绑定 DESK_BUCKET,桶 hexa-desk),目录在 D1 desk_shelf。
//
// 三条分寸:
// ① **非管理员什么都看不到。** 书目接口对他们照样回 200 `{items: []}`(书桌 App 无条件调它,不能借此探知书房存在);
//    其余接口一律 404,与 functions/_middleware.js 挡 /books 的口径一致。判据是 server/admin.js 的 isAdminUser。
// ② **不缓冲请求体。** Worker 内存约 128 MB、请求体上限约 100 MB,标准却允许 300 MB 的书包。
//    所以书包原样流进 R2,再按区间读回中央目录与 book.json 做轻校验(server/deskbook-range.js);
//    大于 SINGLE_MAX 的走 R2 分片上传(建 → 逐片传 → 合),由上传页驱动。完整校验在浏览器里已做过。
// ③ **校验不过就删掉刚写进去的对象**,不留半截东西;旧版本在新版本落库之后才删。
//
// 对象键:shelf/<id>/r<revision>.deskbook(同一修订号覆盖时另加 8 位随机后缀,免得未校验先盖掉旧包)、
//         shelf/<id>/cover.jpg、shelf/<id>/banner.jpg(键名固定,真实类型记在 Content-Type)。
import { isAdminUser } from './admin.js'
import { FORMAT, FORMAT_VERSION, ID_PATTERN, KINDS, LIMITS, readImageInfo } from '../scripts/desk/deskbook-core.mjs'
import { ZipRangeError, readZipDirectory, readZipEntry } from './deskbook-range.js'

const MB = 1024 * 1024
// 单次请求直传的上限:Cloudflare 请求体上限 100 MB(Free / Pro),留出余量
export const SINGLE_MAX = 90 * MB
// 分片大小:R2 要求除最后一片外各片等大、≥ 5 MB;32 MB 一片,300 MB 的包十片
export const PART_SIZE = 32 * MB
// 片大小可由 env.DESK_SHELF_PART_SIZE 改(只为测试用小片走多片;线上不设)
const partSizeOf = (c) => Number(c.env?.DESK_SHELF_PART_SIZE) || PART_SIZE
const maxPartsOf = (c) => Math.ceil(LIMITS.totalBytes / partSizeOf(c)) + 1
const KEY_RE = /^shelf\/([a-z0-9][a-z0-9-]{2,63})\/r(\d{1,9})(-[0-9a-f]{8})?\.deskbook$/
const SHA_RE = /^[0-9a-f]{64}$/
const MEDIA_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const PACKAGE_TYPE = 'application/zip'

class ShelfError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const parseJson = (s, fallback) => { if (s == null) return fallback; try { return JSON.parse(s) } catch { return fallback } }
const randHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n / 2)), (b) => b.toString(16).padStart(2, '0')).join('')
const packageKey = (id, rev, salt) => `shelf/${id}/r${rev}${salt ? '-' + salt : ''}.deskbook`
const mediaKey = (id, which) => `shelf/${id}/${which}.jpg`

function toInt(v, { min = 0, max = Number.MAX_SAFE_INTEGER, name = '数值' } = {}) {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  if (!Number.isInteger(n) || n < min || n > max) throw new ShelfError(400, `${name}不合法`)
  return n
}

// 目录行 → 给网页与书桌 App 的一条。URL 带 ?r= 修订号:换了新版图片地址就变,私有缓存不会喂旧图
export function shelfItem(row) {
  const base = `/api/desk/shelf/${row.id}`
  return {
    id: row.id,
    revision: row.revision,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle || null,
    authors: parseJson(row.authors, []),
    summary: row.summary || null,
    category: row.category || null,
    tags: parseJson(row.tags, []),
    unit: row.unit || null,
    chapters: row.chapters,
    chars: row.chars,
    bytes: row.bytes,
    sha256: row.sha256 || null,
    theme: parseJson(row.theme, null),
    disclaimer: parseJson(row.disclaimer, null),
    source: parseJson(row.source, null),
    hidden: !!row.hidden,
    sort: row.sort,
    cover: row.has_cover ? `${base}/cover?r=${row.revision}` : null,
    banner: row.has_banner ? `${base}/banner?r=${row.revision}` : null,
    package: `${base}/package?r=${row.revision}`,
    uploadedAt: new Date(row.uploaded_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

// R2 的 put / uploadPart 要知道流的长度。Workers 里 request.body 带 Content-Length 一般就够,
// 再套一层 FixedLengthStream(Workers 专有)把长度钉死;Node 测试环境没有它,原样传。
function sizedBody(body, length) {
  if (body && typeof globalThis.FixedLengthStream === 'function') return body.pipeThrough(new globalThis.FixedLengthStream(length))
  return body
}

function declaredLength(c) {
  const n = Number(c.req.header('content-length'))
  if (!Number.isFinite(n) || n <= 0) throw new ShelfError(411, '缺 Content-Length')
  return n
}

// 读 Range 头:返回 {offset, length} 或 null(没带);格式不对 / 越界抛 416
export function parseRange(header, size) {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) throw new ShelfError(416, 'range not satisfiable')
  let start, end
  if (m[1] === '') {
    const n = Number(m[2])
    if (n === 0) throw new ShelfError(416, 'range not satisfiable')
    start = Math.max(0, size - n); end = size - 1
  } else {
    start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start >= size || end < start) throw new ShelfError(416, 'range not satisfiable')
  return { offset: start, length: end - start + 1 }
}

// 文件名:ASCII 兜底用 id,filename* 给中文书名
function disposition(row) {
  const ascii = `${row.id}-r${row.revision}.deskbook`
  const nice = `${String(row.title || row.id).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').slice(0, 80)}.deskbook`
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nice)}`
}

export function mountDeskShelf(app, { getSessionUser, getDb }) {
  const bucketOf = (c) => {
    const b = c.env?.DESK_BUCKET
    if (!b || typeof b.get !== 'function') throw new Error('R2 binding "DESK_BUCKET" is unavailable')
    return b
  }

  async function isAdmin(c) {
    return isAdminUser(await getSessionUser(c), c.env)
  }

  // 改动类请求再加一道:带 Origin 的必须同源(浏览器跨站提交挡在这里;SameSite=Lax 的 cookie 本就不随跨站 POST 走,
  // 这是第二道)。原生 App 不带 Origin,照常通过 —— 它用 Bearer,本来就没有 CSRF 这回事。
  function sameOrigin(c) {
    const origin = c.req.header('Origin')
    if (!origin) return
    if (origin !== new URL(c.req.url).origin) throw new ShelfError(403, 'cross-origin request refused')
  }

  // 包一层:非管理员一律 404;ShelfError 照状态码回;其余 503
  const guarded = (handler, { mutate = false } = {}) => async (c) => {
    try {
      if (!(await isAdmin(c))) return c.json({ ok: false, error: 'not found' }, 404)
      if (mutate) sameOrigin(c)
      return await handler(c)
    } catch (error) {
      if (error instanceof ShelfError) return c.json({ ok: false, error: error.message }, error.status)
      console.error('Desk shelf request failed', error)
      return c.json({ ok: false, error: 'service unavailable' }, 503)
    }
  }

  const rowOf = (db, id) => db.prepare('SELECT * FROM desk_shelf WHERE id = ?').bind(id).first()

  // 上传前的预检:id 形状、修订号须大于已存的(?replace=1 例外);返回本次要写的对象键
  async function planKey(db, id, revision, replace) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new ShelfError(400, 'id 不合规(3–64 位小写字母、数字、-)')
    const row = await rowOf(db, id)
    if (row && !replace && revision <= row.revision) {
      throw new ShelfError(409, `书房里已有《${row.title}》修订 ${row.revision},新包的 revision 须更大(或选「覆盖」)`)
    }
    let key = packageKey(id, revision)
    if (row && row.object_key === key) key = packageKey(id, revision, randHex(8))
    return key
  }

  // 书包已在 R2:按区间读回目录与 book.json 做轻校验,通过即落库。任何一步不过 → 删掉该对象并抛错
  async function finalize(c, key, { replace = false, sha256 = null, chars = 0 } = {}) {
    const bucket = bucketOf(c)
    const db = getDb(c)
    const m = KEY_RE.exec(key)
    if (!m) throw new ShelfError(400, '对象键不合规')
    const [, keyId, keyRev] = m
    try {
      const head = await bucket.head(key)
      if (!head) throw new ShelfError(400, '书包没有写进存储')
      const size = head.size
      const readRange = async (offset, length) => {
        const o = await bucket.get(key, { range: { offset, length } })
        if (!o) throw new ZipRangeError('读不到刚写进去的书包')
        return new Uint8Array(await o.arrayBuffer())
      }
      const dir = await readZipDirectory(readRange, size)
      const bj = dir.get('book.json')
      if (!bj) throw new ShelfError(400, '缺 book.json')
      let book
      try {
        let s = new TextDecoder('utf-8', { fatal: true }).decode(await readZipEntry(readRange, bj, LIMITS.bookJsonBytes))
        if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
        book = JSON.parse(s)
      } catch (e) {
        if (e instanceof ZipRangeError) throw e
        throw new ShelfError(400, 'book.json 不是合法的 JSON')
      }
      if (!book || typeof book !== 'object' || Array.isArray(book)) throw new ShelfError(400, 'book.json 顶层应为对象')
      if (book.format !== FORMAT) throw new ShelfError(400, `book.json 的 format 应为 "${FORMAT}"`)
      if (book.version !== FORMAT_VERSION) throw new ShelfError(400, `book.json 的 version 应为 ${FORMAT_VERSION}`)
      if (typeof book.id !== 'string' || !ID_PATTERN.test(book.id)) throw new ShelfError(400, 'book.json 的 id 不合规')
      if (!Number.isInteger(book.revision) || book.revision < 1) throw new ShelfError(400, 'book.json 的 revision 应为 ≥ 1 的整数')
      if (book.id !== keyId || String(book.revision) !== keyRev) {
        throw new ShelfError(400, `书包里的 id / revision(${book.id} / ${book.revision})与上传时声明的(${keyId} / ${keyRev})不一致`)
      }
      if (!KINDS.includes(book.kind)) throw new ShelfError(400, `book.json 的 kind 应为 ${KINDS.join(' / ')}`)
      if (typeof book.title !== 'string' || !book.title.trim()) throw new ShelfError(400, 'book.json 缺书名')
      if (!Array.isArray(book.chapters) || !book.chapters.length) throw new ShelfError(400, 'book.json 至少一章')
      for (const ch of book.chapters) if (!ch || typeof ch.file !== 'string' || !dir.has(ch.file)) throw new ShelfError(400, `章文件「${ch?.file}」不在包里`)

      const row = await rowOf(db, book.id)
      if (row && !replace && book.revision <= row.revision) {
        throw new ShelfError(409, `书房里已有《${row.title}》修订 ${row.revision},新包的 revision 须更大(或选「覆盖」)`)
      }

      // 封面 / 题图:从包里取出来另存一份,书目与书桌直接取图、不必下整包
      const media = {}
      for (const which of ['cover', 'banner']) {
        const p = book[which]
        if (p === undefined) continue
        const entry = typeof p === 'string' ? dir.get(p) : null
        if (!entry) throw new ShelfError(400, `book.json 的 ${which} 引用的「${p}」不在包里`)
        const bytes = await readZipEntry(readRange, entry, LIMITS.imageBytes)
        const type = readImageInfo(bytes).type
        if (!MEDIA_TYPES[type]) throw new ShelfError(400, `${which}「${p}」不是 jpg / png / webp 图片`)
        media[which] = { bytes, type }
      }
      for (const [which, { bytes, type }] of Object.entries(media)) {
        await bucket.put(mediaKey(book.id, which), bytes, { httpMetadata: { contentType: MEDIA_TYPES[type] } })
      }

      const now = Date.now()
      const str = (v) => (typeof v === 'string' && v.trim() ? v : null)
      const json = (v) => (v === undefined ? null : JSON.stringify(v))
      const fields = {
        revision: book.revision,
        kind: book.kind,
        title: book.title,
        subtitle: str(book.subtitle),
        authors: JSON.stringify(Array.isArray(book.authors) ? book.authors.filter((x) => typeof x === 'string') : []),
        summary: str(book.summary),
        tags: JSON.stringify(Array.isArray(book.tags) ? book.tags.filter((x) => typeof x === 'string') : []),
        unit: str(book.unit),
        chapters: book.chapters.length,
        chars,
        bytes: size,
        sha256: sha256 || head.customMetadata?.sha256 || null,
        has_cover: media.cover ? 1 : 0,
        has_banner: media.banner ? 1 : 0,
        theme: json(book.theme),
        disclaimer: json(book.disclaimer),
        source: json(book.source),
        object_key: key,
        updated_at: now,
      }
      if (row) {
        // 分栏是管理员可改的:重传新版不冲掉他手改过的 category / hidden / sort
        const cols = Object.keys(fields)
        await db.prepare(`UPDATE desk_shelf SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
          .bind(...cols.map((k) => fields[k]), book.id).run()
      } else {
        const all = { id: book.id, ...fields, category: str(book.category), uploaded_at: now, hidden: 0, sort: 0 }
        const cols = Object.keys(all)
        await db.prepare(`INSERT INTO desk_shelf (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
          .bind(...cols.map((k) => all[k])).run()
      }
      // 新版落库后再清旧的:旧版书包、新版没有的封面 / 题图
      if (row && row.object_key !== key) await bucket.delete(row.object_key).catch(() => {})
      for (const which of ['cover', 'banner']) {
        if (row?.[`has_${which}`] && !media[which]) await bucket.delete(mediaKey(book.id, which)).catch(() => {})
      }
      return shelfItem(await rowOf(db, book.id))
    } catch (error) {
      await bucket.delete(key).catch(() => {})
      if (error instanceof ZipRangeError) throw new ShelfError(400, `书包读不开:${error.message}`)
      throw error
    }
  }

  // ── 书目 ──
  app.get('/desk/shelf', async (c) => {
    try {
      if (!(await isAdmin(c))) return c.json({ items: [] })
      const all = c.req.query('all') === '1'
      const rows = await getDb(c)
        .prepare(`SELECT * FROM desk_shelf ${all ? '' : 'WHERE hidden = 0'} ORDER BY category IS NULL, category, sort, title`)
        .all()
      return c.json({ items: (rows?.results || []).map(shelfItem) })
    } catch (error) {
      // 出错也不吐 503:书桌对非管理员 / 出错一视同仁,看到的都是空书房
      console.error('Desk shelf list failed', error)
      return c.json({ items: [] })
    }
  })

  // ── 直传(≤ SINGLE_MAX):POST /desk/shelf?id=&revision=&sha256=&chars=[&replace=1],请求体就是书包 ──
  app.post('/desk/shelf', guarded(async (c) => {
    const q = (k) => c.req.query(k)
    const revision = toInt(q('revision'), { min: 1, max: 999_999_999, name: 'revision ' })
    const replace = q('replace') === '1'
    const sha256 = (q('sha256') || '').toLowerCase()
    if (!SHA_RE.test(sha256)) throw new ShelfError(400, 'sha256 应为 64 位十六进制')
    const chars = toInt(q('chars') ?? 0, { max: 1e9, name: 'chars ' })
    const len = declaredLength(c)
    if (len > LIMITS.totalBytes) throw new ShelfError(413, `书包超过 ${LIMITS.totalBytes / MB} MB`)
    if (len > SINGLE_MAX) throw new ShelfError(413, `超过 ${SINGLE_MAX / MB} MB 的书包请走分片上传`)
    const key = await planKey(getDb(c), q('id'), revision, replace)
    // sha256 交给 R2 核:内容对不上,put 直接失败(不耗 Worker 的 CPU 去算)
    try {
      await bucketOf(c).put(key, sizedBody(c.req.raw.body, len), {
        httpMetadata: { contentType: PACKAGE_TYPE },
        customMetadata: { sha256, chars: String(chars) },
        sha256,
      })
    } catch (error) {
      await bucketOf(c).delete(key).catch(() => {})
      console.error('Desk shelf put failed', error)
      throw new ShelfError(400, '书包没有完整写入(校验和不符或传输中断),请重试')
    }
    const item = await finalize(c, key, { replace, sha256, chars })
    return c.json({ ok: true, item }, 201)
  }, { mutate: true }))

  // ── 分片上传 ──
  // 建:{id, revision, size, sha256, chars, replace?} → {key, uploadId, partSize, parts}
  app.post('/desk/shelf/uploads', guarded(async (c) => {
    let body
    try { body = await c.req.json() } catch { throw new ShelfError(400, 'invalid JSON body') }
    const revision = toInt(body?.revision, { min: 1, max: 999_999_999, name: 'revision ' })
    const size = toInt(body?.size, { min: 1, max: LIMITS.totalBytes, name: '大小' })
    const sha256 = String(body?.sha256 || '').toLowerCase()
    if (!SHA_RE.test(sha256)) throw new ShelfError(400, 'sha256 应为 64 位十六进制')
    const chars = toInt(body?.chars ?? 0, { max: 1e9, name: 'chars ' })
    const key = await planKey(getDb(c), body?.id, revision, !!body?.replace)
    const upload = await bucketOf(c).createMultipartUpload(key, {
      httpMetadata: { contentType: PACKAGE_TYPE },
      customMetadata: { sha256, chars: String(chars), size: String(size) },
    })
    return c.json({ ok: true, key, uploadId: upload.uploadId, partSize: partSizeOf(c), parts: Math.ceil(size / partSizeOf(c)) }, 201)
  }, { mutate: true }))

  const uploadKey = (c) => {
    const key = c.req.query('key') || ''
    if (!KEY_RE.test(key)) throw new ShelfError(400, '对象键不合规')
    return key
  }

  // 传一片:PUT /desk/shelf/uploads/:uploadId/:part?key=… → {partNumber, etag}
  app.put('/desk/shelf/uploads/:uploadId/:part', guarded(async (c) => {
    const key = uploadKey(c)
    const part = toInt(c.req.param('part'), { min: 1, max: maxPartsOf(c), name: '分片号' })
    const len = declaredLength(c)
    if (len > partSizeOf(c)) throw new ShelfError(413, `每片至多 ${partSizeOf(c) / MB} MB`)
    const upload = bucketOf(c).resumeMultipartUpload(key, c.req.param('uploadId'))
    let uploaded
    try {
      uploaded = await upload.uploadPart(part, sizedBody(c.req.raw.body, len))
    } catch (error) {
      console.error('Desk shelf part failed', error)
      throw new ShelfError(400, '这一片没有传上去(上传已失效或传输中断),请重试')
    }
    return c.json({ ok: true, partNumber: uploaded.partNumber, etag: uploaded.etag })
  }, { mutate: true }))

  // 合:{key, parts:[{partNumber, etag}], replace?} → 轻校验 → 落库
  app.post('/desk/shelf/uploads/:uploadId/complete', guarded(async (c) => {
    let body
    try { body = await c.req.json() } catch { throw new ShelfError(400, 'invalid JSON body') }
    const key = String(body?.key || '')
    if (!KEY_RE.test(key)) throw new ShelfError(400, '对象键不合规')
    const parts = Array.isArray(body?.parts) ? body.parts : []
    if (!parts.length || parts.length > maxPartsOf(c)) throw new ShelfError(400, '分片清单不合法')
    const clean = parts.map((p) => ({ partNumber: toInt(p?.partNumber, { min: 1, max: maxPartsOf(c), name: '分片号' }), etag: String(p?.etag || '') }))
      .sort((a, b) => a.partNumber - b.partNumber)
    const upload = bucketOf(c).resumeMultipartUpload(key, c.req.param('uploadId'))
    try {
      await upload.complete(clean)
    } catch (error) {
      console.error('Desk shelf complete failed', error)
      throw new ShelfError(400, '分片合并失败(分片缺失或上传已失效),请重新上传')
    }
    const head = await bucketOf(c).head(key)
    const declared = Number(head?.customMetadata?.size)
    if (head && Number.isFinite(declared) && declared !== head.size) {
      await bucketOf(c).delete(key).catch(() => {})
      throw new ShelfError(400, `合并后大小 ${head.size} 与声明的 ${declared} 不符`)
    }
    const item = await finalize(c, key, {
      replace: !!body?.replace,
      sha256: head?.customMetadata?.sha256 || null,
      chars: Number(head?.customMetadata?.chars) || 0,
    })
    return c.json({ ok: true, item }, 201)
  }, { mutate: true }))

  // 放弃:DELETE /desk/shelf/uploads/:uploadId?key=…
  app.delete('/desk/shelf/uploads/:uploadId', guarded(async (c) => {
    const key = uploadKey(c)
    try { await bucketOf(c).resumeMultipartUpload(key, c.req.param('uploadId')).abort() } catch { /* 已失效也算放弃成功 */ }
    return c.body(null, 204)
  }, { mutate: true }))

  // ── 取书包:支持 Range(断点续传)与 If-None-Match ──
  app.get('/desk/shelf/:id/package', guarded(async (c) => {
    const row = await rowOf(getDb(c), c.req.param('id'))
    if (!row) throw new ShelfError(404, 'not found')
    const bucket = bucketOf(c)
    const head = await bucket.head(row.object_key)
    if (!head) throw new ShelfError(404, 'not found')
    const etag = `"${row.sha256 || head.etag}"`
    const headers = {
      'Content-Type': PACKAGE_TYPE,
      'Accept-Ranges': 'bytes',
      ETag: etag,
      'Content-Disposition': disposition(row),
      'Cache-Control': 'private, no-cache',
    }
    if (c.req.header('If-None-Match') === etag) return new Response(null, { status: 304, headers })
    // If-Range 对不上(包已换新版)就整包重给,免得把两个版本的字节拼在一起
    const ifRange = c.req.header('If-Range')
    let range = null
    try {
      range = !ifRange || ifRange === etag ? parseRange(c.req.header('Range'), head.size) : null
    } catch (error) {
      if (error instanceof ShelfError && error.status === 416) {
        return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${head.size}` } })
      }
      throw error
    }
    const obj = await bucket.get(row.object_key, range ? { range } : undefined)
    if (!obj) throw new ShelfError(404, 'not found')
    if (range) {
      return new Response(obj.body, {
        status: 206,
        headers: { ...headers, 'Content-Length': String(range.length), 'Content-Range': `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}` },
      })
    }
    return new Response(obj.body, { status: 200, headers: { ...headers, 'Content-Length': String(head.size) } })
  }))

  // ── 封面 / 题图 ──
  for (const which of ['cover', 'banner']) {
    app.get(`/desk/shelf/:id/${which}`, guarded(async (c) => {
      const row = await rowOf(getDb(c), c.req.param('id'))
      if (!row || !row[`has_${which}`]) throw new ShelfError(404, 'not found')
      const obj = await bucketOf(c).get(mediaKey(row.id, which))
      if (!obj) throw new ShelfError(404, 'not found')
      return new Response(obj.body, {
        status: 200,
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
          'Content-Length': String(obj.size),
          // 只许私有缓存(浏览器 / App),地址带 ?r= 修订号,换版即换地址
          'Cache-Control': 'private, max-age=86400',
        },
      })
    }))
  }

  // ── 改分栏 / 隐藏 / 排序 ──
  app.patch('/desk/shelf/:id', guarded(async (c) => {
    let body
    try { body = await c.req.json() } catch { throw new ShelfError(400, 'invalid JSON body') }
    const db = getDb(c)
    const id = c.req.param('id')
    if (!(await rowOf(db, id))) throw new ShelfError(404, 'not found')
    const sets = []
    const vals = []
    if (body?.category !== undefined) {
      const v = body.category === null ? '' : String(body.category).trim()
      if ([...v].length > 24 || /\s/.test(v)) throw new ShelfError(400, '分栏应为一个词(≤ 24 字,不含空格)')
      sets.push('category = ?'); vals.push(v || null)
    }
    if (body?.hidden !== undefined) {
      if (typeof body.hidden !== 'boolean') throw new ShelfError(400, 'hidden 应为 true / false')
      sets.push('hidden = ?'); vals.push(body.hidden ? 1 : 0)
    }
    if (body?.sort !== undefined) {
      sets.push('sort = ?'); vals.push(toInt(body.sort, { min: -1e6, max: 1e6, name: 'sort ' }))
    }
    if (!sets.length) throw new ShelfError(400, '没有可改的字段(category / hidden / sort)')
    sets.push('updated_at = ?'); vals.push(Date.now())
    await db.prepare(`UPDATE desk_shelf SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, id).run()
    return c.json({ ok: true, item: shelfItem(await rowOf(db, id)) })
  }, { mutate: true }))

  // ── 删除:目录行 + 该书名下全部对象 ──
  app.delete('/desk/shelf/:id', guarded(async (c) => {
    const db = getDb(c)
    const id = c.req.param('id')
    const row = await rowOf(db, id)
    if (!row) throw new ShelfError(404, 'not found')
    const bucket = bucketOf(c)
    const keys = new Set([row.object_key, mediaKey(id, 'cover'), mediaKey(id, 'banner')])
    let cursor
    do {
      const page = await bucket.list({ prefix: `shelf/${id}/`, cursor })
      for (const o of page.objects || []) keys.add(o.key)
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
    await bucket.delete([...keys])
    await db.prepare('DELETE FROM desk_shelf WHERE id = ?').bind(id).run()
    return c.body(null, 204)
  }, { mutate: true }))
}
