// 逐段锚定注疏的装载与查询(v5 §2–§3)。
// 数据人工维护于 src/data/yijing/zhushi-anchored/,check-data 保证锚点全部命中原文。
import zhushiData from '../../data/yijing/zhushi.json'
import hexAnchored from '../../data/yijing/zhushi-anchored/hexagrams.json'
import xiciShang from '../../data/yijing/zhushi-anchored/xici-shang.json'
import xiciXia from '../../data/yijing/zhushi-anchored/xici-xia.json'
import shuogua from '../../data/yijing/zhushi-anchored/shuogua.json'
import xugua from '../../data/yijing/zhushi-anchored/xugua.json'
import zagua from '../../data/yijing/zhushi-anchored/zagua.json'

const globalByTerm = new Map(zhushiData.map(z => [z.term, z]))

const CLASSIC_BOOKS = {
  'xici-shang': xiciShang,
  'xici-xia': xiciXia,
  shuogua,
  xugua,
  zagua,
}

// ref: true 的条目从全局词表取内容(单一来源);解析不到的条目丢弃(check-data 兜底报错)
function resolve(entries) {
  if (!entries?.length) return null
  const out = []
  for (const e of entries) {
    if (e.ref) {
      const g = globalByTerm.get(e.term)
      if (g) out.push({ ...g, n: e.n ?? 1 })
    } else {
      out.push(e)
    }
  }
  return out.length ? out : null
}

/** 卦系传文锚注。section: 'tuan' | 'daxiang' | 'xiaoxiang' | 'wenyan';
 *  xiaoxiang 的 key 为爻位 1–6 或 'use',wenyan 的 key 为段下标(0 起)。 */
export function getHexAnchors(hexId, section, key) {
  const sections = hexAnchored[String(hexId)]
  if (!sections) return null
  const val = sections[section]
  if (!val) return null
  if (section === 'tuan' || section === 'daxiang') return resolve(val)
  return resolve(val[String(key)])
}

/** 经传锚注。book: classics 文件名(如 'xici-shang'),chapterNo: 章号,paraIdx: 段下标(0 起)。 */
export function getClassicAnchors(book, chapterNo, paraIdx) {
  const data = CLASSIC_BOOKS[book]
  if (!data) return null
  return resolve(data[String(chapterNo)]?.[String(paraIdx)])
}
