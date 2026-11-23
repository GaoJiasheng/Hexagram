#!/usr/bin/env node
// 观象 · 书桌 —— 预先写好的插画 prompt 的机器自查(写手代理每写完一个单元就跑;art-prompts-apply 也用它)。
//   node scripts/desk/art-prompts-check.mjs <guanshu|classics> <uNNN>
// 读 scripts/.cache/desk-art/prompts/<set>/in/<unit>.json 与 out/<unit>.json,逐张核:
//   JSON 合法;不缺不多;imagery 3–5 条、每条带一句出自材料的引文;chosen 一句(观书须点明时代与地点);
//   prompt 以画风句开头、含本类版式句、以收尾句结束、600–2200 字符、画风句括号外无汉字、正文不含禁词;
//   同一单元两张的 prompt 内容词重合 > 60% 算撞题,chosen 与本书已出图(used)重合 > 60% 也算。
// 末行打印「通过」或「未通过」,退出码 0 / 1。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYOUT_PHRASE, CLOSING, BANNED } from './art-prompts-rules.mjs'
import { STYLE } from './gen-art-guanshu.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROMPTS = path.join(ROOT, 'scripts/.cache/desk-art/prompts')

const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/
const norm = (s) => String(s || '').replace(/\*\*/g, '').replace(/\s+/g, '').toLowerCase()
const STOP = new Set('with from that this into their them they over under beside which while where there very some only soft pale light small faint quiet left right upper lower across most part scene picture image paper wash washes tint tinted brush ink lines gentle tone tones warm cool little each other side near behind front along about above below between through toward towards around against just like also been being have has will would could should more less than then when what whose your yours ours ever never much many such same both either rest seen view shown showing stands standing sits sitting lies lying one two three'.split(' '))
export const contentWords = (s) => new Set((String(s).toLowerCase().match(/[a-z]+/g) || []).filter((w) => w.length >= 4 && !STOP.has(w)))
export function overlap(a, b) {
  if (!a.size || !b.size) return 0
  let n = 0
  for (const w of a) if (b.has(w)) n++
  return n / Math.min(a.size, b.size)
}

// prompt 去掉画风句、版式句、收尾句后剩下的场景正文
function bodyOf(prompt, kind) {
  let s = prompt.startsWith(STYLE) ? prompt.slice(STYLE.length) : prompt
  s = s.split(LAYOUT_PHRASE[kind] || '\u0000').join(' ')
  if (s.trim().endsWith(CLOSING)) s = s.trim().slice(0, -CLOSING.length)
  return s.trim()
}

