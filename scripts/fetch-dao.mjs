// 从维基文库抓取道藏六部经文,解析为站点数据文件(v6 §1.2)。
// 产出:src/data/dao/classics/{slug}.json
// 原则同易经管线:原文一律来自抓取结果,不允许手工凭记忆补写;译文来自 scripts/authored/dao-translations.json。
//
// 底本说明(以抓取时实际命中为准):
// - 道德经:「道德經 (王弼本)」(老子道德經注),==X章== 分章,王弼注文为 {{*|…}} 模板,清洗时自动剔除,只余通行本经文
// - 清静经/感应篇:正统道藏单页;清静经尾部有影印复刻({{Vtext}})与朗读外链,以 STOP_RE 截断
// - 庄子内篇:七子页,每页一章
// - 阴符经:主页是 djvu 校对页转嵌,直接抓 Page: 命名空间四页,==章题== 分三章
// - 参同契:35 个章子页(维基文库按 35 章分法,texts.json sections 以此为准)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, clean, isJunk as isJunkBase, createFetcher } from './lib/wikisource.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json') // 与易经管线共享缓存
const OUT_DIR = path.join(ROOT, 'src/data/dao/classics')

const { fetchPages } = createFetcher(CACHE_FILE)

// 道藏侧追加的垃圾行:外部链接行、未闭合的语言转换标记行、跨语言链接残文(fr:…)
const isJunk = (text) => isJunkBase(text) || /^\[http/.test(text) || /^-\{/.test(text) || /^[a-z]{2,3}:/i.test(text)

// 命中即停止解析本页(朗读/有声文献等页尾附件)
const STOP_RE = /Spoken_?Wikisource|有聲文獻|漢語普通話朗讀/

const CANTONGQI_PAGES = Array.from({ length: 35 }, (_, i) => `周易參同契/${String(i + 1).padStart(2, '0')}章`)
const YINFU_PAGES = [96, 97, 98, 99].map((n) => `Page:CADAL01045943 正統道藏(昃下).djvu/${n}`)

// 六部配置(v6 §1.2)。chapterHeaderRe:仅匹配的 == 标题 == 开新章(其余标题行忽略);
// dropPreface:丢弃首个章题之前的无题内容;mergeChapters:全页合为一章。
const BOOKS = [
  {
    slug: 'daodejing',
    title: '道德经',
    pages: ['道德經 (王弼本)'],
    chapterHeaderRe: /^[一二三四五六七八九十]+章$/,
    dropPreface: true,
    exactChapters: 81,
  },
  { slug: 'qingjingjing', title: '清静经', pages: ['太上老君說常清靜經'], mergeChapters: true, exactChapters: 1 },
  { slug: 'ganyingpian', title: '太上感应篇', pages: ['太上感應篇'], mergeChapters: true, exactChapters: 1 },
  {
    slug: 'zhuangzi-neipian',
    title: '庄子内篇',
    pages: ['莊子/逍遙遊', '莊子/齊物論', '莊子/養生主', '莊子/人間世', '莊子/德充符', '莊子/大宗師', '莊子/應帝王'],
    perPageChapter: true,
    exactChapters: 7,
  },
  // mergeParagraphs:校对页按物理行断行,句子跨行被切;每章合并为一段(阴符经各章本为连续短文)
  { slug: 'yinfujing', title: '阴符经', pages: YINFU_PAGES, dropPreface: true, exactChapters: 3, junkRe: /^黄帝阴符经$/, mergeParagraphs: true },
  { slug: 'cantongqi', title: '周易参同契', pages: CANTONGQI_PAGES, exactChapters: 35 },
  // 庄子补全(拓展 Wave 1b):外篇 15 + 杂篇 11,凑全《庄子》33 篇;子页 莊子/篇名,同内篇 perPageChapter。
  {
    slug: 'zhuangzi-waipian',
    title: '庄子外篇',
    pages: ['莊子/駢拇', '莊子/馬蹄', '莊子/胠篋', '莊子/在宥', '莊子/天地', '莊子/天道', '莊子/天運', '莊子/刻意', '莊子/繕性', '莊子/秋水', '莊子/至樂', '莊子/達生', '莊子/山木', '莊子/田子方', '莊子/知北遊'],
    perPageChapter: true,
    exactChapters: 15,
  },
  {
    slug: 'zhuangzi-zapian',
    title: '庄子杂篇',
    pages: ['莊子/庚桑楚', '莊子/徐無鬼', '莊子/則陽', '莊子/外物', '莊子/寓言', '莊子/讓王', '莊子/盜跖', '莊子/說劍', '莊子/漁父', '莊子/列禦寇', '莊子/天下'],
    perPageChapter: true,
    exactChapters: 11,
  },
  // 列子(冲虚真经)8 篇,凑道家「老·庄·列」三经;子页 列子/X篇(带「篇」,张湛注本通行)。
  {
    slug: 'liezi',
    title: '列子',
    pages: ['列子/天瑞篇', '列子/黃帝篇', '列子/周穆王篇', '列子/仲尼篇', '列子/湯問篇', '列子/力命篇', '列子/楊朱篇', '列子/說符篇'],
    perPageChapter: true,
    exactChapters: 8,
  },
  // 文子(通玄真经,Wave 6):黄老道家,12 卷子页 文子/卷一…卷十二(一卷一篇:道原/精诚/九守/符言…)。
  {
    slug: 'wenzi',
    title: '文子',
    pages: ['文子/卷一', '文子/卷二', '文子/卷三', '文子/卷四', '文子/卷五', '文子/卷六', '文子/卷七', '文子/卷八', '文子/卷九', '文子/卷十', '文子/卷十一', '文子/卷十二'],
    perPageChapter: true,
    exactChapters: 12,
  },
]

// ---------- 单页解析 ----------
function parsePage(wikitext, warnings, pageName, opts = {}) {
  const chapters = []
  let current = null
  for (const raw of wikitext.split('\n')) {
    if (STOP_RE.test(raw)) break
    const h = raw.match(/^(=+)\s*(.+?)\s*=+\s*$/)
    if (h) {
      const title = t2s(clean(h[2]))
      if (!title) continue
      // 注释/校勘类对照章节,跳过其下内容直到下一个标题
      if (/校勘|校注|注释|考异|凡例/.test(title)) {
        current = { skip: true, paragraphs: [] }
        continue
      }
      // 限定章题样式时,不匹配的标题(篇题/跋/音注等)同样进入跳过态,
      // 防止其下的序言/附录内容混入上一章(如王弼本下篇序、卷末跋)
      if (opts.chapterHeaderRe && !opts.chapterHeaderRe.test(title)) {
        current = { skip: true, paragraphs: [] }
        continue
      }
      current = { no: chapters.length + 1, title, paragraphs: [] }
      chapters.push(current)
      continue
    }
    const text = clean(raw.replace(/^[*#:;]+/, ''))
    if (isJunk(text)) continue
    const simp = t2s(text)
    if (opts.junkRe?.test(simp)) continue
    if (!current) {
      current = { no: 1, title: null, paragraphs: [] }
      chapters.push(current)
    }
    current.paragraphs.push({ original: simp, translation: null })
  }
  let kept = chapters.filter((c) => !c.skip && c.paragraphs.length > 0)
  if (opts.dropPreface) {
    const firstTitled = kept.findIndex((c) => c.title !== null)
    if (firstTitled > 0) kept = kept.slice(firstTitled)
  }
  if (!kept.length) warnings.push(`${pageName}: 解析后无任何章节`)
  return kept
}

// ---------- 主流程 ----------
async function main() {
  const warnings = []
  const errors = []
  const trPath = path.join(ROOT, 'scripts/authored/dao-translations.json')
  const translations = fs.existsSync(trPath) ? JSON.parse(fs.readFileSync(trPath, 'utf8')) : {}

  const allPages = BOOKS.flatMap((b) => b.pages)
  const pages = await fetchPages(allPages)

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []

  for (const book of BOOKS) {
    let chapters = []
    if (book.perPageChapter) {
      for (const page of book.pages) {
        const sub = parsePage(pages[page], warnings, page, book)
        const title = t2s(page.split('/')[1] ?? page)
        const paragraphs = sub.flatMap((c) => c.paragraphs)
        if (paragraphs.length) chapters.push({ no: chapters.length + 1, title, paragraphs })
        else warnings.push(`${page}: 无正文段落`)
      }
    } else {
      // 多页顺次解析(参同契章子页/阴符经校对页),章跨页续接
      for (const page of book.pages) {
        const sub = parsePage(pages[page], warnings, page, book)
        for (const c of sub) {
          if (c.title === null && chapters.length) {
            // 无题内容续接上一章(校对页跨页断章)
            chapters[chapters.length - 1].paragraphs.push(...c.paragraphs)
          } else {
            chapters.push(c)
          }
        }
      }
      if (book.dropPreface) {
        const firstTitled = chapters.findIndex((c) => c.title !== null)
        if (firstTitled > 0) chapters = chapters.slice(firstTitled)
      }
    }
    if (book.mergeChapters && chapters.length > 1) {
      chapters = [{ no: 1, title: null, paragraphs: chapters.flatMap((c) => c.paragraphs) }]
    }
    if (book.mergeParagraphs) {
      chapters = chapters.map((c) => ({
        ...c,
        paragraphs: [{ original: c.paragraphs.map((p) => p.original).join(''), translation: null }],
      }))
    }
    chapters = chapters.map((c, i) => ({ no: i + 1, title: c.title, paragraphs: c.paragraphs }))

    if (book.exactChapters && chapters.length !== book.exactChapters) {
      errors.push(`${book.title}: 应恰 ${book.exactChapters} 章,实得 ${chapters.length}`)
    }

    // 合并人工译文(章号 → 段序数组)
    const bookTr = translations[book.slug] ?? {}
    let trCount = 0
    for (const c of chapters) {
      const paras = bookTr[String(c.no)]
      if (!paras) continue
      c.paragraphs.forEach((p, i) => {
        if (paras[i]) {
          p.translation = paras[i]
          trCount++
        }
      })
    }

    const out = { book: book.slug, title: book.title, chapters }
    fs.writeFileSync(path.join(OUT_DIR, `${book.slug}.json`), JSON.stringify(out, null, 2) + '\n')
    const paraTotal = chapters.reduce((n, c) => n + c.paragraphs.length, 0)
    summary.push(`${book.title}: ${chapters.length} 章,${paraTotal} 段,译文 ${trCount} 段`)
  }

  for (const w of warnings) console.warn('⚠', w)
  for (const s of summary) console.log(s)
  if (errors.length) {
    for (const e of errors) console.error('✗', e)
    process.exit(1)
  }
  console.log(`已写入 ${OUT_DIR}(${BOOKS.length} 部)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
