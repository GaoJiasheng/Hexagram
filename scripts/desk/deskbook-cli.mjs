// 观象 · 书桌 —— 书包命令行(标准 docs/deskbook-standard.md §7)。
// 这是 Node 一侧的外壳;核心逻辑在 deskbook-core.mjs。scripts/desk/build-deskbook-cli.mjs 把二者内联成
// 单文件 public/desk/standard/deskbook.mjs(无依赖,Node 18+)。在本仓库里也可以直接 `node scripts/desk/deskbook-cli.mjs …`。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { validate, unzip, zip, summarize, formatIssue, readMp4Info, readImageInfo, checkPath, chapterFile, LIMITS, KINDS, CORE_VERSION, FORMAT_VERSION } from './deskbook-core.mjs' // @inline-core

const HELP = `deskbook.mjs ${CORE_VERSION} —— 观象 · 书桌 书包(.deskbook)工具,标准 v${FORMAT_VERSION}

用法:
  node deskbook.mjs init <目录> --kind book|classic|collection --title "书名" [--name 英文短名]
  node deskbook.mjs validate <目录 | 书包>
  node deskbook.mjs pack <目录> [-o 书名.deskbook]
  node deskbook.mjs unpack <书包> [-o 目录]
  node deskbook.mjs gif2mp4 <a.gif> [-o media/a.mp4]      (需本机有 ffmpeg)

通用选项:
  --json     机器可读输出
  -h, --help 本帮助

校验有错误时退出码为 1;校验不过不打包。标准与说明:https://hexa.gavin.pub/desk/standard/`

// ───────── 参数 ─────────

function parseArgs(argv) {
  const pos = []
  const opt = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-o' || a === '--out') opt.out = argv[++i]
    else if (a === '-h' || a === '--help') opt.help = true
    else if (a === '--json') opt.json = true
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      opt[k] = v !== undefined ? v : (argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true)
    } else pos.push(a)
  }
  return { pos, opt }
}

class CliError extends Error {}
const fail = (msg) => { throw new CliError(msg) }

// ───────── 读目录 / 读书包 ─────────

// 读一个书包目录成 Map。隐藏文件(.DS_Store 之类)跳过并记一条提示,不进包
export function readDir(dir) {
  const files = new Map()
  const skipped = []
  const walk = (abs, rel) => {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.name.startsWith('.')) { skipped.push(r); continue }
      const p = path.join(abs, ent.name)
      if (ent.isSymbolicLink()) { skipped.push(r + '(符号链接)'); continue }
      if (ent.isDirectory()) walk(p, r)
      else if (ent.isFile()) files.set(r, new Uint8Array(fs.readFileSync(p)))
    }
  }
  walk(dir, '')
  return { files, skipped }
}

export async function loadPackage(p) {
  if (!fs.existsSync(p)) fail(`找不到「${p}」`)
  if (fs.statSync(p).isDirectory()) return { ...readDir(p), from: 'dir' }
  const bytes = new Uint8Array(fs.readFileSync(p))
  return { files: await unzip(bytes), skipped: [], from: 'zip' }
}

// ───────── 输出 ─────────

