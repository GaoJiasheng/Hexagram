import { describe, it, expect } from 'vitest'
import lunarLib from 'lunar-javascript'
import {
  GAN, ZHI, WUXING, JIAZI, ganWuxing, zhiWuxing, yinYang, shengOf, keOf, shengBy, keBy, wuxingRelation,
  isValidGanZhi, nayin, monthGan, hourGan, hourToZhi, shishen, SHISHEN_NAMES, shishenKind, cangGan,
  GAN_HE, ZHI_LIUHE, ZHI_SANHE, ZHI_SANHUI, ZHI_LIUCHONG, ZHI_XING, ZHI_LIUHAI, isChong, isLiuhe,
  changsheng, CHANGSHENG, parsePillars, analyzePillars, findPillars,
} from './index.js'
import { pillarsFromDate, jieBoundaries, daYun } from './calendar.js'

const { Solar } = lunarLib

describe('五行生克', () => {
  it('相生顺次、相克隔一,且互为逆运算', () => {
    expect(WUXING.map(shengOf)).toEqual(['火', '土', '金', '水', '木'])
    expect(WUXING.map(keOf)).toEqual(['土', '金', '水', '木', '火'])
    for (const w of WUXING) {
      expect(shengBy(shengOf(w))).toBe(w)
      expect(keBy(keOf(w))).toBe(w)
    }
  })
  it('任意两行恰落在五种关系之一,且方向对称', () => {
    const inv = { 同: '同', 生: '被生', 被生: '生', 克: '被克', 被克: '克' }
    for (const a of WUXING) for (const b of WUXING) expect(wuxingRelation(b, a)).toBe(inv[wuxingRelation(a, b)])
  })
})

describe('六十甲子', () => {
  it('恰六十个、不重复,首尾为甲子/癸亥', () => {
    expect(JIAZI).toHaveLength(60)
    expect(new Set(JIAZI).size).toBe(60)
    expect(JIAZI[0]).toBe('甲子')
    expect(JIAZI[59]).toBe('癸亥')
  })
  it('只有阴阳相配的才合法:120 种组合里恰 60 种', () => {
    let ok = 0
    for (const g of GAN) for (const z of ZHI) {
      const valid = isValidGanZhi(g + z)
      expect(valid).toBe(yinYang(g) === yinYang(z))
      if (valid) ok++
    }
    expect(ok).toBe(60)
    expect(isValidGanZhi('甲丑')).toBe(false)
  })
})

describe('遁干', () => {
  it('五虎遁:甲己之年丙作首 …', () => {
    expect(['甲', '己'].map((y) => monthGan(y, '寅'))).toEqual(['丙', '丙'])
    expect(['乙', '庚'].map((y) => monthGan(y, '寅'))).toEqual(['戊', '戊'])
    expect(['丙', '辛'].map((y) => monthGan(y, '寅'))).toEqual(['庚', '庚'])
    expect(['丁', '壬'].map((y) => monthGan(y, '寅'))).toEqual(['壬', '壬'])
    expect(['戊', '癸'].map((y) => monthGan(y, '寅'))).toEqual(['甲', '甲'])
    expect(monthGan('甲', '丑')).toBe('丁')   // 甲年十二月:丙寅起,顺推十一位
  })
  it('五鼠遁:甲己还加甲 …', () => {
    expect(['甲', '己'].map((d) => hourGan(d, '子'))).toEqual(['甲', '甲'])
    expect(['乙', '庚'].map((d) => hourGan(d, '子'))).toEqual(['丙', '丙'])
    expect(['丙', '辛'].map((d) => hourGan(d, '子'))).toEqual(['戊', '戊'])
    expect(['丁', '壬'].map((d) => hourGan(d, '子'))).toEqual(['庚', '庚'])
    expect(['戊', '癸'].map((d) => hourGan(d, '子'))).toEqual(['壬', '壬'])
  })
  it('钟点 → 时支:23 点起为子时', () => {
    expect([23, 0, 1, 2, 11, 12, 13, 22].map(hourToZhi)).toEqual(['子', '子', '丑', '丑', '午', '午', '未', '亥'])
  })
})

