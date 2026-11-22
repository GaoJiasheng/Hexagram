#!/usr/bin/env node
// 观象 · 书桌 —— 批量出插画(题头图 head 每章一张 / 封面 cover 每书一张)。
// 图一律由本机 Codex CLI 生成(owner 2026-10-07),本脚本不含绘图逻辑;prompt 由 Codex 读章节内容后自己设计,
// 先写进 prompt.txt,再出 out.png。后处理(检查/样张/导出)用 python3 + PIL。
//   node scripts/desk/gen-art.mjs <book> [--kind head|cover|banner|all] [--chapters 1-10,25] [--limit N] [--force] [--concurrency 3] [--hint "封面 / 题图的额外约束"]
//   node scripts/desk/gen-art.mjs --contact <book>   # 样张 scripts/.cache/desk-art/<book>/contact-N.jpg
//   node scripts/desk/gen-art.mjs --export <book>    # → public/desk/v1/art/<book>/head-<章>.jpg(1536 宽,q82)与 cover.jpg(1024 宽)
// books: daodejing lunyu sunzi guiguzi zhuangzi yijing
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const D = (p) => path.join(ROOT, 'src/data', p)
const rj = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const CACHE = path.join(ROOT, 'scripts/.cache/desk-art')
const EXPORT = path.join(ROOT, 'public/desk/v1/art')

// ---------- 参数 ----------
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const VALUE_OPTS = ['--kind', '--chapters', '--limit', '--concurrency', '--contact', '--export', '--hint']
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_OPTS.includes(argv[i - 1]))
const book = opt('--contact') || opt('--export') || positional[0]

// ---------- 固定画风(全站同一段,保证成套)----------
const STYLE = 'Chinese ink-wash painting with light translucent color washes (淡彩水墨): soft ink lines and wet brush gradients, tinted with pale mineral blue-green, warm ochre and a touch of cinnabar; warm off-white rice-paper ground; airy, luminous, lots of breathing space.'

// ---------- 六本书的数据 ----------
const BOOKS = {
  daodejing: { group: 'dao', slug: 'daodejing' },
  lunyu: { group: 'ru', slug: 'lunyu' },
  sunzi: { group: 'bing', slug: 'sunzi' },
  guiguzi: { group: 'zong', slug: 'guiguzi' },
  zhuangzi: { group: 'dao', slug: 'zhuangzi', parts: ['zhuangzi-neipian', 'zhuangzi-waipian', 'zhuangzi-zapian'] },
  yijing: { yijing: true },
}

function bhText(b) {
  if (!b) return ''
  return (b.blocks || []).filter((x) => ['p', 'h2', 'quote', 'lead'].includes(x.type) && x.text).map((x) => x.text).join('\n').replace(/\*\*/g, '')
}
function bhOf(b) { return b ? { title: b.title, subtitle: b.subtitle, centralIdea: b.centralIdea, text: bhText(b) } : null }
function chapOriginal(c) { return (c.paragraphs || []).map((p) => p.original).join('\n') }