const kb = (n) => (n === 0 ? '0 KB' : n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function report(r, skipped, out) {
  for (const s of skipped) out.push(`提示  跳过隐藏文件 ${s}(不进包)`)
  for (const e of r.errors) out.push(`错误  ${formatIssue(e)}`)
  for (const w of r.warnings) out.push(`提示  ${formatIssue(w)}`)
  const s = summarize(r)
  if (r.book) out.push(`—— 《${s.title ?? '?'}》 ${s.kind ?? '?'} · ${s.chapters} ${r.book.unit || '章'} · ${s.chars} 字${s.articleChars !== undefined ? `(另有深读 ${s.articleChars} 字)` : ''} · 媒体 ${s.mediaFiles} 个 ${kb(s.mediaBytes)} · 共 ${kb(s.totalBytes)}`)
  out.push(r.ok ? `校验通过${r.warnings.length ? `(${r.warnings.length} 条提示)` : ''}。` : `校验不通过:${r.errors.length} 个错误${r.errors.length >= LIMITS.maxReported ? '(只列前 ' + LIMITS.maxReported + ' 个)' : ''}。`)
}

// ───────── 命令 ─────────

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

function skeleton(kind, title, id) {
  const unit = kind === 'collection' ? '篇' : '章'
  const book = {
    format: 'deskbook', version: 1, id, revision: 1, kind, title,
    authors: [], lang: 'zh-Hans',
    summary: '一句话说这本书讲什么(不超过 60 字)',
    source: kind === 'classic' ? { type: 'public-domain', note: '底本:请写明所用底本与出处' } : { type: 'original' },
    unit,
    chapters: [{ no: 1, file: chapterFile(1), title: kind === 'collection' ? '第一篇' : '第一章', ...(kind === 'collection' ? { author: '作者', date: new Date().toISOString().slice(0, 10) } : {}) }],
    generator: `deskbook.mjs ${CORE_VERSION}`,
  }
  const ch = { no: 1, title: book.chapters[0].title }
  if (kind === 'classic') {
    ch.segs = [{ o: '原文第一段,照底本一字不改。', t: '译文(可无)。' }]
    ch.article = { blocks: [{ t: 'p', x: '章末的深读文章(可无;有则至少一段)。' }] }
  } else {
    ch.article = { idea: '这一章的一句话中心(可无)', blocks: [{ t: 'lead', x: '导语:先说结论。' }, { t: 'p', x: '正文从这里写起。' }] }
  }
  return { book, ch }
}

async function cmdInit(pos, opt, out) {
  const dir = pos[0] || fail('缺目录:deskbook.mjs init <目录> --kind book --title "书名"')
  const kind = opt.kind || 'book'
  if (!KINDS.includes(kind)) fail(`--kind 应为 ${KINDS.join(' / ')}`)
  const title = typeof opt.title === 'string' && opt.title.trim() ? opt.title.trim() : fail('缺 --title "书名"')
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) fail(`「${dir}」已存在且不空,换个目录`)
  const name = slugify(opt.name || title) || slugify(path.basename(path.resolve(dir))) || 'book'
  const id = typeof opt.id === 'string' ? opt.id : `u-${name}-${crypto.randomBytes(4).toString('hex')}`
  const { book, ch } = skeleton(kind, title, id)
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true })
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify(book, null, 2) + '\n')
  fs.writeFileSync(path.join(dir, chapterFile(1)), JSON.stringify(ch, null, 2) + '\n')
  out.push(`已起骨架:${dir}/(id ${id})`, '  book.json            书目清单', `  ${chapterFile(1)}    第一章`, '  media/               图片、视频放这里',
    '下一步:改 book.json 的 summary 等字段,写章文件,然后 `node deskbook.mjs validate ' + dir + '`。')
  return { ok: true, dir, id }
}

async function cmdValidate(pos, opt, out) {
  const p = pos[0] || fail('缺参数:deskbook.mjs validate <目录 | 书包>')
  let pkg
  try { pkg = await loadPackage(p) } catch (e) {
    if (e instanceof CliError) throw e
    const r = { ok: false, errors: [{ file: path.basename(p), where: '', msg: e.message }], warnings: [], book: null, stats: {} }
    report(r, [], out)
    return { ...r, summary: summarize(r) }
  }
  const r = validate(pkg.files)
  report(r, pkg.skipped, out)
  return { ok: r.ok, errors: r.errors, warnings: r.warnings, skipped: pkg.skipped, summary: summarize(r) }
}

async function cmdPack(pos, opt, out) {
  const dir = pos[0] || fail('缺目录:deskbook.mjs pack <目录> [-o 书名.deskbook]')
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`「${dir}」不是目录`)
  const { files, skipped } = readDir(dir)
  const r = validate(files)
  report(r, skipped, out)
  if (!r.ok) { out.push('校验不过,没有打包。'); return { ok: false, errors: r.errors, warnings: r.warnings } }
  const dest = opt.out || `${path.resolve(dir).replace(/[\\/]+$/, '')}.deskbook`
  const bytes = await zip(files)
  fs.mkdirSync(path.dirname(path.resolve(dest)), { recursive: true })
  fs.writeFileSync(dest, bytes)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
  out.push(`已打包:${dest}(${kb(bytes.length)},sha256 ${sha256.slice(0, 16)}…)`)
  return { ok: true, file: dest, bytes: bytes.length, sha256, warnings: r.warnings, summary: summarize(r) }
}

async function cmdUnpack(pos, opt, out) {
  const file = pos[0] || fail('缺参数:deskbook.mjs unpack <书包> [-o 目录]')
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`找不到书包「${file}」`)
  const dest = path.resolve(opt.out || path.basename(file).replace(/\.deskbook$|\.zip$/i, '') || 'book')
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) fail(`「${dest}」已存在且不空`)
  const files = await unzip(new Uint8Array(fs.readFileSync(file)))
  for (const [rel, data] of files) {
    const abs = path.resolve(dest, rel)
    if (!abs.startsWith(dest + path.sep)) fail(`「${rel}」会写到目录外,拒绝`) // unzip 已按路径规则拒过,这里再兜一层
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, data)
  }
  out.push(`已解开 ${files.size} 个文件到 ${dest}/`)
  return { ok: true, dir: dest, files: files.size }
}

