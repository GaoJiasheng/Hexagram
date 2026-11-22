#!/usr/bin/env node
// 详注 · 本机 Codex CLI 起草与核查(docs/xiangzhu-spec.md §4)。标准与 notes-wf.js 的 DRAFT / VERIFY 相同,只是由 `codex exec` 完成。
//   node scripts/desk/notes-codex.mjs <corpus>/<slug> [--units u001,u002] [--concurrency 4] [--force]           起草 → out/uNNN.json
//   node scripts/desk/notes-codex.mjs <corpus>/<slug> --verify [--units …] [--concurrency 4] [--force]           核查:每单元另起一次会话,就地改 out/uNNN.json
//   (旧写法 `<书桌书 id>`,如 zhuangzi,仍认:工作目录是 scripts/.desk-notes/<书 id>/)
// 读 <工作目录>/args.json 与 in/<单元>.json(由 notes-prep.mjs 产出),之后 notes-apply.mjs 合并。
// 核查:改前的文件留作 out/uNNN.draft.json;核后文件不是合法 JSON、或条数比改前少了两成以上,就还原成改前那份并标出该单元。
//   每单元的结果记在 verify-state.json(已核过的单元再跑时跳过,--force 重核)。
// 连续 3 个单元失败(多半是限流 / 额度用完)即停止派新单元,退出码 3;有零星失败退出码 1;全成 0。
// 本轮统计写到 codex-draft-stats.json / codex-verify-stats.json(notes-run-all.mjs 读)。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const book = argv.find((a, i) => !a.startsWith('--') && !['--units', '--concurrency'].includes(argv[i - 1]))
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FORCE = argv.includes('--force')
const VERIFY = argv.includes('--verify')
const CONC = Number(opt('concurrency', 3))
const UNITS = opt('units', '') ? opt('units', '').split(',') : null
if (!book) { console.error('用法:node scripts/desk/notes-codex.mjs <corpus>/<slug> [--verify] [--units u001,u002] [--concurrency 3] [--force]'); process.exit(1) }

const WORK = path.join(ROOT, 'scripts/.desk-notes', book.includes('/') ? book.replace('/', '--') : book)
if (!fs.existsSync(path.join(WORK, 'args.json'))) { console.error(`✗ 没有 ${path.relative(ROOT, WORK)}/args.json(先跑 notes-prep.mjs)`); process.exit(1) }
const args = JSON.parse(fs.readFileSync(path.join(WORK, 'args.json'), 'utf8'))
const ids = UNITS || args.ids
const TIMEOUT = 20 * 60 * 1000
const STOP_AFTER = 3

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

const SEG_NOTE = 'seg 段下标(0 起;周易六十四卦里是部位键:judgment 卦辞、tuan 彖、daxiang 大象、l1–l6 爻辞、x1–x6 小象、use / xuse 用九用六及其小象、w0… 文言各段)'
const FORMAT = '{"<章号>": {"<段下标或部位键>": [ {"k":"…","d":"…","x":"…"}, … ]}}(章号、段下标 / 部位键都是字符串,照抄 item 的 ch 与 seg;只写有注的段)'

// ---- 对应 notes-wf.js 的 DRAFT,换成 Codex 的读写方式(当前目录下的 in.json / out.json)----
const DRAFT_TEXT = `你在给古籍学习 App「观象」写《${args.book}》的详注。读者是成年的自学者:点一个带虚线的词,先看到一句话释义,下面再有一段展开。

输入文件(JSON):当前目录下的 in.json
  · items:要注的各段。ch 章号、chTitle 章题、${SEG_NOTE}、o 原文(底本,一个字不能改)、t 站内译文(参考,可能有错,以原文为准)、label(周易里的「卦辞」「初九」等)、old 已有简注
  · redline:本书红线

${SPEC}

把结果写到当前目录下的 out.json,格式:${FORMAT}。
写完后自查一遍(可以用一小段脚本核):每条 k 是否确为该段 o 的子串、同段是否重叠、d 与 x 字数是否合规、out.json 是否合法 JSON,有问题就改文件。

补充要求:
- 只读 in.json、只写 out.json;不要联网,不要读当前目录之外的任何文件,不要改 in.json。
- 原文 o 一个字不能改;k 必须从 o 里原样截取。
- 密度目标是每百个原文字 12–14 条。**长段(几百字)也要按这个密度逐句往下注,不能一段只挑三五个词**;写完按各段字数核一下总条数,偏少就回头补。
- 全部单元一次写完整,不要只写一部分就停;最后一句话说明写了多少条即可。`