function loadBook(id) {
  const cfg = BOOKS[id]
  if (!cfg) throw new Error(`未知书 ${id},可选:${Object.keys(BOOKS).join(' ')}`)
  if (cfg.yijing) {
    const hs = rj(D('yijing/hexagrams.json')), hb = rj(D('yijing/baihua/hexagrams.json'))
    const chapters = hs.map((h) => {
      const parts = [`${h.fullName}(第 ${h.id} 卦)`, `卦辞:${h.judgment.original}`, h.tuan?.original, h.daxiang?.original,
        ...h.lines.map((l) => `${l.title}:${l.original}`), ...(h.extra ? [JSON.stringify(h.extra)] : [])].filter(Boolean)
      return { n: h.id, title: h.fullName, original: parts.join('\n'), bh: bhOf(hb[String(h.id)]) }
    })
    const names = [['xici-shang', '系辞上传'], ['xici-xia', '系辞下传'], ['shuogua', '说卦传'], ['xugua', '序卦传'], ['zagua', '杂卦传']]
    let n = 65
    for (const [slug, nm] of names) {
      const c = rj(D(`yijing/classics/${slug}.json`)), b = rj(D(`yijing/baihua/${slug}.json`))
      for (const ch of c.chapters) chapters.push({ n: n++, title: `${nm} · ${ch.title}`, original: chapOriginal(ch), bh: bhOf(b[String(ch.no)]) })
    }
    return { id, title: '周易', author: '相传伏羲画卦、文王作卦辞、周公作爻辞、孔子作十翼(今多视为多代累积而成)', brief: '群经之首。六十四卦以阴阳六爻示变化与处境,附《系辞》《说卦》《序卦》《杂卦》等传文。', chapters }
  }
  const slugs = cfg.parts || [cfg.slug]
  const chapters = []
  let meta = null
  for (const s of slugs) {
    const texts = rj(D(`${cfg.group}/texts.json`)), t = texts.find((x) => x.slug === s)
    if (!meta) meta = t
    const c = rj(D(`${cfg.group}/classics/${s}.json`)), b = rj(D(`${cfg.group}/baihua/${s}.json`))
    for (const ch of c.chapters) {
      const name = t.chapterNames?.[String(ch.no)] || ch.title
      chapters.push({ n: chapters.length + 1, title: name === ch.title ? ch.title : `${name}(${ch.title})`, original: chapOriginal(ch), bh: bhOf(b[String(ch.no)]) })
    }
  }
  if (cfg.parts) meta = { ...meta, title: '庄子', attribution: '庄周及其后学', brief: '道家寓言体名著。内篇七、外篇十五、杂篇十一,以逍遥、齐物、养生、化蝶等寓言见道。' }
  return { id, title: meta.title, author: meta.attribution, brief: meta.brief, chapters }
}

// ---------- 指令 ----------
const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '')

const COMMON_RULES = `HARD RULES for the image:
- ABSOLUTELY NO text of any kind in the picture: no Chinese characters, no letters or numerals, no seal stamps, no signature, no inscription, no border or frame.
- No human faces. Any people must be very small, seen from behind or at a distance. No portraits of sages or gods, no deity images.
- For adult readers: calm and refined, never cartoonish, never cute.
- Everything must belong to ancient China (pre-Qin to Han unless the text says otherwise): timber-frame gates and halls, rammed-earth walls, bronze vessels, pottery, bamboo slips, silk, carts and boats of that world; Chinese landscape and plants. NEVER European or generic-fantasy forms: no megaliths, dolmens or Stonehenge-like stones, no stone arches, no castles, no classical columns. An abstract idea such as a "gate" or "door" must be drawn as a Chinese wooden gate or doorway, or shown through nature (a gap between two cliffs, an opening in mist).`

function instructionHead(bk, ch) {
  const bh = ch.bh
  const yj = bk.id === 'yijing' ? '\n- This is the Book of Changes: NEVER draw fortune-telling props (diviner stalls, tube of sticks, bagua mirrors, coins, yarrow-stalk casting scenes, hexagram line diagrams). Draw the concrete natural / human imagery the text itself speaks of (dragon, water, thunder, mountain, wells, carriages, rivers, etc.).' : ''
  return `You will create ONE illustration for a chapter of a classical Chinese book, in two steps.

== FIXED ART STYLE (identical for every image in this series) ==
${STYLE}

== MATERIAL ==
Book: 《${bk.title}》  Author: ${bk.author}
Chapter ${ch.n}: ${ch.title}
Original text (may be truncated):
${clip(ch.original, 1200)}
${bh ? `\nPlain-language rewrite — title: ${bh.title}\nsubtitle: ${bh.subtitle}\ncentral idea: ${bh.centralIdea}\nBody (first ~1500 chars):\n${clip(bh.text, 1500)}` : '\n(No plain-language text for this chapter.)'}

== WHAT THIS IMAGE IS ==
A chapter illustration, landscape 3:2 (1536x1024). In the app it sits at the BOTTOM of the reading page as a soft background that fades upward into blank paper, below and behind large body text. So: keep the top third of the canvas as nearly blank rice paper; let the scene spread across the lower two thirds and across most of the width (a real scene with a readable subject and a little setting around it, NOT one tiny object lost in an empty corner); soft, light-to-medium contrast, translucent washes, never a heavy dark full-bleed composition.

== STEP 1: design the picture (English) ==
First list 3-5 CONCRETE imagery items that this chapter itself speaks of (objects, actions, metaphors named in the text — e.g. for "thirty spokes share one hub" draw the wheel and the empty space of the hub; for "the highest good is like water" draw water flowing downward and resting in low hollows). Then choose one or two of them to organize the picture, so that someone who has read this chapter recognizes which chapter it is at a glance. Do NOT make a generic misty-mountain-landscape mood picture. Write the result into prompt.txt in the current directory, in this form:
IMAGERY: <the 3-5 items>
CHOSEN: <the one or two you picked and why>
PROMPT: <the final English image prompt, which must begin with the fixed art style sentence above, then the scene, then the layout notes and hard rules>

== STEP 2: generate ==
Use your image generation tool to create exactly ONE image from that PROMPT and save it in the current directory as out.png (landscape 3:2, 1536x1024).

${COMMON_RULES}${yj}

When finished, print only the absolute path of out.png. Do nothing else.`
}

