#!/usr/bin/env node
// 观象 · 书桌 —— 「观书」书库(src/data/books/,约 153 部今人 / 译著)的插画:每书一张封面 cover、一张横幅 banner,
// 每章一张题头图 head-<n>(总览算第 0 章)。图一律由本机 Codex CLI 生成,本脚本不含绘图逻辑;
// prompt 由 Codex 读章节内容后自己设计,先写进 prompt.txt,再出 out.png。后处理(检查 / 样张 / 导出)用 python3 + PIL。
// 结构仿 scripts/desk/gen-art.mjs(古籍那一份;那份不动,这里不 import 它)。
//
//   node scripts/desk/gen-art-guanshu.mjs <slug|--all> [--kind head|cover|banner|all] [--chapters 0-3] [--limit N] [--force] [--concurrency 3] [--hint "…"]
//   node scripts/desk/gen-art-guanshu.mjs --contact <slug>         # 样张 scripts/.cache/desk-art/books/<slug>/contact-N.jpg
//   node scripts/desk/gen-art-guanshu.mjs --export <slug|--all>    # → scripts/.cache/desk-art/books-export/<slug>/{cover,banner,head-N}.jpg
//   node scripts/desk/gen-art-guanshu.mjs --status                 # 每本 已出/应出 与总数
//   加 --dry:只打印第一张待出图交给 Codex 的指令,不出图
//
// 现成 prompt:<slug>/<stem>.ready.txt 在(art-prompts-apply.mjs 写的,Claude 预先设计好)→ Codex 只照抄进 prompt.txt 再出图,
// 不读材料、不设计;没有就照旧让 Codex 读材料自己设计。本文件也被 art-prompts-*.mjs import(取材料 / brief),此时不跑命令行。
//
// 额度暂停:Codex 报用量 / 速率上限,或连续 STOP_AFTER_FAILS 张出不了图 → 不再派新活,写 books/paused.json,
// 以退出码 75 结束;重跑即从停下处接着出(已有的图跳过)。--all 按 index.json 顺序逐本出,出齐一本即导出一本。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { LAYOUT_PHRASE, CLOSING, SIZE, chosenOf } from './art-prompts-rules.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BOOKS_DIR = path.join(ROOT, 'src/data/books')
const rj = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
export const CACHE = path.join(ROOT, 'scripts/.cache/desk-art/books')
const EXPORT = path.join(ROOT, 'scripts/.cache/desk-art/books-export')
const PAUSED = path.join(CACHE, 'paused.json')
const EXIT_PAUSED = 75 // EX_TEMPFAIL:额度 / 限流暂停,重跑即续
const STOP_AFTER_FAILS = Math.max(1, +(process.env.GUANSHU_STOP_AFTER_FAILS || 3)) // 连续几张(各已重试一次)无图即停
const CODEX_BIN = process.env.GUANSHU_CODEX || 'codex'

// ---------- 参数 ----------
const IS_MAIN = !!process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
const argv = IS_MAIN ? process.argv.slice(2) : []
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d }
const VALUE_OPTS = ['--kind', '--chapters', '--limit', '--concurrency', '--books', '--contact', '--export', '--hint']
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_OPTS.includes(argv[i - 1]))

// ---------- 固定画风(与古籍那一套同一句,全 App 成套)----------
export const STYLE = 'Chinese ink-wash painting with light translucent color washes (淡彩水墨): soft ink lines and wet brush gradients, tinted with pale mineral blue-green, warm ochre and a touch of cinnabar; warm off-white rice-paper ground; airy, luminous, lots of breathing space.'

// ---------- 书目 ----------
export const INDEX = rj(path.join(BOOKS_DIR, 'index.json'))
const BY_SLUG = Object.fromEntries(INDEX.map((b) => [b.slug, b]))

const strip = (s) => String(s || '').replace(/\*\*/g, '').replace(/<[^>]+>/g, '')
// 正文抽字:段落、小标题、引文、要点、列举、步骤、图注(只取文字说明,不取 SVG);参考 refs 不要
function articleText(a) {
  const out = []
  for (const b of a.blocks || []) {
    if (['p', 'lead', 'pull'].includes(b.type)) out.push(strip(b.text))
    else if (b.type === 'h2') out.push(`## ${strip(b.text)}`)
    else if (b.type === 'quote') out.push(strip(b.original) + (b.translation ? ` —— ${strip(b.translation)}` : ''))
    else if (b.type === 'callout' || b.type === 'list') out.push(...(b.items || []).map((x) => '- ' + strip(typeof x === 'string' ? x : x.text)))
    else if (b.type === 'steps') out.push(...(b.items || []).map((x) => `- ${strip(x.title)}:${strip(x.text)}`))
    else if (b.type === 'figure' && b.caption) out.push(`(diagram in the notes: ${strip(b.caption)})`)
  }
  return out.filter(Boolean).join('\n')
}