// ---- 对应 notes-wf.js 的 VERIFY,换成 Codex 的读写方式 ----
const VERIFY_TEXT = `你是《${args.book}》详注的核查者。另一个代理已把详注写到了当前目录下的 out.json;原文与译文在当前目录下的 in.json(items 里每段的 o 是底本原文,${SEG_NOTE};redline 是本书红线)。

逐条核,有问题就**在 out.json 里就地改那一处**(只替换有问题的那几个字段或那一条),不要把整份文件重写一遍——绝大多数条目是对的,原样留着。改完文件仍须是合法 JSON,格式不变:${FORMAT}。
核这几样:
1. k 必须是该段 o 的精确子串;同段各条按首次出现位置不重叠、不重复。不合的改 k 或删条。

   **读音单独再过一遍**(以往核查改得最多的就是读音):r 字段和 x 里提到的读音,凡是通假字、多音字、生僻字,你十分确定才留;拿不准的把 r 字段删掉、x 里那半句也删掉,不要猜一个填上;原稿没给读音的不必补。
3. **外部说法**(最要紧):x 里凡是「帛书 / 竹简 / 某本作某字」「某注家说……」「见某书某篇」「某年某事」这类不在输入文件里的说法,你十分确定是对的才保留;拿不准的,改成不点名的转述(「一说」「旧注多解作」),或删掉那半句;带引号的他书原话,不能确证逐字无误就去掉引号改转述。
4. 红线:违反 redline 的措辞改掉。
5. 字数:d ≤ 30 字,x 不超过 120 字。x 偏短(45 字以上)但说清楚了的**不必补长**——不要为了凑字数去改写。
不要为改而改:写得对的一个字不动;不新增条目,除非某段明显该注却一条都没有。

补充要求:
- 只读 in.json、只改 out.json;不要联网,不要读当前目录之外的任何文件,不要改 in.json。
- 改完用一小段脚本核一遍 out.json 是合法 JSON、每条 k 仍是该段 o 的子串。
- 最后一句话说明改了多少条、主要改了什么即可。`

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
const flat = (j) => {
  const m = new Map()
  for (const [ch, segs] of Object.entries(j || {})) for (const [seg, notes] of Object.entries(segs || {})) for (const n of Array.isArray(notes) ? notes : []) if (n && typeof n === 'object') m.set(`${ch}|${seg}|${n.k}`, JSON.stringify([n.d, n.x, n.r ?? null]))
  return m
}

function runCodex(id, instruction, files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `desk-notes-${id}-`))
  for (const [from, to] of files) fs.copyFileSync(from, path.join(tmp, to))
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction], { stdio: ['ignore', 'pipe', 'pipe'] })
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
const srcOf = (input) => { const s = {}; for (const it of input.items) s[`${it.ch}|${it.seg}`] = it.o; return s }
const charsOf = (input, src) => input.chars ?? Object.values(src).reduce((a, s) => a + len(s), 0)
const addTok = (stats, r) => { stats.sec += r.sec; if (r.tokens) stats.tokens += Number(r.tokens.replace(/,/g, '')) || 0 }

