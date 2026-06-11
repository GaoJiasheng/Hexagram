// 纳甲干支 — 京房体系，全算法生成
// 依赖 bagong.js 的宫五行

import { getPalace, PALACE_ELEMENT } from './bagong.js'

// 天干：内卦（下卦）用 inner，外卦（上卦）用 outer
const GAN = {
  qian: { inner: '甲', outer: '壬' },
  kun:  { inner: '乙', outer: '癸' },
  zhen: { inner: '庚', outer: '庚' },
  xun:  { inner: '辛', outer: '辛' },
  kan:  { inner: '戊', outer: '戊' },
  li:   { inner: '己', outer: '己' },
  gen:  { inner: '丙', outer: '丙' },
  dui:  { inner: '丁', outer: '丁' },
}

// 地支六位表（初→上），每经卦共 6 位；
// 做下卦时取前 3 位（index 0-2），做上卦时取后 3 位（index 3-5）
const ZHI = {
  qian: ['子','寅','辰','午','申','戌'],
  zhen: ['子','寅','辰','午','申','戌'],
  kan:  ['寅','辰','午','申','戌','子'],
  gen:  ['辰','午','申','戌','子','寅'],
  kun:  ['未','巳','卯','丑','亥','酉'],
  xun:  ['丑','亥','酉','未','巳','卯'],
  li:   ['卯','丑','亥','酉','未','巳'],
  dui:  ['巳','卯','丑','亥','酉','未'],
}

// 地支五行
const ZHI_ELEMENT = {
  子: '水', 亥: '水',
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  辰: '土', 戌: '土', 丑: '土', 未: '土',
}

// 五行相生：key 生 value
const SHENG = { 水: '木', 木: '火', 火: '土', 土: '金', 金: '水' }
// 五行相克：key 克 value
const KE = { 水: '火', 火: '金', 金: '木', 木: '土', 土: '水' }

function getLiuqin(yaoEl, gongEl) {
  if (yaoEl === gongEl) return '兄弟'
  if (SHENG[yaoEl] === gongEl) return '父母'   // 爻五行生宫五行 → 生我 → 父母
  if (SHENG[gongEl] === yaoEl) return '子孙'   // 宫五行生爻五行 → 我生 → 子孙
  if (KE[yaoEl] === gongEl) return '官鬼'      // 爻五行克宫五行 → 克我 → 官鬼
  if (KE[gongEl] === yaoEl) return '妻财'      // 宫五行克爻五行 → 我克 → 妻财
  return '未知'
}

// 从 binary 取经卦 key
function trigramKey(threeBits) {
  const MAP = {
    '111': 'qian', '110': 'dui', '101': 'li', '100': 'zhen',
    '011': 'xun',  '010': 'kan', '001': 'gen', '000': 'kun',
  }
  return MAP[threeBits]
}

/**
 * 返回一卦六爻的纳甲信息，pos 1=初爻 … 6=上爻。
 * @param {string} binary 六位 binary
 * @returns {Array<{ pos:number, gan:string, zhi:string, element:string, liuqin:string }>}
 */
export function getNajia(binary) {
  const lowerKey = trigramKey(binary.slice(0, 3))
  const upperKey = trigramKey(binary.slice(3, 6))
  const palace = getPalace(binary)
  if (!palace) return null
  const gongEl = palace.element

  const lowerGan = GAN[lowerKey].inner
  const upperGan = GAN[upperKey].outer
  const lowerZhi = ZHI[lowerKey]
  const upperZhi = ZHI[upperKey]

  const result = []
  // 下卦（位置 1-3，对应地支表 index 0-2）
  for (let i = 0; i < 3; i++) {
    const zhi = lowerZhi[i]
    const element = ZHI_ELEMENT[zhi]
    result.push({ pos: i + 1, gan: lowerGan, zhi, element, liuqin: getLiuqin(element, gongEl) })
  }
  // 上卦（位置 4-6，对应地支表 index 3-5）
  for (let i = 3; i < 6; i++) {
    const zhi = upperZhi[i]
    const element = ZHI_ELEMENT[zhi]
    result.push({ pos: i + 1, gan: upperGan, zhi, element, liuqin: getLiuqin(element, gongEl) })
  }
  return result
}

export { ZHI_ELEMENT }