export function loadBook(slug) {
  const meta = BY_SLUG[slug]
  if (!meta) throw new Error(`未知书 ${slug}(见 src/data/books/index.json)`)
  const dir = path.join(BOOKS_DIR, slug)
  const ov = rj(path.join(dir, 'overview.json'))
  const chapters = [{ n: 0, title: ov.title, subtitle: ov.subtitle, centralIdea: ov.centralIdea, text: articleText(ov), headings: (ov.blocks || []).filter((b) => b.type === 'h2').map((b) => strip(b.text)) }]
  for (const c of meta.chapters || []) {
    const f = path.join(dir, 'articles', `${c.no}.json`)
    if (!fs.existsSync(f)) continue
    const a = rj(f)
    chapters.push({ n: c.no, title: a.title || c.title, subtitle: a.subtitle, centralIdea: a.centralIdea, text: articleText(a), headings: (a.blocks || []).filter((b) => b.type === 'h2').map((b) => strip(b.text)) })
  }
  return { slug, meta, overview: chapters[0], chapters }
}

// ---------- 指令 ----------
const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')

const COMMON_RULES = `HARD RULES for the image:
- ABSOLUTELY NO text of any kind in the picture: no letters, numerals, Chinese or other characters, no logos or brand marks, no charts or graphs with labels, no maps with names, no book-cover typography, no seal stamps, no signature, no inscription, no border or frame. Pages, screens, signs, banknotes or documents, if they appear at all, must be blank or show only illegible soft strokes.
- No human faces and no recognisable likeness of any real person (the author, scientists, investors, politicians, historical figures). People, if any, must be small, seen from behind or far away, never the focus as portraits.
- Never imitate a publisher's cover or any existing artwork; no trademarks, no recognisable product designs (phones, cars, logos of companies). Vehicles, machines and packaging are generic and unbranded: no badges, emblems or licence plates.
- Objects, places, architecture and dress must belong to the world the book is actually about — take the era and region from the material (a 1950s American office, a Song-dynasty market, a Victorian laboratory, a Peruvian plaza in 1532, a present-day city flat…), all rendered in this ink-wash style. Do NOT default to ancient China unless the book is about it.
- For adult readers: calm and refined, never cartoonish, never cute, no comic-strip or infographic look, no clip-art.
- NO stock-photo metaphors: no light bulbs, handshakes, chess kings, brains with gears, rising arrows or bar charts, puzzle pieces, rockets, targets with darts, ladders to the sky, people on mountain peaks raising their arms.
- Sensitive subjects (war, conquest, atrocity, illness, death, sex, religion): restrained, indirect and dignified — an empty place, an object left behind, a distant scene; no gore, no weapons in use, no victims or bodies shown, no nudity, no worship scenes. For illness or death prefer the ordinary life around it (a window, a chair, a coat on a hook, a path) over a clinical room.`

const HEALTH_RULE = `
- This is a health / medicine book read for understanding: NEVER draw treatment or diagnosis (no doctors with patients, hospital beds, syringes, pills, scans, stethoscopes, surgery) and no anatomical body diagrams or exposed organs. Use the everyday life and the natural world the chapter talks about (a kitchen table, a walk at dusk, a bedroom with the lamp off, food at a market, a garden, an old person's hands at rest).`
const extraRules = (meta) => (meta.tags || []).includes('健康') ? HEALTH_RULE : ''

// 同一本书其他图已用过的题材(读旁边 .txt 的 CHOSEN 行),让 Codex 换一个,免得封面 / 横幅 / 总览 / 各章撞成同一幅
function usedSubjects(bk, stem) {
  const dir = path.join(CACHE, bk.slug)
  if (!fs.existsSync(dir)) return ''
  const out = []
  for (const f of fs.readdirSync(dir).filter((f) => /^(cover|banner|head-\d+)\.txt$/.test(f) && f !== `${stem}.txt`).sort()) {
    const m = /CHOSEN:\s*([\s\S]*?)(?:\n\s*PROMPT:|$)/.exec(fs.readFileSync(path.join(dir, f), 'utf8'))
    if (m) out.push(`- ${f.slice(0, -4)}: ${clip(m[1].replace(/\s+/g, ' ').trim(), 220)}`)
  }
  return out.length ? `\n== ALREADY USED in this book's other pictures — choose a DIFFERENT main subject and scene ==\n${out.slice(0, 14).join('\n')}\n` : ''
}

