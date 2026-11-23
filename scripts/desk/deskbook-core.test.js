// 书包格式(deskbook)核心库的单测:示例全过、坏样本逐条报对、zip 往返与攻击样本、结构定义与校验器一致。
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  validate, zip, unzip, summarize, countChars, countText, RESERVED_IDS, readDirectory, extractEntry, entryRange, ZipError, checkInline, checkFigShape, checkPath, readImageInfo, readMp4Info, crc32, textLen,
  LIMITS, HEXAGRAM_NAMES, TRIGRAM_NAMES, DISCLAIMER_VOCAB,
} from './deskbook-core.mjs'
import { TABLE, TRIGRAMS } from '../lib/hexagram-table.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SAMPLES = path.join(HERE, 'deskbook-samples')
const SCHEMA = path.join(HERE, 'deskbook-schema')
const enc = new TextEncoder()
const dec = new TextDecoder()

function readDir(dir) {
  const m = new Map()
  const walk = (d, r) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const rr = r ? `${r}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(d, e.name), rr)
      else m.set(rr, new Uint8Array(fs.readFileSync(path.join(d, e.name))))
    }
  }
  walk(dir, '')
  return m
}
const sample = (name) => readDir(path.join(SAMPLES, name))
const J = (files, p) => JSON.parse(dec.decode(files.get(p)))
const put = (files, p, obj) => { files.set(p, enc.encode(JSON.stringify(obj))); return files }
const edit = (files, p, fn) => { const o = J(files, p); fn(o); return put(files, p, o) }

// 最小的合法书包(内存里)
function base(kind = 'book', extra = {}) {
  const book = {
    format: 'deskbook', version: 1, id: 'u-test-0123abcd', revision: 1, kind, title: '测试书', authors: [], lang: 'zh-Hans',
    summary: '一句话。', source: { type: kind === 'classic' ? 'public-domain' : 'original', ...(kind === 'classic' ? { note: '底本' } : {}) }, unit: '章',
    chapters: [{ no: 1, file: 'chapters/001.json', title: '一' }], ...extra,
  }
  const ch = { no: 1, title: '一', article: { blocks: [{ t: 'lead', x: '导语。' }, { t: 'p', x: '正文。' }] } }
  if (kind === 'classic') ch.segs = [{ o: '道可道，非常道。', t: '译文。', n: [{ k: '道可道', d: '释义' }] }]
  const files = new Map()
  put(files, 'book.json', book)
  put(files, 'chapters/001.json', ch)
  return files
}
const blocks = (files, list) => edit(files, 'chapters/001.json', (c) => { c.article.blocks = [{ t: 'p', x: '正文。' }, ...list] })
const errs = (files) => validate(files).errors
const msgs = (files) => errs(files).map((e) => `${e.file}|${e.where}|${e.msg}`).join('\n')

describe('示例书包', () => {
  for (const name of ['sample-book', 'sample-collection', 'sample-classic', 'sample-fitness']) {
    it(`${name} 校验零错误零提示`, () => {
      const r = validate(sample(name))
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
      expect(r.ok).toBe(true)
    })
  }
  it('sample-book 用到全部块类型、多种 fig、图片与视频', () => {
    const r = validate(sample('sample-book'))
    for (const t of ['lead', 'h2', 'h3', 'p', 'quote', 'callout', 'pull', 'steps', 'list', 'outline', 'fig', 'img', 'video', 'code', 'divider', 'refs', 'ask']) expect(r.stats.blockTypes[t], t).toBeGreaterThan(0)
    expect(Object.keys(r.stats.figs).length).toBeGreaterThanOrEqual(5)
    expect(r.stats.videos).toBe(2)
  })
  it('summarize 给出书名、章数、字数、媒体字节', () => {
    const s = summarize(sample('sample-fitness'))
    expect(s).toMatchObject({ title: '深蹲的形', kind: 'book', chapters: 2, disclaimer: 'medical', ok: true })
    expect(s.chars).toBeGreaterThan(300)
    expect(s.mediaBytes).toBeGreaterThan(10000)
  })
  it('最小书包三种体裁都合法', () => {
    for (const k of ['book', 'collection', 'classic']) expect(msgs(base(k, k === 'collection' ? { unit: '篇' } : {}))).toBe('')
  })
})

describe('卦名表与 hexagram-table 一致', () => {
  it('八经卦与六十四卦', () => {
    expect(new Set(TRIGRAM_NAMES)).toEqual(new Set(Object.values(TRIGRAMS).map((t) => t.name)))
    expect(new Set(HEXAGRAM_NAMES)).toEqual(new Set(Object.values(TABLE).flatMap((r) => Object.values(r).map(([, n]) => n))))
  })
})

// 坏样本:[说明, 造法, 应报的文件, 错误里应含的字]
const BROKEN = [
  ['format 不对', (f) => edit(f, 'book.json', (b) => { b.format = 'epub' }), 'book.json', 'deskbook'],
  ['version 更新', (f) => edit(f, 'book.json', (b) => { b.version = 2 }), 'book.json', '新'],
  ['id 带大写', (f) => edit(f, 'book.json', (b) => { b.id = 'U-Test' }), 'book.json', 'id 须为'],
  ['revision 为 0', (f) => edit(f, 'book.json', (b) => { b.revision = 0 }), 'book.json', '每次重出'],
  ['kind 不认识', (f) => edit(f, 'book.json', (b) => { b.kind = 'novel' }), 'book.json', 'classic / book / collection'],
  ['缺 lang', (f) => edit(f, 'book.json', (b) => { delete b.lang }), 'book.json', '语言标记'],
  ['缺 unit', (f) => edit(f, 'book.json', (b) => { delete b.unit }), 'book.json', '章的叫法'],
  ['summary 超 60 字', (f) => edit(f, 'book.json', (b) => { b.summary = '字'.repeat(61) }), 'book.json', '超过 60 字'],
  ['tags 9 个', (f) => edit(f, 'book.json', (b) => { b.tags = '一二三四五六七八九'.split('') }), 'book.json', '至多 8 个'],
  ['digest 没写原书', (f) => edit(f, 'book.json', (b) => { b.source = { type: 'digest' } }), 'book.json', '必须写明原书'],
  ['theme 颜色格式', (f) => edit(f, 'book.json', (b) => { b.theme = { accent: 'red' } }), 'book.json', '#RRGGBB'],
  ['章号不连续', (f) => edit(f, 'book.json', (b) => { b.chapters[0].no = 2 }), 'book.json', '从 1 连续'],
  ['章文件名不补零', (f) => edit(f, 'book.json', (b) => { b.chapters[0].file = 'chapters/1.json' }), 'book.json', 'chapters/001.json'],
  ['章文件缺', (f) => { edit(f, 'book.json', (b) => { b.chapters.push({ no: 2, file: 'chapters/002.json', title: '二' }) }); return f }, 'book.json', '不在包里'],
  ['多出未登记的章文件', (f) => put(f, 'chapters/002.json', { no: 2, title: '二', article: { blocks: [{ t: 'p', x: '。' }] } }), 'chapters/002.json', '没有登记'],
  ['parts 没覆盖全部章', (f) => edit(f, 'book.json', (b) => { b.chapters.push({ no: 2, file: 'chapters/002.json', title: '二' }); b.parts = [{ title: '上', from: 1, to: 1 }] }) && put(f, 'chapters/002.json', { no: 2, title: '二', article: { blocks: [{ t: 'p', x: '。' }] } }), 'book.json', '覆盖全部'],
  ['日期不合法', (f) => edit(f, 'book.json', (b) => { b.chapters[0].date = '2026-02-30' }), 'book.json', 'YYYY-MM-DD'],
  ['章文件 no 不对', (f) => edit(f, 'chapters/001.json', (c) => { c.no = 3 }), 'chapters/001.json', '应为 1'],
  ['现代书出现 segs', (f) => edit(f, 'chapters/001.json', (c) => { c.segs = [{ o: '原文' }] }), 'chapters/001.json', '只许出现在典籍'],
  ['现代书出现 yanyi', (f) => edit(f, 'chapters/001.json', (c) => { c.yanyi = ['延伸'] }), 'chapters/001.json', 'yanyi'],
  ['现代书缺 article', (f) => edit(f, 'chapters/001.json', (c) => { delete c.article }), 'chapters/001.json', '必有 article'],
  ['典籍缺 segs', (f) => edit(base('classic'), 'chapters/001.json', (c) => { delete c.segs }), 'chapters/001.json', '必有原文分段'],
  ['注 k 不是子串', (f) => edit(base('classic'), 'chapters/001.json', (c) => { c.segs[0].n = [{ k: '名可名', d: '释' }] }), 'chapters/001.json', '精确子串'],
  ['注互相重叠', (f) => edit(base('classic'), 'chapters/001.json', (c) => { c.segs[0].n = [{ k: '道可道', d: '释' }, { k: '可道', d: '释' }] }), 'chapters/001.json', '重叠'],
  ['注 d 超 40 字', (f) => edit(base('classic'), 'chapters/001.json', (c) => { c.segs[0].n = [{ k: '道', d: '释'.repeat(41) }] }), 'chapters/001.json', '超过 40 字'],
  ['注 x 超 150 字', (f) => edit(base('classic'), 'chapters/001.json', (c) => { c.segs[0].n = [{ k: '道', d: '释', x: '展'.repeat(151) }] }), 'chapters/001.json', '超过 150 字'],
  ['不认识的块', (f) => blocks(f, [{ t: 'html', x: '<b>' }]), 'chapters/001.json', '不认识的块类型'],
  ['空块', (f) => blocks(f, [{ t: 'h2', x: '  ' }]), 'chapters/001.json', '空块不许有'],
  ['没有 p 也没有 lead', (f) => edit(f, 'chapters/001.json', (c) => { c.article.blocks = [{ t: 'h2', x: '题' }] }), 'chapters/001.json', '至少一个 p 或 lead'],
  ['两处 pull', (f) => blocks(f, [{ t: 'pull', x: '一' }, { t: 'pull', x: '二' }]), 'chapters/001.json', '至多 1 处'],
  ['** 不成对', (f) => blocks(f, [{ t: 'p', x: '这是**加粗' }]), 'chapters/001.json', '不成对'],
  ['http 链接', (f) => blocks(f, [{ t: 'p', x: '[看](http://example.org)' }]), 'chapters/001.json', '只许 https'],
  ['javascript 链接', (f) => blocks(f, [{ t: 'refs', items: ['[点](javascript:alert(1))'] }]), 'chapters/001.json', '只许 https'],
  ['list 缺 ordered', (f) => blocks(f, [{ t: 'list', items: ['一'] }]), 'chapters/001.json', 'true / false'],
  ['callout tone 不对', (f) => blocks(f, [{ t: 'callout', tone: 'danger', items: ['一'] }]), 'chapters/001.json', 'note / tip / warn'],
  ['quote 无内容', (f) => blocks(f, [{ t: 'quote', by: '某人' }]), 'chapters/001.json', '须有 o'],
  ['quote 只有 tr', (f) => blocks(f, [{ t: 'quote', tr: '译文' }]), 'chapters/001.json', '须有 o'],
  ['quote 混用 o 与 x', (f) => blocks(f, [{ t: 'quote', o: '原文', x: '引的话' }]), 'chapters/001.json', '不许同时出现'],
  ['quote 原文式配 by', (f) => blocks(f, [{ t: 'quote', o: '原文', by: '某书' }]), 'chapters/001.json', 'by 只配一般式'],
  ['quote 一般式配 tr', (f) => blocks(f, [{ t: 'quote', x: '引的话', tr: '译' }]), 'chapters/001.json', 'tr 只配原文式'],
  ['id 用了官方典籍的', (f) => edit(f, 'book.json', (b) => { b.id = 'daodejing' }), 'book.json', '内置官方典籍'],
  ['id 不带前缀', (f) => edit(f, 'book.json', (b) => { b.id = 'my-book-12345678' }), 'book.json', '须以 u-'],
  ['id 前缀不对', (f) => edit(f, 'book.json', (b) => { b.id = 'x-my-book' }), 'book.json', '须以 u-'],
  ['章 summary 超 80 字', (f) => edit(f, 'book.json', (b) => { b.chapters[0].summary = '字'.repeat(81) }), 'book.json', '超过 80 字'],
  ['章 summary 换行', (f) => edit(f, 'book.json', (b) => { b.chapters[0].summary = '一行\n两行' }), 'book.json', '只许一行'],
  ['outline 五层', (f) => blocks(f, [{ t: 'outline', items: [{ x: '1', children: [{ x: '2', children: [{ x: '3', children: [{ x: '4', children: [{ x: '5' }] }] }] }] }] }]), 'chapters/001.json', '最多 4 层'],
  ['fig cols 只一栏', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'cols', cols: [{ head: '甲', lines: [] }] } }]), 'chapters/001.json', '至少 2 项'],
  ['fig kind 不认识', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'pie' } }]), 'chapters/001.json', '不认识'],
  ['fig 卦名不对', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'gua', guas: [{ name: '天', form: 'hex' }] } }]), 'chapters/001.json', '六十四卦'],
  ['fig 方位重复', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'ring', items: [{ at: 'N', head: '坎' }, { at: 'N', head: '离' }, { at: 'S', head: '乾' }] } }]), 'chapters/001.json', '重复'],
  ['fig 字符串超 120 字', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'notes', lines: ['字'.repeat(121)] } }]), 'chapters/001.json', '超过 120 字'],
  ['fig table 行不等长', (f) => blocks(f, [{ t: 'fig', fig: { kind: 'table', heads: ['a', 'b'], rows: [['1']] } }]), 'chapters/001.json', '等长'],
  ['img 引用的文件不在', (f) => blocks(f, [{ t: 'img', src: 'media/a.png', alt: '图', w: 10, h: 10 }]), 'chapters/001.json', '不在包里'],
  ['img 缺 alt', (f) => blocks(f, [{ t: 'img', src: 'media/a.png', w: 10, h: 10 }]), 'chapters/001.json', 'alt'],
  ['video 超 60 秒', (f) => blocks(f, [{ t: 'video', src: 'media/v.mp4', poster: 'media/p.jpg', w: 10, h: 10, sec: 61 }]), 'chapters/001.json', '超过 60 秒'],
  ['digest 引文超 100 字', (f) => blocks(edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } }), [{ t: 'quote', x: '引'.repeat(101), by: '原书' }]), 'chapters/001.json', '至多 100 字'],
  ['digest 一章 17 条引文', (f) => blocks(edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } }), Array.from({ length: 17 }, () => ({ t: 'quote', x: '引一句', by: '原书' }))), 'chapters/001.json', '至多 16 条'],
  ['digest 金句 pull 超 100 字', (f) => blocks(edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } }), [{ t: 'pull', x: '引'.repeat(101) }]), 'chapters/001.json', '至多 100 字'],
  ['digest 金句卡超 100 字', (f) => blocks(edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } }), [{ t: 'fig', fig: { kind: 'quote', text: '引'.repeat(101) } }]), 'chapters/001.json', '至多 100 字'],
  ['digest quote + pull + 金句卡合计 17 条', (f) => blocks(edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } }), [
    ...Array.from({ length: 15 }, () => ({ t: 'quote', x: '引一句', by: '原书' })), { t: 'pull', x: '金句' }, { t: 'fig', fig: { kind: 'quote', text: '卡上一句' } }]), 'chapters/001.json', '至多 16 条'],
  ['健身书没带医学声明', (f) => edit(f, 'book.json', (b) => { b.category = '健身' }), 'book.json', 'medical'],
  ['英文 fitness 标签没带声明', (f) => edit(f, 'book.json', (b) => { b.tags = ['Fitness'] }), 'book.json', 'medical'],
  ['八字书没带占卜声明', (f) => edit(f, 'book.json', (b) => { b.tags = ['八字入门'] }), 'book.json', 'divination'],
  ['医学书带错声明', (f) => edit(f, 'book.json', (b) => { b.category = '中医'; b.disclaimer = 'divination' }), 'book.json', 'medical'],
  ['自写声明超 120 字', (f) => edit(f, 'book.json', (b) => { b.disclaimer = '声'.repeat(121) }), 'book.json', '超过 120 字'],
  ['包里有 HTML', (f) => f.set('media/x.html', enc.encode('<script>')) && f, 'media/x.html', '不收'],
  ['包里有 SVG', (f) => f.set('media/x.svg', enc.encode('<svg/>')) && f, 'media/x.svg', '不收'],
  ['包里有 GIF', (f) => f.set('media/x.gif', enc.encode('GIF89a')) && f, 'media/x.gif', 'gif2mp4'],
  ['包里有别的顶层文件', (f) => f.set('readme.txt', enc.encode('hi')) && f, 'readme.txt', '只许有'],
  ['路径带大写', (f) => f.set('media/A.png', new Uint8Array(8)) && f, 'media/A.png', '不允许的字符'],
  ['隐藏文件', (f) => f.set('media/.ds', new Uint8Array(1)) && f, 'media/.ds', '隐藏'],
  ['扩展名与内容不符', (f) => f.set('media/a.jpg', PNG(4, 4)) && blocks(f, [{ t: 'img', src: 'media/a.jpg', alt: '图', w: 4, h: 4 }]), 'media/a.jpg', '内容却是 png'],
  ['img 标的尺寸不对', (f) => f.set('media/a.png', PNG(40, 30)) && blocks(f, [{ t: 'img', src: 'media/a.png', alt: '图', w: 30, h: 40 }]), 'chapters/001.json', '实际是 40×30'],
  ['图片长边超 4096', (f) => f.set('media/a.png', PNG(5000, 10)) && blocks(f, [{ t: 'img', src: 'media/a.png', alt: '图', w: 5000, h: 10 }]), 'media/a.png', '长边超过 4096'],
  ['媒体里藏了 zip', (f) => f.set('media/a.png', new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])) && f, 'media/a.png', '嵌套'],
  ['缺 book.json', (f) => { f.delete('book.json'); return f }, 'book.json', '缺 book.json'],
  ['book.json 不是 JSON', (f) => f.set('book.json', enc.encode('{oops')) && f, 'book.json', 'JSON 解析失败'],
]

// 造一个只有头的 PNG(校验器只读到 IHDR)
function PNG(w, h) {
  const b = new Uint8Array(33)
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const dv = new DataView(b.buffer)
  dv.setUint32(16, w); dv.setUint32(20, h)
  return b
}

describe('坏样本逐条报对', () => {
  for (const [name, make, file, word] of BROKEN) {
    it(name, () => {
      const r = validate(make(base()))
      expect(r.ok).toBe(false)
      const hit = r.errors.find((e) => e.file === file && e.msg.includes(word))
      expect(hit, `应在 ${file} 报「${word}」,实际:\n${r.errors.map((e) => `${e.file}|${e.where}|${e.msg}`).join('\n')}`).toBeTruthy()
    })
  }
  it('错误指到块的下标与类型', () => {
    const e = errs(blocks(base(), [{ t: 'h2', x: '' }]))[0]
    expect(e).toMatchObject({ file: 'chapters/001.json', where: 'article.blocks[1](h2).x' })
  })
  it('没人引用的媒体只提示不报错', () => {
    const f = base()
    f.set('media/a.png', PNG(4, 4))
    const r = validate(f)
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.file === 'media/a.png' && w.msg.includes('没有任何地方引用'))).toBe(true)
  })
  it('同时命中两个领域:只带一个报错,两个都带才过', () => {
    const r = validate(edit(base(), 'book.json', (b) => { b.tags = ['中医', '风水']; b.disclaimer = 'medical' }))
    expect(r.errors.map((e) => e.msg).join()).toMatch(/divination/)
    expect(msgs(edit(base(), 'book.json', (b) => { b.tags = ['中医', '风水']; b.disclaimer = ['medical', 'divination'] }))).toBe('')
  })
  it('disclaimer 数组:可混自写一句;空数组、重复、超长报错', () => {
    expect(msgs(edit(base(), 'book.json', (b) => { b.category = '健身'; b.disclaimer = ['medical', '本书动作均需在教练指导下练习。'] }))).toBe('')
    expect(msgs(edit(base(), 'book.json', (b) => { b.disclaimer = [] }))).toMatch(/不能为空/)
    expect(msgs(edit(base(), 'book.json', (b) => { b.disclaimer = ['medical', 'medical'] }))).toMatch(/disclaimer\[1\].*重复/)
    expect(msgs(edit(base(), 'book.json', (b) => { b.disclaimer = ['medical', '声'.repeat(121)] }))).toMatch(/disclaimer\[1\].*超过 120 字/)
    expect(msgs(edit(base(), 'book.json', (b) => { b.disclaimer = ['medical', 3] }))).toMatch(/disclaimer\[1\]/)
    expect(summarize(edit(base(), 'book.json', (b) => { b.disclaimer = ['medical', 'divination'] })).disclaimer).toEqual(['medical', 'divination'])
  })
  it('宽词不误伤:「五四运动」「天文星座」不要求声明', () => {
    expect(msgs(edit(base(), 'book.json', (b) => { b.tags = ['五四运动', '天文星座', 'Fortune 500'] }))).toBe('')
  })
  it('非 digest 书不卡引文数与长度;digest 16 条正好通过', () => {
    expect(msgs(blocks(base(), [...Array.from({ length: 20 }, () => ({ t: 'quote', x: '引'.repeat(120) })), { t: 'fig', fig: { kind: 'quote', text: '引'.repeat(110) } }]))).toBe('')
    const d = edit(base(), 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } })
    expect(msgs(blocks(d, [...Array.from({ length: 14 }, () => ({ t: 'quote', x: '引一句' })), { t: 'pull', x: '金句' }, { t: 'fig', fig: { kind: 'quote', text: '卡' } }]))).toBe('')
  })
  it('theme 可只给一项', () => { expect(msgs(edit(base(), 'book.json', (b) => { b.theme = { paper: '#FFFFFF' } }))).toBe('') })
  it('g- 前缀(书房)合法;保留 id 表只在一处', () => {
    expect(msgs(edit(base(), 'book.json', (b) => { b.id = 'g-neijing-daodu' }))).toBe('')
    expect(RESERVED_IDS).toEqual(expect.arrayContaining(['daodejing', 'lunyu', 'sunzi', 'guiguzi', 'zhuangzi', 'yijing']))
  })
  it('词表只在一处、中英都有', () => {
    for (const d of Object.values(DISCLAIMER_VOCAB)) { expect(d.zh.length).toBeGreaterThan(10); expect(d.en.length).toBeGreaterThan(5) }
  })
})

describe('行内记号、路径、字数', () => {
  it('checkInline', () => {
    expect(checkInline('**a** `**` [x](https://a.org/b)')).toEqual([])
    expect(checkInline('**a')).toHaveLength(1)
    expect(checkInline('[x](ftp://a.org)')).toHaveLength(1)
    expect(checkInline('[](https://a.org)')).toHaveLength(1)
  })
  it('checkPath', () => {
    for (const ok of ['book.json', 'chapters/001.json', 'media/sub/a-b_c.1.png']) expect(checkPath(ok)).toBeNull()
    for (const bad of ['../x', '/etc/passwd', 'a//b', 'media/.x', 'Media/a.png', 'a\\b', 'c:/x', 'media/中.png']) expect(checkPath(bad), bad).not.toBeNull()
  })
  it('textLen 不计空白与 **', () => { expect(textLen(' **加粗** 字\n')).toBe(3) })
  it('fig 结构检查与 desk-baihua-spec 一致的几条', () => {
    expect(checkFigShape({ kind: 'gua', guas: [{ name: '乾', form: 'hex' }], yao: Array.from({ length: 6 }, (_, i) => ({ label: `爻${i}` })) })).toEqual([])
    expect(checkFigShape({ kind: 'gua', guas: [{ name: '乾', form: 'tri' }, { name: '坤', form: 'tri' }], yao: Array.from({ length: 6 }, () => ({ label: '爻' })) })).toContain('有 yao 时 guas 应只有一个六画卦')
    expect(checkFigShape({ kind: 'gua', guas: [{ name: '同人', form: 'tri' }] })[0]).toContain('八经卦')
  })
})

describe('媒体头', () => {
  it('读 png / jpg / mp4 的尺寸与时长', () => {
    const f = sample('sample-book')
    expect(readImageInfo(f.get('media/pendulum-geometry.png'))).toEqual({ type: 'png', w: 1200, h: 900 })
    expect(readImageInfo(f.get('media/cover.jpg'))).toEqual({ type: 'jpg', w: 800, h: 1200 })
    const v = readMp4Info(f.get('media/swing.mp4'))
    expect(v).toMatchObject({ ok: true, w: 480, h: 360, video: 'avc1', audio: null, faststart: true })
    expect(v.sec).toBeCloseTo(4, 0)
  })
  it('读 webp 三种头', () => {
    const riff = (chunk, body) => { const b = new Uint8Array(40); b.set(enc.encode('RIFF'), 0); b.set(enc.encode('WEBP'), 8); b.set(enc.encode(chunk), 12); b.set(body, 20); return b }
    expect(readImageInfo(riff('VP8X', [0, 0, 0, 0, 99, 0, 0, 49, 0, 0]))).toEqual({ type: 'webp', w: 100, h: 50 })
    const bits = (300 - 1) | ((200 - 1) << 14)
    expect(readImageInfo(riff('VP8L', [0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]))).toEqual({ type: 'webp', w: 300, h: 200 })
    expect(readImageInfo(riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 64, 1, 32, 1]))).toEqual({ type: 'webp', w: 320, h: 288 })
  })
  it('认不出的不报尺寸', () => { expect(readImageInfo(new Uint8Array([1, 2, 3]))).toEqual({ type: null, w: null, h: null }) })
})

describe('zip', () => {
  it('往返一致、确定性输出', async () => {
    const f = sample('sample-book')
    const a = await zip(f)
    const b = await zip(new Map([...f].reverse()))
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    const u = await unzip(a)
    expect([...u.keys()].sort()).toEqual([...f.keys()].sort())
    for (const [k, v] of f) expect(Buffer.from(u.get(k)).equals(Buffer.from(v)), k).toBe(true)
    expect(validate(u).ok).toBe(true)
  })
  it('能读系统 zip 工具打的包(含目录条目、deflate)', async () => {
    const { execFileSync } = await import('node:child_process')
    const os = await import('node:os')
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deskbook-zip-'))
    const out = path.join(tmp, 'x.deskbook')
    try { execFileSync('zip', ['-qrX', out, '.'], { cwd: path.join(SAMPLES, 'sample-classic') }) } catch { return } // 没有 zip 命令就跳过
    const u = await unzip(new Uint8Array(fs.readFileSync(out)))
    expect(validate(u).ok).toBe(true)
    fs.rmSync(tmp, { recursive: true, force: true })
  })
  const evil = async (name) => zip(new Map([['book.json', enc.encode('{}')], [name, enc.encode('x')]]))
  for (const name of ['../evil.json', '/etc/passwd', 'media/../../x.json', 'Book.json', 'media/.hidden', 'a\\..\\b']) {
    it(`拒绝路径「${name}」(zip-slip 等)`, async () => { await expect(unzip(await evil(name))).rejects.toThrow(/路径不合规/) })
  }
  it('拒绝嵌套 zip(按扩展名与按内容)', async () => {
    await expect(unzip(await evil('media/inner.zip'))).rejects.toThrow(/嵌套/)
    const inner = await zip(new Map([['a.json', enc.encode('{}')]]))
    await expect(unzip(await zip(new Map([['media/a.png', inner]])))).rejects.toThrow(/嵌套/)
  })
  it('拒绝超限:章文件解开超 2 MB', async () => {
    const big = new Uint8Array(LIMITS.chapterBytes + 1).fill(32)
    await expect(unzip(await zip(new Map([['chapters/001.json', big]])))).rejects.toThrow(/超过上限/)
  })
  it('拒绝谎报大小的炸弹:边解边判,不等解完', async () => {
    const big = new Uint8Array(LIMITS.chapterBytes * 3).fill(32) // 6 MB 空格,压缩后只有几 KB
    const z = await zip(new Map([['chapters/001.json', big]]))
    const dv = new DataView(z.buffer)
    dv.setUint32(22, 100, true) // 本地头里的原长
    const cd = z.length - 22 - (46 + 'chapters/001.json'.length)
    expect(dv.getUint32(cd, true)).toBe(0x02014b50)
    dv.setUint32(cd + 24, 100, true) // 中央目录里的原长
    await expect(unzip(z)).rejects.toThrow(/超过上限/)
  })
  it('拒绝加密条目', async () => {
    const z = await evil('chapters/001.json')
    const dv = new DataView(z.buffer)
    // 改中央目录里每一条的标志位
    for (let i = 0; i < z.length - 4; i++) if (dv.getUint32(i, true) === 0x02014b50) dv.setUint16(i + 8, 1, true)
    await expect(unzip(z)).rejects.toThrow(/加密/)
  })
  it('拒绝数据区重叠 / 指向同一块数据', async () => {
    const z = await zip(new Map([['book.json', enc.encode('{"a":1}')], ['chapters/001.json', enc.encode('{"b":2}')]]))
    const dv = new DataView(z.buffer)
    const cds = []
    for (let i = 0; i < z.length - 4; i++) if (dv.getUint32(i, true) === 0x02014b50) cds.push(i)
    dv.setUint32(cds[1] + 42, dv.getUint32(cds[0] + 42, true), true)
    await expect(unzip(z)).rejects.toThrow()
  })
  it('拒绝不是 zip 的东西、CRC 不对的', async () => {
    await expect(unzip(enc.encode('hello world, this is not a zip file'))).rejects.toThrow(/不是 zip/)
    const z = await zip(new Map([['book.json', enc.encode('{"title":"x"}')]]))
    const dv = new DataView(z.buffer)
    dv.setUint32(14, crc32(enc.encode('other')), true)
    for (let i = 0; i < z.length - 4; i++) if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 16, crc32(enc.encode('other')), true)
    await expect(unzip(z)).rejects.toThrow(/CRC/)
  })
})

// ── 结构定义:用一个极小的 JSON Schema 检查器核示例书包都满足 schema,坏样本不满足 ──
const schemas = Object.fromEntries(['book', 'chapter', 'fig', 'mindmap', 'overview'].map((n) => [`${n}.json`, JSON.parse(fs.readFileSync(path.join(SCHEMA, `${n}.json`), 'utf8'))]))
function schemaCheck(s, v, doc, at = '$', out = []) {
  if (s === true || s === undefined) return out
  if (s === false) { out.push(`${at}: false`); return out }
  if (s.$ref) {
    const [file, frag] = s.$ref.split('#')
    const target = file ? schemas[file] : doc
    let node = target
    if (frag) for (const k of frag.split('/').filter(Boolean)) node = node[k]
    schemaCheck(node, v, target, at, out)
  }
  const T = (t) => (t === 'integer' ? Number.isInteger(v) : t === 'number' ? typeof v === 'number' : t === 'object' ? v && typeof v === 'object' && !Array.isArray(v) : t === 'array' ? Array.isArray(v) : t === 'null' ? v === null : typeof v === t)
  if (s.type && !(Array.isArray(s.type) ? s.type.some(T) : T(s.type))) { out.push(`${at}: 应为 ${s.type}`); return out }
  if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(v)) out.push(`${at}: 应为 ${JSON.stringify(s.const)}`)
  if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) out.push(`${at}: 不在 enum`)
  if (typeof v === 'string') {
    if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) out.push(`${at}: 不合 ${s.pattern}`)
    if (s.minLength !== undefined && [...v].length < s.minLength) out.push(`${at}: 太短`)
    if (s.maxLength !== undefined && [...v].length > s.maxLength) out.push(`${at}: 太长`)
  }
  if (typeof v === 'number') {
    if (s.minimum !== undefined && v < s.minimum) out.push(`${at}: < minimum`)
    if (s.maximum !== undefined && v > s.maximum) out.push(`${at}: > maximum`)
    if (s.exclusiveMinimum !== undefined && v <= s.exclusiveMinimum) out.push(`${at}: <= exclusiveMinimum`)
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) out.push(`${at}: 项太少`)
    if (s.maxItems !== undefined && v.length > s.maxItems) out.push(`${at}: 项太多`)
    if (s.items) v.forEach((x, i) => schemaCheck(s.items, x, doc, `${at}[${i}]`, out))
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const r of s.required || []) if (!(r in v)) out.push(`${at}: 缺 ${r}`)
    for (const [k, sub] of Object.entries(s.properties || {})) if (k in v) schemaCheck(sub, v[k], doc, `${at}.${k}`, out)
    if (s.additionalProperties !== undefined) for (const k of Object.keys(v)) if (!(k in (s.properties || {}))) schemaCheck(s.additionalProperties, v[k], doc, `${at}.${k}`, out)
  }
  const ok = (sub) => schemaCheck(sub, v, doc, at, []).length === 0
  if (s.allOf) for (const sub of s.allOf) schemaCheck(sub, v, doc, at, out)
  if (s.anyOf && !s.anyOf.some(ok)) out.push(`${at}: anyOf 都不满足`)
  if (s.oneOf) { const n = s.oneOf.filter(ok).length; if (n !== 1) out.push(`${at}: oneOf 满足 ${n} 个`) }
  if (s.not && ok(s.not)) out.push(`${at}: 不应满足 not`)
  if (s.if) { if (ok(s.if)) { if (s.then) schemaCheck(s.then, v, doc, at, out) } else if (s.else) schemaCheck(s.else, v, doc, at, out) }
  return out
}
const bySchema = (name, v) => schemaCheck(schemas[name], v, schemas[name])

describe('JSON Schema 与校验器一致', () => {
  for (const name of ['sample-book', 'sample-collection', 'sample-classic', 'sample-fitness']) {
    it(`${name} 满足 book / chapter / fig 三份 schema`, () => {
      const f = sample(name)
      expect(bySchema('book.json', J(f, 'book.json'))).toEqual([])
      if (f.has('mindmap.json')) expect(bySchema('mindmap.json', J(f, 'mindmap.json'))).toEqual([])
      if (f.has('overview.json')) expect(bySchema('overview.json', J(f, 'overview.json'))).toEqual([])
      for (const p of f.keys()) if (p.startsWith('chapters/')) expect(bySchema('chapter.json', J(f, p)), p).toEqual([])
    })
  }
  it('坏样本 schema 也拦得住', () => {
    const ch = (blocks) => ({ no: 1, title: '一', article: { blocks } })
    expect(bySchema('chapter.json', ch([{ t: 'html', x: 'a' }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'outline', items: [{ x: '1', children: [{ x: '2', children: [{ x: '3', children: [{ x: '4', children: [{ x: '5' }] }] }] }] }] }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'img', src: 'media/a.svg', alt: 'a', w: 1, h: 1 }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'fig', fig: { kind: 'cols', cols: [{ head: 'a', lines: [] }] } }]))).not.toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), source: { type: 'digest' } })).not.toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), id: 'Bad' })).not.toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), disclaimer: ['medical', '自写一句'] })).toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), disclaimer: [] })).not.toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), id: 'daodejing' })).not.toEqual([])
    expect(bySchema('book.json', { ...J(sample('sample-book'), 'book.json'), id: 'my-book' })).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'quote', o: '原文', x: '引' }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'quote', x: '引', tr: '译' }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'quote', o: '原文', tr: '译' }, { t: 'quote', x: '引', by: '某' }]))).toEqual([])
    const sm = J(sample('sample-collection'), 'book.json')
    sm.chapters[0].summary = '一\n二'
    expect(bySchema('book.json', sm)).not.toEqual([])
  })
  it('schema 里的上限与 LIMITS 相同', () => {
    const b = schemas['book.json'].properties
    expect(b.summary['x-deskbook-maxChars']).toBe(LIMITS.summary)
    expect(b.description['x-deskbook-maxChars']).toBe(LIMITS.description)
    expect(b.disclaimer['x-deskbook-maxChars']).toBe(LIMITS.disclaimer)
    expect(b.tags.maxItems).toBe(LIMITS.tags)
    expect(b.chapters.maxItems).toBe(LIMITS.chapters)
    expect(b.chapters.items.properties.summary['x-deskbook-maxChars']).toBe(LIMITS.chapterSummary)
    const n = schemas['chapter.json'].properties.segs.items.properties.n.items.properties
    expect(n.d['x-deskbook-maxChars']).toBe(LIMITS.noteD)
    expect(n.x['x-deskbook-maxChars']).toBe(LIMITS.noteXMax)
    expect(schemas['fig.json'].$defs.text['x-deskbook-maxChars']).toBe(LIMITS.figString)
  })
})

describe('按范围读取:readDirectory + extractEntry', () => {
  const PKG = path.join(HERE, '../../public/desk/standard/samples')
  for (const name of ['sample-book', 'sample-collection', 'sample-classic', 'sample-fitness']) {
    it(`${name}:只取末尾若干字节列出条目,再按条目范围解出 book.json 与每个文件`, async () => {
      const whole = new Uint8Array(fs.readFileSync(path.join(PKG, `${name}.deskbook`)))
      const files = await unzip(whole)
      const tailLen = Math.min(whole.length, 66 * 1024)
      const entries = readDirectory(whole.subarray(whole.length - tailLen), whole.length)
      expect(entries.map((e) => e.path).sort()).toEqual([...files.keys()].sort())
      for (const e of entries) {
        expect(Object.keys(e).sort()).toEqual(['compressedSize', 'crc', 'localHeaderOffset', 'method', 'path', 'size'])
        const { start, end } = entryRange(e)
        const data = await extractEntry(whole.subarray(start, Math.min(end, whole.length)), e)
        expect(Buffer.from(data).equals(Buffer.from(files.get(e.path))), e.path).toBe(true)
      }
      const book = JSON.parse(dec.decode(await extractEntry(whole.subarray(entries.find((e) => e.path === 'book.json').localHeaderOffset), entries.find((e) => e.path === 'book.json'))))
      expect(book.format).toBe('deskbook')
    })
  }
  it('末尾字节不够时给出 needBytes,补足后成功', async () => {
    const whole = new Uint8Array(fs.readFileSync(path.join(PKG, 'sample-book.deskbook')))
    let need
    try { readDirectory(whole.subarray(whole.length - 200), whole.length); expect.unreachable() } catch (e) { expect(e).toBeInstanceOf(ZipError); need = e.needBytes }
    expect(need).toBeGreaterThan(200)
    expect(readDirectory(whole.subarray(whole.length - need), whole.length).length).toBeGreaterThan(5)
  })
  it('extractEntry:字节不够报 needBytes,位置不对、炸弹都拒绝', async () => {
    const whole = new Uint8Array(fs.readFileSync(path.join(PKG, 'sample-classic.deskbook')))
    const entries = readDirectory(whole, whole.length)
    const e = entries.find((x) => x.path === 'chapters/001.json')
    await expect(extractEntry(whole.subarray(e.localHeaderOffset, e.localHeaderOffset + 40), e)).rejects.toMatchObject({ needBytes: expect.any(Number) })
    await expect(extractEntry(whole.subarray(e.localHeaderOffset + 1), e)).rejects.toThrow(/本地文件头/)
    await expect(extractEntry(whole.subarray(e.localHeaderOffset), { ...e, path: 'chapters/002.json' })).rejects.toThrow(/不一致/)
    // 谎报大小:目录说 100 字节,实际 6 MB
    const big = new Uint8Array(LIMITS.chapterBytes - 10).fill(32)
    const z = await zip(new Map([['chapters/001.json', big]]))
    const [entry] = readDirectory(z, z.length)
    expect(entry.compressedSize).toBeLessThan(10000)
    await expect(extractEntry(z, { ...entry, size: 100 })).rejects.toThrow(/超过上限/)
  })
  it('readDirectory 与 unzip 同样拒绝不合规的路径', async () => {
    const z = await zip(new Map([['book.json', enc.encode('{}')], ['../x.json', enc.encode('x')]]))
    expect(() => readDirectory(z, z.length)).toThrow(/路径不合规/)
  })
})

describe('字数(标准 §3「字数怎么数」)', () => {
  it('只数 \\p{L} \\p{N}:不数标点、空白、记号', () => {
    expect(countText('道可道，非常道。 **Ab** 12!')).toBe(10)
  })
  it('现代书:只数正文类块;cap、alt、code、图解里的字不计', () => {
    const f = blocks(base(), [
      { t: 'h2', x: '小题' }, { t: 'quote', x: '引一句', by: '某' }, { t: 'callout', tone: 'note', label: '签', items: ['提示'] },
      { t: 'outline', items: [{ x: '甲', children: [{ x: '乙' }] }] }, { t: 'refs', items: ['出处'] },
      { t: 'code', x: 'abcdef' }, { t: 'fig', cap: '图注', fig: { kind: 'notes', lines: ['图里的字'] } },
    ])
    // 正文 2 + 小题 2 + 引一句某 4 + 签提示 3 + 甲乙 2 + 出处 2 = 15
    const r = countChars(f)
    expect(r.chars).toBe(15)
    expect(r.chapters).toEqual([{ no: 1, chars: 15, articleChars: 15 }])
    expect(validate(f).stats.chars).toBe(15)
  })
  it('典籍:chars 只数原文 o,深读另计 articleChars;summarize 都报', () => {
    const f = base('classic') // o = 道可道，非常道。 → 6;文章 导语。正文。 → 4
    expect(countChars(f)).toMatchObject({ chars: 6, articleChars: 4 })
    expect(summarize(f)).toMatchObject({ chars: 6, articleChars: 4 })
    expect(summarize(base())).not.toHaveProperty('articleChars')
  })
  it('示例书包的字数与 summarize 一致', () => {
    for (const n of ['sample-book', 'sample-classic']) {
      const f = sample(n)
      expect(summarize(f).chars).toBe(countChars(f).chars)
      expect(countChars(f).chars).toBeGreaterThan(100)
    }
  })
})

describe('中央目录上限', () => {
  it('EOCD 记载的中央目录超过 16 MB 即拒绝(unzip 与 readDirectory)', async () => {
    const z = await zip(new Map([['book.json', enc.encode('{}')]]))
    new DataView(z.buffer).setUint32(z.length - 22 + 12, LIMITS.centralDirBytes + 1, true)
    await expect(unzip(z)).rejects.toThrow(/中央目录.*超过上限/)
    expect(() => readDirectory(z, z.length)).toThrow(/中央目录.*超过上限/)
  })
})

describe('全书脑图(§10)', () => {
  const mm = (root, f = base()) => { edit(f, 'book.json', (b) => { b.mindmap = 'mindmap.json' }); return put(f, 'mindmap.json', { root }) }
  const deep = (n) => (n === 1 ? { label: `第${n}层` } : { label: `第${n}层`, children: [deep(n - 1)] })
  it('sample-book 的脑图:16 个节点,ch 指向存在的章;summarize 报节点数;不计入字数', () => {
    const f = sample('sample-book')
    const s = summarize(f)
    expect(s.mindmapNodes).toBe(16)
    const g = new Map(f); g.delete('mindmap.json'); edit(g, 'book.json', (b) => { delete b.mindmap })
    expect(countChars(g).chars).toBe(countChars(f).chars)
    expect(summarize(g).mindmapNodes).toBe(0)
  })
  it('合法的最小脑图', () => { expect(msgs(mm({ label: '中心', ch: 1, children: [{ label: '一支', note: '展开' }] }))).toBe('') })
  const BAD = [
    ['book.json 写了但包里没有', (f) => edit(f, 'book.json', (b) => { b.mindmap = 'mindmap.json' }), 'book.json', '不在包里'],
    ['包里有但 book.json 没写', (f) => put(f, 'mindmap.json', { root: { label: '中心' } }), 'mindmap.json', '没写'],
    ['mindmap 字段写了别的路径', (f) => edit(put(f, 'mindmap.json', { root: { label: '中心' } }), 'book.json', (b) => { b.mindmap = 'media/m.json' }), 'book.json', '路径固定'],
    ['放在子目录里', (f) => f.set('chapters/mindmap.json', enc.encode('{}')) && f, 'chapters/mindmap.json', '章文件名'],
    ['缺 root', (f) => edit(put(f, 'mindmap.json', { label: '中心' }), 'book.json', (b) => { b.mindmap = 'mindmap.json' }), 'mindmap.json', '顶层应为'],
    ['节点缺 label', (f) => mm({ label: '中心', children: [{ note: '只有展开' }] }, f), 'mindmap.json', '缺 label'],
    ['label 超 60 字', (f) => mm({ label: '字'.repeat(61) }, f), 'mindmap.json', '超过 60 字'],
    ['label 换行', (f) => mm({ label: '一\n二' }, f), 'mindmap.json', '只许一行'],
    ['note 超长', (f) => mm({ label: '中心', note: '字'.repeat(1501) }, f), 'mindmap.json', '超过 1500 字'],
    ['ch 不存在', (f) => mm({ label: '中心', children: [{ label: '一', ch: 9 }] }, f), 'mindmap.json', '章号'],
    ['多余字段 id', (f) => mm({ label: '中心', id: 'root' }, f), 'mindmap.json', '没有「id」'],
    ['空 children', (f) => mm({ label: '中心', children: [] }, f), 'mindmap.json', '非空数组'],
    ['六层', (f) => mm(deep(6), f), 'mindmap.json', '至多 5 层'],
    ['** 不成对', (f) => mm({ label: '中心', note: '**半边' }, f), 'mindmap.json', '不成对'],
    ['节点太多', (f) => mm({ label: '中心', children: Array.from({ length: 600 }, (_, i) => ({ label: `支${i}` })) }, f), 'mindmap.json', '超过 600 个'],
  ]
  for (const [name, make, file, word] of BAD) {
    it(name, () => {
      const r = validate(make(base()))
      expect(r.errors.find((e) => e.file === file && e.msg.includes(word)), r.errors.map(formatIssueLine).join('\n')).toBeTruthy()
    })
  }
  it('错误指到节点路径', () => {
    const r = validate(mm({ label: '中心', children: [{ label: '一' }, { label: '二' }, { label: '三', children: [{ label: '', note: 'x' }] }] }))
    expect(r.errors[0]).toMatchObject({ file: 'mindmap.json', where: 'root.children[2].children[0].label' })
  })
  it('五层正好通过;schema 拦六层与多余字段', () => {
    expect(msgs(mm(deep(5)))).toBe('')
    expect(bySchema('mindmap.json', { root: deep(5) })).toEqual([])
    expect(bySchema('mindmap.json', { root: deep(6) })).not.toEqual([])
    expect(bySchema('mindmap.json', { root: { label: '中心', id: 'x' } })).not.toEqual([])
    expect(schemas['mindmap.json'].$defs.label['x-deskbook-maxChars']).toBe(LIMITS.mindmapLabel)
    expect(schemas['mindmap.json'].$defs.note['x-deskbook-maxChars']).toBe(LIMITS.mindmapNote)
  })
})
const formatIssueLine = (e) => `${e.file}|${e.where}|${e.msg}`

describe('ask 块', () => {
  it('合法;q、a 都计字数,不算引用(digest 也不卡)', () => {
    const d = edit(base(), 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } })
    const f = blocks(d, [{ t: 'ask', q: '为什么?', a: '答'.repeat(300) }])
    expect(msgs(f)).toBe('')
    expect(countChars(f).chars).toBe(2 + 3 + 300)
  })
  const BAD = [
    ['缺 a', { t: 'ask', q: '问' }, '缺文字'],
    ['缺 q', { t: 'ask', a: '答' }, '缺文字'],
    ['q 超 120 字', { t: 'ask', q: '问'.repeat(121), a: '答' }, '超过 120 字'],
    ['q 换行', { t: 'ask', q: '一\n二', a: '答' }, '只许一行'],
    ['a 超 600 字', { t: 'ask', q: '问', a: '答'.repeat(601) }, '超过 600 字'],
    ['a 里 ** 不成对', { t: 'ask', q: '问', a: '**答' }, '不成对'],
  ]
  for (const [name, b, word] of BAD) it(name, () => { expect(msgs(blocks(base(), [b]))).toContain(word) })
  it('schema', () => {
    const ch = (bl) => ({ no: 1, title: '一', article: { blocks: bl } })
    expect(bySchema('chapter.json', ch([{ t: 'ask', q: '问', a: '答' }]))).toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'ask', q: '问' }]))).not.toEqual([])
    expect(bySchema('chapter.json', ch([{ t: 'ask', q: '一\n二', a: '答' }]))).not.toEqual([])
  })
})

describe('全书总览(§11)', () => {
  const ov = (o, f = base()) => { edit(f, 'book.json', (b) => { b.overview = 'overview.json' }); return put(f, 'overview.json', o) }
  const OK = { title: '总览', idea: '一句话', blocks: [{ t: 'lead', x: '导语。' }, { t: 'ask', q: '问', a: '答' }] }
  it('sample-book 带总览与两处 ask;summarize 报 overviewChars 且计入 chars', () => {
    const f = sample('sample-book')
    const s = summarize(f)
    expect(s.overviewChars).toBeGreaterThan(100)
    const g = new Map(f); g.delete('overview.json'); edit(g, 'book.json', (b) => { delete b.overview })
    expect(s.chars - countChars(g).chars).toBe(s.overviewChars)
    expect(validate(f).stats.blockTypes.ask).toBe(2)
  })
  it('合法的总览;典籍的总览计入 articleChars 不计入 chars', () => {
    expect(msgs(ov(OK))).toBe('')
    const c = ov(OK, base('classic'))
    expect(msgs(c)).toBe('')
    const plain = countChars(base('classic'))
    expect(countChars(c)).toMatchObject({ chars: plain.chars, articleChars: plain.articleChars + 4, overviewChars: 4 }) // 导语 2 + 问 1 + 答 1(title、idea 不计)
    expect(summarize(base())).not.toHaveProperty('overviewChars')
  })
  const BAD = [
    ['写了但包里没有', (f) => edit(f, 'book.json', (b) => { b.overview = 'overview.json' }), 'book.json', '不在包里'],
    ['包里有但没写', (f) => put(f, 'overview.json', OK), 'overview.json', '没写'],
    ['路径不对', (f) => edit(put(f, 'overview.json', OK), 'book.json', (b) => { b.overview = 'chapters/000.json' }), 'book.json', '路径固定'],
    ['放进子目录', (f) => f.set('media/overview.json', enc.encode('{}')) && f, 'media/overview.json', '媒体只收'],
    ['没有 p 或 lead', (f) => ov({ blocks: [{ t: 'h2', x: '题' }] }, f), 'overview.json', '至少一个 p 或 lead'],
    ['两处 pull', (f) => ov({ blocks: [{ t: 'p', x: '正' }, { t: 'pull', x: '一' }, { t: 'pull', x: '二' }] }, f), 'overview.json', '至多 1 处'],
    ['题头图不在包里', (f) => ov({ ...OK, head: 'media/h.jpg' }, f), 'overview.json', '不在包里'],
    ['不认识的块', (f) => ov({ blocks: [{ t: 'p', x: '正' }, { t: 'html' }] }, f), 'overview.json', '不认识的块类型'],
    ['digest 总览引文 17 条', (f) => ov({ blocks: [{ t: 'p', x: '正' }, ...Array.from({ length: 17 }, () => ({ t: 'quote', x: '引' }))] }, edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } })), 'overview.json', '至多 16 条'],
    ['digest 总览引文超 100 字', (f) => ov({ blocks: [{ t: 'p', x: '正' }, { t: 'pull', x: '引'.repeat(101) }] }, edit(f, 'book.json', (b) => { b.source = { type: 'digest', of: { title: '原书', author: '某' } } })), 'overview.json', '至多 100 字'],
  ]
  for (const [name, make, file, word] of BAD) {
    it(name, () => {
      const r = validate(make(base()))
      expect(r.errors.find((e) => e.file === file && e.msg.includes(word)), r.errors.map(formatIssueLine).join('\n')).toBeTruthy()
    })
  }
  it('错误指到 overview.json 的块下标', () => {
    const r = validate(ov({ blocks: [{ t: 'p', x: '正' }, { t: 'h2', x: '' }] }))
    expect(r.errors[0]).toMatchObject({ file: 'overview.json', where: 'blocks[1](h2).x' })
  })
  it('脑图的 ch 只指章(总览不占章号)', () => {
    const f = ov(OK)
    edit(f, 'book.json', (b) => { b.mindmap = 'mindmap.json' })
    put(f, 'mindmap.json', { root: { label: '中心', ch: 2 } })
    expect(msgs(f)).toMatch(/章号/)
  })
  it('schema', () => {
    expect(bySchema('overview.json', OK)).toEqual([])
    expect(bySchema('overview.json', { title: 'x' })).not.toEqual([])
    expect(bySchema('overview.json', { ...OK, head: 'media/a.gif' })).not.toEqual([])
  })
})
