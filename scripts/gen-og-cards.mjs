#!/usr/bin/env node
// 社交分享卡(og:image):每本有题图(texts.json 的 `art`)的书一张 1200×630 JPEG → public/og/books/<组>/<slug>.jpg,
// 外加站点级默认卡 public/og/site.jpg。纸本气质:宣纸底、左缘组色竖条、左侧书名 / 别名·时代·撰人 / 题解 / 朱印落款,
// 右侧题图遮罩染 --ink-soft。数据全从仓库读:书目 src/data/<组>/texts.json、组色 src/index.css 首个 :root、
// 站点说明 index.html 的 description(构建期占位符则照 vite.config statsMeta 的句子 + public/content/stats.json 还原)。
// node 只管组织数据,绘图交给 python3 + PIL(同 gen-book-art.mjs 的分工)。
//   node scripts/gen-og-cards.mjs              # 全量(所有书卡 + 站点卡)
//   node scripts/gen-og-cards.mjs ru/lunyu     # 只出这一本(可列多本;写 site 只出站点卡)
//   node scripts/gen-og-cards.mjs --contact    # 把已出的卡缩成网格样张 scripts/.cache/og-cards-contact.jpg(人眼检查)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_BOOKS = path.join(ROOT, 'public/og/books')
const OUT_SITE = path.join(ROOT, 'public/og/site.jpg')
const CACHE = path.join(ROOT, 'scripts/.cache')
const CONTACT = path.join(CACHE, 'og-cards-contact.jpg')

// 组 → index.css 的主色 token(与 registry.accent 同一套)
const GROUP_TOKEN = {
  dao: 'azure', ru: 'confucian', fo: 'buddha', xin: 'xinxue', fa: 'legalist', mo: 'mohist', bing: 'military',
  zong: 'zongheng', zhongyi: 'zhongyi', moulue: 'moulue', mingli: 'mingli', guwen: 'guwen',
  tangshi: 'tangshi', songci: 'songci', yuanqu: 'yuanqu',
}
// 站点卡右侧叠放的三张代表题图(第一张压在最上)
const SITE_ART = [['dao', 'daodejing'], ['ru', 'lunyu'], ['bing', 'sunzi']]

const args = process.argv.slice(2)
const contact = args.includes('--contact')
const only = args.filter((a) => !a.startsWith('--'))

// 浅色主题色值:取 index.css 第一个 `:root {` 块(后面还有深色主题的 :root 重定义,不要)
function cssColors() {
  const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')
  const start = css.indexOf(':root {')
  const block = css.slice(start, css.indexOf('\n}', start))
  const colors = {}
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) if (!(m[1] in colors)) colors[m[1]] = m[2]
  return colors
}

function siteDescription() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || ''
  if (!desc.includes('__STATS_DESC__')) return desc
  // 构建期占位符:与 vite.config.js statsMeta() 的长句同一写法
  let s = null
  try { s = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/content/stats.json'), 'utf8')) } catch { /* 未跑 content:build */ }
  const books = s?.books ? `${s.books} 部典籍` : '诸多典籍'
  const shelves = s?.shelves ? `${s.shelves} 组书架` : '诸组书架'
  return `${books}的原文、白话译注、每章延伸与深读。易经、道藏、儒释、诸子百家、中医、谋略、命理、唐诗宋词元曲、古文，${shelves}同站。引文逐字校验为原文精确子串。`
}

function collectBooks(colors) {
  const books = []
  for (const [group, token] of Object.entries(GROUP_TOKEN)) {
    const f = path.join(ROOT, `src/data/${group}/texts.json`)
    if (!fs.existsSync(f)) continue
    if (!colors[token]) throw new Error(`index.css 缺 --${token}(组 ${group})`)
    for (const b of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      if (!b.art?.file) continue
      const art = path.join(ROOT, 'public/book-art', group, b.art.file)
      if (!fs.existsSync(art)) { console.warn(`⚠ ${group}/${b.slug} 题图缺失:${path.relative(ROOT, art)}`); continue }
      books.push({
        key: `${group}/${b.slug}`, accent: colors[token], art,
        title: b.title, meta: [b.alias, b.era, b.attribution], brief: b.brief || '', dubious: !!b.dubious,
        out: path.join(OUT_BOOKS, group, `${b.slug}.jpg`),
      })
    }
  }
  return books
}

