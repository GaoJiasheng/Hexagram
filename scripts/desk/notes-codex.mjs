#!/usr/bin/env node
// 观象 · 书桌 —— 详注起草(本机 Codex CLI 版)。与 notes-wf.js 的 DRAFT 同标准,只是起草由 `codex exec` 完成。
//   node scripts/desk/notes-codex.mjs <书 id> [--units u001,u002] [--concurrency 3] [--force]
// 读 scripts/.desk-notes/<书>/args.json 与 in/<单元>.json,结果落 out/<单元>.json(之后仍可交 notes-wf.js 的 verifyOnly 核查,再 notes-apply.mjs 合并)。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const book = argv.find((a) => !a.startsWith('--'))
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FORCE = argv.includes('--force')
const CONC = Number(opt('concurrency', 3))
const UNITS = opt('units', '') ? opt('units', '').split(',') : null
if (!book) { console.error('用法:node scripts/desk/notes-codex.mjs <书 id> [--units u001,u002] [--concurrency 3] [--force]'); process.exit(1) }

const WORK = path.join(ROOT, 'scripts/.desk-notes', book)
const args = JSON.parse(fs.readFileSync(path.join(WORK, 'args.json'), 'utf8'))
const ids = UNITS || args.ids
const TIMEOUT = 20 * 60 * 1000

// ---- 以下 SPEC 与 notes-wf.js 的 SPEC 逐字相同(workflow 脚本不能 import,故复制)----
const SPEC = `每条注四个字段:
- k:被注的词,必须是该段 o(原文)的**精确子串**(照抄底本字形,不带两端标点);取完整的词或短语(2–6 字为宜,单字也可)。同一段里各条的 k 按「在 o 中第一次出现的位置」**不能互相重叠**,同一个词在同一段只注一次。
- d:一句话释义,不超过 30 个字,让人一眼明白这个词在这句里是什么意思。
- x:展开,**60–120 个字(写完数一下,不到 60 字的补足)**。讲清其中一两样:为什么这么讲(字义来历、与今义的差别)、这个词在这句里起什么作用、历代注家或不同版本有分歧时各家怎么说、它在本书别处怎样呼应。不要复述 d,不要空话套话。
- r:读音(汉语拼音带声调),只在生僻字、多音字需要时给,否则不要这个字段。
注哪些:难字、通假与古今异义、专名(人名、地名、官职、器物、典制)、这一章的关键概念、今人容易按现代义读错的常用字(只在确实会读错时)、有重要异文或句读分歧处。**密度:平均每百个原文字 12–14 条**;很短的段至少 1 条,确实无可注的可以没有。items 里的 old 是站内已有的简注,可吸收、可改写,不必受它限制。
口径:讲训诂、思想、史实、源流;有争议处并陈不裁断;不写鸡汤、不作人生启示、不作现代影射;严守输入里的 redline。
**外部说法从严**:版本异文(帛书、竹简、别本)、某注家怎么讲、某事见于某书某篇——只写你十分确定的;拿不准就不点名、不加引号,改用「一说」「旧注多解作」这类转述,或干脆不写。绝不凭印象把他书的原话放进引号。
文字用简体中文、全角标点,平实。`

// ---- 对应 notes-wf.js 的 DRAFT,换成 Codex 的读写方式(当前目录下的 in.json / out.json)----
const INSTRUCTION = `你在给古籍学习 App「观象 · 书桌」写《${args.book}》的详注。读者是成年的自学者:点一个带虚线的词,先看到一句话释义,下面再有一段展开。

输入文件(JSON):当前目录下的 in.json
  · items:要注的各段。ch 章号、chTitle 章题、seg 段下标(0 起)、o 原文(底本,一个字不能改)、t 站内译文(参考,可能有错,以原文为准)、label(周易里的「卦辞」「初九」等)、old 已有简注
  · redline:本书红线

${SPEC}

把结果写到当前目录下的 out.json,格式:{"<章号>": {"<段下标>": [ {"k":"…","d":"…","x":"…"}, … ]}}(章号、段下标都是字符串;只写有注的段)。
写完后自查一遍(可以用一小段脚本核):每条 k 是否确为该段 o 的子串、同段是否重叠、d 与 x 字数是否合规、out.json 是否合法 JSON,有问题就改文件。

补充要求:
- 只读 in.json、只写 out.json;不要联网,不要读当前目录之外的任何文件,不要改 in.json。
- 原文 o 一个字不能改;k 必须从 o 里原样截取。
- 密度目标是每百个原文字 12–14 条。**长段(几百字)也要按这个密度逐句往下注,不能一段只挑三五个词**;写完按各段字数核一下总条数,偏少就回头补。
- 全部单元一次写完整,不要只写一部分就停;最后一句话说明写了多少条即可。`