// 返回 true = 成功,false = 失败(计入连续失败)
async function draftUnit(id, stats, failed) {
  const outFile = path.join(WORK, 'out', `${id}.json`)
  if (!FORCE && fs.existsSync(outFile)) { console.log(`- ${id} 已有输出,跳过`); stats.skipped++; return true }
  const inFile = path.join(WORK, 'in', `${id}.json`)
  const input = JSON.parse(fs.readFileSync(inFile, 'utf8'))
  const src = srcOf(input)
  let reason = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await runCodex(id, DRAFT_TEXT, [[inFile, 'in.json']])
    addTok(stats, r)
    const f = path.join(r.tmp, 'out.json')
    let j = null
    if (!fs.existsSync(f)) reason = `codex exit ${r.code},无 out.json:${r.log.slice(-160).replace(/\n/g, ' ')}`
    else { try { j = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { reason = 'out.json 不是合法 JSON' } }
    if (j) {
      const v = validate(j, src)
      if (v.total === 0) { reason = '条数为 0'; continue }
      fs.mkdirSync(path.dirname(outFile), { recursive: true })
      fs.writeFileSync(outFile, JSON.stringify(j, null, 2) + '\n')
      const chars = charsOf(input, src)
      stats.ok++; stats.notes += v.total; stats.good += v.good; stats.chars += chars
      for (const [k, n] of Object.entries(v.why)) stats.why[k] = (stats.why[k] || 0) + n
      console.log(`✓ ${id} ${r.sec}s tokens=${r.tokens || '?'} 条 ${v.total}(每百字 ${(v.total * 100 / chars).toFixed(1)})· 机器校验不合 ${v.total - v.good} ${JSON.stringify(v.why)}${attempt > 1 ? ' [重试后]' : ''}`)
      try { fs.rmSync(r.tmp, { recursive: true }) } catch {}
      return true
    }
    console.log(`… ${id} 第 ${attempt} 次失败:${reason}`)
  }
  stats.fail++; failed.push({ id, reason })
  console.log(`✗ ${id} ${reason}`)
  return false
}

const stateFile = path.join(WORK, 'verify-state.json')
const vstate = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {}
const saveState = () => fs.writeFileSync(stateFile, JSON.stringify(vstate, null, 1) + '\n')

async function verifyUnit(id, stats, failed) {
  const outFile = path.join(WORK, 'out', `${id}.json`)
  const draftFile = path.join(WORK, 'out', `${id}.draft.json`)
  if (!fs.existsSync(outFile)) { console.log(`- ${id} 还没有起草输出,跳过`); stats.skipped++; return true }
  if (!FORCE && ['ok', 'restored'].includes(vstate[id]?.status)) { console.log(`- ${id} 已核过(${vstate[id].status}),跳过`); stats.skipped++; return true }
  // 改前那份:第一次核时留底;之后(重核 / 上次失败)一律从这份出发
  if (!fs.existsSync(draftFile)) fs.copyFileSync(outFile, draftFile)
  const inFile = path.join(WORK, 'in', `${id}.json`)
  const input = JSON.parse(fs.readFileSync(inFile, 'utf8'))
  const src = srcOf(input)
  const draft = JSON.parse(fs.readFileSync(draftFile, 'utf8'))
  const before = validate(draft, src).total
  const r = await runCodex(id, VERIFY_TEXT, [[inFile, 'in.json'], [draftFile, 'out.json']])
  addTok(stats, r)
  const restore = (why, status) => {
    fs.copyFileSync(draftFile, outFile)
    vstate[id] = { status, why, before, sec: r.sec, tokens: r.tokens }
    saveState()
    console.log(`${status === 'failed' ? '✗' : '⚠'} ${id} ${why} → 已还原成改前那份${status === 'restored' ? '(标出,待人看)' : ''}`)
  }
  let ok = false
  try {
    if (r.code !== 0) { restore(`codex exit ${r.code}:${r.log.slice(-160).replace(/\n/g, ' ')}`, 'failed'); failed.push({ id, reason: `codex exit ${r.code}` }); stats.fail++; return false }
    let j
    try { j = JSON.parse(fs.readFileSync(path.join(r.tmp, 'out.json'), 'utf8')) } catch { restore('核后的 out.json 读不出或不是合法 JSON', 'restored'); stats.restored++; ok = true; return true }
    const v = validate(j, src)
    if (v.total < before * 0.8) { restore(`核后条数 ${v.total},比改前 ${before} 少了两成以上`, 'restored'); stats.restored++; ok = true; return true }
    const a = flat(draft), b = flat(j)
    let modified = 0, deleted = 0, added = 0
    for (const [k, val] of a) { if (!b.has(k)) deleted++; else if (b.get(k) !== val) modified++ }
    for (const k of b.keys()) if (!a.has(k)) added++
    const changed = modified + deleted + added
    fs.writeFileSync(outFile, JSON.stringify(j, null, 2) + '\n')
    vstate[id] = { status: 'ok', before, after: v.total, changed, modified, deleted, added, sec: r.sec, tokens: r.tokens }
    saveState()
    stats.ok++; stats.notes += v.total; stats.before += before; stats.changed += changed; stats.chars += charsOf(input, src)
    console.log(`✓ ${id} ${r.sec}s tokens=${r.tokens || '?'} 核前 ${before} → 核后 ${v.total} 条 · changed ${changed}(改 ${modified} · 删 ${deleted} · 增 ${added})· 机器校验不合 ${v.total - v.good}`)
    ok = true
    return true
  } finally {
    if (ok) try { fs.rmSync(r.tmp, { recursive: true }) } catch {}
  }
}

