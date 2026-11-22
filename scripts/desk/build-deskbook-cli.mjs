// 观象 · 书桌 —— 重出 public/desk/standard/ 下的全部公开物(npm run desk:standard):
//   deskbook.mjs              单文件命令行(deskbook-core.mjs + deskbook-cli.mjs 内联,无依赖)
//   schema/{book,chapter,fig}.json   结构定义(源在 scripts/desk/deskbook-schema/)
//   samples/<名>.deskbook      四个示例书包(源在 scripts/desk/deskbook-samples/<名>/,先校验再打包)
//   deskbook-skill.zip        做书用的 Claude Code skill(源在 skills/deskbook/,本脚本先把标准、CLI、schema、示例同步进去)
//   index.html / index.json   公开页与下载清单(App 据 index.json 显示要下载什么)
// 全程确定性:同样的源,出同样的字节。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validate, zip, summarize, formatIssue, CORE_VERSION, FORMAT_VERSION, LIMITS } from './deskbook-core.mjs'
import { readDir } from './deskbook-cli.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const R = (...p) => path.join(ROOT, ...p)
const OUT = R('public/desk/standard')
const SKILL = R('skills/deskbook')
const SAMPLES = ['sample-book', 'sample-collection', 'sample-classic', 'sample-fitness']
const SKILL_EXAMPLES = ['sample-book', 'sample-classic']
const SITE = 'https://hexa.gavin.pub/desk/standard/'