// --hint "…":只对封面 / 题图生效的一句额外约束(如「别再画门」),画面仍由 Codex 读书后自己设计
const HINT = opt('--hint', '')
function instructionCover(bk, banner = false) {
  const first = bk.chapters[0]
  const yj = bk.id === 'yijing' ? '\n- This is the Book of Changes: NEVER draw fortune-telling props (diviner stalls, tube of sticks, bagua mirrors, coins, hexagram diagrams). Use natural imagery (heaven and earth, dragon, water, mountain, thunder…).' : ''
  return `You will create ONE book-cover illustration for a classical Chinese book, in two steps.

== FIXED ART STYLE (identical for every image in this series) ==
${STYLE}

== MATERIAL ==
Book: 《${bk.title}》  Author: ${bk.author}
One-line blurb: ${bk.brief}
First chapter (${first.title}) original, truncated:
${clip(first.original, 600)}
${first.bh ? `First chapter plain-language central idea: ${first.bh.centralIdea}` : ''}
Chapter titles: ${clip(bk.chapters.map((c) => c.title).join('、'), 500)}

== WHAT THIS IMAGE IS ==
${banner ? 'A wide banner for the home-screen card of this book, landscape 3:2 (1536x1024). Complete picture with a clear main subject placed in the right or central part; the lower-left area must stay calm (soft washes only) because the app overlays the book title there in white on a dark gradient. BANNER-ONLY NOTE, ignore the cover sentences that follow:' : ''} A book cover, portrait 2:3 (1024x1536). Complete picture with a clear, definite main subject. The bottom third must be left clean and quiet (paper-colored, only faint washes) because the app will typeset the book title there. Keep the upper two thirds as the picture.

${HINT ? `== EXTRA CONSTRAINT FOR THIS IMAGE (from the art director) ==\n${HINT}\n\n` : ''}== STEP 1: design the picture (English) ==
From the blurb and first chapter, pull out 3-5 of the most representative CONCRETE images of the whole book (things, scenes, metaphors the book actually uses). Pick one or two to make a single memorable, iconic composition — not a generic mood landscape. Write into prompt.txt in the current directory:
IMAGERY: <the 3-5 items>
CHOSEN: <the one or two you picked and why>
PROMPT: <the final English image prompt, beginning with the fixed art style sentence above, then the scene, then layout notes and hard rules>

== STEP 2: generate ==
Use your image generation tool to create exactly ONE image from that PROMPT and save it in the current directory as out.png (${banner ? 'landscape 3:2, 1536x1024' : 'portrait 2:3, 1024x1536'}).

${COMMON_RULES}${yj}

When finished, print only the absolute path of out.png. Do nothing else.`
}