const stats = { mode: VERIFY ? 'verify' : 'draft', ok: 0, fail: 0, skipped: 0, restored: 0, notes: 0, good: 0, before: 0, changed: 0, chars: 0, sec: 0, tokens: 0, why: {}, stopped: false }
const failed = []
const queue = [...ids]
let streak = 0
const t0 = Date.now()
await Promise.all(Array.from({ length: Math.max(1, CONC) }, async () => {
  while (queue.length && !stats.stopped) {
    const id = queue.shift()
    const good = await (VERIFY ? verifyUnit : draftUnit)(id, stats, failed)
    streak = good ? 0 : streak + 1
    if (streak >= STOP_AFTER && !stats.stopped) {
      stats.stopped = true
      console.log(`\n✗ 连续 ${STOP_AFTER} 个单元失败(多半是 Codex 限流或额度用完),停止派新单元;正在跑的单元跑完即退出。`)
    }
  }
}))
stats.wall = Math.round((Date.now() - t0) / 1000)
const ff = path.join(WORK, VERIFY ? 'codex-verify-failed.json' : 'codex-failed.json')
if (failed.length) fs.writeFileSync(ff, JSON.stringify(failed, null, 2) + '\n')
else if (fs.existsSync(ff)) fs.rmSync(ff)
fs.writeFileSync(path.join(WORK, VERIFY ? 'codex-verify-stats.json' : 'codex-draft-stats.json'), JSON.stringify(stats, null, 1) + '\n')
if (VERIFY) {
  console.log(`\n核查:成功 ${stats.ok} · 还原待看 ${stats.restored} · 失败 ${stats.fail} · 跳过 ${stats.skipped} · 核前 ${stats.before} → 核后 ${stats.notes} 条 · changed ${stats.changed}(${stats.before ? (stats.changed * 100 / stats.before).toFixed(1) : '-'}%)· 用时 ${stats.wall}s · tokens ${stats.tokens || '?'}`)
} else {
  console.log(`\n成功 ${stats.ok} · 失败 ${stats.fail} · 跳过 ${stats.skipped} · 总条数 ${stats.notes}(校验合格 ${stats.good})· 原文 ${stats.chars} 字 · 每百字 ${stats.chars ? (stats.notes * 100 / stats.chars).toFixed(1) : '-'} 条 · 平均耗时 ${stats.ok ? Math.round(stats.sec / stats.ok) : '-'}s(含重试)· 用时 ${stats.wall}s · tokens ${stats.tokens || '?'}`)
  console.log(`问题分布 ${JSON.stringify(stats.why)}`)
}
if (failed.length) console.log(`失败单元已记入 ${path.relative(ROOT, ff)}`)
process.exit(stats.stopped ? 3 : failed.length ? 1 : 0)
