// 农历适配层 — 将 Date 转为梅花起卦所需的数字
// lunar-javascript 仅在此模块内懒加载，不影响首页 bundle

import { hourToShiZhi } from './meihua.js'

const ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

let _Solar = null

async function getSolar() {
  if (!_Solar) {
    const mod = await import('lunar-javascript')
    _Solar = mod.Solar
  }
  return _Solar
}

/** Date → 梅花起卦输入 + 显示字符串
 * @param {Date} date
 * @returns {Promise<{ nianZhi, yue, ri, shiZhi, displayStr, ganZhiYear }>}
 */
export async function dateToMeihuaInput(date) {
  const Solar = await getSolar()
  const solar = Solar.fromDate(date)
  const lunar = solar.getLunar()

  const nianZhi = lunar.getYearZhiIndex() + 1   // 0-based → 1-based (子=1)
  const yue     = Math.abs(lunar.getMonth())     // 闰月取正
  const ri      = lunar.getDay()
  const shiZhi  = hourToShiZhi(date.getHours())
  const ganZhiYear = lunar.getYearInGanZhi()
  const lunarMonthStr = (lunar.getMonth() < 0 ? '闰' : '') + MONTH_NAMES[yue - 1] + '月'
  const lunarDayStr = lunar.getDayInChinese()
  const shiStr = ZHI_NAMES[shiZhi - 1] + '时'
  const displayStr = `${ganZhiYear}年 ${lunarMonthStr}${lunarDayStr} ${shiStr}`

  return { nianZhi, yue, ri, shiZhi, displayStr, ganZhiYear }
}

export { ZHI_NAMES, MONTH_NAMES }
