// 干支五行规则层 —— 纯函数、零依赖、同步。
//
// 观数(命理)、中医五行藏象、易经纳甲、参同契月体纳甲踩在同一套符号上,故抽成共享底座。
// 分层(design-v23 §2):
//   · **规则层**(本文件):干支、五行生克、遁干、十神、藏干、纳音、合冲刑害、十二长生。
//     全是查表与模运算,自己写、自己测 —— 学堂要把这些规则**讲给人看**,它们必须是
//     我们能解释的数据,不能是库里的黑盒。
//   · **历法层**(./calendar.js):公历 → 四柱。节气交接时刻是天文计算,不能手写,用 lunar-javascript。
//
// 每张表的典籍出处见 docs/design-v23.md §3(规则表)。单测里另用 lunar-javascript 的
// EightChar 当 oracle 逐项交叉验证(ganzhi.test.js)—— 两个独立来源对得上才算数。
//
// 约定:天干下标 0=甲 … 9=癸;地支下标 0=子 … 11=亥;下标为偶数者属阳。

export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
export const WUXING = ['木', '火', '土', '金', '水']

const GAN_WX = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']
const ZHI_WX = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']

const ganIdx = (g) => {
  const i = GAN.indexOf(g)
  if (i < 0) throw new RangeError(`不是天干: ${g}`)
  return i
}
const zhiIdx = (z) => {
  const i = ZHI.indexOf(z)
  if (i < 0) throw new RangeError(`不是地支: ${z}`)
  return i
}

export const isGan = (c) => GAN.includes(c)
export const isZhi = (c) => ZHI.includes(c)
export const ganWuxing = (g) => GAN_WX[ganIdx(g)]
export const zhiWuxing = (z) => ZHI_WX[zhiIdx(z)]
export const wuxingOf = (c) => (isGan(c) ? ganWuxing(c) : zhiWuxing(c))
/** 阴阳:下标偶数为阳(甲丙戊庚壬 / 子寅辰午申戌)。 */
export const yinYang = (c) => ((isGan(c) ? ganIdx(c) : zhiIdx(c)) % 2 === 0 ? '阳' : '阴')

// ── 五行生克 ───────────────────────────────────────────────
// 相生:木→火→土→金→水→木(顺次);相克:木→土→水→火→金→木(隔一)。
export const shengOf = (wx) => WUXING[(WUXING.indexOf(wx) + 1) % 5]   // wx 所生
export const keOf = (wx) => WUXING[(WUXING.indexOf(wx) + 2) % 5]      // wx 所克
export const shengBy = (wx) => WUXING[(WUXING.indexOf(wx) + 4) % 5]   // 生 wx 者
export const keBy = (wx) => WUXING[(WUXING.indexOf(wx) + 3) % 5]      // 克 wx 者

/** a 对 b 的关系:'同' | '生'(a 生 b)| '克'(a 克 b)| '被生'(b 生 a)| '被克'(b 克 a)。 */
export function wuxingRelation(a, b) {
  if (!WUXING.includes(a) || !WUXING.includes(b)) throw new RangeError(`不是五行: ${a} ${b}`)
  if (a === b) return '同'
  if (shengOf(a) === b) return '生'
  if (keOf(a) === b) return '克'
  if (shengOf(b) === a) return '被生'
  return '被克'
}

// ── 六十甲子与纳音 ──────────────────────────────────────────
// 干支相配必阳配阳、阴配阴(下标同奇偶),故只有 60 种而非 120 种。
export const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12])

export function isValidGanZhi(gz) {
  return typeof gz === 'string' && gz.length === 2 && JIAZI.includes(gz)
}
export const jiaziIndex = (gz) => {
  const i = JIAZI.indexOf(gz)
  if (i < 0) throw new RangeError(`不是合法干支: ${gz}`)
  return i
}

// 纳音:六十甲子两两一组,共三十名。
const NAYIN_30 = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火',
  '涧下水', '城头土', '白蜡金', '杨柳木', '泉中水', '屋上土',
  '霹雳火', '松柏木', '长流水', '沙中金', '山下火', '平地木',
  '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
]
export const nayin = (gz) => NAYIN_30[Math.floor(jiaziIndex(gz) / 2)]