// ---------- 机器检查(python3 + PIL)----------
function py(code, ...a) { return execFileSync('python3', ['-', ...a], { input: code, encoding: 'utf8', maxBuffer: 1 << 26 }) }
function checkImage(file) {
  try {
    const out = py(`
import sys
from PIL import Image, ImageStat
im = Image.open(sys.argv[1]); im.verify()
im = Image.open(sys.argv[1]).convert('L')
w, h = im.size
sd = ImageStat.Stat(im.resize((256, 256))).stddev[0]
print(w, h, round(sd, 2))
`, file).trim().split(' ').map(Number)
    const [w, h, sd] = out
    if (Math.min(w, h) < 1000) return `短边 ${Math.min(w, h)} < 1000`
    if (sd < 6) return `近乎纯色 (std ${sd})`
    return null
  } catch (e) { return '不是合法图片' }
}

// ---------- 调 Codex ----------
function runCodex(instruction) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-art-'))
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
    const timer = setTimeout(() => p.kill('SIGKILL'), 12 * 60 * 1000)
    p.on('close', (code) => {
      clearTimeout(timer)
      const sec = Math.round((Date.now() - t0) / 1000)
      const tok = /tokens used[^\d]*([\d,]+)/i.exec(log)?.[1] || ''
      const png = fs.existsSync(path.join(tmp, 'out.png')) ? 'out.png' : fs.readdirSync(tmp).find((f) => /\.png$/i.test(f))
      resolve({ tmp, code, sec, tokens: tok, png: png && path.join(tmp, png), promptFile: fs.existsSync(path.join(tmp, 'prompt.txt')) ? path.join(tmp, 'prompt.txt') : null, log })
    })
  })
}

async function makeOne(bk, kind, ch, dir, force, timing, failed) {
  const stem = kind === 'cover' ? 'cover' : kind === 'banner' ? 'banner' : `head-${ch.n}`
  const png = path.join(dir, `${stem}.png`), txt = path.join(dir, `${stem}.txt`)
  if (!force && fs.existsSync(png)) return 'skip'
  const instruction = kind === 'cover' ? instructionCover(bk) : kind === 'banner' ? instructionCover(bk, true) : instructionHead(bk, ch)
  let why = '', total = 0, toks = [], r
  for (let attempt = 1; attempt <= 2; attempt++) {
    r = await runCodex(instruction)
    total += r.sec; if (r.tokens) toks.push(r.tokens)
    why = !r.png ? `codex exit ${r.code},无 png:${r.log.slice(-200).replace(/\n/g, ' ')}` : checkImage(r.png)
    if (!why) break
    console.log(`  ! ${stem} 第 ${attempt} 次不过:${why}`)
    if (attempt < 2) fs.rmSync(r.tmp, { recursive: true, force: true })
  }
  const rec = { book: bk.id, stem, sec: total, tokens: toks.join('+'), ok: !why }
  if (!why) {
    fs.copyFileSync(r.png, png)
    if (r.promptFile) fs.copyFileSync(r.promptFile, txt); else fs.writeFileSync(txt, '(Codex 未写 prompt.txt)')
    console.log(`✓ ${bk.id}/${stem} ${total}s tokens=${rec.tokens || '?'}`)
  } else {
    failed[`${bk.id}/${stem}`] = why
    console.log(`✗ ${bk.id}/${stem} ${why}`)
  }
  fs.rmSync(r.tmp, { recursive: true, force: true })
  timing.push(rec)
  return rec.ok ? 'ok' : 'fail'
}

function parseChapters(spec, max) {
  if (!spec) return null
  const s = new Set()
  for (const part of spec.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!m) throw new Error(`--chapters 格式不对:${part}`)
    for (let i = +m[1]; i <= +(m[2] || m[1]); i++) if (i <= max) s.add(i)
  }
  return s
}