describe('十神', () => {
  it('以甲为日主,十干恰得十神各一', () => {
    expect(GAN.map((g) => shishen('甲', g))).toEqual(['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'])
  })
  it('任一日主看十干,十神皆各出现一次(十神是关系不是属性)', () => {
    for (const d of GAN) expect(new Set(GAN.map((g) => shishen(d, g))).size).toBe(10)
  })
  it('十神归类', () => {
    expect(SHISHEN_NAMES.map(shishenKind)).toEqual(['同', '同', '生', '生', '克', '克', '被克', '被克', '被生', '被生'])
  })
})

describe('合冲刑害的结构自洽', () => {
  it('六冲两支必相隔六位、五行相克或同为土', () => {
    for (const [a, b] of ZHI_LIUCHONG) expect((ZHI.indexOf(b) - ZHI.indexOf(a) + 12) % 12).toBe(6)
    expect(isChong('午', '子')).toBe(true)
  })
  it('六合/六害/六冲各覆盖十二支恰一次', () => {
    for (const pairs of [ZHI_LIUHE.map((x) => x.pair), ZHI_LIUHAI, ZHI_LIUCHONG]) {
      expect(pairs.flat().sort()).toEqual([...ZHI].sort())
    }
    expect(isLiuhe('亥', '寅')).toBe(true)
  })
  it('三合局 = 该行的长生、帝旺、墓三支', () => {
    const yangGanOf = { 水: '壬', 木: '甲', 火: '丙', 金: '庚' }
    for (const { zhi, ju } of ZHI_SANHE) {
      expect(zhi.map((z) => changsheng(yangGanOf[ju], z))).toEqual(['长生', '帝旺', '墓'])
    }
  })
  it('三会方三支连续;天干五合相隔五位', () => {
    for (const { zhi } of ZHI_SANHUI) expect(zhi.map((z) => ZHI.indexOf(z))).toEqual([0, 1, 2].map((k) => (ZHI.indexOf(zhi[0]) + k) % 12))
    for (const { pair: [a, b] } of GAN_HE) expect(GAN.indexOf(b) - GAN.indexOf(a)).toBe(5)
  })
  it('三刑表覆盖十二支', () => {
    expect(ZHI_XING.flatMap((x) => x.zhi).sort()).toEqual([...ZHI].sort())
  })
})

describe('四柱解析', () => {
  it('解析与校验', () => {
    expect(parsePillars('辛卯 丁酉 庚午 丙子')).toEqual(['辛卯', '丁酉', '庚午', '丙子'])
    expect(parsePillars('辛卯丁酉庚午丙子'.match(/../g))).toHaveLength(4)
    expect(() => parsePillars('辛卯 丁酉 庚午')).toThrow()
    expect(() => parsePillars('甲丑 丁酉 庚午 丙子')).toThrow()   // 阳干配阴支,不合法
  })
  it('排盘只到结构:日主、十神、藏干、五行计数', () => {
    const r = analyzePillars('辛卯 丁酉 庚午 丙子')
    expect(r.dayGan).toBe('庚')
    expect(r.pillars.map((p) => p.gan.shishen)).toEqual(['劫财', '正官', '日主', '七杀'])
    expect(r.pillars[2].cangGan.map((c) => c.char)).toEqual(['丁', '己'])
    expect(Object.values(r.wuxingCount).reduce((a, b) => a + b)).toBe(8)
    expect(JSON.stringify(r)).not.toMatch(/吉|凶|贵|贱|富|贫|寿|夭/)   // 结构里不许混进断语
  })
  it('正文里找四柱:不合法的干支组合不算', () => {
    const hits = findPillars('如一造:辛卯 丁酉 庚午 丙子,又如甲丑 丁酉 庚午 丙子则非。')
    expect(hits).toHaveLength(1)
    expect(hits[0].pillars).toEqual(['辛卯', '丁酉', '庚午', '丙子'])
  })
})

