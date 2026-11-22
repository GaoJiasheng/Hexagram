#!/usr/bin/env node
// 观象 · 书桌 —— 画风样张(M0)。四种带颜色的画风 × 两个《道德经》题材,调本机 Codex CLI 出图,
// 落 scripts/.cache/desk-art/samples/<画风>-<题材>.png,并记每张耗时(用来排后面的批次)。
// 图一律由 Codex 出(owner 2026-10-07),本脚本不含绘图逻辑。并发 3。
//   node scripts/desk/art-samples.mjs            # 出缺的
//   node scripts/desk/art-samples.mjs --contact  # 拼样张 contact.jpg
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'scripts/.cache/desk-art/samples')
fs.mkdirSync(OUT, { recursive: true })

const COMMON = 'No text, no Chinese characters, no letters, no seal stamp, no signature, no border or frame. No human faces (figures, if any, are tiny and seen from behind or far away). Not childish, not cartoonish, not cute; calm, refined, for adult readers. Landscape 3:2, 1536x1024. Full-bleed composition with generous empty space on one side so a title can be overlaid later.'
const STYLES = {
  danmo: 'Chinese ink-wash painting with light translucent color washes (淡彩水墨): soft ink lines and wet brush gradients, tinted with pale mineral blue-green, warm ochre and a touch of cinnabar; warm off-white rice-paper ground; airy, luminous, lots of breathing space.',
  qinglu: 'Decorative Chinese blue-green landscape style (青绿重彩) reinterpreted in a modern way: flat layered mineral pigments — azurite blue, malachite green, warm earth, sparse fine gold outlines; crisp shapes, rhythmic patterns of mountains, water and clouds; rich but harmonious color on a warm ivory ground.',
  bianping: 'Contemporary editorial illustration: simplified geometric shapes, soft gradients and subtle paper grain, a limited warm palette (terracotta, mustard, sage green, deep teal, cream); elegant and light, inspired by East Asian composition and negative space; modern book-cover feel.',
  muke: 'Chinese color woodblock print (水印套色木刻): bold carved shapes with visible wood-grain and slightly imperfect registration, 3 to 4 spot colors (indigo, vermilion, ochre, pale green) on cream paper; strong silhouettes, handmade warmth.',
}
const SUBJECTS = {
  book: 'Cover art for the Dao De Jing as a whole: a wide quiet valley with a river winding out of mist toward the distance, a single uncarved block of wood resting on the near bank, a few birds far away.',
  ch8: 'Chapter 8 of the Dao De Jing, "the highest good is like water": water flowing down a stepped hillside, pooling in the lowest hollow, nourishing reeds, moss and a small field without contending; everything else stands still while the water quietly moves.',
}

function run(style, subject) {
  const file = path.join(OUT, `${style}-${subject}.png`)
  if (fs.existsSync(file)) return Promise.resolve(null)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-art-'))
  const prompt = `${STYLES[style]}\n\nSubject: ${SUBJECTS[subject]}\n\n${COMMON}`
  const instruction = 'Use your image generation tool to create exactly ONE image and save it in the current directory as out.png. ' +
    `Image prompt (follow it literally):\n\n${prompt}\n\nAfter saving, print only the absolute path of out.png. Do nothing else.`
  const t0 = Date.now()
  return new Promise((resolve) => {
    const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction], { stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
    const timer = setTimeout(() => p.kill('SIGKILL'), 12 * 60 * 1000)
    p.on('close', (code) => {
      clearTimeout(timer)
      const png = fs.readdirSync(tmp).find((f) => /\.png$/i.test(f))
      const sec = Math.round((Date.now() - t0) / 1000)
      if (code === 0 && png) { fs.copyFileSync(path.join(tmp, png), file); console.log(`✓ ${style}-${subject} ${sec}s`) }
      else console.log(`✗ ${style}-${subject} exit ${code} ${sec}s ${log.slice(-300).replace(/\n/g, ' ')}`)
      const tok = /tokens used[^\d]*([\d,]+)/i.exec(log)?.[1] || ''
      fs.rmSync(tmp, { recursive: true, force: true })
      resolve({ style, subject, sec, ok: code === 0 && !!png, tokens: tok })
    })
  })
}

if (process.argv.includes('--contact')) {
  execFileSync('python3', ['-', OUT, ...Object.keys(STYLES), '--', ...Object.keys(SUBJECTS)], { stdio: ['pipe', 'inherit', 'inherit'], input: `
import sys, os
from PIL import Image
out = sys.argv[1]; i = sys.argv.index('--'); styles = sys.argv[2:i]; subs = sys.argv[i+1:]
W, H, G = 768, 512, 16
sheet = Image.new('RGB', (len(subs)*(W+G)+G, len(styles)*(H+G)+G), (245, 241, 233))
for r, s in enumerate(styles):
    for c, b in enumerate(subs):
        f = os.path.join(out, f'{s}-{b}.png')
        if os.path.exists(f):
            im = Image.open(f).convert('RGB'); im.thumbnail((W, H)); sheet.paste(im, (G + c*(W+G), G + r*(H+G)))
sheet.save(os.path.join(out, 'contact.jpg'), quality=88)
print(os.path.join(out, 'contact.jpg'))
` })
  process.exit(0)
}

const jobs = []
for (const s of Object.keys(STYLES)) for (const b of Object.keys(SUBJECTS)) jobs.push([s, b])
const results = []
let i = 0
await Promise.all(Array.from({ length: 3 }, async () => {
  while (i < jobs.length) { const [s, b] = jobs[i++]; const r = await run(s, b); if (r) results.push(r) }
}))
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(results, null, 1))
console.log('done', results.filter((r) => r.ok).length, '/', results.length)
