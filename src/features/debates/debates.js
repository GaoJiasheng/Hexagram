import index from '../../data/debates/index.json'

// 《赛博:百家争鸣》数据层(v21)——index.json 列已建辩题 + 46 题路线;各辩一文件懒加载。
const loaders = import.meta.glob('../../data/debates/*.json')

export const EPIGRAPH = index.epigraph        // 系辞题词
export const TOPICS = index.topics            // 已建辩题(列表/每日一辩读此,不必载文件)
export const PLANNED = index.planned          // 路线图(整理中)

// 入场家所属组 → 主色 token。debate 走中立 portal 外壳(per-site --cinnabar 不激活),
// 故直接用根级 accent token(自适应明暗)。中医/谋略不入场,无需配色。
const GROUP_ACCENT = {
  ru: 'var(--confucian)', xin: 'var(--xinxue)', dao: 'var(--azure)',
  fo: 'var(--buddha)', fa: 'var(--legalist)', mo: 'var(--mohist)',
  bing: 'var(--military)', zong: 'var(--zongheng)', yijing: 'var(--cinnabar)',
}
export function groupAccent(group) { return GROUP_ACCENT[group] || 'var(--ink-soft)' }

// 头像印章用「派名」(owner:不用门户的观X品牌,直接儒家/道家/法家…),按 group 映射;
// 均 2 字、与原观X字数一致、布局不变。数据里的 s.seal 不再用于显示(新辩自动适配)。
const GROUP_SEAL = {
  ru: '儒家', xin: '心学', dao: '道家', fo: '佛家',
  fa: '法家', mo: '墨家', bing: '兵家', zong: '纵横', yijing: '易家',
}
export function schoolSeal(group) { return GROUP_SEAL[group] || group }

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