function py(code, ...argv) {
  return execFileSync('python3', ['-', ...argv], { input: code, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['pipe', 'pipe', 'inherit'] })
}

if (contact) {
  const cards = []
  if (fs.existsSync(OUT_SITE)) cards.push(OUT_SITE)
  if (fs.existsSync(OUT_BOOKS)) {
    for (const g of fs.readdirSync(OUT_BOOKS).sort()) {
      for (const f of fs.readdirSync(path.join(OUT_BOOKS, g)).sort()) if (f.endsWith('.jpg')) cards.push(path.join(OUT_BOOKS, g, f))
    }
  }
  if (!cards.length) { console.error('还没有卡,先跑全量'); process.exit(1) }
  fs.mkdirSync(CACHE, { recursive: true })
  py(`
import sys, json
from PIL import Image
cards = json.loads(sys.argv[1]); out = sys.argv[2]
TW, TH, GAP, COLS = 400, 210, 8, 5
rows = (len(cards) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * (TW + GAP) + GAP, rows * (TH + GAP) + GAP), (0x88, 0x82, 0x7a))
for i, p in enumerate(cards):
    im = Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS)
    sheet.paste(im, (GAP + (i % COLS) * (TW + GAP), GAP + (i // COLS) * (TH + GAP)))
sheet.save(out, quality=82)
`, JSON.stringify(cards), CONTACT)
  console.log(`样张 ${path.relative(ROOT, CONTACT)}(${cards.length} 张)`)
  process.exit(0)
}

const colors = cssColors()
const allBooks = collectBooks(colors)
const books = only.length ? allBooks.filter((b) => only.includes(b.key)) : allBooks
const wantSite = !only.length || only.includes('site')
const unknown = only.filter((k) => k !== 'site' && !allBooks.some((b) => b.key === k))
if (unknown.length) console.warn(`⚠ 未找到(无此书或无题图):${unknown.join(' ')}`)

const siteArt = SITE_ART.map(([g, slug]) => allBooks.find((b) => b.key === `${g}/${slug}`)?.art).filter(Boolean)
const job = {
  palette: {
    paper: colors.paper, ink: colors.ink, inkSoft: colors['ink-soft'], inkFaint: colors['ink-faint'],
    cinnabar: colors['cinnabar-pure'],
  },
  books,
  site: wantSite ? { out: OUT_SITE, desc: siteDescription(), arts: siteArt } : null,
}
for (const b of books) fs.mkdirSync(path.dirname(b.out), { recursive: true })
fs.mkdirSync(path.dirname(OUT_SITE), { recursive: true })

