#!/usr/bin/env node
// 典籍目录页插图(docs/book-page-proposal.md §3):读 scripts/authored/book-art.json,逐条 prompt 调本机 Codex CLI 出图,
// 候选落 scripts/.cache/book-art/<组>-<slug>-<i>.png(原图,带 alpha);`--contact` 把候选铺成一张样张(宣纸底染墨)给人挑;
// `--pick` 把 book-art.json 里 pick 指定的那张只留 alpha、缩到 800² 存成单通道 PNG → public/book-art/<组>/<slug>.png。
// 图一律由 Codex 出(owner 2026-10-07:不自己画),本脚本不含任何绘图逻辑;后处理用 python3 + PIL。
//   node scripts/gen-book-art.mjs                 # 出所有缺的候选
//   node scripts/gen-book-art.mjs dao/daodejing   # 只出这一本
//   node scripts/gen-book-art.mjs --force dao/daodejing   # 重出(覆盖候选)
//   node scripts/gen-book-art.mjs --contact       # 样张 scripts/.cache/book-art/contact.jpg
//   node scripts/gen-book-art.mjs --pick          # 按 pick 落最终图
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'scripts/authored/book-art.json')
const CACHE = path.join(ROOT, 'scripts/.cache/book-art')
const OUT = path.join(ROOT, 'public/book-art')
const SIZE = 800
const MAX_BYTES = 150 * 1024

const args = process.argv.slice(2)
const force = args.includes('--force')
const contact = args.includes('--contact')
const pick = args.includes('--pick')
const only = args.filter((a) => !a.startsWith('--'))

const spec = JSON.parse(fs.readFileSync(SRC, 'utf8'))
const books = Object.entries(spec).filter(([k]) => !k.startsWith('_') && (!only.length || only.includes(k)))
fs.mkdirSync(CACHE, { recursive: true })

function cand(key, i) { return path.join(CACHE, `${key.replace('/', '-')}-${i}.png`) }

function generate(key, i, prompt) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'book-art-'))
  const full = `${spec._style}\n\nSubject: ${prompt}`
  const instruction = `Use your image generation tool to create exactly ONE image and save it in the current directory as out.png. ` +
    `Request a transparent background if the tool supports it. Image prompt (follow it literally):\n\n${full}\n\n` +
    `After saving, print only the absolute path of out.png. Do nothing else.`
  console.log(`▶ ${key} #${i} …`)
  const r = spawnSync('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction], {
    encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
  })
  const png = fs.readdirSync(tmp).find((f) => /\.png$/i.test(f))
  if (r.status !== 0 || !png) {
    console.error(`❌ ${key} #${i} 失败(exit ${r.status})\n${(r.stderr || r.stdout || '').slice(-800)}`)
    return false
  }
  fs.copyFileSync(path.join(tmp, png), cand(key, i))
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`  ✓ ${path.relative(ROOT, cand(key, i))}`)
  return true
}

function py(code, ...argv) {
  return execFileSync('python3', ['-', ...argv], { input: code, encoding: 'utf8' })
}

if (contact) {
  // 样张:每本一行,候选横排,alpha 染 --ink-soft 铺宣纸底,下标写在左上角(用 PIL 默认字体,只写数字)
  const items = []
  for (const [key, b] of books) b.prompts.forEach((_, i) => { if (fs.existsSync(cand(key, i))) items.push([key, i, cand(key, i)]) })
  const out = path.join(CACHE, 'contact.jpg')
  py(`
import sys, json
from PIL import Image, ImageDraw

def mask_of(im):
    # 遮罩 = alpha × 墨色深浅:模型常把淡墨画成「不透明的灰」,只取 alpha 会糊成实心剪影
    from PIL import ImageChops, ImageOps
    im = im.convert('RGBA'); a = im.getchannel('A'); l = ImageOps.grayscale(im)
    return ImageChops.multiply(a, ImageOps.invert(l))
items = json.loads(sys.argv[1]); out = sys.argv[2]
T = 360; rows = {}
for key, i, p in items: rows.setdefault(key, []).append((i, p))
W = T * max(len(v) for v in rows.values()); H = T * len(rows)
sheet = Image.new('RGB', (W, H), (0xfa, 0xf6, 0xec)); d = ImageDraw.Draw(sheet)
for r, (key, cands) in enumerate(rows.items()):
    for c, (i, p) in enumerate(cands):
        a = mask_of(Image.open(p)).resize((T, T), Image.LANCZOS)
        fg = Image.new('RGBA', (T, T), (0x6b, 0x61, 0x57, 255)); fg.putalpha(a)
        tile = Image.alpha_composite(Image.new('RGBA', (T, T), (0xfa, 0xf6, 0xec, 255)), fg).convert('RGB')
        sheet.paste(tile, (c * T, r * T)); d.rectangle([c*T, r*T, c*T+T-1, r*T+T-1], outline=(200,190,170))
        d.text((c*T+8, r*T+6), f"{key} #{i}", fill=(0xc3,0x27,0x2b))
sheet.save(out, quality=88); print(out)
`, JSON.stringify(items), out)
  console.log(`样张 → ${path.relative(ROOT, out)}`)
  process.exit(0)
}

if (pick) {
  for (const [key, b] of books) {
    if (b.pick == null) { console.log(`· ${key} 未指定 pick,跳过`); continue }
    const src = cand(key, b.pick)
    if (!fs.existsSync(src)) { console.error(`❌ ${key} 候选 #${b.pick} 不存在`); process.exitCode = 1; continue }
    const [corpus, slug] = key.split('/')
    const dest = path.join(OUT, corpus, `${slug}.png`)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    // 只留 alpha,整幅等比缩到 SIZE(不裁边——构图里的留白就是版面要的),alpha 量化到 32 级压体积
    const info = py(`
import sys
from PIL import Image

def mask_of(im):
    # 遮罩 = alpha × 墨色深浅:模型常把淡墨画成「不透明的灰」,只取 alpha 会糊成实心剪影
    from PIL import ImageChops, ImageOps
    im = im.convert('RGBA'); a = im.getchannel('A'); l = ImageOps.grayscale(im)
    return ImageChops.multiply(a, ImageOps.invert(l))
src, dest, S = sys.argv[1], sys.argv[2], int(sys.argv[3])
a = mask_of(Image.open(src)).resize((S, S), Image.LANCZOS)
a = a.point(lambda v: (v // 8) * 8)
# 存成「灰 + alpha」(墨色全黑、浓淡进 alpha):CSS mask-image 默认按 alpha 取遮罩,纯灰度 PNG 没有 alpha 会整块实心
Image.merge('LA', (Image.new('L', a.size, 0), a)).save(dest, optimize=True)
import os; print(os.path.getsize(dest))
`, src, dest, String(SIZE))
    const bytes = Number(info.trim())
    console.log(`${bytes <= MAX_BYTES ? '✓' : '⚠'} ${path.relative(ROOT, dest)} ${(bytes / 1024).toFixed(0)} KB${bytes > MAX_BYTES ? '(超 150 KB)' : ''}`)
  }
  process.exit(0)
}

let fail = 0
for (const [key, b] of books) {
  b.prompts.forEach((prompt, i) => {
    if (!force && fs.existsSync(cand(key, i))) { console.log(`· ${key} #${i} 已有,跳过`); return }
    if (!generate(key, i, prompt)) fail++
  })
}
console.log(fail ? `完成,${fail} 张失败` : '完成')
process.exitCode = fail ? 1 : 0