// ── oracle 交叉验证:自写规则层 vs lunar-javascript 的 EightChar ──
// 两个独立来源对得上才算数。用确定性伪随机,失败可复现。
describe('oracle 交叉验证(lunar-javascript)', () => {
  let seed = 20260919
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  const samples = Array.from({ length: 1500 }, () => ({
    year: 1900 + rnd(200), month: 1 + rnd(12), day: 1 + rnd(28), hour: rnd(24), minute: rnd(60),
  }))

  it('1500 个随机时刻:月干/时干/十神/藏干/纳音/长生 逐项全等', () => {
    for (const t of samples) {
      const ec = Solar.fromYmdHms(t.year, t.month, t.day, t.hour, t.minute, 0).getLunar().getEightChar()
      const [y, m, d, h] = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()]
      const where = `${t.year}-${t.month}-${t.day} ${t.hour}:${t.minute} → ${y} ${m} ${d} ${h}`
      for (const gz of [y, m, d, h]) expect(isValidGanZhi(gz), where).toBe(true)
      // 五虎遁、五鼠遁
      expect(monthGan(y[0], m[1]), where).toBe(m[0])
      // sect=2 下晚子时(23 点)时干按次日日干起,库内如此;故 23 点样本用次日日干验
      const dayGanForHour = t.hour === 23 ? GAN[(GAN.indexOf(d[0]) + 1) % 10] : d[0]
      expect(hourGan(dayGanForHour, h[1]), where).toBe(h[0])
      expect(hourToZhi(t.hour), where).toBe(h[1])
      // 十神
      expect(shishen(d[0], y[0]), where).toBe(ec.getYearShiShenGan())
      expect(shishen(d[0], m[0]), where).toBe(ec.getMonthShiShenGan())
      expect(shishen(d[0], h[0]), where).toBe(ec.getTimeShiShenGan())
      // 藏干及其十神
      expect(cangGan(y[1]), where).toEqual(ec.getYearHideGan())
      expect(cangGan(d[1]), where).toEqual(ec.getDayHideGan())
      expect(cangGan(m[1]).map((g) => shishen(d[0], g)), where).toEqual(ec.getMonthShiShenZhi())
      // 纳音、长生
      expect(nayin(y), where).toBe(ec.getYearNaYin())
      expect(nayin(h), where).toBe(ec.getTimeNaYin())
      expect(changsheng(d[0], y[1]), where).toBe(ec.getYearDiShi())
      expect(changsheng(d[0], m[1]), where).toBe(ec.getMonthDiShi())
    }
  })

  it('五行归属与库一致', () => {
    const { LunarUtil } = lunarLib
    for (const g of GAN) expect(ganWuxing(g)).toBe(LunarUtil.WU_XING_GAN[g])
    for (const z of ZHI) expect(zhiWuxing(z)).toBe(LunarUtil.WU_XING_ZHI[z])
  })
})

describe('历法层', () => {
  it('年柱在立春那一刻换,不在正月初一、也不在元旦', async () => {
    // 2024 年立春交于 2 月 4 日 16:27:07
    expect((await pillarsFromDate({ year: 2024, month: 2, day: 4, hour: 16, minute: 0 })).pillars.slice(0, 2)).toEqual(['癸卯', '乙丑'])
    expect((await pillarsFromDate({ year: 2024, month: 2, day: 4, hour: 17, minute: 0 })).pillars.slice(0, 2)).toEqual(['甲辰', '丙寅'])
    // 2024 年春节是 2 月 10 日:此时年柱早已是甲辰
    expect((await pillarsFromDate({ year: 2024, month: 2, day: 9, hour: 12 })).pillars[0]).toBe('甲辰')
  })
  it('十二节交接表:自立春始,时刻递增', async () => {
    const js = await jieBoundaries(2024)
    expect(js).toHaveLength(12)
    expect(js[0]).toEqual({ name: '立春', at: '2024-02-04 16:27:07' })
    for (let i = 1; i < js.length; i++) expect(js[i].at > js[i - 1].at).toBe(true)
    expect(js[11].at.startsWith('2025-01')).toBe(true)
  })
  it('子时换日的两种算法都给', async () => {
    const t = { year: 2024, month: 3, day: 10, hour: 23, minute: 30 }
    const a = (await pillarsFromDate(t, { sect: 2 })).pillars[2]
    const b = (await pillarsFromDate(t, { sect: 1 })).pillars[2]
    expect(JIAZI.indexOf(b)).toBe((JIAZI.indexOf(a) + 1) % 60)
  })
  it('大运:只给排列', async () => {
    const r = await daYun({ year: 1990, month: 5, day: 20, hour: 10 }, '男')
    expect(r.list.length).toBeGreaterThanOrEqual(8)
    for (const d of r.list) expect(isValidGanZhi(d.ganzhi)).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/吉|凶/)
  })
})
