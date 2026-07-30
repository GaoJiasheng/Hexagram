// 长章拆页(owner 2026-07-30)。全站有 9 部书的最长章 ≥150 段(围炉夜话 421 段全书
// 就一章、传习录三卷平均 322 段),打开就是几百段一屏、回来找不到位置。
//
// **只拆显示,不拆数据**:章仍是第 N 章、段号仍是章内那套——译文/注疏/白话/收藏批注/
// 锚点/跨书互见全站都按章号索引,章的语义动不得。
const TARGET = 40      // 每屏目标段数
const MIN_SPLIT = 60   // 章长超过此数才拆(短章不受影响)

// 自然边界:诗经的《诗题》段、传习录一类由 texts.json pieces 给出的条首段。
// 有边界就切在边界上(不把一首诗、一条语录腰斩),没有则按目标段数均分。
function boundaries(chapter, meta) {
  const ps = chapter.paragraphs
  if (meta?.poemTitles) {
    const isTitle = (p) => /^《[^》]+》$/.test(p.original.trim())
    return ps.map((p, i) => (isTitle(p) ? i : -1)).filter((i) => i > 0)
  }
  if (meta?.pieces) {
    return meta.pieces.filter((x) => x.ch === chapter.no && x.from > 0).map((x) => x.from).sort((a, b) => a - b)
  }
  return []
}

// 段范围 → 该屏的标题。有自然边界时用那一段的题名,否则用「第 X 部分」+ 段号区间。
function labelFor(chapter, from, to, meta, i) {
  const first = chapter.paragraphs[from]
  if (meta?.poemTitles && /^《[^》]+》$/.test(first.original.trim())) {
    return first.original.trim().replace(/^《|》$/g, '')
  }
  const pc = meta?.pieces?.find((x) => x.ch === chapter.no && x.from === from)
  if (pc) return pc.title
  return `第 ${i + 1} 部分（${from + 1}–${to} 段）`
}

export function chapterParts(chapter, meta) {
  const n = chapter.paragraphs.length
  if (n <= MIN_SPLIT) return null
  const bs = boundaries(chapter, meta)
  const cuts = [0]
  if (bs.length) {
    // 沿自然边界推进,累够一屏就切
    let last = 0
    for (const b of bs) {
      if (b - last >= TARGET) { cuts.push(b); last = b }
    }
    // 末屏太短就并回前一屏
    if (cuts.length > 1 && n - cuts[cuts.length - 1] < TARGET / 2) cuts.pop()
  } else {
    for (let i = TARGET; i < n - TARGET / 2; i += TARGET) cuts.push(i)
  }
  if (cuts.length < 2) return null
  return cuts.map((from, i) => {
    const to = i + 1 < cuts.length ? cuts[i + 1] : n
    return { from, to, label: labelFor(chapter, from, to, meta, i) }
  })
}
