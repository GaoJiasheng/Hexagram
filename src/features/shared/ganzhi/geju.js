// 《子平真诠》取格的规则层(纯函数,design-v23 §7「格局判定流程图」)。
//
// 这里只实现书里**明文写了、且只靠日主+月令+透干就能定**的那一段:
//   月令藏干 → 各藏干对日主的十神 → 谁作主(本气 / 透出者)→ 格名 → 顺用还是逆用。
// 每条规则后面都挂着原文出处(zhenquan 章号·段下标),页面上逐条引出来。
//
// 书里还有两件事**需要整个八字**才能谈,这里**不建模、只如实告知**:
//   ① 地支三合会局使用神变化(《论用神变化》「丁生亥月,本为正官,支全卯未,则化为印」)
//   ② 格局的成败救应、高低(《论用神成败救应》以下)
// 故本层只回答「这个格叫什么、书里在哪一章讲」,不回答「这个格好不好」。
import { GAN, ZHI, cangGan, shishen, yinYang, changsheng } from './index.js'

// 阳刃:「禄前一位,惟五阳有之,故为阳刃」(论阳刃 44·0)。
// 戊之刃在午——原书明文:「若戊生午月,干透丙火,支会火局,则化刃为印」(44·4)。
export const YANGREN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' }

const ROLES = ['本气', '中气', '余气']
const ZAQI = ['辰', '戌', '丑', '未']

// 十神 → 格。财、印不分偏正:「故财与印不分偏正,同为一格而论之」(论印绶 36·0)。
// 顺逆:「财官印食,此用神之善而顺用之者也;煞伤劫刃,用神之不善而逆用之者也」(论用神 9·0)。
const GE = {
  正官: { name: '正官格', ch: 32, use: '顺' },
  七杀: { name: '偏官格(七煞)', ch: 40, use: '逆' },
  正财: { name: '财格', ch: 34, use: '顺' },
  偏财: { name: '财格', ch: 34, use: '顺' },
  正印: { name: '印绶格', ch: 36, use: '顺' },
  偏印: { name: '印绶格', ch: 36, use: '顺' },
  食神: { name: '食神格', ch: 38, use: '顺' },
  伤官: { name: '伤官格', ch: 42, use: '逆' },
}
const GE_YANGREN = { name: '阳刃格', ch: 44, use: '逆' }
const GE_LUJIE = { name: '建禄月劫格', ch: 46, use: '逆' }

// 「此顺逆之大路也」一段(论用神 9·7)里,各格对应的那一句。照录,不改字。
export const SHUN_NI_QUOTE = {
  财格: '财喜食神以相生，生官以护财',
  正官格: '官喜透财以相生，生印以护官',
  印绶格: '印喜官煞以相生，劫财以护印',
  食神格: '食喜身旺以相生，生财以护食',
  '偏官格(七煞)': '七煞喜食神以制伏，忌财印以资扶',
  伤官格: '伤官喜佩印以制伏，生财以化伤',
  阳刃格: '阳刃喜官煞以制伏，忌官煞之俱无',
  建禄月劫格: '月劫喜透官以制伏，利用财而透食以化劫',
}

