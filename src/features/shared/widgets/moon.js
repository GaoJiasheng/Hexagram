// 参同契月相纳甲盘(design-v24 §3)的纯函数层 —— 零 React、零 JSON 依赖,
// 件(MoonDial)、页面(CantongqiMoonPage)与校验闸(scripts/lib/check-cantongqi-moon.mjs)共用。
//
// 盘上八格(phase 0–7),顺着一月走一圈:
//   0 朔 · 1 初三震 · 2 初八兑 · 3 十五乾 · 4 十六巽 · 5 二十三艮 · 6 三十坤 · 7 晦朔合符(盘心坎离)
// 原文、卦、干、方位一律取自 src/data/dao/cantongqi-moon.json(每句经闸回查);这里只管排布与推导。

import { ganWuxing } from '../ganzhi/index.js'

export const MOON_STATIONS = 8

// 五行配五方(木东、火南、土中、金西、水北)。天干的方位由它的五行推出(ganWuxing 在规则层)。
// 这是盘上「由干推」的那一步:兑丁、巽辛、坤乙三句原文没写方位,靠的就是它。
export const WUXING_FANG = { 木: '东', 火: '南', 土: '中', 金: '西', 水: '北' }
export const ganFang = (g) => WUXING_FANG[ganWuxing(g)]

/**
 * 把数据整理成盘上八格。返回数组下标即 phase。
 * 每格:{ idx, kind:'shuo'|'phase'|'hefu', key, label, day?, gan:[…], src }
 *   src 指回数据里的原条目(phase / junction),页面与件从它取 quote/ch/note。
 */
export function stationsOf(data) {
  const shuo = data.junctions.find((j) => j.key === 'shuo')
  const hefu = data.junctions.find((j) => j.key === 'hefu')
  return [
    { idx: 0, kind: 'shuo', key: shuo.key, label: shuo.label, day: shuo.day, gan: [...shuo.gan], src: shuo },
    ...data.phases.map((p, i) => ({ idx: i + 1, kind: 'phase', key: p.key, label: p.label, day: p.day, gan: [p.gan], src: p })),
    { idx: 7, kind: 'hefu', key: hefu.key, label: hefu.label, day: null, gan: data.center.map((c) => c.gan), src: hefu },
  ]
}

/** 天干 → 哪一格纳它(壬癸 → 朔,戊己 → 合符)。点盘上的天干即跳到那一格。 */
export function stationOfGan(stations, g) {
  const s = stations.find((x) => x.gan.includes(g))
  return s ? s.idx : -1
}

/** 六画卦的下卦三画(binary 自下而上,下标 0 = 初爻)。纯卦上下同。 */
export const lowerTrigram = (binary6) => binary6.slice(0, 3)

const CN = ['零', '一', '二', '三']
/** 三画卦里阳几阴几,如「阳一阴二」。 */
export function yinYangCount(bin3) {
  const yang = [...bin3].filter((b) => b === '1').length
  return `阳${CN[yang]}阴${CN[3 - yang]}`
}

const YAO_POS = ['初', '二', '三']
/**
 * 与上一相相比哪一爻变了、怎么变——「阳自下而上一爻一爻长」就是从这里看出来的。
 * prev/cur 皆为三画 binary;返回如「二爻由阴转阳」,无变化返回 ''。
 */
export function trigramChange(prevBin3, curBin3) {
  const out = []
  for (let i = 0; i < 3; i++) {
    if (prevBin3[i] !== curBin3[i]) out.push(`${YAO_POS[i]}爻由${prevBin3[i] === '1' ? '阳' : '阴'}转${curBin3[i] === '1' ? '阳' : '阴'}`)
  }
  return out.join('、')
}

/**
 * 月轮亮面的 SVG path(圆心在原点、半径 r)。按一月三十日的理想周期示意:
 * 第 30 日(晦)全暗,第 15 日(望)全满;前半月亮面在右(西),后半月在左(东)。
 * 返回 '' 表示全暗。
 */
export function moonLitPath(day, r) {
  const d = ((day % 30) + 30) % 30
  const t = (2 * Math.PI * d) / 30          // 0 = 朔,π = 望
  const c = Math.cos(t)
  if (1 - c < 1e-9) return ''
  const rx = +(Math.abs(c) * r).toFixed(3)
  const waxing = t < Math.PI - 1e-9
  // 先走亮面一侧的半圆(上 → 下),再沿明暗界线(半椭圆)回到上端。
  const s1 = waxing ? 1 : 0
  const s2 = waxing ? (c > 0 ? 0 : 1) : (c > 0 ? 1 : 0)
  return `M 0 ${-r} A ${r} ${r} 0 0 ${s1} 0 ${r} A ${rx} ${r} 0 0 ${s2} 0 ${-r} Z`
}

/** 1–30 的汉字写法(三 / 十五 / 二十三 / 三十),闸用它核对「日数确在原句里」。 */
export function cnDay(n) {
  const D = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  if (n < 10) return D[n]
  const tens = Math.floor(n / 10), ones = n % 10
  return `${tens === 1 ? '' : D[tens]}十${D[ones]}`
}