// ── 遁干:年上起月(五虎遁)、日上起时(五鼠遁)──────────────────
// 五虎遁:甲己之年丙作首,乙庚之岁戊为头,丙辛必定寻庚起,丁壬壬位顺行流,戊癸何方发,甲寅之上好追求。
//   —— 正月建寅,寅月之干 = (年干下标 % 5) * 2 + 2,其后逐月顺推。
// 五鼠遁:甲己还加甲,乙庚丙作初,丙辛从戊起,丁壬庚子居,戊癸何方发,壬子是真途。
//   —— 子时之干 = (日干下标 % 5) * 2,其后逐时顺推。
/** 月干:给年干与月支(寅=正月)。 */
export function monthGan(yearGan, monthZhi) {
  const first = (ganIdx(yearGan) % 5) * 2 + 2             // 寅月之干
  const offset = (zhiIdx(monthZhi) - 2 + 12) % 12          // 距寅月几个月
  return GAN[(first + offset) % 10]
}
/** 时干:给日干与时支。 */
export function hourGan(dayGan, hourZhi) {
  const first = (ganIdx(dayGan) % 5) * 2                   // 子时之干
  return GAN[(first + zhiIdx(hourZhi)) % 10]
}
/** 钟点(0–23)→ 时支。23 点起为子时。 */
export const hourToZhi = (hour) => ZHI[Math.floor(((hour + 1) % 24) / 2)]

// ── 十神 ─────────────────────────────────────────────────
// 以日干为「我」:五种关系(同我/我生/我克/克我/生我)× 阴阳同异 = 十神。
// 阴阳相同者为「偏」(比肩/食神/偏财/七杀/偏印),相异者为「正」(劫财/伤官/正财/正官/正印)。
const SHISHEN = {
  同: ['比肩', '劫财'],
  生: ['食神', '伤官'],     // 我生
  克: ['偏财', '正财'],     // 我克
  被克: ['七杀', '正官'],   // 克我
  被生: ['偏印', '正印'],   // 生我
}
export const SHISHEN_NAMES = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']

/** 十神:日干看另一个天干。 */
export function shishen(dayGan, otherGan) {
  const rel = wuxingRelation(ganWuxing(dayGan), ganWuxing(otherGan))
  const same = yinYang(dayGan) === yinYang(otherGan)
  return SHISHEN[rel][same ? 0 : 1]
}
/** 十神所属的那一类关系,学堂「十神盘」用。 */
export function shishenKind(name) {
  for (const [rel, pair] of Object.entries(SHISHEN)) if (pair.includes(name)) return rel
  throw new RangeError(`不是十神: ${name}`)
}

// ── 地支藏干(人元)────────────────────────────────────────
// 顺序:本气、中气、余气。子午卯酉四正只藏一二干;寅申巳亥四生、辰戌丑未四库各藏三干。
const CANG_GAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
}
export const cangGan = (zhi) => [...CANG_GAN[ZHI[zhiIdx(zhi)]]]

// ── 合冲刑害 ──────────────────────────────────────────────
/** 天干五合(合化之气)。 */
export const GAN_HE = [
  { pair: ['甲', '己'], hua: '土' }, { pair: ['乙', '庚'], hua: '金' }, { pair: ['丙', '辛'], hua: '水' },
  { pair: ['丁', '壬'], hua: '木' }, { pair: ['戊', '癸'], hua: '火' },
]
/** 地支六合。午未之合,诸书或云化土、或云日月之合不言化,故 hua 留 null、另存 note。 */
export const ZHI_LIUHE = [
  { pair: ['子', '丑'], hua: '土' }, { pair: ['寅', '亥'], hua: '木' }, { pair: ['卯', '戌'], hua: '火' },
  { pair: ['辰', '酉'], hua: '金' }, { pair: ['巳', '申'], hua: '水' },
  { pair: ['午', '未'], hua: null, note: '午为太阳、未为太阴,诸书或云合而化土,或不言化' },
]
/** 三合局:长生、帝旺、墓三支会成一局。 */
export const ZHI_SANHE = [
  { zhi: ['申', '子', '辰'], ju: '水' }, { zhi: ['亥', '卯', '未'], ju: '木' },
  { zhi: ['寅', '午', '戌'], ju: '火' }, { zhi: ['巳', '酉', '丑'], ju: '金' },
]
/** 三会方:同一方位(一季)三支。 */
export const ZHI_SANHUI = [
  { zhi: ['寅', '卯', '辰'], fang: '木' }, { zhi: ['巳', '午', '未'], fang: '火' },
  { zhi: ['申', '酉', '戌'], fang: '金' }, { zhi: ['亥', '子', '丑'], fang: '水' },
]
/** 六冲:相隔六位、方位正对。 */
export const ZHI_LIUCHONG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]
/** 三刑。 */
export const ZHI_XING = [
  { zhi: ['寅', '巳', '申'], name: '无恩之刑' }, { zhi: ['丑', '戌', '未'], name: '恃势之刑' },
  { zhi: ['子', '卯'], name: '无礼之刑' }, { zhi: ['辰', '午', '酉', '亥'], name: '自刑', self: true },
]
/** 六害(穿)。 */
export const ZHI_LIUHAI = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']]

