#!/usr/bin/env node
// 观象 · 书桌 —— 图解结构化(本机 Codex CLI 版)。把站内白话的 SVG 图转成 docs/desk-baihua-spec.md §2 的 fig 数据。
//   node scripts/desk/figs-codex.mjs <书 id> [--units u001,u002] [--concurrency 3] [--force]
// 读 scripts/.desk-figs/<书>/args.json 与 in/<单元>.json(figs-prep.mjs 备),结果落 out/<单元>.json({key: fig});
// 每单元先出一版,过闸(fig-gate.mjs checkFig)不过的再补一轮「只修这几张」。之后 figs-apply.mjs 合并。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { ROOT, workDir } from './fig-sources.mjs'
import { checkFig } from './fig-gate.mjs'

const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const valIdx = new Set(['units', 'concurrency'].map((n) => argv.indexOf('--' + n) + 1).filter((i) => i > 0))
const book = argv.find((a, i) => !a.startsWith('--') && !valIdx.has(i))
const FORCE = argv.includes('--force')
const CONC = Number(opt('concurrency', 3))
const UNITS = opt('units', '') ? opt('units', '').split(',') : null
if (!book) { console.error('用法:node scripts/desk/figs-codex.mjs <书 id> [--units u001,u002] [--concurrency 3] [--force]'); process.exit(1) }

const WORK = workDir(book)
const args = JSON.parse(fs.readFileSync(path.join(WORK, 'args.json'), 'utf8'))
const ids = UNITS || args.ids
const TIMEOUT = 20 * 60 * 1000

// 格式规格:运行时从设计文档读 §2 起到文末,保证与闸、App 同一份
const specDoc = fs.readFileSync(path.join(ROOT, 'docs/desk-baihua-spec.md'), 'utf8')
const SPEC = specDoc.slice(specDoc.search(/^## 2\b/m))

const RULES = `硬性规则(机器闸会逐字核,不过的整张作废):
1. **字不多不少**:SVG 里每个 <text> 元素的文字,在 fig 里必须恰好出现一次(字母、数字、汉字按多重集比对;标点、箭头、空格不比)。一行 SVG 文字 = 一个字符串,**不要把几行并成一行**;一行里明显是「标签 + 说明」的(如「上九 · 已过顶，高而无位」「战国·多释某某」),可以在分隔符处拆进 label / text、when / body、head / body 两个字段,字照旧;不改字、不补字、不删字、不换字(含异体字、全半角数字照抄)。
2. 唯一可以不收的:卦符号(䷀…䷿、☰…☷)、纯箭头 / 纯标点的 <text>,以及角上单独成字的「观」「象」印章(不论哪种 kind)。
3. 图里看得见的字,不管多零碎(坐标轴标注、图例、角标、页脚小字)都要收进某个字段;放不进结构的就放进 foot 或改用 notes / rows。
4. 原图里用朱色(\`var(--cinnabar)\` 或朱红 fill / stroke)强调的那一条,给它加 \`"accent": true\`。
5. 同一张图里 <text> 的出现顺序与画面位置(x/y)是判断结构的依据:先看 y 分行、再看 x 分栏;不要只按文档顺序。
6. caption(图注)与 ftype 只是帮你理解图在讲什么的提示,**caption 里的字不得抄进 fig**(它不在 SVG 里,抄了就是多字)。
7. 拿不准版式时优先 rows / notes,不要臆造结构;六画卦 / 三画卦画在图里的用 gua(卦名写进 guas[].name,卦名文字本身若也在 <text> 里,仍要按规则 1 收进某个字符串)。
8. 单个字符串不超过 120 字。
9. 一句原文大字居中、下面配一行白话和一行出处的,是金句卡,用 quote(不要用 rows;金句若分两行排,两行都写进 text、中间用换行符 \\n 隔开,不要把上一行当 title;accent 只标在条目上,不要标在整张图上);有先后推进、最后落到一个结论的,用 flow 并把结论放进 result。`

const taskFull = (unit) => `你在把古籍学习 App「观象 · 书桌」白话文章里的 SVG 图解,转成结构化数据,供 App 原生重排。

输入:当前目录下的 in.json,{book, items:[{key, ftype, caption, chapter, svg}]}。共 ${unit} 张图。

以下是格式规格(第 2 节,即你要产出的数据格式;其中「闸」一节就是机器校验规则):

${SPEC}

${RULES}

做法:对 in.json 里的每个 item,读它的 svg,判断最合适的 kind,产出 fig。把结果写到当前目录下的 out.json,格式:{"<key>": <fig>, …}(key 原样照抄 in.json 里的)。每个 item 都要有。
写完自查一遍(可以写一小段脚本):out.json 是合法 JSON;每张图 svg 里所有 <text> 内容(去掉标签、解 &amp; 等实体)与 fig 里所有字符串值(kind / form / at / guas[].name 除外)的「字母数字」多重集一致。有差异就改。
补充:只读 in.json、只写 out.json;不要联网,不要读当前目录之外的文件。最后一句话说明写了多少张。`

const taskFix = (n) => `你上一轮把 SVG 图解转成了结构化数据,其中 ${n} 张没过机器闸。请只修这几张。

输入:当前目录下的 fix.json,{items:[{key, svg, previous(你上次的 fig), problems(闸报的问题)}]}。

格式规格与闸规则与上一轮相同:

${SPEC}

${RULES}

「漏字」= SVG 里有、fig 里没有的字;「多字」= fig 里有、SVG 里没有的字。逐张对照 svg 的 <text> 行改 fig(常见原因:漏收了角标 / 图例 / 页脚小字;把 caption 或自己的话写了进去;把一行拆成两处写或重复写了一次;改了字)。
把修好的结果写到当前目录下的 out.json,格式:{"<key>": <fig>, …},只含 fix.json 里的这几张。写完用小脚本自查字符多重集一致。只读 fix.json、只写 out.json;不联网。最后一句话说明改了多少张。`

function runCodex(tag, files, instruction) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `desk-figs-${tag}-`))
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(tmp, name), content)
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
    const timer = setTimeout(() => p.kill('SIGKILL'), TIMEOUT)
    p.on('close', (code) => {
      clearTimeout(timer)
      const tok = /tokens used[^\d]*([\d,]+)/i.exec(log)?.[1] || ''
      let out = null, reason = ''
      const f = path.join(tmp, 'out.json')
      if (!fs.existsSync(f)) reason = `codex exit ${code},无 out.json:${log.slice(-160).replace(/\n/g, ' ')}`
      else { try { out = JSON.parse(fs.readFileSync(f, 'utf8')) } catch { reason = 'out.json 不是合法 JSON' } }
      if (out && (typeof out !== 'object' || Array.isArray(out))) { out = null; reason = 'out.json 不是对象' }
      try { fs.rmSync(tmp, { recursive: true }) } catch {}
      resolve({ out, reason, sec: Math.round((Date.now() - t0) / 1000), tokens: Number(tok.replace(/,/g, '')) || 0 })
    })
  })
}