const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data) }
const copyDir = (src, dst) => {
  fs.rmSync(dst, { recursive: true, force: true })
  for (const [rel, data] of readDir(src).files) write(path.join(dst, rel), data)
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')

// ── 1. 单文件命令行 ──
function buildCli() {
  const core = fs.readFileSync(R('scripts/desk/deskbook-core.mjs'), 'utf8')
  const cli = fs.readFileSync(R('scripts/desk/deskbook-cli.mjs'), 'utf8')
  const lines = cli.split('\n')
  const at = lines.findIndex((l) => l.includes('// @inline-core'))
  if (at < 0) throw new Error('deskbook-cli.mjs 里找不到 // @inline-core 那一行')
  const head = [
    '#!/usr/bin/env node',
    `// deskbook.mjs ${CORE_VERSION} —— 观象 · 书桌 书包(.deskbook)工具,标准 v${FORMAT_VERSION}。单文件、无依赖,Node 18+。`,
    `// 说明与标准:${SITE}`,
    '// 本文件由 scripts/desk/build-deskbook-cli.mjs 从 deskbook-core.mjs + deskbook-cli.mjs 生成,勿手改。',
    '',
  ]
  const body = [
    ...lines.slice(0, at),
    '// ═══════════════════ 核心库(deskbook-core.mjs,原样内联) ═══════════════════',
    core.trimEnd(),
    '// ═══════════════════ 命令行(deskbook-cli.mjs) ═══════════════════',
    ...lines.slice(at + 1),
  ]
  const text = head.join('\n') + body.join('\n')
  write(path.join(OUT, 'deskbook.mjs'), text)
  fs.chmodSync(path.join(OUT, 'deskbook.mjs'), 0o755)
  return text
}

// ── 2. 标准正文(附 fig 字段) ──
function buildStandard() {
  // 标准原文末尾的「附录 A」只是一句占位,这里换成从 desk-baihua-spec §2 摘出的全文
  const full = fs.readFileSync(R('docs/deskbook-standard.md'), 'utf8')
  const cut = full.indexOf('## 附录 A')
  if (cut < 0) throw new Error('docs/deskbook-standard.md 里找不到「## 附录 A」')
  const std = full.slice(0, cut).trimEnd()
  const spec = fs.readFileSync(R('docs/desk-baihua-spec.md'), 'utf8')
  const a = spec.indexOf('### 公共字段')
  const b = spec.indexOf('### 闸')
  if (a < 0 || b < 0) throw new Error('desk-baihua-spec.md §2 的结构变了:找不到「### 公共字段」或「### 闸」')
  const appendix = [
    '',
    '## 附录 A · 图解 fig 的字段',
    '',
    '> 摘自 `docs/desk-baihua-spec.md` §2(书桌白话图解的格式,本标准的 `fig` 块原样沿用;机器可读版见 `schema/fig.json`)。',
    '> 那份说明写的是「把站内的 SVG 图转成结构化数据」,文中的「原图」指转换的来源图;自己做书时,理解成「你想画的那张图」即可。',
    '> 书包里不放 SVG;那边「与 SVG 字字相等」的闸不适用于书包,其余两条(结构合法、单个字符串 ≤ 120 字)由校验器照核。',
    '',
    spec.slice(a, b).trimEnd(),
  ].join('\n')
  const banner = '<!-- 本文件由 scripts/desk/build-deskbook-cli.mjs 从 docs/deskbook-standard.md(附 docs/desk-baihua-spec.md §2)生成,勿手改。 -->\n'
  return { md: std + '\n' + appendix + '\n', banner }
}

// ── 3. 示例书包 ──
async function buildSamples() {
  const out = []
  for (const name of SAMPLES) {
    const { files, skipped } = readDir(R('scripts/desk/deskbook-samples', name))
    if (skipped.length) console.log(`  ${name}:跳过隐藏文件 ${skipped.join(' ')}`)
    const r = validate(files)
    if (!r.ok) throw new Error(`示例 ${name} 校验不过:\n` + r.errors.map((e) => '  ' + formatIssue(e)).join('\n'))
    if (r.warnings.length) throw new Error(`示例 ${name} 有提示(示例须零提示):\n` + r.warnings.map((e) => '  ' + formatIssue(e)).join('\n'))
    const bytes = await zip(files)
    write(path.join(OUT, 'samples', `${name}.deskbook`), bytes)
    out.push({ name, bytes: bytes.length, summary: summarize(r) })
  }
  return out
}

// ── 4. skill ──
async function buildSkill(cliText, standardMd) {
  if (!fs.existsSync(path.join(SKILL, 'SKILL.md'))) throw new Error('缺 skills/deskbook/SKILL.md')
  write(path.join(SKILL, 'standard.md'), standardMd)
  write(path.join(SKILL, 'deskbook.mjs'), cliText)
  fs.chmodSync(path.join(SKILL, 'deskbook.mjs'), 0o755)
  copyDir(R('scripts/desk/deskbook-schema'), path.join(SKILL, 'schema'))
  fs.rmSync(path.join(SKILL, 'examples'), { recursive: true, force: true })
  for (const ex of SKILL_EXAMPLES) copyDir(R('scripts/desk/deskbook-samples', ex), path.join(SKILL, 'examples', ex))
  const files = new Map()
  for (const [rel, data] of readDir(SKILL).files) files.set(`deskbook/${rel}`, data)
  const bytes = await zip(files)
  write(path.join(OUT, 'deskbook-skill.zip'), bytes)
  return { files: files.size, bytes: bytes.length }
}

// ── 5. 公开页 ──
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function inlineMd(s) {
  const codes = []
  let t = s.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  t = esc(t)
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`)
}
function mdToHtml(md) {
  const lines = md.split('\n')
  const out = []
  const toc = []
  let i = 0
  const para = []
  const flush = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(''))}</p>`); para.length = 0 } }
  while (i < lines.length) {
    const l = lines[i]
    if (/^<!--/.test(l)) { i++; continue }
    if (/^```/.test(l)) {
      flush()
      const buf = []
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) buf.push(lines[i])
      i++
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`)
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l)
    if (h) {
      flush()
      const n = h[1].length
      const id = `s${toc.length + 1}`
      if (n === 2) toc.push({ id, text: h[2] })
      out.push(`<h${n}${n === 2 ? ` id="${id}"` : ''}>${inlineMd(h[2])}</h${n}>`)
      i++; continue
    }
    if (/^\|/.test(l)) {
      flush()
      const rows = []
      for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i])
      const cells = (r) => r.replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inlineMd(c.trim()))
      const body = rows.filter((r, k) => k !== 1 || !/^\|[\s:|-]+\|$/.test(r))
      out.push('<div class="tbl"><table><thead><tr>' + cells(body[0]).map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
        + body.slice(1).map((r) => '<tr>' + cells(r).map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>')
      continue
    }
    if (/^>\s?/.test(l)) {
      flush()
      const buf = []
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) buf.push(inlineMd(lines[i].replace(/^>\s?/, '')))
      out.push(`<blockquote>${buf.map((x) => `<p>${x}</p>`).join('')}</blockquote>`)
      continue
    }
    const li = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(l)
    if (li) {
      flush()
      const ordered = /\d/.test(li[2])
      const items = []
      for (; i < lines.length; i++) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i])
        if (m) items.push(m[3])
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) items[items.length - 1] += lines[i].trim()
        else break
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inlineMd(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }
    if (!l.trim()) { flush(); i++; continue }
    para.push(l.trim())
    i++
  }
  flush()
  return { html: out.join('\n'), toc }
}