const bookLine = (m) => `Book: 《${m.title}》${m.subtitle ? `  (original title: ${m.subtitle})` : ''}  Author: ${m.author || '?'} (for context only — never draw the author)
Tags: ${(m.tags || []).join(' / ')}
One-line blurb: ${m.oneLine || ''}`

// 指令的几块(出图指令与 art-prompts-prep 的 brief 共用,改一处两处都跟着变)
const headMaterial = (bk, ch) => `${bookLine(bk.meta)}
${ch.n === 0 ? 'This is the whole-book overview essay (chapter 0).' : `Chapter ${ch.n}`}: ${ch.title}
Subtitle: ${ch.subtitle || ''}
Central idea: ${ch.centralIdea || ''}
Section headings: ${clip(ch.headings.join(' / '), 400)}
Body of the notes (may be truncated):
${clip(ch.text, 3000)}`
const HEAD_LAYOUT = 'A chapter illustration, landscape 3:2 (1536x1024). In the app it sits at the TOP of the article as a soft head image that fades downward into the page. So: keep the top third of the canvas as nearly blank rice paper; let the scene spread across the lower two thirds and across most of the width (a real scene with a readable subject and a little setting around it, NOT one tiny object lost in an empty corner); soft, light-to-medium contrast, translucent washes, never a heavy dark full-bleed composition.'
const NO_LOOKUP = 'Work ONLY from the material above: do not search the web, do not look up or quote the book itself or any other source, do not read any files.'
const HEAD_DESIGN = 'First list 3-5 CONCRETE imagery items that THIS chapter itself contains — an example or story the author tells, a scene, an object, a metaphor the notes use (e.g. for a chapter built on "the man who crossed the room at the party to talk to a stranger" draw that room; for "168 Spanish soldiers meet the Inca army at Cajamarca" draw the plaza and the waiting host at a distance). For each item, quote the short phrase of the material it comes from. Then choose one or two to organize the picture, so that someone who has read this chapter recognizes which chapter it is at a glance. Do NOT make a generic mood landscape, and do NOT illustrate the abstract idea with a symbol.'

function instructionHead(bk, ch) {
  return `You will create ONE illustration for a chapter of a non-fiction / literary book (reading notes in Chinese), in two steps.

== FIXED ART STYLE (identical for every image in this series) ==
${STYLE}

== MATERIAL ==
${headMaterial(bk, ch)}
${usedSubjects(bk, `head-${ch.n}`)}
== WHAT THIS IMAGE IS ==
${HEAD_LAYOUT}

== STEP 1: design the picture (English) ==
${NO_LOOKUP}
${HEAD_DESIGN} Write the result into prompt.txt in the current directory, in this form:
IMAGERY: <the 3-5 items, each with its quoted source phrase>
CHOSEN: <the one or two you picked and why; name the era and place they belong to>
PROMPT: <the final English image prompt, which must begin with the fixed art style sentence above, then the scene, then the layout notes and hard rules>

== STEP 2: generate ==
Use your image generation tool to create exactly ONE image from that PROMPT and save it in the current directory as out.png (landscape 3:2, 1536x1024).

${COMMON_RULES}${extraRules(bk.meta)}

When finished, print only the absolute path of out.png. Do nothing else.`
}

const HINT = opt('--hint', '')
const BANNER_LAYOUT = 'A wide banner for the home-screen card of this book, landscape 3:2 (1536x1024). Unlike the cover (which carries the book\'s governing image), the banner shows a concrete scene, example or place from inside the book. Complete picture with a clear main subject placed in the right or central part; the lower-left area must stay calm (soft washes only) because the app overlays the book title there in white on a dark gradient.'
const COVER_LAYOUT = 'A book cover, portrait 2:3 (1024x1536). Complete picture with a clear, definite main subject. The bottom third must be left clean and quiet (paper-colored, only faint washes) because the app will typeset the book title there. Keep the upper two thirds as the picture.'
const coverMaterial = (bk, banner) => `${bookLine(bk.meta)}
Overview essay central idea: ${bk.overview.centralIdea || ''}
Overview section headings: ${clip(bk.overview.headings.join(' / '), 500)}
Chapter titles: ${clip(bk.chapters.slice(1).map((c) => c.title).join(' / '), 500)}
Opening of the overview (truncated):
${clip(bk.overview.text, banner ? 2500 : 1200)}`
const COVER_DESIGN = 'From the material, pull out 3-5 of the most representative CONCRETE images of the whole book (things, scenes, examples, metaphors the book actually uses — quote the phrase each comes from). Pick one or two to make a single memorable, iconic composition that belongs to this book and no other — not a generic mood landscape, not a symbol of the abstract theme.'

