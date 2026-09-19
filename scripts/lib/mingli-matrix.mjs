// 《穷通宝鉴》调候矩阵单格校验 —— assemble-matrix 与 check-data 共用同一份,免得两处规则走样。
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const MATRIX_MONTHS = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
// gist 是我们自己的话(转述原书给的寒暖燥湿之理),守「研习不断命」:不许带断语用字。
const VERDICT_RE = /[吉凶贵贱富贫寿夭祸福]/

/** @returns {string[]} 错误信息;空数组 = 合法 */
export function validateMatrixCell(rec, book) {
  const e = []
  if (!GAN.includes(rec.gan)) return [`gan 不是天干: ${rec.gan}`]
  if (!MATRIX_MONTHS.includes(rec.month)) return [`month 不合法: ${rec.month}`]
  const ch = book.chapters.find((c) => c.no === GAN.indexOf(rec.gan) + 2)   // 第 1 章是五行总论
  if (!ch) return ['找不到对应的章']
  const n = ch.paragraphs.length
  for (const f of ['para', 'quotePara']) if (!Number.isInteger(rec[f]) || rec[f] < 0 || rec[f] >= n) e.push(`${f} 越界: ${rec[f]}`)
  if (!Array.isArray(rec.yong) || rec.yong.length < 1 || rec.yong.length > 4) e.push('yong 须为 1–4 个天干')
  else for (const g of rec.yong) if (!GAN.includes(g)) e.push(`yong 里不是天干: ${g}`)
  if (typeof rec.quote !== 'string' || rec.quote.length < 2) e.push('缺 quote')
  if (e.length) return e
  if (!ch.paragraphs[rec.quotePara].original.includes(rec.quote)) e.push(`quote 不是第 ${rec.quotePara} 段的原文子串: ${rec.quote}`)
  for (const g of rec.yong) if (!rec.quote.includes(g)) e.push(`yong 的「${g}」不在 quote 里`)
  if (typeof rec.gist !== 'string' || !rec.gist) e.push('缺 gist')
  else if ([...rec.gist].length > 32) e.push(`gist 超 32 字`)
  else if (VERDICT_RE.test(rec.gist)) e.push(`gist 含断语用字: ${rec.gist}`)
  if (rec.shared != null && typeof rec.shared !== 'string') e.push('shared 须为字符串或 null')
  return e
}