// 每条说明 = 一句人话 + 原书的话 + 出处章。引文逐字取自站内底本(geju.test.js 有断言)。
export const GEJU_NOTES = {
  'zaqi-butou': { say: '辰戌丑未是「杂气」月,一个地支里藏着三样东西。原书的办法是看谁透出来;都不透,就暂按本气论,但格不算清。', quote: '四墓者，杂气也……透干会取其清者用之，杂而不杂也。', ch: 17, title: '论杂气如何取用' },
  'zaqi-tou': { say: '杂气月,透出来的那个作主。', quote: '一透则一用，兼透则兼用，透而又会，则透与会并用。', ch: 17, title: '论杂气如何取用' },
  bianhua: { say: '月令本气没透、别的藏干透了——于是透出来的那个说了算。这就是原书说的「用神变化」。', quote: '假使寅月为提，不透甲而透丙，则如知府不临郡，而同知得以作主。', ch: 11, title: '论用神变化' },
  jiange: { say: '本气透了,别的藏干也透了:格仍按本气定,另一个算兼格。', quote: '变之而不失本格者', ch: 11, title: '论用神变化' },
  'jiantou-zaqi': { say: '杂气月里不止一个透出来,就都要用上;它们之间是相成还是相背,原书分「有情」「无情」去讲。', quote: '其合而有情者吉，其合而无情者则不吉。', ch: 17, title: '论杂气如何取用' },
  'lujie-lingqu': { say: '月令和日主是同一种五行——自己不能拿自己当用神。原书的办法是到四柱里另找财官煞食;那需要整个八字,这个件到此为止。', quote: '日与月同，本身不可为用，必看四柱有无财官煞食透干会支，另取用神', ch: 9, title: '论用神' },
  'wu-wu': { say: '戊的本气在午是丁火(印),但原书明文把戊生午月当阳刃讲。', quote: '若戊生午月，干透丙火，支会火局，则化刃为印', ch: 44, title: '论阳刃' },
  'lu-tu': { say: '按「禄」的位置,戊禄在巳、己禄在午(火土同宫),此月也算得上建禄;但月令本气对日主是印。原书没有单独举这个例子,这里从本气,如实记下这一处。', quote: '建禄者，月建逢禄堂也，禄即是劫。', ch: 46, title: '论建禄月劫' },
  'yin-jie': { say: '阴干遇劫财不叫「刃」,归在月劫里。', quote: '禄前一位，惟五阳有之，故为阳刃。', ch: 44, title: '论阳刃' },
}

const isBiJie = (ss) => ss === '比肩' || ss === '劫财'

/**
 * @param {string} dayGan   日主
 * @param {string} monthZhi 月支(月令)
 * @param {string[]} tou    月令藏干里,哪几个透到了年/月/时干上
 */
export function determineGeju(dayGan, monthZhi, tou = []) {
  if (!GAN.includes(dayGan)) throw new RangeError(`不是天干: ${dayGan}`)
  if (!ZHI.includes(monthZhi)) throw new RangeError(`不是地支: ${monthZhi}`)
  const cang = cangGan(monthZhi).map((g, i) => ({
    gan: g, role: ROLES[i], shishen: shishen(dayGan, g), tou: tou.includes(g),
  }))
  const bad = tou.filter((g) => !cang.some((c) => c.gan === g))
  if (bad.length) throw new RangeError(`${bad.join('')} 不在 ${monthZhi} 的藏干里`)

  const zaqi = ZAQI.includes(monthZhi)
  const touList = cang.filter((c) => c.tou)
  // 谁作主:「假使寅月为提,不透甲而透丙,则如知府不临郡,而同知得以作主」(论用神变化 11·0)
  let main, reason
  if (!touList.length) { main = cang[0]; reason = 'benqi-default' }
  else if (cang[0].tou) { main = cang[0]; reason = 'benqi-tou' }
  else { main = touList[0]; reason = 'other-tou' }
  const jian = touList.filter((c) => c !== main)

  const yangren = YANGREN[dayGan] === monthZhi
  const lu = changsheng(dayGan, monthZhi) === '临官'
  let geju, kind
  if (yangren && main === cang[0]) { geju = GE_YANGREN; kind = 'yangren' }
  else if (isBiJie(main.shishen)) { geju = GE_LUJIE; kind = 'lujie' }
  else { geju = GE[main.shishen]; kind = 'normal' }

  const notes = []
  if (zaqi) notes.push(touList.length ? 'zaqi-tou' : 'zaqi-butou')
  if (reason === 'other-tou') notes.push('bianhua')
  if (jian.length) notes.push(zaqi ? 'jiantou-zaqi' : 'jiange')
  if (kind === 'lujie') notes.push('lujie-lingqu')
  if (dayGan === '戊' && monthZhi === '午') notes.push('wu-wu')
  // 戊禄在巳、己禄在午(火土同宫),但月令本气对戊己是印不是比劫——原书未单独举例,如实标出
  if (lu && !isBiJie(cang[0].shishen)) notes.push('lu-tu')
  if (yinYang(dayGan) === '阴' && cang[0].shishen === '劫财' && !zaqi) notes.push('yin-jie')

  return { dayGan, monthZhi, cang, main, reason, jian, geju, kind, zaqi, lu, yangren, notes }
}
