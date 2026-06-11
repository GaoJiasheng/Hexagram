import hexagramsRaw from '../../data/yijing/hexagrams.json'
import trigramsRaw from '../../data/yijing/trigrams.json'

export const allHexagrams = hexagramsRaw
export const allTrigrams = trigramsRaw

export const hexagramById = new Map(hexagramsRaw.map(h => [h.id, h]))
export const hexagramByBinary = new Map(hexagramsRaw.map(h => [h.binary, h]))
export const trigramById = Object.fromEntries(trigramsRaw.map(t => [t.id, t]))

export function getHexagram(id) {
  return hexagramById.get(Number(id))
}

export function getHexagramByBinary(binary) {
  return hexagramByBinary.get(binary)
}

// 经卦按王弼卦序排列(乾兑离震巽坎艮坤)
export const TRIGRAM_ORDER = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun']

// 8×8 上下卦矩阵 — TABLE[upper][lower] = hexagram
export const TABLE = (() => {
  const t = {}
  for (const h of hexagramsRaw) {
    if (!t[h.upperTrigram]) t[h.upperTrigram] = {}
    t[h.upperTrigram][h.lowerTrigram] = h
  }
  return t
})()

// 汉字月份
const MONTHS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
export function formatDateChinese(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${MONTHS[parseInt(m, 10)]}月${parseInt(d, 10)}日`
}

// 加载经传文件(动态import — 按路由懒加载)
const classicsCache = {}
export async function loadClassics(book) {
  if (classicsCache[book]) return classicsCache[book]
  const mod = await import(`../../data/yijing/classics/${book}.json`)
  classicsCache[book] = mod.default
  return mod.default
}

export const CLASSICS_META = [
  { key: 'xici-shang', title: '系辞上传', chapters: 12, desc: '论易之大道，阴阳之理，圣人制卦之意。' },
  { key: 'xici-xia', title: '系辞下传', chapters: 9, desc: '续论易道，八卦之形成，卦爻之变通。' },
  { key: 'shuogua', title: '说卦传', chapters: 11, desc: '论八卦之象德，阴阳万物之取象。' },
  { key: 'xugua', title: '序卦传', chapters: 2, desc: '论六十四卦前后相继之义。' },
  { key: 'zagua', title: '杂卦传', chapters: 1, desc: '以对举方式点明各卦卦义精要。' },
]
