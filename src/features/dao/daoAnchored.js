// 道藏逐段锚定注疏装载(v6 §5,v7 起六部齐备)。与易经 zhushiAnchored 同构,
// 但无 ref 机制(模块不互链,不引易经全局词表)。
import daodejing from '../../data/dao/zhushi-anchored/daodejing.json'
import qingjingjing from '../../data/dao/zhushi-anchored/qingjingjing.json'
import ganyingpian from '../../data/dao/zhushi-anchored/ganyingpian.json'
import yinfujing from '../../data/dao/zhushi-anchored/yinfujing.json'
import zhuangziNeipian from '../../data/dao/zhushi-anchored/zhuangzi-neipian.json'
import cantongqi from '../../data/dao/zhushi-anchored/cantongqi.json'

const BOOKS = { daodejing, qingjingjing, ganyingpian, yinfujing, 'zhuangzi-neipian': zhuangziNeipian, cantongqi }

/** 道藏锚注。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。 */
export function getDaoAnchors(slug, chapterNo, paraIdx) {
  const entries = BOOKS[slug]?.[String(chapterNo)]?.[String(paraIdx)]
  return entries?.length ? entries : null
}
