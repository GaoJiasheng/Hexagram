// 观象 · 书桌 —— 官方典籍书单(唯一一份):build-desk-packs.mjs(内容包)、fig-sources.mjs(图解转换的白话来源)、
// gen-art.mjs(出插画的书目)都从这里取。
//   · 首发六本(bundled: true,随 App 带核心包):id、拼法、模板、主题色一律照旧写死,包的字节不变。
//   · 其余各书从站内数据派生:书目次序与「有 classics 数据才算」照 scripts/lib/xiangzhu.mjs 的 allBooks();
//     id = slug(与别组或六本撞名时才加 corpus 前缀,见 COLLISIONS);category 用站内的门类名;主题色从该组的站色(src/index.css)推出。
// 改这里不改别处:加书 = 站内加书(texts.json + classics),这张表自动跟上。
import fs from 'node:fs'
import path from 'node:path'
import { allBooks, textsOf, FIRST_BATCH, ROOT } from '../lib/xiangzhu.mjs'
import { SITES } from '../../src/sites/registry.js'

// 门类:书桌「添书 → 典籍」按这个次序分栏(站内门户 FAMILIES 的次序:易道 → 儒释心 → 诸子 → 方术 → 集部)。
// 名字取站内对读者的叫法;诗词曲三组在门户里同属「集部 · 诗词曲文」,书桌里并成一栏「诗词曲」。
export const CATEGORY_OF = {
  yijing: '易', dao: '道',
  ru: '儒', fo: '佛', xin: '心学',
  fa: '法', mo: '墨', bing: '兵', zong: '纵横', moulue: '谋略',
  zhongyi: '中医', mingli: '命理',
  tangshi: '诗词曲', songci: '诗词曲', yuanqu: '诗词曲', guwen: '古文',
}
export const CATEGORIES = [...new Set(Object.values(CATEGORY_OF))]

// 首发六本:与此前 build-desk-packs.mjs 里的 BOOKS 逐字相同(只多 category / bundled 两个清单字段)
const FIRST_SIX = [
  { id: 'daodejing', template: 'duanzhang', sources: [['dao', 'daodejing']], theme: { accent: '#2E7D86', accent2: '#C7673F', paper: '#F7F5EE' } },
  { id: 'lunyu', template: 'yulu', sources: [['ru', 'lunyu']], theme: { accent: '#A65A2E', accent2: '#3F6F5A', paper: '#F8F4EA' } },
  { id: 'sunzi', template: 'pianzhang', sources: [['bing', 'sunzi']], theme: { accent: '#8C3B2F', accent2: '#3D5A6C', paper: '#F6F3EC' } },
  { id: 'guiguzi', template: 'pianzhang', sources: [['zong', 'guiguzi']], theme: { accent: '#5B4B8A', accent2: '#B8862F', paper: '#F5F3EE' } },
  { id: 'zhuangzi', template: 'pianzhang', title: '庄子', unit: '篇',
    sources: [['dao', 'zhuangzi-neipian', '内篇'], ['dao', 'zhuangzi-waipian', '外篇'], ['dao', 'zhuangzi-zapian', '杂篇']],
    theme: { accent: '#3F7A4E', accent2: '#D08A2E', paper: '#F6F6EC' } },
  // 易经:六十四卦(hexagrams.json)+ 独立成篇的十翼五种(classics/),数据形态不同,走 buildYijing
  { id: 'yijing', template: 'gua', title: '周易', unit: '卦', build: 'yijing',
    era: '先秦', attribution: '旧题伏羲画卦、文王系辞、孔子作传', summary: '六十四卦 · 十翼',
    brief: '六十四卦卦爻辞与十翼传文,以阴阳爻画说变化之理的群经之首。',
    theme: { accent: '#7A4E9A', accent2: '#C9892B', paper: '#F6F4EE' } },
].map((b) => ({ ...b, category: CATEGORY_OF[b.sources ? b.sources[0][0] : 'yijing'], bundled: true }))

// 体裁模板(App 里只有 yulu 语录体会在每条前标条号;其余按篇章排)
const YULU = new Set(['ru/mengzi', 'ru/jinsilu', 'xin/chuanxilu', 'moulue/caigentan', 'moulue/weiluyehua', 'moulue/xiaochuangyouji'])
const templateOf = (corpus, slug, meta) => (YULU.has(`${corpus}/${slug}`) ? 'yulu' : (meta?.sections || 0) <= 1 ? 'duanzhang' : 'pianzhang')

// ── 主题色:该组站色(src/index.css :root 里的 --<accent>)作主色;辅色取色相对面、饱和度压低;纸色是主色掺一点进暖白
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const rgb2hex = (c) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
function rgb2hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function hsl2rgb([h, s, l]) {
  if (!s) return [l, l, l]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p }
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
}
let siteColors = null
function siteColor(name) {
  if (!siteColors) {
    const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8')
    const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')))
    siteColors = Object.fromEntries([...root.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]))
  }
  return siteColors[name]
}
export function themeOfGroup(group) {
  const site = SITES.find((s) => s.group === group || s.key === group)
  const accent = siteColor(site?.accent || 'cinnabar') || '#C3272B'
  const [h, s, l] = rgb2hsl(hex2rgb(accent))
  const accent2 = rgb2hex(hsl2rgb([(h + 0.42) % 1, Math.min(0.5, Math.max(0.32, s)), Math.min(0.5, Math.max(0.4, l))]))
  const base = hex2rgb('#F8F5EE'), a = hex2rgb(accent)
  const paper = rgb2hex(base.map((x, i) => x * 0.965 + a[i] * 0.035))
  return { accent: accent.toUpperCase(), accent2, paper }
}

// ── 书单
const SIX_SLUGS = new Set(FIRST_BATCH)
// 显式改名(撞名时):'<corpus>/<slug>' → id。由 resolveIds 自动填,这里留给日后手工指定
const RENAME = {}
export const COLLISIONS = []

function deriveBooks() {
  const out = []
  const taken = new Set(FIRST_SIX.map((b) => b.id))
  const derived = allBooks().filter((b) => !SIX_SLUGS.has(b.id))
  const slugCount = {}
  for (const b of derived) slugCount[b.slug] = (slugCount[b.slug] || 0) + 1
  for (const { corpus, slug } of derived) {
    const meta = textsOf(corpus).find((t) => t.slug === slug)
    let id = RENAME[`${corpus}/${slug}`] || slug
    if (taken.has(id) || slugCount[slug] > 1) { const was = id; id = `${corpus}-${slug}`; COLLISIONS.push(`${corpus}/${slug}:id「${was}」已被占用 → ${id}`) }
    taken.add(id)
    out.push({
      id, category: CATEGORY_OF[corpus] || '其他', group: corpus,
      template: templateOf(corpus, slug, meta),
      sources: [[corpus, slug]],
      theme: themeOfGroup(corpus),
      bundled: false,
    })
  }
  return out
}

export const DESK_BOOKS = [...FIRST_SIX, ...deriveBooks()]
export const bookById = (id) => DESK_BOOKS.find((b) => b.id === id)

// 书 → 站内白话文件(corpus/slug,对应 src/data/<corpus>/baihua/<slug>.json)
export function baihuaSources(b) {
  if (b.build === 'yijing') return ['yijing/hexagrams', 'yijing/xici-shang', 'yijing/xici-xia', 'yijing/shuogua', 'yijing/xugua', 'yijing/zagua']
  return b.sources.map(([c, s]) => `${c}/${s}`)
}