function instructionCover(bk, banner = false) {
  const layout = banner ? BANNER_LAYOUT : COVER_LAYOUT
  return `You will create ONE ${banner ? 'banner' : 'cover'} illustration for a book (non-fiction / literary, reading notes in Chinese), in two steps.

== FIXED ART STYLE (identical for every image in this series) ==
${STYLE}

== MATERIAL ==
${coverMaterial(bk, banner)}
${usedSubjects(bk, banner ? 'banner' : 'cover')}
== WHAT THIS IMAGE IS ==
${layout}

${HINT ? `== EXTRA CONSTRAINT FOR THIS IMAGE (from the art director) ==\n${HINT}\n\n` : ''}== STEP 1: design the picture (English) ==
${NO_LOOKUP}
${COVER_DESIGN} Write into prompt.txt in the current directory:
IMAGERY: <the 3-5 items, each with its quoted source phrase>
CHOSEN: <the one or two you picked and why; name the era and place they belong to>
PROMPT: <the final English image prompt, beginning with the fixed art style sentence above, then the scene, then layout notes and hard rules>

== STEP 2: generate ==
Use your image generation tool to create exactly ONE image from that PROMPT and save it in the current directory as out.png (${banner ? 'landscape 3:2, 1536x1024' : 'portrait 2:3, 1024x1536'}).

${COMMON_RULES}${extraRules(bk.meta)}

When finished, print only the absolute path of out.png. Do nothing else.`
}

// ---------- 预先设计 prompt(art-prompts-prep 用)与现成 prompt 的出图指令 ----------
// brief = 今天给 Codex 的指令去掉「出图」那一步:画风句 + 材料 + 这张图是什么 + 怎么设计 + 全部硬规矩,另给版式句 / 收尾句原文
export function briefFor(bk, kind, ch) {
  const head = kind === 'head'
  return `ONE ${head ? 'chapter illustration' : kind} for a non-fiction / literary book (reading notes in Chinese). Size: ${SIZE[kind]}.

== FIXED ART STYLE (the PROMPT must begin with exactly this sentence) ==
${STYLE}

== MATERIAL ==
${head ? headMaterial(bk, ch) : coverMaterial(bk, kind === 'banner')}

== WHAT THIS IMAGE IS ==
${head ? HEAD_LAYOUT : kind === 'banner' ? BANNER_LAYOUT : COVER_LAYOUT}
Layout sentence — copy it verbatim into the PROMPT, right after the scene: ${LAYOUT_PHRASE[kind]}

== HOW TO DESIGN IT ==
${NO_LOOKUP}
${head ? HEAD_DESIGN : COVER_DESIGN}
Give: imagery = the 3-5 items, each with its quoted source phrase; chosen = the one or two you picked and why, naming the era and place they belong to; prompt = the final English image prompt: the fixed art style sentence, then the scene (only what IS in the picture — never name forbidden things, not even as "no …"), then the layout sentence, then the closing sentence.

${COMMON_RULES}${extraRules(bk.meta)}

Closing sentence — the PROMPT must end with exactly this: ${CLOSING}`
}

export const readyFile = (dir, stem) => path.join(dir, `${stem}.ready.txt`)

// 现成 prompt 在 → 只抄写 + 出一张图;不给材料、不让读、不让上网
export function instructionReady(ready, kind) {
  return `You will create ONE illustration. The picture has already been designed; do not redesign or change it.

STEP 1: write a file prompt.txt in the current directory whose content is exactly the text between the two marker lines below (without the marker lines):
<<<<<<<< BEGIN
${ready.trim()}
>>>>>>>> END

STEP 2: use your image generation tool to create exactly ONE image from the PROMPT line above and save it in the current directory as out.png (${SIZE[kind]}).

Do not read any other files, do not search the web, do not alter the prompt. When finished, print only the absolute path of out.png. Do nothing else.`
}

