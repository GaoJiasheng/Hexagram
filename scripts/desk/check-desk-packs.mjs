#!/usr/bin/env node
// 观象 · 书桌 —— 内容包的闸:清单里每本书的文件都在、id 不重、随 App 带的正好是首发六本;
// 可选 `--baseline <hashes.txt>`(`shasum *.json` 的输出):逐个核那几个文件字节不变(改打包脚本前先记一份,改完对一遍)。
//   node scripts/build-desk-packs.mjs && node scripts/desk/check-desk-packs.mjs [--baseline <hashes.txt>]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DESK_BOOKS } from './books.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const OUT = path.join(ROOT, 'public/desk/v1')
export const FIRST_SIX = ['daodejing', 'lunyu', 'sunzi', 'guiguzi', 'zhuangzi', 'yijing']

// 返回问题清单(空 = 过)
export function checkManifest(dir = OUT, { strictList = true } = {}) {
  const bad = []
  const mf = path.join(dir, 'manifest.json')
  if (!fs.existsSync(mf)) return [`没有 ${path.relative(ROOT, mf)}(先跑 node scripts/build-desk-packs.mjs)`]
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'))
  const ids = new Set()
  for (const b of m.books) {
    if (ids.has(b.id)) bad.push(`id「${b.id}」重复`)
    ids.add(b.id)
    if (!/^[a-z0-9-]+$/.test(b.id)) bad.push(`id「${b.id}」不合形态`)
    for (const f of [b.file, b.baihua?.file].filter(Boolean)) if (!fs.existsSync(path.join(dir, f))) bad.push(`${b.id}:缺文件 ${f}`)
    if (!b.category) bad.push(`${b.id}:没有 category`)
    else if (!m.categories?.includes(b.category)) bad.push(`${b.id}:门类「${b.category}」不在 categories 里`)
  }
  const bundled = m.books.filter((b) => b.bundled).map((b) => b.id)
  if (bundled.join() !== FIRST_SIX.join()) bad.push(`随 App 带的应是首发六本,清单里是 ${bundled.join(' ')}`)
  const want = DESK_BOOKS.map((b) => b.id)
  if (strictList && m.books.map((b) => b.id).join() !== want.join()) bad.push('清单的书目与 scripts/desk/books.mjs 不一致(书单改了没重新打包?)')
  return bad
}

export function checkBaseline(hashesFile, dir = OUT) {
  const bad = []
  for (const line of fs.readFileSync(hashesFile, 'utf8').split('\n').filter(Boolean)) {
    const [sha, name] = line.trim().split(/\s+/)
    if (name === 'manifest.json') continue      // 清单本来就多了字段
    const f = path.join(dir, name)
    if (!fs.existsSync(f)) { bad.push(`${name}:没有了(内容变了文件名才会变)`); continue }
    const got = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex')
    if (got !== sha) bad.push(`${name}:字节变了`)
  }
  return bad
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const i = process.argv.indexOf('--baseline')
  const bad = [...checkManifest(), ...(i > 0 ? checkBaseline(process.argv[i + 1]) : [])]
  if (bad.length) { console.error(bad.join('\n')); console.error(`✗ ${bad.length} 处`); process.exit(1) }
  console.log(`✓ 书桌内容包:${DESK_BOOKS.length} 本,文件齐、id 不重、随 App 带首发六本` + (i > 0 ? ';基准文件字节不变' : ''))
}
