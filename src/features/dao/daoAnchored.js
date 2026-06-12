// 道藏逐段锚定注疏装载(v6 §5,v7 起六部齐备)。与易经 zhushiAnchored 同构,
// 但无 ref 机制(模块不互链,不引易经全局词表)。
// v8:条目可带 hex/to 桥字段,解析为气泡内指向易经的单向链接——
// 「模块不互链」的唯一例外(v4 §3.7),仅道藏侧出现。取卦名是代码层复用,不构成 UI 互链。
import daodejing from '../../data/dao/zhushi-anchored/daodejing.json'
import qingjingjing from '../../data/dao/zhushi-anchored/qingjingjing.json'
import ganyingpian from '../../data/dao/zhushi-anchored/ganyingpian.json'
import yinfujing from '../../data/dao/zhushi-anchored/yinfujing.json'
import zhuangziNeipian from '../../data/dao/zhushi-anchored/zhuangzi-neipian.json'
import cantongqi from '../../data/dao/zhushi-anchored/cantongqi.json'
import { getHexagram } from '../yijing/data.js'

const BOOKS = { daodejing, qingjingjing, ganyingpian, yinfujing, 'zhuangzi-neipian': zhuangziNeipian, cantongqi }

function resolve(entries) {
  if (!entries?.length) return null
  return entries.map((e) => {
    if (e.hex) {
      const h = getHexagram(e.hex)
      return { ...e, qiao: { to: `/hexagram/${e.hex}`, label: `《周易》第${e.hex}卦·${h?.name ?? ''} →` } }
    }
    if (e.to) return { ...e, qiao: { to: e.to, label: `${e.label ?? '前往'} →` } }
    return e
  })
}

/** 道藏锚注。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。 */
export function getDaoAnchors(slug, chapterNo, paraIdx) {
  return resolve(BOOKS[slug]?.[String(chapterNo)]?.[String(paraIdx)])
}