export function buildInstruction(bk, kind, ch, dir) {
  const rf = readyFile(dir, stemOf(kind, ch))
  if (fs.existsSync(rf)) return { instruction: instructionReady(fs.readFileSync(rf, 'utf8'), kind), ready: rf }
  return { instruction: kind === 'head' ? instructionHead(bk, ch) : instructionCover(bk, kind === 'banner'), ready: null }
}

// ---------- 机器检查(python3 + PIL)----------
function py(code, ...a) { return execFileSync('python3', ['-', ...a], { input: code, encoding: 'utf8', maxBuffer: 1 << 26 }) }
function checkImage(file, kind) {
  try {
    const [w, h, sd] = py(`
import sys
from PIL import Image, ImageStat
im = Image.open(sys.argv[1]); im.verify()
im = Image.open(sys.argv[1]).convert('L')
w, h = im.size
sd = ImageStat.Stat(im.resize((256, 256))).stddev[0]
print(w, h, round(sd, 2))
`, file).trim().split(' ').map(Number)
    if (Math.min(w, h) < 1000) return `短边 ${Math.min(w, h)} < 1000`
    if (sd < 6) return `近乎纯色 (std ${sd})`
    if (kind === 'cover' && w >= h) return `封面应为竖图,得 ${w}x${h}`
    if (kind !== 'cover' && h >= w) return `横图应为横幅,得 ${w}x${h}`
    return null
  } catch { return '不是合法图片' }
}

// ---------- 额度 / 限流识别 ----------
// 文案取自 codex 0.160 二进制里的报错串:「You've hit your usage limit…」「exceeded retry limit, last status: 429」
// 「rate limit exceeded」「quota exceeded」「usage not included」「…credits_depleted」等;图像工具自己的限流也会被 Codex 转述成这类话。
const LIMIT_RE = /hit your usage limit|usage limit (?:reached|exceeded)|usage_limit|rate[ _-]?limit(?:ed| reached| exceeded)?|quota exceeded|insufficient_quota|exceeded retry limit|status:? 429|429 too many|too many requests|credits[ _]depleted|purchase more credits|usage not included|try again (?:at|later|in)/i
function limitHit(log, instruction) {
  const t = log.split(instruction).join('') // codex exec 会把指令回显进日志,先剔掉
  const m = LIMIT_RE.exec(t)
  if (!m) return null
  const i = t.lastIndexOf('\n', m.index)
  return t.slice(i + 1, i + 1 + 300).trim()
}

// ---------- 调 Codex ----------
function runCodex(instruction) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-art-gs-'))
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn(CODEX_BIN, ['exec', '--skip-git-repo-check', '-c', 'web_search="disabled"', '-C', tmp, '-s', 'workspace-write', instruction], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
    p.on('error', (e) => { log += `\nspawn error: ${e.message}` })
    const timer = setTimeout(() => p.kill('SIGKILL'), 12 * 60 * 1000)
    // 图出来就收工:Codex 画完后进程常常还要挂一两分钟才退(2026-11-23 实测,白占并发位)。out.png 大小 25 秒不变即视为画完,不等它自己退。
    let seen = '', since = 0
    const watch = setInterval(() => {
      try {
        const st = fs.statSync(path.join(tmp, 'out.png'))
        if (st.size < 100000) return
        const sig = `${st.size}:${st.mtimeMs}`
        if (sig !== seen) { seen = sig; since = Date.now() }
        else if (Date.now() - since > 25000) { log += '\n[图已稳定,提前收工]'; clearInterval(watch); p.kill('SIGTERM') }
      } catch {}
    }, 3000)
    p.on('close', (code) => {
      clearTimeout(timer); clearInterval(watch)
      const sec = Math.round((Date.now() - t0) / 1000)
      const tok = /tokens used[^\d]*([\d,]+)/i.exec(log)?.[1]?.replace(/,/g, '') || ''
      const png = fs.existsSync(path.join(tmp, 'out.png')) ? 'out.png' : fs.readdirSync(tmp).find((f) => /\.png$/i.test(f))
      resolve({ tmp, code, sec, tokens: tok, png: png && path.join(tmp, png), promptFile: fs.existsSync(path.join(tmp, 'prompt.txt')) ? path.join(tmp, 'prompt.txt') : null, log })
    })
  })
}

export const stemOf = (kind, ch) => (kind === 'head' ? `head-${ch.n}` : kind)

