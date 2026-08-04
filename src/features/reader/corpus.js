// 通用 corpus 装载层(v16 §1)——佛(fo)/儒(ru)等读经类站共用一套装载。
// 按 corpusKey 动态取 texts.json / classics / 锚定注疏 / 延伸;道藏(dao)保留自己的
// data.js + daoAnchored.js(含「桥」hex 字段),不并入此处。
// glob 逐组显式列举(不是自动发现),道藏数据不被牵入本 chunk;某 corpus 尚无文件时安全返回空。
// ⚠️ 新增一组要改**两处**:下面的 TEXTS 静态映射 + 三条 glob。只改 glob 会让 getMeta 返回 null,
//    表现为阅读页空白、路由回落书架(踩过)。
import foTexts from '../../data/fo/texts.json'
import ruTexts from '../../data/ru/texts.json'
import xinTexts from '../../data/xin/texts.json'
import faTexts from '../../data/fa/texts.json'
import moTexts from '../../data/mo/texts.json'
import bingTexts from '../../data/bing/texts.json'
import zongTexts from '../../data/zong/texts.json'
import zhongyiTexts from '../../data/zhongyi/texts.json'
import moulueTexts from '../../data/moulue/texts.json'
import tangshiTexts from '../../data/tangshi/texts.json'
import songciTexts from '../../data/songci/texts.json'
import yuanquTexts from '../../data/yuanqu/texts.json'

const TEXTS = { fo: foTexts, ru: ruTexts, xin: xinTexts, fa: faTexts, mo: moTexts, bing: bingTexts, zong: zongTexts, zhongyi: zhongyiTexts, moulue: moulueTexts, tangshi: tangshiTexts, songci: songciTexts, yuanqu: yuanquTexts }

const classicsLoaders = import.meta.glob('../../data/{fo,ru,xin,fa,mo,bing,zong,zhongyi,moulue,tangshi,songci,yuanqu}/classics/*.json')
const anchoredMods = import.meta.glob('../../data/{fo,ru,xin,fa,mo,bing,zong,zhongyi,moulue,tangshi,songci,yuanqu}/zhushi-anchored/*.json', { eager: true })
const yanyiMods = import.meta.glob('../../data/{fo,ru,xin,fa,mo,bing,zong,zhongyi,moulue,tangshi,songci,yuanqu}/yanyi.json', { eager: true })

const cache = {}

export function corpusTexts(corpus) {
  return TEXTS[corpus] ?? []
}

export function getMeta(corpus, slug) {
  return (TEXTS[corpus] ?? []).find((t) => t.slug === slug) ?? null
}

export async function loadText(corpus, slug) {
  const k = `${corpus}/${slug}`
  if (cache[k]) return cache[k]
  const loader = classicsLoaders[`../../data/${corpus}/classics/${slug}.json`]
  if (!loader) return null
  const mod = await loader()
  cache[k] = mod.default
  return mod.default
}

/** 锚定注疏。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。佛/儒无「桥」。 */
export function getAnchors(corpus, slug, chapterNo, paraIdx) {
  const book = anchoredMods[`../../data/${corpus}/zhushi-anchored/${slug}.json`]?.default
  const entries = book?.[String(chapterNo)]?.[String(paraIdx)]
  return entries?.length ? entries : null
}

/** 每章/篇延伸。无数据返回 null。 */
export function getYanyi(corpus, slug, chapterNo) {
  const paras = yanyiMods[`../../data/${corpus}/yanyi.json`]?.default?.[slug]?.[String(chapterNo)]
  return paras?.length ? paras : null
}
