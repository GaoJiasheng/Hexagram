// 历法层 —— 公历 ↔ 四柱、节气交接时刻。
// 节气是天文计算,不能手写,用 lunar-javascript(~426KB,**只在此模块内懒加载**,不进首屏 bundle)。
// 规则层(./index.js)不依赖本文件;已知四柱的场景(书中命例)完全不需要加载历法库。
//
// ⚠️ 两处体系内部自己就没统一的分歧,**给开关、不替用户拍板**(design-v23 §4):
//   · 子时换日:sect=2(默认)晚子时(23 点后)日柱仍算当天;sect=1 算次日。
//   · 真太阳时:本层只认传入的钟表时间;是否按经度校正由调用方决定后再传入。

let _lib = null
async function lib() {
  if (!_lib) _lib = await import('lunar-javascript')
  return _lib
}

// 十二「节」(非「中气」)定月:立春起寅月,其后每节换一月。
export const JIE_OF_MONTH = ['立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒']

/**
 * 公历时刻 → 四柱。
 * @param {{year:number,month:number,day:number,hour?:number,minute?:number}} t 钟表时间
 * @param {{sect?:1|2}} [opts]
 * @returns {Promise<{pillars:string[], lunarText:string}>} pillars = [年,月,日,时]
 */
export async function pillarsFromDate(t, opts = {}) {
  const { Solar } = await lib()
  const solar = Solar.fromYmdHms(t.year, t.month, t.day, t.hour ?? 12, t.minute ?? 0, 0)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()
  ec.setSect(opts.sect === 1 ? 1 : 2)
  return {
    pillars: [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()],
    lunarText: `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
  }
}

/**
 * 某公历年的十二节交接时刻(立春 … 次年小寒),供「节气年轮」演示年柱/月柱在哪一刻切换。
 * @returns {Promise<{name:string, at:string}[]>} at 形如 '2024-02-04 16:27:07'
 */
export async function jieBoundaries(year) {
  const { Solar } = await lib()
  // 取年中一天的节气表:含当年立春至次年小寒。库里次年的小寒用 'XIAO_HAN' 作键。
  const table = Solar.fromYmd(year, 6, 15).getLunar().getJieQiTable()
  return JIE_OF_MONTH.map((name) => {
    const key = name === '小寒' ? 'XIAO_HAN' : name
    return { name, at: table[key].toYmdHms() }
  })
}

/**
 * 某公历年里三个常被混为一谈的「新年」:元旦、春节(农历正月初一)、立春。
 * 「节气年轮」用它演示:八字的年柱只认立春。
 * @returns {Promise<{yuandan:string, chunjie:string, lichun:string}>} 形如 '2024-02-10'/'2024-02-04 16:27:07'
 */
export async function newYearMarks(year) {
  const { Lunar, Solar } = await lib()
  const chunjie = Lunar.fromYmd(year, 1, 1).getSolar().toYmd()
  const lichun = Solar.fromYmd(year, 6, 15).getLunar().getJieQiTable()['立春'].toYmdHms()
  return { yuandan: `${year}-01-01`, chunjie, lichun }
}

/**
 * 大运排列(排盘台用;**只给排列,不作任何吉凶判断**)。
 * @param {object} t 同 pillarsFromDate
 * @param {'男'|'女'} gender 顺逆由年干阴阳与性别共同决定,库内已按通行之法处理
 */
export async function daYun(t, gender, opts = {}) {
  const { Solar } = await lib()
  const ec = Solar.fromYmdHms(t.year, t.month, t.day, t.hour ?? 12, t.minute ?? 0, 0).getLunar().getEightChar()
  ec.setSect(opts.sect === 1 ? 1 : 2)
  const yun = ec.getYun(gender === '男' ? 1 : 0)
  return {
    start: { years: yun.getStartYear(), months: yun.getStartMonth(), days: yun.getStartDay() },
    forward: yun.isForward(),
    list: yun.getDaYun().filter((d) => d.getGanZhi()).map((d) => ({
      ganzhi: d.getGanZhi(), startAge: d.getStartAge(), startYear: d.getStartYear(),
    })),
  }
}
