// 通用 corpus 装载层(v16 §1)——佛(fo)/儒(ru)等读经类站共用一套装载。
// 按 corpusKey 动态取 texts.json / classics / 锚定注疏 / 延伸;道藏(dao)保留自己的
// data.js + daoAnchored.js(含「桥」hex 字段),不并入此处;易经(yijing)另一套,也不并入。
// glob 逐组显式列举(不是自动发现),道藏数据不被牵入本 chunk;某 corpus 尚无文件时安全返回空。
// ⚠️ 新增一组要改**两处**:下面的 TEXTS 静态映射 + 三条 glob。只改 glob 会让 getMeta 返回 null,
//    表现为阅读页空白、路由回落书架(踩过)。
//
// 2026-08:原文(classics)一直是懒加载的,但注疏(zhushi-anchored)与延伸(yanyi)曾用
// `{ eager: true }`——这把全部 12 组的注疏与延伸一次性打进同一个 chunk(3.6MB),读者打开
// 任意一组任意一本书,浏览器要把全站 12 组的注疏/延伸全下下来,一个都用不上。
// 现改懒加载:注疏 zhushi-anchored/<slug>.json 本就一书一文件,懒加载后天然按书分片；
// 延伸 yanyi.json 是一组一文件(含该组所有书),懒加载后按组分片,已经够用。
//
// getAnchors/getYanyi 对外仍是**同步**签名——渲染路径(CorpusReadPage/YanyiBlock/ClassicReader)
// 一行都不用改。做法:loadText(corpus, slug) 本来就是 async 且调用方已经 await 它才会渲染依赖
// 注疏/延伸的组件,于是把该书的注疏、该组的延伸一并塞进同一次 await,解析后写进模块级
// resolved 缓存;getAnchors/getYanyi 只读这份已解析缓存。corpusSearch.js 的索引构建同理
// (它的循环本就 `await loadText(...)` 之后才调 getAnchors/getYanyi,天然满足这个前提)。
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
const anchoredLoaders = import.meta.glob('../../data/{fo,ru,xin,fa,mo,bing,zong,zhongyi,moulue,tangshi,songci,yuanqu}/zhushi-anchored/*.json')
const yanyiLoaders = import.meta.glob('../../data/{fo,ru,xin,fa,mo,bing,zong,zhongyi,moulue,tangshi,songci,yuanqu}/yanyi.json')

const textCache = {}      // `${corpus}/${slug}` → Promise<classics book>
const anchorsData = {}    // `${corpus}/${slug}` → 已解析的锚定注疏 book(或 null),供 getAnchors 同步读
const anchorsInFlight = {}
const yanyiData = {}      // corpus → 已解析的延伸 book(或 null),供 getYanyi 同步读
const yanyiInFlight = {}

export function corpusTexts(corpus) {
  return TEXTS[corpus] ?? []
}

export function getMeta(corpus, slug) {
  return (TEXTS[corpus] ?? []).find((t) => t.slug === slug) ?? null
}

function loadAnchors(corpus, slug) {
  const k = `${corpus}/${slug}`
  if (k in anchorsData) return Promise.resolve(anchorsData[k])
  if (!anchorsInFlight[k]) {
    const loader = anchoredLoaders[`../../data/${corpus}/zhushi-anchored/${slug}.json`]
    anchorsInFlight[k] = (loader ? loader().then((m) => m.default) : Promise.resolve(null))
      .catch(() => null)
      .then((data) => { anchorsData[k] = data; return data })
  }
  return anchorsInFlight[k]
}

function loadYanyi(corpus) {
  if (corpus in yanyiData) return Promise.resolve(yanyiData[corpus])
  if (!yanyiInFlight[corpus]) {
    const loader = yanyiLoaders[`../../data/${corpus}/yanyi.json`]
    yanyiInFlight[corpus] = (loader ? loader().then((m) => m.default) : Promise.resolve(null))
      .catch(() => null)
      .then((data) => { yanyiData[corpus] = data; return data })
  }
  return yanyiInFlight[corpus]
}

export async function loadText(corpus, slug) {
  const k = `${corpus}/${slug}`
  if (!textCache[k]) {
    const loader = classicsLoaders[`../../data/${corpus}/classics/${slug}.json`]
    if (!loader) return null
    // 原文 + 该书注疏 + 该组延伸一并取回:三者同一次 await 解析完,渲染路径依赖的
    // getAnchors/getYanyi 才能在 loadText 之后安全地同步读到数据。
    textCache[k] = Promise.all([loader(), loadAnchors(corpus, slug), loadYanyi(corpus)])
      .then(([mod]) => mod.default)
  }
  return textCache[k]
}

/** 锚定注疏。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。
 *  同步读取——调用方必须已 await 过 loadText(corpus, slug)(渲染路径皆如此)。 */
export function getAnchors(corpus, slug, chapterNo, paraIdx) {
  const book = anchorsData[`${corpus}/${slug}`]
  const entries = book?.[String(chapterNo)]?.[String(paraIdx)]
  return entries?.length ? entries : null
}

/** 每章/篇延伸。无数据返回 null。
 *  同步读取——调用方必须已 await 过同组内某本书的 loadText(渲染路径皆如此)。 */
export function getYanyi(corpus, slug, chapterNo) {
  const paras = yanyiData[corpus]?.[slug]?.[String(chapterNo)]
  return paras?.length ? paras : null
}
