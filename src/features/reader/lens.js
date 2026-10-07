// 目录页「透镜」:选一两个关键词,看哪些章写到了它。
//
// 一章算命中 = 章标题或任一段 original 含该词。只看原文、不看译文/注疏——
// 透镜是「这书原话在哪儿说到 X」,混进译文会把「译者用了这个词」也算进来。
// 纯函数,页面用 useMemo 包一层即可;章数最多几百、词十来个,直接 includes 足够快。

/**
 * @param {{no:number|string, title?:string, paragraphs?:{original?:string}[]}[]} chapters
 * @param {string[]} words
 * @returns {Map<string, Set<number|string>>}
 */
export function lensHits(chapters, words) {
  const out = new Map()
  for (const w of words || []) {
    if (!w || out.has(w)) continue
    const set = new Set()
    for (const ch of chapters || []) {
      if (!ch) continue
      if ((ch.title || '').includes(w) || (ch.paragraphs || []).some((p) => (p?.original || '').includes(w))) {
        set.add(ch.no)
      }
    }
    out.set(w, set)
  }
  return out
}

/**
 * 多个命中集合取交集。空数组返回 null——约定「null = 不筛」,好让页面区分
 * 「没选词(全亮)」与「选了词但交集为空(全暗)」。
 * @param {Set[]} sets
 * @returns {Set|null}
 */
export function intersect(sets) {
  if (!sets || sets.length === 0) return null
  // 缺失的集合当空集处理(选中了一个已不在词表里的词时,宁可全暗也不误亮)
  const list = sets.map((s) => s || new Set())
  const [first, ...rest] = [...list].sort((a, b) => a.size - b.size)
  const out = new Set()
  for (const x of first) if (rest.every((s) => s.has(x))) out.add(x)
  return out
}
