import index from '../../data/debates/index.json'

// 《赛博:百家争鸣》数据层(v21)——index.json 列已建辩题 + 46 题路线;各辩一文件懒加载。
const loaders = import.meta.glob('../../data/debates/*.json')

// 白话导读(owner 2026-07-29:辩论页门槛高,另出整篇白话文章解释「他们到底在辩什么」)。
// 与辩本身分文件、懒加载;辩论页不改,入口挂在辩题列表。
const articleLoaders = import.meta.glob('../../data/debates/articles/*.json')
export const HAS_ARTICLE = new Set(
  Object.keys(articleLoaders).map((k) => k.split('/').pop().replace('.json', '')))
export async function loadDebateArticle(id) {
  const load = articleLoaders[`../../data/debates/articles/${id}.json`]
  if (!load) return null
  return (await load()).default
}

export const EPIGRAPH = index.epigraph        // 系辞题词
export const TOPICS = index.topics            // 已建辩题(列表/每日一辩读此,不必载文件)
export const PLANNED = index.planned          // 路线图(整理中)

// 入场家所属组 → 主色 token。debate 走中立 portal 外壳(per-site --cinnabar 不激活),
// 故直接用根级 accent token(自适应明暗)。中医/谋略不入场,无需配色。
const GROUP_ACCENT = {
  ru: 'var(--confucian)', xin: 'var(--xinxue)', dao: 'var(--azure)',
  fo: 'var(--buddha)', fa: 'var(--legalist)', mo: 'var(--mohist)',
  // yijing 用 --cinnabar-pure:辩论走中立 portal 外壳,而该壳把 --cinnabar 压成 --ink-soft
  // (即未知组的兜底色),易经会因此失色;--cinnabar-pure 是不被门户 muted 覆盖的真朱砂。
  bing: 'var(--military)', zong: 'var(--zongheng)', yijing: 'var(--cinnabar-pure)',
}
export function groupAccent(group) { return GROUP_ACCENT[group] || 'var(--ink-soft)' }

// 头像印章用「派名」(owner:不用门户的观X品牌,直接儒家/道家/法家…),按 group 映射;
// 均 2 字、与原观X字数一致、布局不变。数据里的 s.seal 不再用于显示(新辩自动适配)。
const GROUP_SEAL = {
  ru: '儒家', xin: '心学', dao: '道家', fo: '佛家',
  fa: '法家', mo: '墨家', bing: '兵家', zong: '纵横', yijing: '易家',
}
export function schoolSeal(group) { return GROUP_SEAL[group] || group }

// ── 分类体系(v21.1)────────────────────────────────────────
// 议题走两级树(义理四门 → 八类目),阵营/形态走筛选——因为一辩天然跨 2–4 家,
// 塞进单一父节点必然丢信息。四门本身即内容:它告诉读者诸子在争的是哪几件大事。
export const DIVISIONS = [
  { key: 'tiandao', label: '天道 · 形上', desc: '天与人、有与无、常与变——世界的根底' },
  { key: 'xinxing', label: '心性 · 生命', desc: '性善性恶、心之本体、生死苦乐——人的根底' },
  { key: 'zhidao', label: '治道 · 群己', desc: '治国、义利、爱与孝、礼乐——人间秩序如何立' },
  { key: 'weixue', label: '为学 · 知言', desc: '工夫、知行、名实、言意——如何求知与立言' },
]

// 各门下的类目次序(未列出的类目按首次出现追加,加新类目不会漏显)
const CATEGORY_ORDER = {
  tiandao: ['天人 · 形上 · 道'],
  xinxing: ['性与心', '生死 · 身 · 苦乐'],
  zhidao: ['治道与政治', '伦理 · 义利 · 爱孝', '礼 · 文 · 乐'],
  weixue: ['工夫与学', '名实 · 言辩 · 知'],
}

// 对辩形态(与议题正交:讲的是「谁跟谁辩」,不是「辩什么」)
export const FORMATS = [
  { key: 'intra', label: '组内多方' },
  { key: 'synthesis', label: '跨组会通' },
]

// 入场阵营(按现有家次降序固定,空档一目了然——正好是补辩题的路线图)
export const SCHOOL_GROUPS = ['ru', 'dao', 'mo', 'fa', 'xin', 'fo', 'bing', 'yijing', 'zong']

// 某门下按类目分好组的辩题:[{ category, topics }]
export function categoriesOf(division, topics = TOPICS) {
  const inDiv = topics.filter((t) => t.division === division)
  const order = CATEGORY_ORDER[division] || []
  const seen = [...order, ...inDiv.map((t) => t.category).filter((c) => !order.includes(c))]
  return [...new Set(seen)]
    .map((category) => ({ category, topics: inDiv.filter((t) => t.category === category) }))
    .filter((c) => c.topics.length)
}

// 一辩涉及的阵营(去重;三家参辩即跨三组,故为多值)
export function groupsOf(topic) { return [...new Set(topic.schools.map((s) => s.group))] }

// 一辩的参辩家(以 label 为准:check-data 已保证同一家全站同名同 key,故 label 可作稳定标识)
export function thinkersOf(topic) { return [...new Set(topic.schools.map((s) => s.label))] }

// 全站参辩家表,按出场辩数降序。阵营分面只到「儒家/道家」这一层,
// 但读者读完《荀子》想看的是「荀子跟谁辩过」——故另开一层。
export const THINKERS = (() => {
  const m = new Map()
  for (const t of TOPICS) {
    for (const s of t.schools) {
      const e = m.get(s.label) || { label: s.label, group: s.group, count: 0 }
      e.count += 1
      m.set(s.label, e)
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh'))
})()

export function debateById(id) { return TOPICS.find((t) => t.id === id) || null }

export async function loadDebate(id) {
  const loader = loaders[`../../data/debates/${id}.json`]
  if (!loader) return null
  return (await loader()).default
}

// 每日一辩:日期 hash 取一题(同「今日一卦/一章」确定性套路)
export function pickDailyDebate(date = new Date()) {
  if (!TOPICS.length) return null
  const s = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}|debate`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TOPICS[h % TOPICS.length]
}