function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-version'], { encoding: 'utf8' })
  return r.status === 0
}

async function cmdGif2mp4(pos, opt, out) {
  const gif = pos[0] || fail('缺参数:deskbook.mjs gif2mp4 <a.gif> [-o media/a.mp4]')
  if (!fs.existsSync(gif)) fail(`找不到「${gif}」`)
  if (!hasFfmpeg()) fail('本机没有 ffmpeg:macOS 用 `brew install ffmpeg`,Debian/Ubuntu 用 `apt install ffmpeg`')
  const base = slugify(path.basename(gif).replace(/\.[^.]+$/, '')) || 'clip'
  const mp4 = opt.out || path.join(path.dirname(gif), `${base}.mp4`)
  if (!/\.mp4$/.test(mp4)) fail('-o 须以 .mp4 结尾')
  const mbase = path.basename(mp4)
  if (checkPath(mbase)) fail(`输出文件名「${mbase}」不合书包路径规则:只许小写字母、数字、- _ .`)
  const poster = mp4.replace(/\.mp4$/, '-poster.jpg')
  fs.mkdirSync(path.dirname(path.resolve(mp4)), { recursive: true })
  const L = LIMITS.videoLongSide
  const run = (args) => {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
    if (r.status !== 0) fail(`ffmpeg 出错:${(r.stderr || '').trim().slice(-600)}`)
  }
  run(['-i', gif, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', '-tag:v', 'avc1',
    '-vf', `scale=w='min(${L},iw)':h='min(${L},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1`, mp4])
  run(['-i', mp4, '-frames:v', '1', '-q:v', '3', poster])
  const info = readMp4Info(new Uint8Array(fs.readFileSync(mp4)))
  const pinfo = readImageInfo(new Uint8Array(fs.readFileSync(poster)))
  if (info.sec != null && info.sec > LIMITS.videoSeconds) {
    fs.rmSync(mp4); fs.rmSync(poster)
    fail(`转出的视频 ${info.sec} 秒,超过 ${LIMITS.videoSeconds} 秒上限:先把动图剪短`)
  }
  const rel = (p) => { const s = path.resolve(p).split(path.sep).join('/'); const i = s.lastIndexOf('/media/'); return i >= 0 ? s.slice(i + 1) : `media/${path.basename(p)}` }
  const block = { t: 'video', src: rel(mp4), poster: rel(poster), w: info.w, h: info.h, sec: info.sec, loop: true }
  const gifBytes = fs.statSync(gif).size, mp4Bytes = fs.statSync(mp4).size
  out.push(`已转:${mp4}(${kb(mp4Bytes)},原 GIF ${kb(gifBytes)})· 封面 ${poster}(${pinfo.w}×${pinfo.h})`)
  if (!/\/media\//.test(path.resolve(mp4).split(path.sep).join('/'))) out.push('提示:视频与封面要放进书包的 media/ 目录。')
  out.push('把下面这一块贴进章文件的 article.blocks(cap 自己补一句):', JSON.stringify(block))
  return { ok: true, block, mp4, poster, bytes: mp4Bytes, gifBytes }
}

const COMMANDS = { init: cmdInit, validate: cmdValidate, pack: cmdPack, unpack: cmdUnpack, gif2mp4: cmdGif2mp4 }

export async function main(argv) {
  const [cmd, ...rest] = argv
  const { pos, opt } = parseArgs(rest)
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') { console.log(HELP); return 0 }
  if (cmd === '--version' || cmd === 'version') { console.log(CORE_VERSION); return 0 }
  const fn = COMMANDS[cmd]
  if (!fn) { console.error(`不认识的命令「${cmd}」\n\n${HELP}`); return 2 }
  if (opt.help) { console.log(HELP); return 0 }
  const out = []
  let res
  try { res = await fn(pos, opt, out) } catch (e) {
    const msg = e instanceof CliError ? e.message : `${e?.name === 'ZipError' ? '' : '出错:'}${e?.message || e}`
    if (opt.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
    else console.error(msg)
    return 1
  }
  if (opt.json) console.log(JSON.stringify(res, null, 2))
  else for (const line of out) (/^错误/.test(line) ? console.error : console.log)(line)
  return res.ok ? 0 : 1
}

const self = (() => { try { return pathToFileURL(fs.realpathSync(process.argv[1])).href } catch { return '' } })()
if (import.meta.url === self) main(process.argv.slice(2)).then((code) => { process.exitCode = code })