const pairHit = (pairs, a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
export const isChong = (a, b) => pairHit(ZHI_LIUCHONG, a, b)
export const isHai = (a, b) => pairHit(ZHI_LIUHAI, a, b)
export const isLiuhe = (a, b) => pairHit(ZHI_LIUHE.map((x) => x.pair), a, b)
export const isGanHe = (a, b) => pairHit(GAN_HE.map((x) => x.pair), a, b)

// ── 十二长生 ──────────────────────────────────────────────
// 阳干顺行、阴干逆行;火土同宫(丙戊同起于寅、丁己同起于酉)。
// ⚠️ 「阴干逆行」之说诸家有争:《子平真诠·论阴阳生死》主之,亦有命家以为阴阳同生同死。
//    此处从通行之法(与 lunar-javascript 一致),学堂正文须如实交代这一分歧。
export const CHANGSHENG = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']
const CHANGSHENG_START = { 甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申', 乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯' }

/** 某天干在某地支上的十二长生状态。 */
export function changsheng(gan, zhi) {
  const start = zhiIdx(CHANGSHENG_START[GAN[ganIdx(gan)]])
  const z = zhiIdx(zhi)
  const step = yinYang(gan) === '阳' ? (z - start + 12) % 12 : (start - z + 12) % 12
  return CHANGSHENG[step]
}

// ── 四柱解析(给 sizhu 交互件与命例识别用)─────────────────────
const PILLAR_NAMES = ['年', '月', '日', '时']

/** 「辛卯 丁酉 庚午 丙子」或 ['辛卯',…] → 四个合法干支;不合法抛错。 */
export function parsePillars(input) {
  const arr = Array.isArray(input) ? input : String(input).trim().split(/[\s　,，、]+/)
  if (arr.length !== 4) throw new RangeError(`四柱须恰为四个干支,得到 ${arr.length} 个`)
  for (const gz of arr) if (!isValidGanZhi(gz)) throw new RangeError(`不是合法干支: ${gz}`)
  return arr
}

/**
 * 四柱 → 结构化排盘(**只到结构为止,不含任何断语**)。
 * 每柱:干、支、各自五行与阴阳、天干十神(日柱为「日主」)、藏干及其十神、纳音、日主在此支的长生状态。
 * 另给五行计数(天干四 + 地支本气四 = 八字;藏干另计)。
 */
export function analyzePillars(input) {
  const gzs = parsePillars(input)
  const dayGan = gzs[2][0]
  const pillars = gzs.map((gz, i) => {
    const [gan, zhi] = gz
    return {
      name: PILLAR_NAMES[i],
      ganzhi: gz,
      gan: { char: gan, wuxing: ganWuxing(gan), yinyang: yinYang(gan), shishen: i === 2 ? '日主' : shishen(dayGan, gan) },
      zhi: { char: zhi, wuxing: zhiWuxing(zhi), yinyang: yinYang(zhi) },
      cangGan: cangGan(zhi).map((g) => ({ char: g, wuxing: ganWuxing(g), shishen: shishen(dayGan, g) })),
      nayin: nayin(gz),
      changsheng: changsheng(dayGan, zhi),
    }
  })
  const count = Object.fromEntries(WUXING.map((w) => [w, 0]))
  for (const p of pillars) { count[p.gan.wuxing]++; count[p.zhi.wuxing]++ }
  return { dayGan, dayWuxing: ganWuxing(dayGan), pillars, wuxingCount: count }
}

// 正文里的四柱串识别(管线「命例识别」与阅读器共用)。全角/半角空格、无空格都认。
const GZ = `[${GAN.join('')}][${ZHI.join('')}]`
export const PILLARS_RE = new RegExp(`(${GZ})[\\s　]*(${GZ})[\\s　]*(${GZ})[\\s　]*(${GZ})`, 'g')

/** 从一段文字里找出所有合法四柱(干支阴阳须相配,否则不算)。 */
export function findPillars(text) {
  const out = []
  for (const m of String(text).matchAll(PILLARS_RE)) {
    const gzs = m.slice(1, 5)
    if (gzs.every(isValidGanZhi)) out.push({ index: m.index, raw: m[0], pillars: gzs })
  }
  return out
}
