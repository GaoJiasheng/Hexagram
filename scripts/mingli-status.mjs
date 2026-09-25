// 观数(mingli)组内容进度盘点——**接手续跑前先跑这个**,以磁盘为准,不信文档里的数字。
// 用法: node scripts/mingli-status.mjs
// 打印:各书 章/段/译/断句/白话 · 三命通会逐卷译注进度 · 精选白话甲乙档完成数 · 源头书 pieces 是否已定 · 滴天髓遗留 callout 数 · 剩余清单
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const exists = (p) => fs.existsSync(path.join(ROOT, p))
const texts = J('src/data/mingli/texts.json')
const punct = exists('scripts/authored/mingli-punct.json') ? J('scripts/authored/mingli-punct.json') : {}

// 三命通会精选选目(与 docs/todo.md §0.1 一致;改选目两处同改)
export const SANMING_JIA = [1, 9, 11, 13, 18, 25, 28, 33, 34, 36, 40, 42, 46, 54, 63, 92, 93, 94, 95, 96, 97, 99, 100, 101, 103, 104, 105, 106, 121, 184, 191, 255, 256, 257, 258, 260, 261, 262, 263, 395, 397, 398, 399]
export const SANMING_YI = [2, 8, 15, 16, 19, 26, 35, 41, 44, 48, 53, 69, 70, 77, 78, 79, 80, 81, 107, 108, 119, 122, 132, 168, 259, 389, 391, 392, 400, 402, 408, 414]
export const WUXING_SKIP = [2, 6, 12, 17, 28, 43, 46]   // 五行大义的段目章(只有一行「第 X 论某某就此分为 N 段」),不写白话

console.log('== 观数 · 逐书 ==')
const rows = []
for (const t of texts) {
  const b = J(`src/data/mingli/classics/${t.slug}.json`)
  const chs = b.chapters
  const paras = chs.reduce((a, c) => a + c.paragraphs.length, 0)
  const tr = chs.reduce((a, c) => a + c.paragraphs.filter((p) => p.translation).length, 0)
  const PUNCT_BOOKS = new Set(['sanming', 'lixuzhong', 'yuzhao'])   // 四库白文本才有断句层(与 gen-zhuzi-wf 同表)
  const pu = PUNCT_BOOKS.has(t.slug) && punct[t.slug] ? Object.values(punct[t.slug]).reduce((a, c) => a + (Array.isArray(c) ? c.filter(Boolean).length : Object.keys(c).length), 0) : null
  const bhp = `src/data/mingli/baihua/${t.slug}.json`
  const bh = exists(bhp) ? Object.keys(J(bhp)).length : 0
  const target = t.pieces ? t.pieces.length : t.slug === 'wuxingdayi' ? chs.length - WUXING_SKIP.length : t.slug === 'sanming' ? SANMING_JIA.length + SANMING_YI.length : chs.length
  // 译 < 段 的 done 书(滴天髓/穷通)是命例行照录不译,属正常;三命通会译 < 段 才是没做完
  rows.push({ 书: t.title, slug: t.slug, status: t.status, 章: chs.length, 段: paras, 译: `${tr}/${paras}`, 断句: pu == null ? '-' : `${pu}/${paras}`, 白话: `${bh}/${target}${t.pieces ? '(pieces)' : ''}`, 导读: exists(`src/data/mingli/daodu/${t.slug}.json`) ? '✓' : '✗' })
}
console.table(rows)

// 三命通会逐卷
const sm = J('src/data/mingli/classics/sanming.json').chapters
const byJuan = new Map()
for (const c of sm) {
  const j = (c.title || '').split(' · ')[0] || '?'
  const r = byJuan.get(j) || { 卷: j, 章: 0, 首章: c.no, 末章: c.no, 段: 0, 译: 0 }
  r.章++; r.末章 = c.no; r.段 += c.paragraphs.length; r.译 += c.paragraphs.filter((p) => p.translation).length
  byJuan.set(j, r)
}
console.log('== 三命通会 · 逐卷译注(译 < 段 的卷就是还没做的)==')
console.table([...byJuan.values()].map((r) => ({ ...r, 状态: r.译 === r.段 ? '✓' : r.译 === 0 ? '未做' : `${r.译}/${r.段}` })))

// 精选白话
const smBh = exists('src/data/mingli/baihua/sanming.json') ? J('src/data/mingli/baihua/sanming.json') : {}
const doneJia = SANMING_JIA.filter((n) => smBh[String(n)]), doneYi = SANMING_YI.filter((n) => smBh[String(n)])
console.log(`== 三命通会精选白话 == 甲档 ${doneJia.length}/${SANMING_JIA.length} · 乙档 ${doneYi.length}/${SANMING_YI.length}`)
const restJia = SANMING_JIA.filter((n) => !smBh[String(n)]), restYi = SANMING_YI.filter((n) => !smBh[String(n)])
if (restJia.length) console.log(`  甲档未做 --chapters=${restJia.join(',')}`)
if (restYi.length) console.log(`  乙档未做 --chapters=${restYi.join(',')}`)

// 源头书 pieces
console.log('== 源头书细粒度白话(pieces)==')
for (const slug of ['lixuzhong', 'luoluzi', 'yuzhao']) {
  const t = texts.find((x) => x.slug === slug)
  console.log(`  ${t.title}: ${t.pieces ? `pieces 已定 ${t.pieces.length} 篇` : '**pieces 未定**(texts.json 加 pieces 后 gen-baihua-wf 才认;定法见 docs/todo.md §0.1 续跑手册第 3 步)'}`)
}
const wx = exists('src/data/mingli/baihua/wuxingdayi.json') ? Object.keys(J('src/data/mingli/baihua/wuxingdayi.json')).map(Number) : []
const wxRest = sm && J('src/data/mingli/classics/wuxingdayi.json').chapters.map((c) => c.no).filter((n) => !WUXING_SKIP.includes(n) && !wx.includes(n))
console.log(`  五行大义: ${wx.length}/41${wxRest.length ? `,未做 ${wxRest.length} 章(gen 用 --skip=${WUXING_SKIP.join(',')})` : ' ✓'}`)

// 滴天髓遗留 callout
if (exists('src/data/mingli/baihua/ditiansui.json')) {
  const d = J('src/data/mingli/baihua/ditiansui.json'); let n = 0
  for (const ch of Object.values(d)) for (const b of ch.blocks || []) if (b.type === 'callout' && /底本|讹|疑作|当作|误作/.test(JSON.stringify(b))) n++
  console.log(`== 滴天髓白话「底本存疑」callout 遗留: ${n} 处(379 条讹字已入 typoFixes,这些措辞待改「已据见证本校正」或删;0 即清完)`)
}
console.log('\n规矩:起批前读 get_usage(周 ≥77% 不起、80% 硬线、5 小时 ≥85% 不起);一次只跑一个 workflow;opus 起草 / sonnet 校对;不部署不发 iOS。续跑手册:docs/todo.md §0.1')