function mergeJson(file, update) {
  let cur = {}
  try { cur = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
  fs.writeFileSync(file, JSON.stringify(update(cur), null, 1))
}

// ---------- 样张 / 导出 ----------
if (opt('--contact')) {
  const dir = path.join(CACHE, book)
  const out = py(`
import sys, os, re, glob
from PIL import Image, ImageDraw
d = sys.argv[1]
items = []
if os.path.exists(os.path.join(d, 'cover.png')): items.append(('cover', os.path.join(d, 'cover.png')))
if os.path.exists(os.path.join(d, 'banner.png')): items.append(('banner', os.path.join(d, 'banner.png')))
heads = []
for f in glob.glob(os.path.join(d, 'head-*.png')):
    m = re.search(r'head-(\\d+)\\.png$', f)
    if m: heads.append((int(m.group(1)), f))
for n, f in sorted(heads): items.append((str(n), f))
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
`, dir)
  console.log(out.trim())
  process.exit(0)
}

if (opt('--export')) {
  const dir = path.join(CACHE, book), dest = path.join(EXPORT, book)
  fs.mkdirSync(dest, { recursive: true })
  const out = py(`
import sys, os, glob, re
from PIL import Image
src, dest = sys.argv[1], sys.argv[2]
n = 0
for f in sorted(glob.glob(os.path.join(src, '*.png'))):
    b = os.path.basename(f)[:-4]
    if not (b in ('cover', 'banner') or re.fullmatch(r'head-\\d+', b)): continue
    W = 1024 if b == 'cover' else 1536
    im = Image.open(f).convert('RGB')
    if im.width > W: im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    im.save(os.path.join(dest, b + '.jpg'), quality=82, optimize=True, progressive=True); n += 1
print(n)
`, dir, dest)
  console.log(`导出 ${out.trim()} 张 → ${path.relative(ROOT, dest)}`)
  process.exit(0)
}

// ---------- 主流程 ----------
if (!book) { console.error('用法:node scripts/desk/gen-art.mjs <book> [--kind head|cover|all] [--chapters 1-10,25] [--limit N] [--force] [--concurrency 3]\n书:' + Object.keys(BOOKS).join(' ')); process.exit(1) }
const bk = loadBook(book)
const kind = opt('--kind', 'all')
if (!['head', 'cover', 'banner', 'all'].includes(kind)) { console.error('--kind 须为 head|cover|banner|all'); process.exit(1) }
const conc = Math.max(1, +opt('--concurrency', 3))
const limit = opt('--limit') ? +opt('--limit') : Infinity
const only = parseChapters(opt('--chapters'), bk.chapters.length)
const force = flag('--force')
const dir = path.join(CACHE, book)
fs.mkdirSync(dir, { recursive: true })

const jobs = []
if (kind === 'cover' || kind === 'all') jobs.push({ kind: 'cover' })
if (kind === 'banner' || kind === 'all') jobs.push({ kind: 'banner' })
if (kind === 'head' || kind === 'all') for (const ch of bk.chapters) if (!only || only.has(ch.n)) jobs.push({ kind: 'head', ch })
const todo = []
for (const j of jobs) {
  const stem = j.kind === 'cover' ? 'cover' : j.kind === 'banner' ? 'banner' : `head-${j.ch.n}`
  if (!force && fs.existsSync(path.join(dir, `${stem}.png`))) continue
  if (todo.length < limit) todo.push(j)
}
console.log(`${bk.title}:共 ${jobs.length} 张,待出 ${todo.length} 张,并发 ${conc}`)

const timing = [], failed = {}
let next = 0, ok = 0, fail = 0
await Promise.all(Array.from({ length: conc }, async () => {
  while (next < todo.length) {
    const j = todo[next++]
    const r = await makeOne(bk, j.kind, j.ch, dir, force, timing, failed)
    if (r === 'ok') ok++; else if (r === 'fail') fail++
  }
}))
mergeJson(path.join(dir, 'timing.json'), (cur) => {
  const m = new Map((Array.isArray(cur) ? cur : []).map((x) => [x.stem, x]))
  for (const t of timing) m.set(t.stem, t)
  return [...m.values()]
})
mergeJson(path.join(dir, 'failed.json'), (cur) => {
  const o = { ...cur }
  for (const t of timing) if (t.ok) delete o[`${book}/${t.stem}`]
  return { ...o, ...failed }
})
const avg = timing.length ? Math.round(timing.reduce((s, t) => s + t.sec, 0) / timing.length) : 0
console.log(`完成:成功 ${ok},失败 ${fail},平均 ${avg}s/张`)