const gate = (figs, items) => {
  const pass = {}, bad = []
  for (const it of items) {
    const fig = figs?.[it.key]
    const probs = fig === undefined ? ['out.json 里没有这张'] : checkFig(fig, it.svg)
    if (probs.length) bad.push({ it, fig, probs }); else pass[it.key] = fig
  }
  return { pass, bad }
}

async function doUnit(id, S) {
  const outFile = path.join(WORK, 'out', `${id}.json`)
  if (!FORCE && fs.existsSync(outFile)) { console.log(`- ${id} 已有输出,跳过`); return }
  const inputText = fs.readFileSync(path.join(WORK, 'in', `${id}.json`), 'utf8')
  const items = JSON.parse(inputText).items
  let sec = 0, tokens = 0, r, reason = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await runCodex(id, { 'in.json': inputText }, taskFull(items.length))
    sec += r.sec; tokens += r.tokens
    if (r.out) break
    reason = r.reason; console.log(`… ${id} 第 ${attempt} 次失败:${reason}`)
  }
  if (!r.out) { S.fail++; S.failed.push({ id, reason }); console.log(`✗ ${id} ${reason}`); return }
  let figs = r.out
  const first = gate(figs, items)
  let { pass, bad } = first
  let repaired = 0
  if (bad.length) {   // 补一轮:只送没过的,带上闸的原话与上次的答案
    const fix = { items: bad.map((b) => ({ key: b.it.key, svg: b.it.svg, previous: b.fig ?? null, problems: b.probs })) }
    const r2 = await runCodex(id + 'fix', { 'fix.json': JSON.stringify(fix, null, 1) }, taskFix(bad.length))
    sec += r2.sec; tokens += r2.tokens
    if (r2.out) {
      figs = { ...figs, ...r2.out }
      const second = gate(figs, bad.map((b) => b.it))
      repaired = Object.keys(second.pass).length
      pass = { ...pass, ...second.pass }; bad = second.bad
    } else console.log(`… ${id} 修复轮失败:${r2.reason}`)
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(figs, null, 1) + '\n')
  const kinds = {}
  for (const f of Object.values(pass)) kinds[f.kind] = (kinds[f.kind] || 0) + 1
  S.ok++; S.figs += items.length; S.first += Object.keys(first.pass).length; S.pass += Object.keys(pass).length; S.sec += sec; S.tokens += tokens
  for (const [k, n] of Object.entries(kinds)) S.kinds[k] = (S.kinds[k] || 0) + n
  for (const b of bad) for (const p of b.probs) { const k = p.replace(/「[^」]*」/g, '「…」'); S.why[k] = (S.why[k] || 0) + 1 }
  console.log(`✓ ${id} ${sec}s tokens=${tokens || '?'} 图 ${items.length} · 首轮过闸 ${Object.keys(first.pass).length} · 修复后 ${Object.keys(pass).length}(修复轮救回 ${repaired})· 仍不过 ${bad.length} · ${JSON.stringify(kinds)}`)
  for (const b of bad) console.log(`    ✗ ${b.it.key} ${b.probs.slice(0, 2).join(';')}`)
}

const S = { ok: 0, fail: 0, figs: 0, first: 0, pass: 0, sec: 0, tokens: 0, kinds: {}, why: {}, failed: [] }
const queue = [...ids]
await Promise.all(Array.from({ length: Math.max(1, CONC) }, async () => { while (queue.length) await doUnit(queue.shift(), S) }))
const ff = path.join(WORK, 'codex-failed.json')
if (S.failed.length) fs.writeFileSync(ff, JSON.stringify(S.failed, null, 2) + '\n'); else if (fs.existsSync(ff)) fs.rmSync(ff)
console.log(`\n单元成功 ${S.ok} · 失败 ${S.fail} · 图 ${S.figs} · 首轮过闸 ${S.first} · 修复后过闸 ${S.pass}(${S.figs ? (S.pass * 100 / S.figs).toFixed(0) : '-'}%)· 平均 ${S.ok ? Math.round(S.sec / S.ok) : '-'}s/单元 · tokens ${S.tokens || '?'}`)
console.log(`种类分布 ${JSON.stringify(S.kinds)}`)
console.log(`未过闸原因 ${JSON.stringify(S.why)}`)
if (S.failed.length) console.log(`失败单元已记入 ${path.relative(ROOT, ff)}`)
