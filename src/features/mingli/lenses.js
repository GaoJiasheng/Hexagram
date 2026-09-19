// 三派对读的计算层(design-v23 §7「贯通件」)。同一个八字,三本书从三个地方下手:
//   《子平真诠》先看月令定格局 · 《穷通宝鉴》先问寒暖燥湿 · 《滴天髓》先论旺衰
// 前两个镜头**完全由规则层算出**(不写一个字的判断):格局走 determineGeju,调候查调候矩阵。
// 第三个镜头是任铁樵自己的话(走读数据)。三家结论未必一致——这里只摆出各自从哪里下手。
import { cangGan } from '../shared/ganzhi/index.js'
import { determineGeju } from '../shared/ganzhi/geju.js'
import { chapterParts } from '../reader/chapterParts.js'

export const MONTH_OF_ZHI = { 寅: '正月', 卯: '二月', 辰: '三月', 巳: '四月', 午: '五月', 未: '六月', 申: '七月', 酉: '八月', 戌: '九月', 亥: '十月', 子: '十一月', 丑: '十二月' }
const GAN = '甲乙丙丁戊己庚辛壬癸'

/** 四柱 → 格局镜头。透干 = 月令藏干里,出现在年/月/时干上的那几个(日干是「我」,不算透)。 */
export function gejuLens(pillars) {
  const [y, m, d, h] = pillars
  const dayGan = d[0], monthZhi = m[1]
  const others = [y[0], m[0], h[0]]
  const tou = cangGan(monthZhi).filter((g) => others.includes(g))
  const r = determineGeju(dayGan, monthZhi, tou)
  const qs = new URLSearchParams({ d: dayGan, z: monthZhi, ...(tou.length ? { t: tou.join('') } : {}) })
  return { ...r, tou, flowHref: `/mingli/zhenquan/geju?${qs}`, chapterHref: `/mingli/zhenquan/${r.geju.ch}` }
}

/** 四柱 + 调候矩阵(+ 穷通底本,用来算分屏)→ 调候镜头。查不到返回 null。 */
export function tiaohouLens(pillars, matrix, book, meta) {
  const dayGan = pillars[2][0], month = MONTH_OF_ZHI[pillars[1][1]]
  const cell = (matrix?.cells || []).find((c) => c.gan === dayGan && c.month === month)
  if (!cell) return null
  const no = GAN.indexOf(dayGan) + 2
  const ch = book?.chapters.find((c) => c.no === no)
  const parts = ch ? chapterParts(ch, meta) : null
  const pi = parts ? parts.findIndex((pt) => cell.para >= pt.from && cell.para < pt.to) : -1
  return { ...cell, dayGan, monthName: month, href: `/mingli/qiongtong/${no}${pi > 0 ? `?p=${pi + 1}` : ''}#p${cell.para + 1}` }
}