// 绘图。字体:宋体 SC 粗(index 1)+ 常规(index 6);宋体缺字逐字退到冬青明朝 / 冬青黑 GB / Apple Symbols / Arial Unicode。
const out = py(`
import sys, json, io, re
from PIL import Image, ImageDraw, ImageFont

job = json.loads(open(sys.argv[1], encoding='utf-8').read())
P = job['palette']
W, H = 1200, 630
SONGTI = '/System/Library/Fonts/Supplemental/Songti.ttc'
BOLD_IDX, REG_IDX = 1, 6           # ('Songti SC','Bold') / ('Songti SC','Regular')
import os
FALLBACKS = [p for p in [('/System/Library/Fonts/ヒラギノ明朝 ProN.ttc', 0), ('/System/Library/Fonts/Hiragino Sans GB.ttc', 0),
             ('/System/Library/Fonts/Apple Symbols.ttf', 0), ('/System/Library/Fonts/Supplemental/Arial Unicode.ttf', 0)]
             if os.path.exists(p[0])]
MAX_BYTES = 120 * 1024
TEXT_X, TEXT_R = 72, 604           # 左侧文字区;题图从 x=640 起,行末挂标点也还留气口
ART = 520; ART_X = 640; ART_Y = (H - ART) // 2 + 22
NO_HEAD = set('，。、；：？！」』）》〉,.;:?!)…')

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
_fonts = {}
def font(kind, size):
    k = (kind, size)
    if k not in _fonts:
        if kind == 'bold': _fonts[k] = ImageFont.truetype(SONGTI, size, index=BOLD_IDX)
        elif kind == 'reg': _fonts[k] = ImageFont.truetype(SONGTI, size, index=REG_IDX)
        else: path, idx = FALLBACKS[kind]; _fonts[k] = ImageFont.truetype(path, size, index=idx)
    return _fonts[k]

# 缺字判定:与「必缺字」(私用区末尾)的字形一致即视为 .notdef
_has = {}
def has_glyph(f, ch):
    k = (id(f), ch)
    if k not in _has:
        if ch.isspace(): _has[k] = True
        else:
            m = lambda c: (f.getbbox(c), bytes(f.getmask(c)))
            _has[k] = m(ch) != m('\\U0010FFFD')
    return _has[k]

missing = []
def font_for(kind, size, ch):
    f = font(kind, size)
    if has_glyph(f, ch): return f
    for i in range(len(FALLBACKS)):
        g = font(i, size)
        if has_glyph(g, ch): return g
    missing.append(ch); return f

def runs(kind, size, text):
    # 把文字按「同一字体」切段,逐段量宽/绘制
    out = []
    for ch in text:
        f = font_for(kind, size, ch)
        if out and out[-1][0] is f: out[-1][1] += ch
        else: out.append([f, ch])
    return out

def width(kind, size, text): return sum(f.getlength(t) for f, t in runs(kind, size, text))

def draw_text(d, xy, kind, size, text, fill):
    x, y = xy
    for f, t in runs(kind, size, text):
        d.text((x, y), t, font=f, fill=fill, anchor='ls')
        boxes.append(d.textbbox((x, y), t, font=f, anchor='ls')); x += f.getlength(t)

def wrap(kind, size, text, maxw):
    lines, cur = [], ''
    for ch in text:
        if cur and width(kind, size, cur + ch) > maxw:
            if ch in NO_HEAD: cur += ch; continue     # 标点不落行首:挂在上一行末(允许略出界)
            lines.append(cur); cur = ch
        else: cur += ch
    if cur: lines.append(cur)
    return lines

def ellipsize(kind, size, text, maxw):
    if width(kind, size, text) <= maxw: return text
    while text and width(kind, size, text + '…') > maxw: text = text[:-1]
    return text.rstrip('，、；：· ') + '…'

def clamp_lines(kind, size, text, maxw, n):
    lines = wrap(kind, size, text, maxw)
    if len(lines) <= n: return lines
    # 超出:先试在句末(。！？)收住,至少留 n-1 行;不行再末行截断加省略号
    for k in range(n, n - 2, -1):
        head = ''.join(lines[:k])
        cut = max(head.rfind(c) for c in '。！？')
        if cut >= 0:
            sub = wrap(kind, size, text[:cut + 1], maxw)
            if n - 1 <= len(sub) <= n: return sub
    keep = lines[:n]
    rest = ''.join(lines[n - 1:])
    keep[-1] = ellipsize(kind, size, rest, maxw)
    return keep

def mask_of(path, size):
    im = Image.open(path)
    a = im.getchannel('A') if 'A' in im.getbands() else im.convert('L')
    return a.resize((size, size), Image.LANCZOS)

boxes, inks = [], []                # 本张卡画过的文字框 / 题图遮罩,出卡后查重叠
def ink_layer(base, mask, xy, color, opacity=1.0):
    if opacity < 1: mask = mask.point(lambda v: int(v * opacity))
    inks.append((mask, xy))
    base.paste(Image.new('RGB', mask.size, rgb(color)), xy, mask)

def seal_and_footer(im, d):
    S = 56; x, y = TEXT_X, H - 64 - S
    d.rounded_rectangle((x, y, x + S, y + S), radius=6, fill=rgb(P['cinnabar']))
    f = font('bold', 22)                     # 竖排「观象」
    for i, ch in enumerate('观象'):
        d.text((x + S / 2, y + S / 2 + (i - 0.5) * 23), ch, font=f, fill=(255, 255, 255), anchor='mm')
    tx = x + S + 18
    draw_text(d, (tx, y + 25), 'reg', 28, '观象 · 古籍研读站', rgb(P['ink']))
    draw_text(d, (tx, y + S - 2), 'reg', 24, 'hexa.gavin.pub', rgb(P['inkFaint']))
    return y

def save(im, out):
    for q in (85, 80, 72):
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=q, optimize=True, progressive=True)
        if buf.tell() <= MAX_BYTES or q == 72: break
    open(out, 'wb').write(buf.getvalue())
    return buf.tell(), q

def canvas(accent):
    im = Image.new('RGB', (W, H), rgb(P['paper'])); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 9, H), fill=rgb(accent))
    return im, d

def overlaps():
    # 文字框与题图「有墨处」(遮罩 > 24)相交即报
    hits = 0
    for (x0, y0, x1, y1) in boxes:
        for mask, (mx, my) in inks:
            c = mask.crop((int(x0) - mx, int(y0) - my, int(x1) - mx, int(y1) - my))
            if c.size[0] > 0 and c.size[1] > 0 and (c.getextrema()[1] or 0) > 24: hits += 1
    boxes.clear(); inks.clear()
    return hits

def cjk_punct(t):
    # 题解里偶有半角 , ; : 夹在汉字间(数据如此),卡面上换成全角,不动数据
    return re.sub(r'(?<=[\u3400-\u9fff」』）])([,;:])(?=[\u3400-\u9fff「『（])', lambda m: {',': '，', ';': '；', ':': '：'}[m.group(1)], t)

def book_card(b):
    im, d = canvas(b['accent'])
    ink_layer(im, mask_of(b['art'], ART), (ART_X, ART_Y), P['inkSoft'])
    maxw = TEXT_R - TEXT_X
    size = 88
    while size > 40 and width('bold', size, b['title']) > maxw: size -= 2
    y = 100 + 88 * 0.86 - (88 - size) * 0.25   # 书名基线:字号降了只略上提,下面各行位置基本不跳
    draw_text(d, (TEXT_X, y), 'bold', size, b['title'], rgb(P['ink']))
    parts = []
    for p in b['meta']:
        p = (p or '').strip()
        if p and p not in parts and p != b['title']: parts.append(p)
    y += 54
    if parts:
        draw_text(d, (TEXT_X, y), 'reg', 30, ellipsize('reg', 30, ' · '.join(parts), maxw), rgb(P['inkSoft']))
        y += 44
    if b['dubious']:
        draw_text(d, (TEXT_X, y), 'reg', 26, '⚠ 托名 · 疑现代伪作', rgb(P['cinnabar']))
        y += 40
    footer_top = H - 64 - 56
    y += 22
    lh = round(32 * 1.6)
    n = max(1, min(3, int((footer_top - 24 - (y - 26)) // lh)))
    for line in clamp_lines('reg', 32, cjk_punct(b['brief']), maxw, n):
        draw_text(d, (TEXT_X, y), 'reg', 32, line, rgb(P['ink'])); y += lh
    seal_and_footer(im, d)
    return save(im, b['out'])

def site_card(s):
    im, d = canvas(P['cinnabar'])
    # 三张题图错落:后两张小、淡,压在底下;道德经那张在最前
    spots = [(ART_X + 140, ART_Y + 60, 400, 0.85), (ART_X + 10, ART_Y - 40, 300, 0.35), (ART_X + 280, ART_Y - 45, 250, 0.30)]
    for art, (x, y, sz, op) in reversed(list(zip(s['arts'], spots))):
        ink_layer(im, mask_of(art, sz), (x, y), P['inkSoft'], op)
    draw_text(d, (TEXT_X, 100 + 120 * 0.86), 'bold', 120, '观象', rgb(P['ink']))
    draw_text(d, (TEXT_X + 4, 280), 'reg', 40, '古籍研读站', rgb(P['inkSoft']))
    y = 350; lh = round(30 * 1.6)
    for line in clamp_lines('reg', 30, s['desc'], TEXT_R - TEXT_X, 3):
        draw_text(d, (TEXT_X, y), 'reg', 30, line, rgb(P['ink'])); y += lh
    seal_and_footer(im, d)
    return save(im, s['out'])

sizes = []
for b in job['books']:
    n, q = book_card(b); sizes.append((n, b['key'], q))
    if overlaps(): print(f'  ⚠ {b["key"]} 文字与题图重叠')
if job['site']:
    n, q = site_card(job['site']); sizes.append((n, 'site', q))
    if overlaps(): print('  ⚠ site 文字与题图重叠')
for n, k, q in sizes:
    if q != 85: print(f'  {k} 降质到 q{q}({n // 1024} KB)')
if missing: print('缺字:' + ''.join(sorted(set(missing))))
big = max(sizes) if sizes else (0, '-', 0)
print(f'{len(sizes)} 张卡 · 最大 {big[0] / 1024:.1f} KB({big[1]})')
`, writeJob(job))
process.stdout.write(out)

function writeJob(j) {
  fs.mkdirSync(CACHE, { recursive: true })
  const f = path.join(CACHE, 'og-cards-job.json')
  fs.writeFileSync(f, JSON.stringify(j))
  return f
}