function buildIndexHtml(standardMd, downloads) {
  const { html, toc } = mdToHtml(standardMd.replace(/^# .*\n/, ''))
  const dl = downloads.map((d) => `<li><a href="${d.href}" download>${esc(d.label)}</a><span class="sz">${d.size}</span><div class="note">${esc(d.note)}</div></li>`).join('\n')
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>书包格式标准</title>
<meta name="description" content="观象 · 书桌的书包格式(.deskbook)标准 v${FORMAT_VERSION}:结构、校验器、做书用的 skill 与示例。">
<style>
:root { --paper:#f7f5ee; --ink:#26292c; --soft:#6b6a66; --line:#dcd8cc; --accent:#2e7d86; --code:#efece2; }
@media (prefers-color-scheme: dark) { :root { --paper:#1b1c1d; --ink:#e6e3da; --soft:#a19f98; --line:#3a3b3c; --accent:#6fb7bf; --code:#262729; } }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin:0; background:var(--paper); color:var(--ink); font: 17px/1.75 -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 80px; }
h1 { font-size: 30px; line-height:1.3; margin: 8px 0 4px; letter-spacing: .02em; }
.sub { color: var(--soft); margin: 0 0 28px; }
h2 { font-size: 22px; margin: 44px 0 12px; padding-top: 8px; border-top: 1px solid var(--line); }
h3 { font-size: 18px; margin: 28px 0 8px; }
h4 { font-size: 16px; margin: 22px 0 6px; }
p, li { overflow-wrap: anywhere; }
a { color: var(--accent); }
code { font: 14px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: var(--code); padding: 1px 5px; border-radius: 4px; }
pre { background: var(--code); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; font-size: 13px; }
blockquote { margin: 16px 0; padding: 2px 14px; border-left: 3px solid var(--line); color: var(--soft); }
blockquote p { margin: 6px 0; }
.tbl { overflow-x: auto; margin: 12px 0; }
table { border-collapse: collapse; font-size: 15px; min-width: 100%; }
th, td { border-bottom: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
th { font-weight: 600; white-space: nowrap; }
.intro p { margin: 0 0 12px; }
ol.steps { padding-left: 22px; }
ol.steps li { margin-bottom: 8px; }
ul.dl { list-style: none; padding: 0; margin: 0; }
ul.dl li { padding: 10px 0; border-bottom: 1px solid var(--line); }
ul.dl a { font-weight: 600; }
.sz { color: var(--soft); font-size: 14px; margin-left: 8px; }
.note { color: var(--soft); font-size: 15px; }
nav.toc { font-size: 15px; color: var(--soft); }
nav.toc a { color: var(--soft); text-decoration: none; margin-right: 12px; white-space: nowrap; display: inline-block; }
footer { margin-top: 56px; color: var(--soft); font-size: 14px; }
</style>
</head>
<body>
<main>
<h1>书包格式标准</h1>
<p class="sub">观象 · 书桌 · .deskbook · 第 ${FORMAT_VERSION} 版 · 工具 ${CORE_VERSION}</p>

<section class="intro">
<p>书包是「观象 · 书桌」读的书:一个 <code>.deskbook</code> 文件,本质是 zip,里面一份书目清单、每章一个 JSON 文件、再加图片和短视频。</p>
<p>它只装文字结构与媒体,不装任何网页、脚本或字体;版式由书桌统一排。典籍、现代书、文集三种体裁共用同一套格式。</p>
<p>任何人都可以照下面的标准做一本,导进自己设备上的书桌。导入的书只存在那台设备上,不上传。</p>
</section>

<h2 id="make">三步做一本</h2>
<ol class="steps">
<li><strong>写。</strong>用 Claude Code 装上下面的 skill,说「做一本书包」,它会先和你定提纲,再一章一章写;也可以手写 JSON,用 <code>node deskbook.mjs init 目录 --kind book --title "书名"</code> 起骨架。</li>
<li><strong>校验与打包。</strong><code>node deskbook.mjs validate 目录</code> 查出所有不合标准的地方,改到通过,再 <code>node deskbook.mjs pack 目录</code> 得到 <code>.deskbook</code> 文件。动图先用 <code>gif2mp4</code> 转成视频。</li>
<li><strong>放进书桌。</strong>把文件隔空投送或存进「文件」,在手机上点开,选「用书桌打开」。</li>
</ol>

<h2 id="download">下载</h2>
<ul class="dl">
${dl}
</ul>

<nav class="toc"><p>标准目录:${toc.map((t) => `<a href="#${t.id}">${inlineMd(t.text)}</a>`).join('')}</p></nav>

<h2 id="standard">标准全文</h2>
${html}

<footer>本页与下载物由 <code>scripts/desk/build-deskbook-cli.mjs</code> 从标准原文生成。</footer>
</main>
</body>
</html>
`
}

const human = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  // 只清本脚本产出的东西
  for (const p of ['samples', 'schema']) fs.rmSync(path.join(OUT, p), { recursive: true, force: true })
  const cliText = buildCli()
  copyDir(R('scripts/desk/deskbook-schema'), path.join(OUT, 'schema'))
  const { md, banner } = buildStandard()
  const samples = await buildSamples()
  const skill = await buildSkill(cliText, banner + md)
  const size = (p) => human(fs.statSync(path.join(OUT, p)).size)
  const SAMPLE_NOTES = {
    'sample-book': '现代书:单摆三章,用到全部块类型,带图片与两段动画',
    'sample-collection': '文集:三篇独立短文,各有作者与日期',
    'sample-classic': '典籍:《道德经》三章,原文、译文、字词注与章末深读',
    'sample-fitness': '现代书 · 健身:带医学声明(disclaimer: medical)与一段动作视频',
  }
  const downloads = [
    { href: 'deskbook-skill.zip', label: 'deskbook-skill.zip', size: size('deskbook-skill.zip'), note: '做书用的 Claude Code skill。解压到 ~/.claude/skills/(得到 deskbook/ 目录),在任意会话里说「做一本书包」即可。内含标准、校验器、结构定义与两本示例。' },
    { href: 'deskbook.mjs', label: 'deskbook.mjs', size: size('deskbook.mjs'), note: '校验器与打包工具:单文件、无依赖,Node 18 以上。init / validate / pack / unpack / gif2mp4。' },
    { href: 'schema/book.json', label: 'schema/book.json', size: size('schema/book.json'), note: 'book.json 的 JSON Schema(2020-12)。' },
    { href: 'schema/chapter.json', label: 'schema/chapter.json', size: size('schema/chapter.json'), note: '章文件的 JSON Schema。' },
    { href: 'schema/fig.json', label: 'schema/fig.json', size: size('schema/fig.json'), note: '图解 fig 的 JSON Schema。' },
    ...samples.map((s) => ({ href: `samples/${s.name}.deskbook`, label: `${s.name}.deskbook`, size: human(s.bytes), note: `${SAMPLE_NOTES[s.name]}。` })),
  ]
  write(path.join(OUT, 'index.html'), buildIndexHtml(md, downloads))

  // 下载清单:除 index.json 自身外的全部文件
  const files = []
  const { files: all } = readDir(OUT)
  for (const [rel, data] of [...all].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (rel === 'index.json') continue
    files.push({ path: rel, bytes: data.length, sha256: sha256(data) })
  }
  const index = {
    format: 'deskbook', version: FORMAT_VERSION, tool: CORE_VERSION, url: SITE,
    limits: { totalBytes: LIMITS.totalBytes, chapterBytes: LIMITS.chapterBytes, imageBytes: LIMITS.imageBytes, videoBytes: LIMITS.videoBytes, chapters: LIMITS.chapters },
    samples: samples.map((s) => ({ path: `samples/${s.name}.deskbook`, ...s.summary })),
    files,
  }
  write(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  const total = files.reduce((a, f) => a + f.bytes, 0)
  console.log(`书包标准公开物已重出:${path.relative(ROOT, OUT)}/(${files.length + 1} 个文件,共 ${human(total)})`)
  for (const s of samples) console.log(`  samples/${s.name}.deskbook  ${human(s.bytes)}  ${s.summary.chapters} 章 ${s.summary.chars} 字`)
  console.log(`  deskbook-skill.zip  ${human(skill.bytes)}(${skill.files} 个文件)`)
}

main().catch((e) => { console.error(e.message || e); process.exit(1) })
