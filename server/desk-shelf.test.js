// 书房书架接口(server/desk-shelf.js)。D1 用 node:sqlite 上的真 schema,R2 用内存模拟(server/test-r2.js),
// 书包用 public/desk/standard/samples/ 里的真实样例。
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../functions/api/[[route]].js'
import { createTestD1, readRepoFile } from './test-d1.js'
import { createTestR2 } from './test-r2.js'
import { unzip, zip } from '../scripts/desk/deskbook-core.mjs'
import { parseRange } from './desk-shelf.js'

const ORIGIN = 'https://hexa.gavin.pub'
const sample = (name) => new Uint8Array(readFileSync(new URL(`../public/desk/standard/samples/${name}.deskbook`, import.meta.url)))
const sha = (b) => createHash('sha256').update(b).digest('hex')
const BOOK = sample('sample-book') // 有封面 + 题图
const FIT = sample('sample-fitness') // 只有封面
const BOOK_ID = 'u-pendulum-sample-5e1c2a90'

let db, r2, env

function call(path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } }
  if (body !== undefined) {
    if (body instanceof Uint8Array) {
      init.body = body
      init.headers['Content-Length'] = String(body.length)
      init.headers['Content-Type'] ||= 'application/zip'
    } else {
      init.body = JSON.stringify(body)
      init.headers['Content-Type'] = 'application/json'
    }
  }
  return onRequest({ request: new Request(`${ORIGIN}${path}`, init), env })
}

async function register(email) {
  const res = await call('/api/auth/register', { method: 'POST', body: { email, password: 'correct-horse', password2: 'correct-horse' }, headers: { 'X-Client': 'native' } })
  expect(res.status).toBe(201)
  return (await res.json()).token
}

let admin, reader
const as = (token, extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra })

async function readBookJson(bytes) {
  return JSON.parse(new TextDecoder().decode((await unzip(bytes)).get('book.json')))
}

function upload(bytes, { token = admin, id, revision, replace, headers = {} } = {}) {
  return (async () => {
    const b = await readBookJson(bytes).catch(() => ({}))
    const q = new URLSearchParams({ id: id ?? b.id, revision: String(revision ?? b.revision), sha256: sha(bytes), chars: '1234' })
    if (replace) q.set('replace', '1')
    return call(`/api/desk/shelf?${q}`, { method: 'POST', body: bytes, headers: token ? as(token, headers) : headers })
  })()
}

// 改一份书包的 book.json(revision / 删字段),重新打包
async function repack(bytes, edit) {
  const files = await unzip(bytes)
  const book = JSON.parse(new TextDecoder().decode(files.get('book.json')))
  const next = edit(book, files)
  if (next !== null) files.set('book.json', new TextEncoder().encode(JSON.stringify(book)))
  return zip(files)
}

const shelfKeys = () => [...r2.store.keys()].filter((k) => k.startsWith('shelf/')).sort()

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  db = createTestD1()
  r2 = createTestR2({ minPartSize: 1 })
  env = { DB: db, DESK_BUCKET: r2, ADMIN_EMAILS: 'owner@example.com' }
  admin = await register('owner@example.com')
  reader = await register('reader@example.com')
})

describe('迁移 0008', () => {
  it('在旧库上执行后,desk_shelf 与 schema.sql 新建的一致', () => {
    const current = readRepoFile('schema.sql')
    const before = current.replace(/-- 书房书架[\s\S]*$/, '')
    expect(before).not.toContain('desk_shelf')
    const old = createTestD1(before)
    old.exec(readRepoFile('migrations/0008-desk-shelf.sql'))
    const cols = (d) => d.sqlite.prepare("SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info('desk_shelf')").all()
    expect(cols(old)).toEqual(cols(db))
    expect(cols(db).map((c) => c.name)).toEqual(expect.arrayContaining(['id', 'revision', 'kind', 'title', 'subtitle', 'authors', 'summary', 'category', 'tags', 'unit', 'chapters', 'chars', 'bytes', 'sha256', 'has_cover', 'has_banner', 'theme', 'disclaimer', 'source', 'uploaded_at', 'updated_at', 'hidden', 'sort']))
  })
})