// ---- 校验(照 notes-apply.mjs)----
const len = (s) => [...String(s || '')].length
function validate(j, src) {
  const why = {}
  const bump = (r) => { why[r] = (why[r] || 0) + 1 }
  let total = 0, good = 0
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { total: 0, good: 0, why: { 结构不对: 1 } }
  for (const [ch, segs] of Object.entries(j)) for (const [seg, notes] of Object.entries(segs || {})) {
    const o = src[`${ch}|${seg}`]
    if (!Array.isArray(notes)) { bump('章段不在输入里或不是数组'); continue }
    const spans = []
    for (const n of notes) {
      total++
      if (o === undefined) { bump('章段不在输入里或不是数组'); continue }
      if (!n || typeof n.k !== 'string' || !n.k || typeof n.d !== 'string' || typeof n.x !== 'string') { bump('缺字段'); continue }
      const at = o.indexOf(n.k)
      if (at < 0) { bump('k 不是原文子串'); continue }
      if (spans.some(([a, b]) => at < b && a < at + n.k.length)) { bump('同段重叠'); continue }
      if (len(n.d) > 40) { bump('d 超长'); continue }
      if (len(n.x) < 40 || len(n.x) > 150) { bump('x 字数不合'); continue }
      spans.push([at, at + n.k.length]); good++
    }
  }
  return { total, good, why }
}

function runCodex(id) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `desk-notes-${id}-`))
  fs.copyFileSync(path.join(WORK, 'in', `${id}.json`), path.join(tmp, 'in.json'))
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', INSTRUCTION], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
    const timer = setTimeout(() => p.kill('SIGKILL'), TIMEOUT)
    p.on('close', (code) => {
      clearTimeout(timer)
      const sec = Math.round((Date.now() - t0) / 1000)
      const tok = /tokens used[^\d]*([\d,]+)/i.exec(log)?.[1] || ''
      resolve({ tmp, code, sec, tokens: tok, log })
    })
  })
}

async function doUnit(id, stats, failed) {
  const outFile = path.join(WORK, 'out', `${id}.json`)
  if (!FORCE && fs.existsSync(outFile)) { console.log(`- ${id} 已有输出,跳过`); return }
  const input = JSON.parse(fs.readFileSync(path.join(WORK, 'in', `${id}.json`), 'utf8'))
  const src = {}
  for (const it of input.items) src[`${it.ch}|${it.seg}`] = it.o
  let reason = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await runCodex(id)
    stats.sec += r.sec
    if (r.tokens) stats.tokens += Number(r.tokens.replace(/,/g, '')) || 0
    const f = path.join(r.tmp, 'out.json')
    let j = null
    if (!fs.existsSync(f)) reason = `codex exit ${r.code},无 out.json:${r.log.slice(-160).replace(/\n/g, ' ')}`
    else { try { j = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { reason = 'out.json 不是合法 JSON' } }
    if (j) {
      const v = validate(j, src)
      if (v.total === 0) { reason = '条数为 0'; continue }
      fs.mkdirSync(path.dirname(outFile), { recursive: true })
      fs.writeFileSync(outFile, JSON.stringify(j, null, 2) + '\n')
      stats.ok++; stats.notes += v.total; stats.good += v.good; stats.chars += input.chars ?? Object.values(src).reduce((a, s) => a + s.length, 0)
      for (const [k, n] of Object.entries(v.why)) stats.why[k] = (stats.why[k] || 0) + n
      const chars = input.chars ?? Object.values(src).reduce((a, s) => a + s.length, 0)
      console.log(`✓ ${id} ${r.sec}s tokens=${r.tokens || '?'} 条 ${v.total}(每百字 ${(v.total * 100 / chars).toFixed(1)})· 机器校验不合 ${v.total - v.good} ${JSON.stringify(v.why)}${attempt > 1 ? ' [重试后]' : ''}`)
      try { fs.rmSync(r.tmp, { recursive: true }) } catch {}
      return
    }
    console.log(`… ${id} 第 ${attempt} 次失败:${reason}`)
  }
  stats.fail++; failed.push({ id, reason })
  console.log(`✗ ${id} ${reason}`)
}

const stats = { ok: 0, fail: 0, notes: 0, good: 0, chars: 0, sec: 0, tokens: 0, why: {} }
const failed = []
const queue = [...ids]
await Promise.all(Array.from({ length: Math.max(1, CONC) }, async () => { while (queue.length) await doUnit(queue.shift(), stats, failed) }))
const ff = path.join(WORK, 'codex-failed.json')
if (failed.length) fs.writeFileSync(ff, JSON.stringify(failed, null, 2) + '\n')
else if (fs.existsSync(ff)) fs.rmSync(ff)
console.log(`\n成功 ${stats.ok} · 失败 ${stats.fail} · 总条数 ${stats.notes}(校验合格 ${stats.good})· 原文 ${stats.chars} 字 · 每百字 ${stats.chars ? (stats.notes * 100 / stats.chars).toFixed(1) : '-'} 条 · 平均耗时 ${stats.ok ? Math.round(stats.sec / stats.ok) : '-'}s(含重试)· tokens ${stats.tokens || '?'}`)
console.log(`问题分布 ${JSON.stringify(stats.why)}`)
if (failed.length) console.log(`失败单元已记入 ${path.relative(ROOT, ff)}`)
