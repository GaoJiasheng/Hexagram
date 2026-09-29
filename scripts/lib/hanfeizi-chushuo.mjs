// 《韩非子》储说六篇「经—说」对应表的派生规则(design-v24 §1)。
// gen-hanfeizi-chushuo.mjs 用它生成 src/data/fa/hanfeizi-chushuo.json,
// check-hanfeizi-chushuo.mjs 用它复算一遍、防生成物与原文漂移。
//
// 原书结构:每篇先列「经」(一条条论点,多数末了说「其说在某事」),再排「说」(与经条一一对应的故事组)。
// 站内底本(维基文库通行本)把两层标记都留着,但六篇的写法并不划一:
//   内储说上七术(30)/ 内储说下六微(31):首段总纲 → 经条正文段 + 紧随其后的标签段(「参观一」「必罚二」…),
//     末条标签兼作经部收尾(「倒言七。右经」「庙攻。右经」——六微的第七条「庙攻」无序号);
//   外储说左上(32)/ 左下(33):经条以「一。」「二。」…起头,**没有「右经」段**,编号回到「一。」处即说部开始;
//   外储说右上(34):首段总纲「君所以治臣者有三。」→ 经条「一。」起头 → 单独一段「右经」;
//   外储说右下(35):经条「一。」起头 → 单独一段「右经」。
// 说部一律以「一。」「二。」…起头分组;组内「一曰：」是异文,不起新组。
//
// **不靠「其说在」切经条**:六篇 34 条经里有 16 条原文并无「其说在 / 说在」
// (如内储说上第五、七条诡使、倒言;外储说有的写作「说在」、有的根本不写)。有标签段就以标签定条,没有就以「X。」序号定条。

export const CHUSHUO_CHAPTERS = [30, 31, 32, 33, 34, 35]

const NUMERALS = '一二三四五六七八九十'
export const numOf = (c) => NUMERALS.indexOf(c) + 1
export const numeral = (n) => NUMERALS[n - 1] || String(n)

// 说组 / 外储说经条的起头:「一。」…「十。」
export const HEAD_RE = /^([一二三四五六七八九十])。/
// 内储说的标签段:「参观一」「倒言七。右经」「庙攻。右经」(两字名 + 可省的序号 + 可带的「。右经」)
const LABEL_RE = /^([一-鿿]{2})([一二三四五六七八九十])?(?:。右经)?$/
// 单独成段的「右经」,或标签段末尾的「。右经」
const YOUJING_RE = /(?:^|。)右经$/
const SHORT = 8   // 标签段/右经段都很短;长段即便以「右经」结尾也不当收尾标记

const text = (p) => (typeof p === 'string' ? p : p.original).trim()

/**
 * 从一章原文派生经—说对应。结构不合预期一律抛错(带章号),由调用方决定不落盘。
 * @returns {{ch:number,title:string,intro?:number,jing:object[],youjingPara?:number}}
 */
export function deriveChapter(chapter) {
  const no = chapter.no
  const ps = chapter.paragraphs.map(text)
  const fail = (msg) => { throw new Error(`第 ${no} 章《${chapter.title}》: ${msg}`) }
  if (!/储说/.test(chapter.title || '')) fail('章题不含「储说」——章序是否变了?')

  // ① 经部终点 / 说部起点
  const youjing = ps.findIndex((t) => [...t].length <= SHORT && YOUJING_RE.test(t))
  let shuoStart = -1
  if (youjing >= 0) {
    shuoStart = youjing + 1
  } else {
    // 无「右经」段:经条序号一路递增,再遇「一。」即说部
    let seen = 0
    for (let i = 0; i < ps.length; i++) {
      const m = HEAD_RE.exec(ps[i])
      if (!m) continue
      if (numOf(m[1]) === 1 && seen > 0) { shuoStart = i; break }
      seen = numOf(m[1])
    }
    if (shuoStart < 0) fail('找不到「右经」段,也找不到说部起头的「一。」')
  }

  // ② 经条
  const isLabel = (i) => ps[i] !== '右经' && LABEL_RE.test(ps[i])
  const labelIdx = []
  for (let i = 0; i < shuoStart; i++) if (isLabel(i)) labelIdx.push(i)
  let jing
  if (labelIdx.length) {
    jing = labelIdx.map((L, k) => {
      const m = LABEL_RE.exec(ps[L])
      if (m[2] && numOf(m[2]) !== k + 1) fail(`标签段「${ps[L]}」序号不是第 ${k + 1} 条`)
      const para = L - 1
      if (para < 0 || isLabel(para)) fail(`标签段「${ps[L]}」前面没有经条正文`)
      return { no: k + 1, label: m[1], para, labelPara: L }
    })
  } else {
    jing = []
    for (let i = 0; i < shuoStart; i++) {
      const m = HEAD_RE.exec(ps[i])
      if (!m) continue
      if (numOf(m[1]) !== jing.length + 1) fail(`经条「${ps[i].slice(0, 8)}…」序号不接续`)
      jing.push({ no: jing.length + 1, para: i })
    }
  }
  if (!jing.length) fail('经部里一条经也没认出来')

  // 经部里的每一段都得有着落:总纲(仅限首段)/ 经条正文 / 标签段 / 右经段。多出来的段说明结构没认对。
  const owned = new Set(jing.flatMap((j) => (j.labelPara != null ? [j.para, j.labelPara] : [j.para])))
  if (youjing >= 0) owned.add(youjing)
  let intro
  for (let i = 0; i < shuoStart; i++) {
    if (owned.has(i)) continue
    if (i === 0 && jing[0].para > 0) { intro = 0; continue }
    fail(`经部第 ${i} 段「${ps[i].slice(0, 10)}…」既不是经条也不是标签`)
  }

  // ③ 说组
  const starts = []
  for (let i = shuoStart; i < ps.length; i++) {
    const m = HEAD_RE.exec(ps[i])
    if (!m) continue
    if (numOf(m[1]) !== starts.length + 1) fail(`说组「${ps[i].slice(0, 8)}…」序号不接续`)
    starts.push(i)
  }
  if (starts[0] !== shuoStart) fail(`说部首段(第 ${shuoStart} 段)不以「一。」起头`)
  if (starts.length !== jing.length) fail(`经 ${jing.length} 条 ≠ 说 ${starts.length} 组`)
  jing.forEach((j, k) => {
    j.shuoFrom = starts[k]
    j.shuoTo = (starts[k + 1] ?? ps.length) - 1
  })

  const out = { ch: no, title: chapter.title }
  if (intro != null) out.intro = intro
  out.jing = jing.map(({ no: n, label, para, labelPara, shuoFrom, shuoTo }) => ({
    no: n, ...(label ? { label } : {}), para, ...(labelPara != null ? { labelPara } : {}), shuoFrom, shuoTo,
  }))
  if (youjing >= 0) out.youjingPara = youjing
  return out
}

/** 派生六篇;任一篇出错即抛(错误信息逐篇汇总)。 */
export function deriveChushuo(book) {
  const errors = []
  const chapters = []
  for (const no of CHUSHUO_CHAPTERS) {
    const c = book.chapters.find((x) => x.no === no)
    if (!c) { errors.push(`缺第 ${no} 章`); continue }
    try { chapters.push(deriveChapter(c)) } catch (e) { errors.push(e.message) }
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { chapters }
}
