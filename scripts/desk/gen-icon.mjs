#!/usr/bin/env node
// 观象 · 书桌 —— App 图标候选(本机 Codex CLI 出图;每个方向一张,owner 挑)。
//   node scripts/desk/gen-icon.mjs [--only a,b] → scripts/.cache/desk-art/icon/<方向>.png(1024×1024)+ <方向>.txt(Codex 写的 prompt)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.join(ROOT, 'scripts/.cache/desk-art/icon')
const only = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1].split(',') : null })()

const STYLE = 'Chinese ink-wash painting with light translucent color washes (淡彩水墨): soft ink lines and wet brush gradients, tinted with pale mineral blue-green, warm ochre and a touch of cinnabar; warm off-white rice-paper ground.'
// 方向只给母题,构图与细节由 Codex 自己设计
const DIRECTIONS = {
  desk: 'A low wooden scholar\'s desk seen slightly from above with ONE open bamboo-slip scroll on it and a small oil lamp — "the study desk" itself is the subject.',
  scroll: 'ONE half-unrolled bamboo-slip scroll, large, filling most of the square, lying diagonally; nothing else except a soft wash behind it.',
  lamp: 'A single small bronze oil lamp with a warm flame, large and centred, its glow falling on the corner of an open bamboo-slip scroll.',
  brush: 'An inkstone with a brush resting across it beside the edge of a bamboo-slip scroll — the tools of someone studying, seen from above.',
}

const instruction = (dir) => `You will create ONE iOS app icon illustration, in two steps.

== WHAT THE APP IS ==
「观象 · 书桌」 ("the study desk"): a quiet iPhone / iPad app for studying a few Chinese classics deeply — the reader keeps only the books being studied on the desk. Mood: calm, warm, a little lively, not solemn, not childish.

== ART STYLE (same as the app's illustrations) ==
${STYLE}

== MOTIF FOR THIS CANDIDATE ==
${dir}

== ICON RULES (hard) ==
- Square 1024x1024, the picture fills the whole square edge to edge (iOS rounds the corners itself): NO rounded-corner frame, NO border, NO drop shadow around a tile, NO transparent areas.
- ONE bold, simple subject that still reads clearly when the icon is shown 60 pixels wide: large shapes, strong silhouette, few details, generous margin around the subject (keep it inside the central 70%).
- A warm paper-coloured ground with at most one soft colour wash; slightly richer colour than a book illustration so it stands out on a home screen.
- Absolutely NO text, letters, Chinese characters, seals, signatures or numbers. No people, no faces. Ancient Chinese objects only (no Western books, no modern objects).

== STEP 1 ==
Write prompt.txt in the current directory: one paragraph, the final English image prompt, beginning with the art style sentence, then the subject and composition, then the hard rules.

== STEP 2 ==
Use your image generation tool to create exactly ONE image from that prompt and save it in the current directory as out.png (square, 1024x1024).`

const run = (key, dir) => new Promise((resolve) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-icon-'))
  const p = spawn('codex', ['exec', '--skip-git-repo-check', '-C', tmp, '-s', 'workspace-write', instruction(dir)], { stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  p.stdout.on('data', (d) => { log += d }); p.stderr.on('data', (d) => { log += d })
  const timer = setTimeout(() => p.kill('SIGKILL'), 10 * 60 * 1000)
  p.on('close', (code) => {
    clearTimeout(timer)
    const png = fs.existsSync(path.join(tmp, 'out.png')) ? 'out.png' : fs.readdirSync(tmp).find((f) => /\.png$/i.test(f))
    if (png) {
      fs.copyFileSync(path.join(tmp, png), path.join(OUT, `${key}.png`))
      if (fs.existsSync(path.join(tmp, 'prompt.txt'))) fs.copyFileSync(path.join(tmp, 'prompt.txt'), path.join(OUT, `${key}.txt`))
      console.log(`✓ ${key} tokens=${/tokens used[^\d]*([\d,]+)/i.exec(log)?.[1] || '?'}`)
    } else console.log(`✗ ${key} codex exit ${code}: ${log.slice(-200).replace(/\n/g, ' ')}`)
    fs.rmSync(tmp, { recursive: true, force: true })
    resolve()
  })
})

fs.mkdirSync(OUT, { recursive: true })
await Promise.all(Object.entries(DIRECTIONS).filter(([k]) => !only || only.includes(k)).map(([k, d]) => run(k, d)))
