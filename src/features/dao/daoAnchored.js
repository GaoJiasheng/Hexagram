// 道藏逐段锚定注疏装载(v6 §5)。与易经 zhushiAnchored 同构,但无 ref 机制
// (模块不互链,不引易经全局词表);本期仅道德经有数据。
import daodejing from '../../data/dao/zhushi-anchored/daodejing.json'

const BOOKS = { daodejing }

/** 道藏锚注。chapterNo: 章号,paraIdx: 段下标(0 起);无注返回 null。 */
export function getDaoAnchors(slug, chapterNo, paraIdx) {
  const entries = BOOKS[slug]?.[String(chapterNo)]?.[String(paraIdx)]
  return entries?.length ? entries : null
}