describe('权限:非管理员与未登录什么都看不到', () => {
  beforeEach(async () => {
    expect((await upload(BOOK)).status).toBe(201)
  })

  it('书目:未登录 / 普通账号 200 空列表,管理员看得到', async () => {
    for (const headers of [{}, as(reader), as('bogus-token')]) {
      const res = await call('/api/desk/shelf', { headers })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ items: [] })
    }
    const res = await call('/api/desk/shelf', { headers: as(admin) })
    expect((await res.json()).items.map((x) => x.id)).toEqual([BOOK_ID])
  })

  it('其余每条路由对非管理员一律 404', async () => {
    const routes = [
      ['GET', `/api/desk/shelf/${BOOK_ID}/package`],
      ['GET', `/api/desk/shelf/${BOOK_ID}/cover`],
      ['GET', `/api/desk/shelf/${BOOK_ID}/banner`],
      ['PATCH', `/api/desk/shelf/${BOOK_ID}`, { hidden: true }],
      ['DELETE', `/api/desk/shelf/${BOOK_ID}`],
      ['POST', '/api/desk/shelf/uploads', { id: 'u-x-12345678', revision: 1, size: 10, sha256: 'a'.repeat(64) }],
      ['PUT', '/api/desk/shelf/uploads/abc/1?key=shelf/u-x-12345678/r1.deskbook', new Uint8Array(4)],
      ['POST', '/api/desk/shelf/uploads/abc/complete', { key: 'shelf/u-x-12345678/r1.deskbook', parts: [] }],
      ['DELETE', '/api/desk/shelf/uploads/abc?key=shelf/u-x-12345678/r1.deskbook'],
    ]
    for (const headers of [{}, as(reader)]) {
      for (const [method, path, body] of routes) {
        const res = await call(path, { method, body, headers })
        expect(res.status, `${method} ${path}`).toBe(404)
      }
      expect((await upload(FIT, { token: null, headers })).status).toBe(404)
    }
    // 什么都没动
    expect(shelfKeys()).toEqual([`shelf/${BOOK_ID}/banner.jpg`, `shelf/${BOOK_ID}/cover.jpg`, `shelf/${BOOK_ID}/r1.deskbook`])
    expect(db.sqlite.prepare('SELECT hidden FROM desk_shelf').get().hidden).toBe(0)
  })

  it('普通账号上传被拒,存储里不留东西', async () => {
    const res = await upload(FIT, { token: reader })
    expect(res.status).toBe(404)
    expect(shelfKeys().some((k) => k.includes('squat'))).toBe(false)
  })

  it('ADMIN_EMAILS 之外,is_owner 也算管理员', async () => {
    db.sqlite.prepare("UPDATE users SET is_owner = 1 WHERE email = 'reader@example.com'").run()
    const res = await call('/api/desk/shelf', { headers: as(reader) })
    expect((await res.json()).items).toHaveLength(1)
  })
})

