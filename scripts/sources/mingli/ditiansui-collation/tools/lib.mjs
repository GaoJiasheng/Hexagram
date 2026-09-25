// 共用:读本站底本、读见证本、归一化、Myers diff
import fs from 'fs'
import path from 'path'
import { t2s } from '/Users/gavin/work/hexagram/scripts/lib/wikisource.mjs'

export const ROOT = '/Users/gavin/work/hexagram'
export const HERE = path.dirname(new URL(import.meta.url).pathname)

export const GZ = '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'
const HAN = /\p{Script=Han}/u

// 异体折叠(只用于比对,不改输出):才/财、杀/煞、余/馀/餘、于/於
const FOLD = { 财: '才', 煞: '杀', 馀: '余', 餘: '余', 於: '于' }
export const fold = (c) => FOLD[c] ?? c

// 归一化:只留汉字,返回 {s, map}(map[i] = 原串下标)
export function norm(text, { doFold = true } = {}) {
  const chars = [...text]
  let s = '', map = []
  let off = 0
  for (const ch of chars) {
    if (HAN.test(ch)) { s += doFold ? fold(ch) : ch; map.push(off) }
    off += ch.length
  }
  return { s, map }
}

export function loadBase() {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/mingli/classics/ditiansui.json'), 'utf8'))
  return d.chapters.map((c) => ({
    no: c.no, title: c.title,
    paras: c.paragraphs.map((p, i) => ({ idx: i, original: p.original, skip: !!p.pillars })),
  }))
}

const decode = (t) => t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))

export const isGanzhiLine = (t) => {
  const x = [...t.replace(/[\s　]/g, '')]
  return x.length >= 4 && x.length % 2 === 0 && x.every((c) => GZ.includes(c))
}

// 劝学网:ditian03..65 → 本站 1..63
export function loadQuanxue() {
  const dir = path.join(HERE, 'quanxue')
  const out = []
  for (let i = 3; i <= 65; i++) {
    const html = fs.readFileSync(path.join(dir, `ditian${String(i).padStart(2, '0')}.html`), 'utf8')
    const title = (html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || ''
    let body = html.split(/<hr\s*\/?>/)[1] || ''
    body = body.split('getPageBottom')[0]
    const paras = body.split(/<p[^>]*>|<\/p>|<br\s*\/?>/i).map((t) => decode(t.replace(/<[^>]*>/g, '')).trim()).filter((t) => t && !/^<!--/.test(t) && t !== '<!--')
      .map((t) => t.replace(/<!--|-->|<script>|<\/script>/g, '').trim()).filter(Boolean)
    out.push({ no: i - 2, title, paras: paras.map(t2s) })
  }
  return out
}

// Myers diff(字符数组),返回 [{op:'=', a:[i0,i1], b:[j0,j1]} | {op:'-',...} | {op:'+',...}]
export function myers(a, b) {
  const N = a.length, M = b.length, MAX = N + M
  const off = MAX + 1
  let V = new Int32Array(2 * MAX + 3)
  const trace = []
  let found = -1
  for (let d = 0; d <= MAX; d++) {
    trace.push(V.slice(off - d - 1, off + d + 2))
    for (let k = -d; k <= d; k += 2) {
      let x
      if (k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])) x = V[off + k + 1]
      else x = V[off + k - 1] + 1
      let y = x - k
      while (x < N && y < M && a[x] === b[y]) { x++; y++ }
      V[off + k] = x
      if (x >= N && y >= M) { found = d; break }
    }
    if (found >= 0) break
  }
  // 回溯
  const ops = []
  let x = N, y = M
  for (let d = found; d > 0; d--) {
    const Vp = trace[d] // 进入第 d 轮前的 V(下标偏移 d+1)
    const get = (k) => Vp[k + d + 1]
    const k = x - y
    let pk
    if (k === -d || (k !== d && get(k - 1) < get(k + 1))) pk = k + 1
    else pk = k - 1
    const px = get(pk), py = px - pk
    while (x > px && y > py) { ops.push(['=', x - 1, y - 1]); x--; y-- }
    if (x === px) ops.push(['+', null, y - 1]) // 插入 b[py]
    else ops.push(['-', x - 1, null])
    x = px; y = py
  }
  while (x > 0 && y > 0) { ops.push(['=', x - 1, y - 1]); x--; y-- }
  ops.reverse()
  // 合并成 run
  const runs = []
  for (const [op, i, j] of ops) {
    const last = runs[runs.length - 1]
    if (last && last.op === op) { if (i != null) last.a[1] = i + 1; if (j != null) last.b[1] = j + 1 }
    else runs.push({ op, a: i != null ? [i, i + 1] : null, b: j != null ? [j, j + 1] : null })
  }
  return runs
}

// 古诗文网(古文岛):01=序,02..64 → 本站 1..63
export function loadGushiwen() {
  const dir = path.join(HERE, 'gushiwen')
  const files = fs.readdirSync(dir).filter((f) => /^\d\d-bookv_.*\.html$/.test(f)).sort()
  const out = []
  for (let i = 1; i < files.length; i++) {
    const html = fs.readFileSync(path.join(dir, files[i]), 'utf8')
    const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]*>/g, '').trim() || ''
    const m = html.match(/<div class="contson"[^>]*>([\s\S]*?)<\/div>/)
    const body = m ? m[1] : ''
    const paras = body.split(/<p[^>]*>|<\/p>|<br\s*\/?>/i).map((t) => decode(t.replace(/<[^>]*>/g, '')).replace(/^[\s　]+|[\s　]+$/g, '')).filter(Boolean)
    out.push({ no: i, title, paras: paras.map(t2s), file: files[i] })
  }
  return out
}