// 返回 { status: ok|fail|limit, sec, tokens, why }
async function makeOne(bk, kind, ch, dir, state) {
  const stem = stemOf(kind, ch)
  const png = path.join(dir, `${stem}.png`), txt = path.join(dir, `${stem}.txt`)
  const { instruction, ready } = buildInstruction(bk, kind, ch, dir)
  let why = '', total = 0, toks = [], r, limit = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (state.paused) { why = '已暂停,未出'; break }
    r = await runCodex(instruction)
    total += r.sec; if (r.tokens) toks.push(r.tokens)
    why = !r.png ? `codex exit ${r.code},无 png:${r.log.slice(-200).replace(/\n/g, ' ')}` : checkImage(r.png, kind)
    if (!why) break
    if (!r.png) limit = limitHit(r.log, instruction)
    console.log(`  ! ${bk.slug}/${stem} 第 ${attempt} 次不过:${limit ? '额度/限流:' + limit : why}`)
    if (limit) break // 额度打满,重试无益
    if (attempt < 2) fs.rmSync(r.tmp, { recursive: true, force: true })
  }
  const rec = { book: bk.slug, stem, sec: total, tokens: toks.join('+'), ok: !why, at: new Date().toISOString() }
  if (!why) {
    fs.copyFileSync(r.png, png)
    if (r.promptFile) fs.copyFileSync(r.promptFile, txt); else fs.writeFileSync(txt, ready ? fs.readFileSync(ready, 'utf8') : '(Codex 未写 prompt.txt)')
    console.log(`✓ ${bk.slug}/${stem}${ready ? '(现成 prompt)' : ''} ${total}s tokens=${rec.tokens || '?'}`)
  } else if (why !== '已暂停,未出') {
    rec.why = limit ? `limit: ${limit}` : why
    console.log(`✗ ${bk.slug}/${stem} ${rec.why.slice(0, 200)}`)
  }
  if (r) fs.rmSync(r.tmp, { recursive: true, force: true })
  if (why !== '已暂停,未出') state.timing.push(rec)
  return { status: !why ? 'ok' : limit ? 'limit' : why === '已暂停,未出' ? 'skipped' : 'fail', stem, why: rec.why }
}

function parseChapters(spec) {
  if (!spec) return null
  const s = new Set()
  for (const part of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!m) throw new Error(`--chapters 格式不对:${part}`)
    for (let i = +m[1]; i <= +(m[2] || m[1]); i++) s.add(i)
  }
  return s
}