describe('上传', () => {
  it('直传:落库、拆出封面题图、回目录行', async () => {
    const res = await upload(BOOK)
    expect(res.status).toBe(201)
    const { item } = await res.json()
    const book = await readBookJson(BOOK)
    expect(item).toMatchObject({
      id: BOOK_ID, revision: 1, kind: book.kind, title: book.title, chapters: book.chapters.length, chars: 1234,
      bytes: BOOK.length, sha256: sha(BOOK), category: book.category ?? null, hidden: false,
      cover: `/api/desk/shelf/${BOOK_ID}/cover?r=1`, banner: `/api/desk/shelf/${BOOK_ID}/banner?r=1`,
    })
    expect(item.tags).toEqual(book.tags || [])
    expect(item.theme).toEqual(book.theme ?? null)
    expect(shelfKeys()).toEqual([`shelf/${BOOK_ID}/banner.jpg`, `shelf/${BOOK_ID}/cover.jpg`, `shelf/${BOOK_ID}/r1.deskbook`])
    // 服务端只按区间读了几小段,没有整包读回
    expect(r2.calls.ranges.every((r) => r.length < BOOK.length)).toBe(true)

    const cover = await call(`/api/desk/shelf/${BOOK_ID}/cover`, { headers: as(admin) })
    expect(cover.status).toBe(200)
    expect(cover.headers.get('Content-Type')).toBe('image/jpeg')
    expect(cover.headers.get('Cache-Control')).toBe('private, max-age=86400')
    const files = await unzip(BOOK)
    expect(new Uint8Array(await cover.arrayBuffer())).toEqual(files.get(book.cover))
  })

  it('只有封面的书没有题图地址,题图 404', async () => {
    const { item } = await (await upload(FIT)).json()
    expect(item.cover).toBeTruthy()
    expect(item.banner).toBeNull()
    expect((await call(`/api/desk/shelf/${item.id}/banner`, { headers: as(admin) })).status).toBe(404)
  })

  it('跨站 Origin 的上传被拒(403),同源与原生(不带 Origin)可以', async () => {
    expect((await upload(FIT, { headers: { Origin: 'https://evil.example' } })).status).toBe(403)
    expect((await upload(FIT, { headers: { Origin: ORIGIN } })).status).toBe(201)
  })

  it('套壳 App 的源(capacitor://localhost)可以上传;长得像的别的源不行', async () => {
    expect((await upload(FIT, { headers: { Origin: 'capacitor://evil' } })).status).toBe(403)
    expect((await upload(FIT, { headers: { Origin: 'capacitor://localhost' } })).status).toBe(201)
  })

  it('不是 zip:拒收并清掉对象', async () => {
    const junk = new TextEncoder().encode('this is not a zip file at all, just text '.repeat(10))
    const res = await upload(junk, { id: 'u-junk-12345678', revision: 1 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/读不开/)
    expect(shelfKeys()).toEqual([])
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM desk_shelf').get().n).toBe(0)
  })

  it('缺 book.json:拒收并清掉对象', async () => {
    const files = await unzip(FIT)
    files.delete('book.json')
    const bytes = await zip(files)
    const res = await upload(bytes, { id: 'u-squat-basics-sample-c3e85d17', revision: 1 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/缺 book\.json/)
    expect(shelfKeys()).toEqual([])
  })

  it('book.json 的 id 不合规 / 与声明不符:拒收并清掉', async () => {
    const bad = await repack(FIT, (b) => { b.id = 'Bad_ID' })
    const res = await upload(bad, { id: 'u-squat-basics-sample-c3e85d17', revision: 1 })
    expect(res.status).toBe(400)
    expect(shelfKeys()).toEqual([])
    // 声明的 id 形状不对:根本不写进存储
    const res2 = await upload(FIT, { id: 'BAD' })
    expect(res2.status).toBe(400)
    expect(r2.calls.put).toBe(1)
  })

  it('sha256 对不上:R2 拒写,不留对象', async () => {
    const q = new URLSearchParams({ id: 'u-squat-basics-sample-c3e85d17', revision: '1', sha256: 'f'.repeat(64) })
    const res = await call(`/api/desk/shelf?${q}`, { method: 'POST', body: FIT, headers: as(admin) })
    expect(res.status).toBe(400)
    expect(shelfKeys()).toEqual([])
  })

  it('修订号不大于已存的:409;?replace=1 可覆盖,旧包在新包落库后才删', async () => {
    expect((await upload(BOOK)).status).toBe(201)
    const again = await upload(BOOK)
    expect(again.status).toBe(409)
    expect((await again.json()).error).toMatch(/revision 须更大/)
    // 声明大、包里小:读 book.json 时也会拦
    const lie = await upload(BOOK, { revision: 5 })
    expect(lie.status).toBe(400)
    expect(shelfKeys()).toEqual([`shelf/${BOOK_ID}/banner.jpg`, `shelf/${BOOK_ID}/cover.jpg`, `shelf/${BOOK_ID}/r1.deskbook`])

    // 同修订覆盖:另起一个带后缀的键,旧键随后删掉
    const rep = await upload(BOOK, { replace: true })
    expect(rep.status).toBe(201)
    const keys = shelfKeys().filter((k) => k.endsWith('.deskbook'))
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatch(new RegExp(`^shelf/${BOOK_ID}/r1-[0-9a-f]{8}\\.deskbook$`))

    // 新修订:管理员改过的分栏保留;新版没有题图 → 题图对象删掉
    await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'PATCH', body: { category: '物理' }, headers: as(admin) })
    const r2pkg = await repack(BOOK, (b, files) => { b.revision = 2; delete b.banner; files.delete('media/banner.jpg') })
    const up = await upload(r2pkg)
    expect(up.status).toBe(201)
    const { item } = await up.json()
    expect(item).toMatchObject({ revision: 2, category: '物理', banner: null })
    expect(shelfKeys()).toEqual([`shelf/${BOOK_ID}/cover.jpg`, `shelf/${BOOK_ID}/r2.deskbook`])
  })

  it('分片上传:建 → 两片 → 合,结果同直传', async () => {
    env.DESK_SHELF_PART_SIZE = String(Math.ceil(BOOK.length / 2))
    const book = await readBookJson(BOOK)
    const create = await call('/api/desk/shelf/uploads', { method: 'POST', headers: as(admin), body: { id: book.id, revision: book.revision, size: BOOK.length, sha256: sha(BOOK), chars: 99 } })
    expect(create.status).toBe(201)
    const { key, uploadId, partSize, parts } = await create.json()
    expect(parts).toBe(2)
    const done = []
    for (let n = 1; n <= parts; n++) {
      const chunk = BOOK.subarray((n - 1) * partSize, n * partSize)
      const res = await call(`/api/desk/shelf/uploads/${uploadId}/${n}?key=${encodeURIComponent(key)}`, { method: 'PUT', body: chunk, headers: as(admin) })
      expect(res.status).toBe(200)
      done.push(await res.json())
    }
    const fin = await call(`/api/desk/shelf/uploads/${uploadId}/complete`, { method: 'POST', headers: as(admin), body: { key, parts: done.map(({ partNumber, etag }) => ({ partNumber, etag })) } })
    expect(fin.status).toBe(201)
    const { item } = await fin.json()
    expect(item).toMatchObject({ id: BOOK_ID, bytes: BOOK.length, sha256: sha(BOOK), chars: 99 })
    const pkg = await call(`/api/desk/shelf/${BOOK_ID}/package`, { headers: as(admin) })
    expect(sha(new Uint8Array(await pkg.arrayBuffer()))).toBe(sha(BOOK))
  })

  it('分片上传:修订过旧建不起来;合并后校验不过就删', async () => {
    expect((await upload(BOOK)).status).toBe(201)
    const stale = await call('/api/desk/shelf/uploads', { method: 'POST', headers: as(admin), body: { id: BOOK_ID, revision: 1, size: 10, sha256: 'a'.repeat(64) } })
    expect(stale.status).toBe(409)

    const junk = new Uint8Array(4096).fill(7)
    const create = await call('/api/desk/shelf/uploads', { method: 'POST', headers: as(admin), body: { id: 'u-junk-12345678', revision: 1, size: junk.length, sha256: sha(junk) } })
    const { key, uploadId } = await create.json()
    const part = await (await call(`/api/desk/shelf/uploads/${uploadId}/1?key=${encodeURIComponent(key)}`, { method: 'PUT', body: junk, headers: as(admin) })).json()
    const fin = await call(`/api/desk/shelf/uploads/${uploadId}/complete`, { method: 'POST', headers: as(admin), body: { key, parts: [{ partNumber: 1, etag: part.etag }] } })
    expect(fin.status).toBe(400)
    expect(r2.store.has(key)).toBe(false)
  })

  it('分片上传可放弃;对象键形状不对一律 400', async () => {
    const create = await call('/api/desk/shelf/uploads', { method: 'POST', headers: as(admin), body: { id: 'u-x-12345678', revision: 1, size: 10, sha256: 'a'.repeat(64) } })
    const { key, uploadId } = await create.json()
    expect(r2.uploads.size).toBe(1)
    expect((await call(`/api/desk/shelf/uploads/${uploadId}?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: as(admin) })).status).toBe(204)
    expect(r2.uploads.size).toBe(0)
    expect((await call(`/api/desk/shelf/uploads/${uploadId}/1?key=../etc`, { method: 'PUT', body: new Uint8Array(3), headers: as(admin) })).status).toBe(400)
  })
})

describe('下载', () => {
  beforeEach(async () => { expect((await upload(BOOK)).status).toBe(201) })

  it('整包:字节一致,带 ETag / 长度 / 文件名', async () => {
    const res = await call(`/api/desk/shelf/${BOOK_ID}/package`, { headers: as(admin) })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Length')).toBe(String(BOOK.length))
    expect(res.headers.get('ETag')).toBe(`"${sha(BOOK)}"`)
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    expect(res.headers.get('Content-Disposition')).toMatch(new RegExp(`filename="${BOOK_ID}-r1\\.deskbook"; filename\\*=UTF-8''`))
    expect(sha(new Uint8Array(await res.arrayBuffer()))).toBe(sha(BOOK))
    const again = await call(`/api/desk/shelf/${BOOK_ID}/package`, { headers: as(admin, { 'If-None-Match': `"${sha(BOOK)}"` }) })
    expect(again.status).toBe(304)
  })

  it('Range:中段 / 开口 / 后缀,拼回来等于原包;越界 416', async () => {
    const get = (range, extra = {}) => call(`/api/desk/shelf/${BOOK_ID}/package`, { headers: as(admin, { Range: range, ...extra }) })
    const a = await get('bytes=0-99999')
    expect(a.status).toBe(206)
    expect(a.headers.get('Content-Range')).toBe(`bytes 0-99999/${BOOK.length}`)
    expect(a.headers.get('Content-Length')).toBe('100000')
    const b = await get('bytes=100000-')
    expect(b.status).toBe(206)
    const joined = new Uint8Array([...new Uint8Array(await a.arrayBuffer()), ...new Uint8Array(await b.arrayBuffer())])
    expect(sha(joined)).toBe(sha(BOOK))
    const c = await get('bytes=-22')
    expect(new Uint8Array(await c.arrayBuffer())).toEqual(BOOK.subarray(BOOK.length - 22))
    const bad = await get(`bytes=${BOOK.length}-`)
    expect(bad.status).toBe(416)
    expect(bad.headers.get('Content-Range')).toBe(`bytes */${BOOK.length}`)
    // If-Range 对不上(已换版)→ 整包 200
    const stale = await get('bytes=0-9', { 'If-Range': '"old"' })
    expect(stale.status).toBe(200)
  })

  it('parseRange 边界', () => {
    expect(parseRange('bytes=0-0', 10)).toEqual({ offset: 0, length: 1 })
    expect(parseRange('bytes=5-100', 10)).toEqual({ offset: 5, length: 5 })
    expect(parseRange('bytes=-100', 10)).toEqual({ offset: 0, length: 10 })
    expect(() => parseRange('bytes=-', 10)).toThrow()
    expect(() => parseRange('items=0-1', 10)).toThrow()
    expect(() => parseRange('bytes=5-2', 10)).toThrow()
  })
})

describe('修改与删除', () => {
  beforeEach(async () => {
    expect((await upload(BOOK)).status).toBe(201)
    expect((await upload(FIT)).status).toBe(201)
  })

  it('改分栏 / 隐藏 / 排序;隐藏的书默认不进书目,?all=1 才有', async () => {
    const res = await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'PATCH', body: { category: '科普', hidden: true, sort: 3 }, headers: as(admin) })
    expect(res.status).toBe(200)
    expect((await res.json()).item).toMatchObject({ category: '科普', hidden: true, sort: 3 })
    const list = await (await call('/api/desk/shelf', { headers: as(admin) })).json()
    expect(list.items.map((x) => x.id)).toEqual(['u-squat-basics-sample-c3e85d17'])
    const all = await (await call('/api/desk/shelf?all=1', { headers: as(admin) })).json()
    expect(all.items).toHaveLength(2)
    expect((await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'PATCH', body: { category: '两 个词' }, headers: as(admin) })).status).toBe(400)
    expect((await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'PATCH', body: { hidden: 'yes' }, headers: as(admin) })).status).toBe(400)
    expect((await call('/api/desk/shelf/u-nope-12345678', { method: 'PATCH', body: { hidden: false }, headers: as(admin) })).status).toBe(404)
  })

  it('删除:目录行与该书名下全部对象一起没', async () => {
    const res = await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'DELETE', headers: as(admin) })
    expect(res.status).toBe(204)
    expect(shelfKeys().some((k) => k.startsWith(`shelf/${BOOK_ID}/`))).toBe(false)
    expect(shelfKeys().some((k) => k.startsWith('shelf/u-squat-basics-sample-c3e85d17/'))).toBe(true)
    expect((await call(`/api/desk/shelf/${BOOK_ID}/package`, { headers: as(admin) })).status).toBe(404)
    expect((await call(`/api/desk/shelf/${BOOK_ID}`, { method: 'DELETE', headers: as(admin) })).status).toBe(404)
  })
})
