// 书房 · 书包上传页的浏览器端:完整校验、算 SHA-256、上传(直传 / 分片,带进度与续传)。
//
// 校验器 scripts/desk/deskbook-core.mjs 是纯 JS(Web 标准 API,不 import 任何东西),这里按需 import,
// Vite 把它打成单独的 chunk,只有打开上传页、放进书包时才下载。服务端只做轻校验,这里才是完整那道。
import { apiFetch, IS_NATIVE } from '../auth/apiClient.js'

const MB = 1024 * 1024
// 与 server/desk-shelf.js 的 SINGLE_MAX 一致:超过就走分片
export const SINGLE_MAX = 90 * MB
const RESUME_KEY = (sha) => `guanxiang.v1.shelfUpload.${sha}`

let corePromise = null
export const loadCore = () => (corePromise ||= import('../../../scripts/desk/deskbook-core.mjs'))

export async function sha256Hex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

// 一个文件 → { ok, errors[], warnings[](已排成一行中文,原样用校验器的措辞), book, stats, sha256, bytes }
export async function checkFile(file) {
  const core = await loadCore()
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const sha256 = await sha256Hex(buf)
  let files
  try {
    files = await core.unzip(bytes)
  } catch (e) {
    return { ok: false, errors: [e?.message || String(e)], warnings: [], book: null, stats: null, sha256, bytes: bytes.length }
  }
  const r = core.validate(files)
  return {
    ok: r.ok,
    errors: r.errors.map(core.formatIssue),
    warnings: r.warnings.map(core.formatIssue),
    book: r.book,
    stats: r.stats,
    sha256,
    bytes: bytes.length,
  }
}

async function jsonOf(res) {
  try { return await res.json() } catch { return {} }
}

// 带进度的 PUT / POST(fetch 没有上传进度,用 XHR);原生壳里没有 cookie,退回 apiFetch(无进度)
function send(method, url, body, onProgress) {
  if (IS_NATIVE) {
    return apiFetch(url, { method, body }).then(async (res) => ({ status: res.status, data: await jsonOf(res) }))
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.withCredentials = true
    xhr.responseType = 'text'
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded) }
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText || '{}') } catch { /* 非 JSON:当空对象 */ }
      resolve({ status: xhr.status, data })
    }
    xhr.onerror = () => reject(new Error('网络连接失败,请检查网络后重试'))
    xhr.onabort = () => reject(new Error('已取消'))
    xhr.send(body)
  })
}

class UploadError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const fail = (r, fallback) => { throw new UploadError(r.status, r.data?.error || `${fallback}(HTTP ${r.status})`) }

function readResume(sha) {
  try { return JSON.parse(localStorage.getItem(RESUME_KEY(sha)) || 'null') } catch { return null }
}
function writeResume(sha, v) {
  try { if (v) localStorage.setItem(RESUME_KEY(sha), JSON.stringify(v)); else localStorage.removeItem(RESUME_KEY(sha)) } catch { /* 存不下:只是不能跨刷新续传 */ }
}
export const hasResume = (sha) => !!readResume(sha)

// 上传一个已校验的书包。onProgress(已传字节, 总字节)。返回服务端的目录行
export async function uploadPackage(file, check, { replace = false, onProgress } = {}) {
  const { book, sha256, bytes: size } = check
  const chars = check.stats?.chars || 0
  if (size <= SINGLE_MAX) {
    const q = new URLSearchParams({ id: book.id, revision: String(book.revision), sha256, chars: String(chars) })
    if (replace) q.set('replace', '1')
    const r = await send('POST', `/api/desk/shelf?${q}`, file, (n) => onProgress?.(n, size))
    if (r.status !== 201) fail(r, '上传失败')
    return r.data.item
  }

  // 分片:先看本机有没有同一个包(按 SHA-256)没传完的记录,有就接着传
  let st = readResume(sha256)
  if (st && st.size !== size) st = null
  if (!st) {
    const r = await send('POST', '/api/desk/shelf/uploads', JSON.stringify({ id: book.id, revision: book.revision, size, sha256, chars, replace }))
    if (r.status !== 201) fail(r, '建立分片上传失败')
    st = { key: r.data.key, uploadId: r.data.uploadId, partSize: r.data.partSize, size, parts: {} }
    writeResume(sha256, st)
  }
  const total = Math.ceil(size / st.partSize)
  const doneBytes = () => Object.keys(st.parts).reduce((a, n) => a + Math.min(st.partSize, size - (n - 1) * st.partSize), 0)
  for (let n = 1; n <= total; n++) {
    if (st.parts[n]) continue
    const blob = file.slice((n - 1) * st.partSize, Math.min(n * st.partSize, size))
    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const base = doneBytes()
        const r = await send('PUT', `/api/desk/shelf/uploads/${encodeURIComponent(st.uploadId)}/${n}?key=${encodeURIComponent(st.key)}`, blob, (b) => onProgress?.(base + b, size))
        if (r.status !== 200) {
          // 上传已失效(过期、被放弃):丢掉本机记录,下次从头来
          if (r.status === 400) writeResume(sha256, null)
          fail(r, `第 ${n} 片上传失败`)
        }
        st.parts[n] = r.data.etag
        writeResume(sha256, st)
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        if (e instanceof UploadError && e.status < 500) break
      }
    }
    if (lastErr) throw lastErr
  }
  onProgress?.(size, size)
  const parts = Object.entries(st.parts).map(([n, etag]) => ({ partNumber: Number(n), etag }))
  const r = await send('POST', `/api/desk/shelf/uploads/${encodeURIComponent(st.uploadId)}/complete`, JSON.stringify({ key: st.key, parts, replace }))
  writeResume(sha256, null)
  if (r.status !== 201) fail(r, '合并分片失败')
  return r.data.item
}

// ── 书目 ──
export async function fetchShelf() {
  const res = await apiFetch('/api/desk/shelf?all=1')
  if (!res.ok) throw new Error(`读取书房失败(HTTP ${res.status})`)
  return (await res.json()).items || []
}

export async function patchItem(id, patch) {
  const res = await apiFetch(`/api/desk/shelf/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  const data = await jsonOf(res)
  if (!res.ok) throw new Error(data.error || `修改失败(HTTP ${res.status})`)
  return data.item
}

export async function deleteItem(id) {
  const res = await apiFetch(`/api/desk/shelf/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (res.status !== 204) {
    const data = await jsonOf(res)
    throw new Error(data.error || `删除失败(HTTP ${res.status})`)
  }
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return ''
  if (n < 1024) return `${n} B`
  if (n < MB) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / MB).toFixed(n < 10 * MB ? 1 : 0)} MB`
}

export const KIND_LABEL = { classic: '典籍', book: '现代书', collection: '文集' }