function mergeJson(file, update) {
  let cur = {}
  try { cur = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
  fs.writeFileSync(file, JSON.stringify(update(cur), null, 1))
}

export function expectedStems(bk) { return ['cover', 'banner', ...bk.chapters.map((c) => `head-${c.n}`)] }
export function doneStems(slug) {
  const d = path.join(CACHE, slug)
  return fs.existsSync(d) ? new Set(fs.readdirSync(d).filter((f) => /^(cover|banner|head-\d+)\.png$/.test(f)).map((f) => f.slice(0, -4))) : new Set()
}

// ---------- 样张 / 导出 ----------
function contact(slug) {
  const dir = path.join(CACHE, slug)
  return py(`
import sys, os, re, glob
from PIL import Image, ImageDraw
d = sys.argv[1]
items = []
for k in ('cover', 'banner'):
    if os.path.exists(os.path.join(d, k + '.png')): items.append((k, os.path.join(d, k + '.png')))
heads = []
for f in glob.glob(os.path.join(d, 'head-*.png')):
    m = re.search(r'head-(\\d+)\\.png$', f)
    if m: heads.append((int(m.group(1)), f))
for n, f in sorted(heads): items.append(('head-' + str(n), f))
if not items: print('无图'); sys.exit(0)
COLS, ROWS, W, H, G = 4, 4, 360, 240, 12
per = COLS * ROWS
for pg in range((len(items) + per - 1) // per):
    chunk = items[pg*per:(pg+1)*per]
    rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS*(W+G)+G, rows*(H+G+16)+G), (245, 241, 233))
    dr = ImageDraw.Draw(sheet)
    for i, (label, f) in enumerate(chunk):
        im = Image.open(f).convert('RGB'); im.thumbnail((W, H))
        x = G + (i % COLS) * (W+G); y = G + (i // COLS) * (H+G+16)
        sheet.paste(im, (x, y)); dr.text((x, y+H+2), label, fill=(150, 40, 40))
    o = os.path.join(d, f'contact-{pg+1}.jpg'); sheet.save(o, quality=88); print(o)
`, dir).trim()
}

// 封面 1024 宽、其余 1536 宽;q80 起,超 220 KB 逐级降到 q60
function exportBook(slug) {
  const dir = path.join(CACHE, slug), dest = path.join(EXPORT, slug)
  if (!fs.existsSync(dir)) return '0'
  fs.mkdirSync(dest, { recursive: true })
  return py(`
import sys, os, glob, re, io
from PIL import Image
src, dest = sys.argv[1], sys.argv[2]
n = 0; big = []
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    b = os.path.basename(f)[:-4]
    if not (b in ('cover', 'banner') or re.fullmatch(r'head-\\d+', b)): continue
    o = os.path.join(dest, b + '.jpg')
    if os.path.exists(o) and os.path.getmtime(o) >= os.path.getmtime(f): n += 1; continue
    W = 1024 if b == 'cover' else 1536
    im = Image.open(f).convert('RGB')
    if im.width != W: im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    for q in (80, 76, 72, 68, 64, 60):
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() <= 220 * 1024: break
    if buf.tell() > 220 * 1024: big.append(b)
    open(o, 'wb').write(buf.getvalue()); n += 1
print(n, ('超 220KB:' + ','.join(big)) if big else '')
`, dir, dest).trim()
}

function status() {
  let done = 0, total = 0, complete = 0, readyN = 0
  for (const m of INDEX) {
    const bk = loadBook(m.slug), exp = expectedStems(bk), have = doneStems(m.slug)
    const d = exp.filter((s) => have.has(s)).length
    const rd = exp.filter((s) => !have.has(s) && fs.existsSync(readyFile(path.join(CACHE, m.slug), s))).length
    done += d; total += exp.length; readyN += rd; if (d === exp.length) complete++
    if (d || rd) console.log(`${m.slug.padEnd(40)} ${d}/${exp.length}${d === exp.length ? ' ✓' : ''}${rd ? `  现成 prompt ${rd}` : ''}`)
  }
  console.log(`合计 ${done}/${total} 张;出齐 ${complete}/${INDEX.length} 本;待出 ${total - done} 张中 ${readyN} 张已有现成 prompt`)
  if (fs.existsSync(PAUSED)) console.log('暂停记录:', fs.readFileSync(PAUSED, 'utf8'))
}

async function main() {
if (flag('--status')) { status(); process.exit(0) }
if (argv.includes('--contact')) { const s = opt('--contact'); if (!s) { console.error('--contact <slug>'); process.exit(1) } console.log(contact(s)); process.exit(0) }
if (argv.includes('--export')) {
  const s = opt('--export')
  const list = (!s && flag('--all')) || s === '--all' ? INDEX.map((m) => m.slug) : s ? [s] : []
  if (!list.length) { console.error('--export <slug|--all>'); process.exit(1) }
  for (const x of list) { const r = exportBook(x); if (r !== '0') console.log(`导出 ${x}:${r} → ${path.relative(ROOT, path.join(EXPORT, x))}`) }
  process.exit(0)
}

// ---------- 主流程 ----------
const all = flag('--all')
if (!all && !positional[0]) {
  console.error('用法:node scripts/desk/gen-art-guanshu.mjs <slug|--all> [--kind head|cover|banner|all] [--chapters 0-3] [--limit N] [--force] [--concurrency 3]\n      --contact <slug> | --export <slug|--all> | --status')
  process.exit(1)
}
const kind = opt('--kind', 'all')
if (!['head', 'cover', 'banner', 'all'].includes(kind)) { console.error('--kind 须为 head|cover|banner|all'); process.exit(1) }
const conc = Math.max(1, +opt('--concurrency', 3))
const limit = opt('--limit') ? +opt('--limit') : Infinity
const only = parseChapters(opt('--chapters'))
const force = flag('--force')
const slugs = all ? INDEX.map((m) => m.slug) : [positional[0]]
for (const s of slugs) if (!BY_SLUG[s]) { console.error(`未知书 ${s}`); process.exit(1) }

fs.mkdirSync(CACHE, { recursive: true })
if (fs.existsSync(PAUSED) && !flag('--dry')) { console.log('上次暂停:', fs.readFileSync(PAUSED, 'utf8').replace(/\s+/g, ' ')); fs.rmSync(PAUSED) } // --dry 不动暂停记录

const state = { paused: null, consecutiveFails: 0, timing: [], ok: 0, fail: 0, last: null }
let budget = limit

function pause(reason, last) {
  if (state.paused) return
  state.paused = { at: new Date().toISOString(), reason, last, okThisRun: state.ok, failThisRun: state.fail }
  console.log(`\n■ 暂停:${reason}(最后一张 ${last})`)
}

async function runBook(slug) {
  const bk = loadBook(slug)
  const dir = path.join(CACHE, slug)
  fs.mkdirSync(dir, { recursive: true })
  const jobs = []
  if (kind === 'cover' || kind === 'all') jobs.push({ kind: 'cover' })
  if (kind === 'banner' || kind === 'all') jobs.push({ kind: 'banner' })
  if (kind === 'head' || kind === 'all') for (const ch of bk.chapters) if (!only || only.has(ch.n)) jobs.push({ kind: 'head', ch })
  const todo = []
  for (const j of jobs) {
    if (!force && fs.existsSync(path.join(dir, `${stemOf(j.kind, j.ch)}.png`))) continue
    if (budget > 0) { todo.push(j); budget-- }
  }
  if (!todo.length) return bk
  if (flag('--dry')) { // 只打印第一张待出图的指令,不调 Codex
    const j = todo[0]
    console.log(buildInstruction(bk, j.kind, j.ch, dir).instruction)
    process.exit(0)
  }
  console.log(`《${bk.meta.title}》${slug}:共 ${jobs.length} 张,待出 ${todo.length} 张,并发 ${conc}`)
  const before = state.timing.length
  let next = 0
  await Promise.all(Array.from({ length: conc }, async () => {
    while (next < todo.length && !state.paused) {
      const j = todo[next++]
      const r = await makeOne(bk, j.kind, j.ch, dir, state)
      state.last = `${slug}/${r.stem}`
      if (r.status === 'ok') { state.ok++; state.consecutiveFails = 0 }
      else if (r.status === 'limit') { state.fail++; pause(`Codex 报额度 / 限流:${r.why.replace(/^limit: /, '').slice(0, 200)}`, state.last) }
      else if (r.status === 'fail') {
        state.fail++
        if (++state.consecutiveFails >= STOP_AFTER_FAILS) pause(`连续 ${state.consecutiveFails} 张出不了图(最近一次:${String(r.why).slice(0, 160)})`, state.last)
      }
    }
  }))
  const mine = state.timing.slice(before)
  mergeJson(path.join(dir, 'timing.json'), (cur) => {
    const m = new Map((Array.isArray(cur) ? cur : []).map((x) => [x.stem, x]))
    for (const t of mine) m.set(t.stem, t)
    return [...m.values()]
  })
  mergeJson(path.join(dir, 'failed.json'), (cur) => {
    const o = { ...cur }
    for (const t of mine) { if (t.ok) delete o[t.stem]; else o[t.stem] = t.why }
    return o
  })
  return bk
}

// --books N:同时开 N 本(每本内部仍是 --concurrency 路)。一本书十来张图,只在书内并发的话每本收尾时都在等最后一两张,整体并发上不去。
const booksPar = Math.max(1, +opt('--books', 1))
let nextBook = 0
await Promise.all(Array.from({ length: booksPar }, async () => {
  while (nextBook < slugs.length && !state.paused && budget > 0) {
    const slug = slugs[nextBook++]
    const bk = await runBook(slug)
    if (all) {
      const have = doneStems(slug)
      if (expectedStems(bk).every((s) => have.has(s))) { const r = exportBook(slug); console.log(`  导出 ${slug}:${r}`) }
    }
  }
}))

const avg = state.timing.length ? Math.round(state.timing.reduce((s, t) => s + t.sec, 0) / state.timing.length) : 0
console.log(`本次:成功 ${state.ok},失败 ${state.fail},平均 ${avg}s/张`)
if (state.paused) {
  let total = 0, done = 0
  for (const m of INDEX) { const exp = expectedStems(loadBook(m.slug)), have = doneStems(m.slug); total += exp.length; done += exp.filter((s) => have.has(s)).length }
  fs.writeFileSync(PAUSED, JSON.stringify({ ...state.paused, doneTotal: done, expectedTotal: total, resume: `node scripts/desk/gen-art-guanshu.mjs ${argv.join(' ')}` }, null, 1))
  console.log(`已写 ${path.relative(ROOT, PAUSED)};重跑同一命令即续。`)
  process.exit(EXIT_PAUSED)
}
}

if (IS_MAIN) await main()
