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

// 章内锚点(2026-08-02):侧栏 TOC 原先只到篇/卷/品,进了章就只能滚 ——
// 诗经一章十余首诗、传习录一卷数百段,找某一首/某一条全靠翻。
// 这里把**全部**自然边界(不只是拆屏用的那几个切点)连同首段一起列出来,
// 供 TOC 在当前章下展开成子目录。没有自然边界的书返回 null,TOC 不变。
export function chapterAnchors(chapter, meta) {
  const bs = boundaries(chapter, meta)
  if (!bs.length) return null
  const froms = [0, ...bs]          // 首段也是一个锚(第一首诗 / 第一条)
  const n = chapter.paragraphs.length
  // 锚点 id 两种形态,由书的机制决定(渲染层就是这么给的,不能一律写 p{n}):
  //   诗经一类:诗题段**升格为诗头**,那个 div 的 id 是 seg-<章>-<段>,原段号不再挂在它身上
  //   传习录一类:条头是**插在段前**的独立 div,段落本身照常带 id p<段+1>
  const idOf = (from) => (meta?.poemTitles ? `seg-${chapter.no}-${from}` : `p${from + 1}`)
  return froms.map((from, i) => ({
    from,
    id: idOf(from),
    label: labelFor(chapter, from, froms[i + 1] ?? n, meta, i),
  }))
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
