// 观象 · 书桌 —— 典籍示例书包 sample-classic 的生成脚本(一次性,产物入库)。
// 原文与译文取 src/data/dao/classics/daodejing.json(维基文库王弼本经文,繁转简),
// 注取 src/data/dao/xiangzhu/daodejing.json(观象详注);章末深读文章写在下面。
// 用法:node scripts/desk/deskbook-samples/make-classic.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from '../deskbook-core.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT = path.join(ROOT, 'scripts/desk/deskbook-samples/sample-classic')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const classic = read('src/data/dao/classics/daodejing.json')
const xiangzhu = read('src/data/dao/xiangzhu/daodejing.json')

const PICK = [1, 8, 11]
const NAMES = { 1: '一章', 8: '八章', 11: '十一章' }

// 章末深读(本示例自写,短)
const ARTICLES = {
  1: {
    title: '说不出的,和说得出的',
    idea: '开篇先划一条线:能说出来的道已不是恒常的道,但人只能借名去指它。',
    blocks: [
      { t: 'lead', x: '《道德经》第一章先替全书立了一个前提:**能说出来的道,已经不是那个恒常的道**。后面八十章都是在这个前提下,用「似」「若」「强为之名」去说那说不尽的东西。' },
      { t: 'quote', o: '道可道，非常道，名可名，非常名；', tr: '可以言说的道，就不是恒常之道；可以称呼的名，就不是恒常之名。' },
      { t: 'p', x: '这里的「常」是恒久,不是今天「非常」的「很」。帛书本作「恒」,一般认为通行本改作「常」是避汉文帝刘恒的讳。' },
      { t: 'fig', fig: { kind: 'cols', title: '本章的两种读法', cols: [{ head: '王弼读法', lines: ['无名，天地之始', '有名，万物之母', '常无欲 / 常有欲'] }, { head: '宋人读法', lines: ['无，名天地之始', '有，名万物之母', '常无 / 常有'] }], foot: ['两读义理相近,侧重不同,至今并存'] } },
      { t: 'p', x: '两种断句都能讲通。王弼读法落在「名」与「欲」上,讲人怎样观照;宋人读法把「无」「有」提出来当一对概念,讲道本身的两面。本书译文从王弼本。' },
    ],
  },
  8: {
    title: '水的七种「善」',
    idea: '以水喻最高的善:利物而不争,居于人所厌恶的低处,因此近于道。',
    blocks: [
      { t: 'lead', x: '这一章用水作比喻。水的好处在于**利万物而不争**,而且肯待在众人都不愿去的低处。' },
      { t: 'p', x: '「居善地」以下七句,句式整齐,每句一个「善」字。它们讲的是处世的分寸:住处、心境、交往、言语、为政、做事、行动,各有其宜。最后一句收束:正因为不争,所以没有过失。' },
      { t: 'fig', fig: { kind: 'rows', title: '七个「善」', items: [{ head: '居善地', body: '居处善于择地' }, { head: '心善渊', body: '心境深静' }, { head: '与善仁', body: '交往仁爱' }, { head: '言善信', body: '言语守信' }, { head: '正善治', body: '为政善治' }, { head: '事善能', body: '做事发挥所长' }, { head: '动善时', body: '行动把握时机' }] } },
      { t: 'p', x: '「上善若水」常被当作励志语录引用。放回原章看,它的落点是「不争」,与第六十六章「以其不争，故天下莫能与之争」一脉相承。' },
    ],
  },
  11: {
    title: '空处的用',
    idea: '车毂、器皿、房屋都靠其中的空处发挥作用:有给人便利,无才成其用。',
    blocks: [
      { t: 'lead', x: '这一章举了三个日常的东西:车轮、陶器、房屋。它们的用处都在**空着的地方**。' },
      { t: 'fig', fig: { kind: 'table', heads: ['物', '有', '无(空处)'], rows: [['车', '三十根辐条', '毂中的孔,穿轴'], ['器', '揉成的陶土', '器中的空,盛物'], ['室', '墙与门窗', '室内的空,住人']] } },
      { t: 'p', x: '末句「故有之以为利，无之以为用」把三个例子收成一句:实的部分提供条件,空的部分才是用处所在。这是全书「有无相生」思想最直观的一处。' },
    ],
  },
}

// 注:k 须是该段原文的精确子串、同段不重叠;d ≤ 40、x ≤ 150(标准 §3)
const len = (s) => [...String(s).replace(/\s+/g, '')].length
function notesFor(no, i, o) {
  const list = (xiangzhu[no]?.[i] || []).filter((n) => o.includes(n.k) && len(n.d) <= 40 && (!n.x || len(n.x) <= 150))
  const spans = []
  const out = []
  for (const n of list) {
    const a = o.indexOf(n.k), b = a + n.k.length
    if (spans.some(([s, e]) => a < e && s < b)) continue
    spans.push([a, b])
    out.push({ k: n.k, d: n.d, ...(n.x ? { x: n.x } : {}), ...(n.r ? { r: n.r } : {}) })
  }
  return out
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, 'chapters'), { recursive: true })
const chapters = []
PICK.forEach((src, idx) => {
  const no = idx + 1
  const c = classic.chapters.find((x) => x.no === src)
  const segs = c.paragraphs.map((p, i) => {
    const n = notesFor(src, i, p.original)
    return { o: p.original, ...(p.translation ? { t: p.translation } : {}), ...(n.length ? { n } : {}) }
  })
  const file = `chapters/${String(no).padStart(3, '0')}.json`
  const ch = { no, title: NAMES[src], segs, article: ARTICLES[src] }
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(ch, null, 2) + '\n')
  chapters.push({ no, file, title: NAMES[src], subtitle: ARTICLES[src].title })
})
const book = {
  format: 'deskbook', version: 1, id: 'u-daodejing-sample-0b7d41c3', revision: 1, kind: 'classic',
  title: '道德经 · 三章', subtitle: '一章 · 八章 · 十一章',
  authors: ['观象书桌 示例'], lang: 'zh-Hans',
  summary: '从《道德经》里取三章:道与名、上善若水、有无之用,原文译文逐段对照,带字词注。',
  category: '道家', tags: ['道德经', '老子', '典籍'],
  source: { type: 'public-domain', note: '原文取维基文库《道德經》王弼本经文(王注已剔),繁转简;译文与注释为观象站内所作' },
  unit: '章',
  theme: { accent: '#5B6B4E', accent2: '#A8553A', paper: '#F6F3EA' },
  chapters,
  generator: 'make-classic.mjs',
}
fs.writeFileSync(path.join(OUT, 'book.json'), JSON.stringify(book, null, 2) + '\n')

const files = new Map()
const walk = (d, r = '') => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const rr = r ? `${r}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), rr); else files.set(rr, new Uint8Array(fs.readFileSync(path.join(d, e.name)))) } }
walk(OUT)
const r = validate(files)
console.log(r.ok ? `sample-classic 已生成,校验通过(${r.stats.segs} 段 ${r.stats.notes} 注)` : r.errors)
