// 梅花易数起卦引擎 — 纯函数，不依赖日历库
// 核心函数只收数字（nianZhi/yue/ri/shiZhi），日历换算在 lunarAdapter.js

// 先天卦数：乾1兑2离3震4巽5坎6艮7坤8
const TRIGRAM_BY_XIANTIAN = ['qian', 'dui', 'li', 'zhen', 'xun', 'kan', 'gen', 'kun']

// 经卦五行
const JING_ELEMENT = {
  qian: '金', dui: '金', li: '火', zhen: '木', xun: '木', kan: '水', gen: '土', kun: '土',
}

// 生克表
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE   = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

// 余 0 取除数本身（梅花通用约定）
function mod8(n) { const r = n % 8; return r === 0 ? 8 : r }
function mod6(n) { const r = n % 6; return r === 0 ? 6 : r }

function trigramAt(idx1) { return TRIGRAM_BY_XIANTIAN[idx1 - 1] }

/** 时间起卦
 * @param {{ nianZhi:number, yue:number, ri:number, shiZhi:number }} input
 *   - nianZhi: 年支序数 子=1…亥=12
 *   - yue: 农历月 1-12
 *   - ri: 农历日 1-30
 *   - shiZhi: 时支序数 子=1…亥=12（由 hourToShiZhi 换算）
 * @returns {{ upper, lower, dongYao, formula }}
 */
export function qiGuaByTime({ nianZhi, yue, ri, shiZhi }) {
  const sum3 = nianZhi + yue + ri
  const sum4 = sum3 + shiZhi
  return {
    upper: trigramAt(mod8(sum3)),
    lower: trigramAt(mod8(sum4)),
    dongYao: mod6(sum4),
    formula: { nianZhi, yue, ri, shiZhi, sum3, sum4 },
  }
}

/** 数字起卦（两数版）
 * @param {{ shu1:number, shu2:number }}
 * @returns {{ upper, lower, dongYao, formula }}
 */
export function qiGuaByNumber({ shu1, shu2 }) {
  const sum = shu1 + shu2
  return {
    upper: trigramAt(mod8(shu1)),
    lower: trigramAt(mod8(shu2)),
    dongYao: mod6(sum),
    formula: { shu1, shu2, sum },
  }
}

/** 小时 → 时支序数（子时=1，亥时=12）
 * 23:00-00:59 子，01:00-02:59 丑…
 */
export function hourToShiZhi(h) {
  return Math.floor(((h + 1) % 24) / 2) + 1
}

/** 体用关系
 * @param {string} upper  上卦 trigram key
 * @param {string} lower  下卦 trigram key
 * @param {number} dongYao 1-6
 * @returns {{ ti, yong, tiEl, yongEl, relation, text }}
 */
export function calcTiYong(upper, lower, dongYao) {
  // 动在下卦(1-3)：下卦为用、上卦为体；动在上卦(4-6)：上卦为用、下卦为体
  const ti   = dongYao <= 3 ? upper : lower
  const yong = dongYao <= 3 ? lower : upper
  const tiEl   = JING_ELEMENT[ti]
  const yongEl = JING_ELEMENT[yong]

  let relation, text
  if (yongEl === tiEl) {
    relation = '比和'; text = '谋事易成'
  } else if (SHENG[yongEl] === tiEl) {
    relation = '用生体'; text = '顺遂有助'
  } else if (SHENG[tiEl] === yongEl) {
    relation = '体生用'; text = '泄耗，劳而少功'
  } else if (KE[yongEl] === tiEl) {
    relation = '用克体'; text = '多阻，不利'
  } else {
    relation = '体克用'; text = '可成而费力'
  }

  return { ti, yong, tiEl, yongEl, relation, text }
}

/** 参断：单经卦与体的生克关系 */
export function paramDuan(trigram, tiEl) {
  const el = JING_ELEMENT[trigram]
  if (!el) return null
  if (el === tiEl)           return { el, relation: '比和', text: '平稳' }
  if (SHENG[el] === tiEl)    return { el, relation: '生体', text: '助益' }
  if (SHENG[tiEl] === el)    return { el, relation: '体生', text: '泄耗' }
  if (KE[el] === tiEl)       return { el, relation: '克体', text: '阻碍' }
  return                            { el, relation: '体克', text: '制胜' }
}

export { JING_ELEMENT }