const QUOTE = /[“"「『]([^“”"「」『』]{2,}?)[”"」』]/g
function quoteFound(item, brief) {
  const nb = norm(brief)
  for (const m of String(item).matchAll(QUOTE)) {
    const pieces = m[1].split(/…|\.\.\./).map(norm).filter((p) => p.length >= 2).sort((a, b) => b.length - a.length)
    if (pieces.length && nb.includes(pieces[0])) return true
  }
  return false
}

const ERA = /\b(era|century|centuries|dynasty|period|present[- ]day|contemporary|today|modern|ancient|medieval|prehistoric|victorian|\d{3,4}s?|bce?|ad)\b/i

export function bannedFor(input) {
  const list = [...BANNED.all, ...(BANNED[input.set] || []), ...(input.category ? BANNED[input.category] || [] : [])]
  return [...new Set(list)]
}

// 返回 { unit: [单元级错误], items: { id: [该张的错误] }, ok }
export function checkUnit(input, output) {
  const res = { unit: [], items: {}, ok: false }
  if (!output || typeof output !== 'object' || Array.isArray(output)) { res.unit.push('out 不是 {"<book>/<stem>": {...}} 形态的对象'); return res }
  const ids = new Set(input.items.map((x) => x.id))
  for (const k of Object.keys(output)) if (!ids.has(k)) res.unit.push(`多出来的条目 ${k}(本单元没有这张)`)
  const banned = bannedFor(input)
  const bodies = []
  for (const it of input.items) {
    const errs = (res.items[it.id] = [])
    const o = output[it.id]
    if (!o || typeof o !== 'object') { errs.push('缺这一张'); continue }
    const { imagery, chosen } = o
    const prompt = typeof o.prompt === 'string' ? o.prompt.replace(/\s+/g, ' ').trim() : ''
    if (!Array.isArray(imagery) || imagery.length < 3 || imagery.length > 5 || imagery.some((x) => typeof x !== 'string' || x.trim().length < 8)) errs.push('imagery 须是 3–5 条字符串(每条一个具体物象)')
    else imagery.forEach((x, i) => { if (!quoteFound(x, it.brief)) errs.push(`imagery 第 ${i + 1} 条没有引出自材料的原话(用 “…” 或「…」括起材料里逐字有的一句)`) })
    if (typeof chosen !== 'string' || chosen.trim().length < 30) errs.push('chosen 须是一句完整的话(选了哪个物象、为什么)')
    else if (chosen.length > 1200) errs.push(`chosen 太长(${chosen.length} 字符,限 1200)`)
    else if (input.set === 'guanshu' && !ERA.test(chosen)) errs.push('chosen 须点明时代与地点(如 "present-day Seoul", "1930s Chicago", "Song dynasty Kaifeng")')
    if (!prompt) { errs.push('缺 prompt'); continue }
    if (!prompt.startsWith(STYLE)) errs.push('prompt 须以画风句原文开头(一字不改)')
    if (!prompt.includes(LAYOUT_PHRASE[it.kind])) errs.push(`prompt 缺本类版式句原文:${LAYOUT_PHRASE[it.kind]}`)
    for (const [k, v] of Object.entries(LAYOUT_PHRASE)) if (k !== it.kind && prompt.includes(v)) errs.push(`prompt 里混进了 ${k} 的版式句`)
    if (!prompt.endsWith(CLOSING)) errs.push(`prompt 须以收尾句原文结束:${CLOSING}`)
    if (prompt.length < 600 || prompt.length > 2200) errs.push(`prompt 长度 ${prompt.length},须在 600–2200 字符`)
    const rest = prompt.startsWith(STYLE) ? prompt.slice(STYLE.length) : prompt
    if (CJK.test(rest)) errs.push(`prompt 画风句之外有汉字或全角符号:「${rest.match(CJK)[0]}」`)
    const body = bodyOf(prompt, it.kind)
    if (body.length < 250) errs.push(`场景描写太短(${body.length} 字符)——写清主体、位置、留白`)
    const hit = banned.filter((w) => new RegExp(`(?<![a-z])${w.replace(/[-]/g, '[- ]?')}(?![a-z])`, 'i').test(body))
    if (hit.length) errs.push(`场景正文含禁词:${hit.join(', ')}(只写画里有的东西,不写否定句)`)
    for (const u of input.used || []) {
      const uw = contentWords(u.replace(/^[a-z0-9-]+:\s*/, ''))
      if (uw.size >= 6 && overlap(contentWords(chosen || ''), uw) > 0.6) errs.push(`chosen 与本书已出的图撞题:${u.slice(0, 80)}`)
    }
    bodies.push({ id: it.id, words: contentWords(body) })
  }
  for (let i = 0; i < bodies.length; i++) for (let j = 0; j < i; j++) {
    const r = overlap(bodies[i].words, bodies[j].words)
    if (r > 0.6) res.items[bodies[i].id].push(`与 ${bodies[j].id} 撞题(prompt 内容词重合 ${Math.round(r * 100)}%)——换一个主体与场景`)
  }
  res.ok = !res.unit.length && Object.values(res.items).every((e) => !e.length)
  return res
}

export function readUnit(set, unit) {
  const dir = path.join(PROMPTS, set)
  const input = JSON.parse(fs.readFileSync(path.join(dir, 'in', `${unit}.json`), 'utf8'))
  const of = path.join(dir, 'out', `${unit}.json`)
  if (!fs.existsSync(of)) return { input, output: null, err: `没有 out 文件 ${path.relative(ROOT, of)}` }
  try { return { input, output: JSON.parse(fs.readFileSync(of, 'utf8')) } } catch (e) { return { input, output: null, err: `out 不是合法 JSON:${e.message}` } }
}

export function report(res) {
  const lines = res.unit.map((e) => `✗ ${e}`)
  for (const [id, errs] of Object.entries(res.items)) for (const e of errs) lines.push(`✗ ${id}:${e}`)
  return lines
}

const IS_MAIN = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
if (IS_MAIN) {
  const [set, unit] = process.argv.slice(2)
  if (!set || !unit) { console.error('用法:node scripts/desk/art-prompts-check.mjs <guanshu|classics> <uNNN>'); process.exit(2) }
  const { input, output, err } = readUnit(set, unit)
  if (err) { console.log(`✗ ${err}\n未通过`); process.exit(1) }
  const res = checkUnit(input, output)
  const lines = report(res)
  const n = input.items.length, bad = Object.values(res.items).filter((e) => e.length).length
  console.log(lines.length ? lines.join('\n') : `${n} 张全部合格`)
  console.log(res.ok ? '通过' : `未通过(${bad}/${n} 张有问题${res.unit.length ? ',另有单元级问题' : ''})`)
  process.exit(res.ok ? 0 : 1)
}
