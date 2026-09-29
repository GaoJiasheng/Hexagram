// 诗经十五国风示意图的纯函数(design-v24 §8)——页面与校验闸共用一份,免得两处规则走样。
// 这里只管几何与取诗题,不碰 DOM。

const TITLE_RE = /^《([^》]+)》$/

// 圆的大小表诗的首数:面积随首数增长(开方),4 首 ≈ 26、21 首 ≈ 39(viewBox 单位)。
export function regionRadius(poems) {
  return 16 + 5 * Math.sqrt(Math.max(0, poems || 0))
}

// 首数标签挂在圆的右侧(不挂下方:鄘、王、周南的下方就是河道),估一个宽度供框选与越界判断。
export const COUNT_LABEL_GAP = 6
export const COUNT_LABEL_W = 44

/** 章里的诗题段 → [{ title, idx }](idx 是章内段下标) */
export function poemTitlesOf(chapter) {
  const out = []
  ;(chapter?.paragraphs || []).forEach((p, idx) => {
    const m = TITLE_RE.exec((p.original || '').trim())
    if (m) out.push({ title: m[1], idx })
  })
  return out
}

/**
 * 相对方位约束——这张图唯一要守的「事实」。只比前后左右,不比距离。
 * [a, 方位, b, 依据];方位 W/E/N/S 表示 a 在 b 的西/东/北/南(SVG 里 y 向下为南)。
 */
export const ORIENTATION = [
  ['qin', 'W', 'wang', '秦在王畿之西'],
  ['qi', 'E', 'wang', '齐在王畿之东'],
  ['bin', 'W', 'wang', '豳在西北'],
  ['bin', 'N', 'wang', '豳在西北'],
  ['bin', 'N', 'qin', '豳在秦之北(泾水上游)'],
  ['zheng', 'E', 'wang', '郑在王畿之东'],
  ['chen', 'S', 'zheng', '陈在郑之东南'],
  ['chen', 'E', 'zheng', '陈在郑之东南'],
  ['zhounan', 'S', 'wang', '二南在南'],
  ['shaonan', 'S', 'wang', '二南在南'],
  ['shaonan', 'W', 'zhounan', '召南在周南以西(分陕而治,召公居西)'],
  ['bei', 'N', 'yong', '郑玄《诗谱》:朝歌以北为邶、以南为鄘'],
  ['wey', 'E', 'yong', '郑玄《诗谱》:朝歌以东为卫'],
  ['wey', 'E', 'bei', '郑玄《诗谱》:朝歌以东为卫'],
  ['yong', 'N', 'zheng', '卫地三风在河北,郑在河南'],
  ['tang', 'N', 'wang', '唐(晋)在北'],
  ['wei', 'N', 'wang', '魏在北(河曲之内)'],
  ['wei', 'W', 'tang', '魏在唐之西南'],
  ['wei', 'S', 'tang', '魏在唐之西南'],
  ['cao', 'E', 'zheng', '曹在中东'],
  ['cao', 'E', 'wey', '曹在卫之东南'],
  ['cao', 'S', 'wey', '曹在卫之东南'],
]

const SIDE = {
  W: (a, b) => a.x < b.x,
  E: (a, b) => a.x > b.x,
  N: (a, b) => a.y < b.y,
  S: (a, b) => a.y > b.y,
}

/** 违反的方位约束 → [说明];缺 id 也算一条 */
export function orientationErrors(regions, rules = ORIENTATION) {
  const byId = Object.fromEntries(regions.map((r) => [r.id, r]))
  const out = []
  for (const [a, dir, b, why] of rules) {
    if (!byId[a] || !byId[b]) { out.push(`方位约束引用了不存在的 id:${a} / ${b}`); continue }
    if (!SIDE[dir](byId[a], byId[b])) out.push(`${byId[a].name} 应在 ${byId[b].name} 之${{ W: '西', E: '东', N: '北', S: '南' }[dir]}(${why})`)
  }
  return out
}

/** 一组节点(连同右侧首数标签)的外框,供「皆故卫地」虚框用 */
export function clusterBox(regions, ids, pad = 12) {
  const rs = regions.filter((r) => ids.includes(r.id))
  if (!rs.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rs) {
    const rad = regionRadius(r.poems)
    x0 = Math.min(x0, r.x - rad)
    x1 = Math.max(x1, r.x + rad + COUNT_LABEL_GAP + COUNT_LABEL_W)
    y0 = Math.min(y0, r.y - rad)
    y1 = Math.max(y1, r.y + rad)
  }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
}

/** 两两重叠的节点(圆心距 < 两半径和 + 间隙) → [[a, b]] */
export function overlappingPairs(regions, gap = 8) {
  const out = []
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < regionRadius(a.poems) + regionRadius(b.poems) + gap) out.push([a.id, b.id])
    }
  }
  return out
}

/**
 * 诗题 → 阅读器深链。长章在阅读器里拆屏(?p=,见 reader/chapterParts.js),
 * 诗题所在那一屏要带上,否则 #seg 锚落不到。parts 为 chapterParts() 的返回(可为 null)。
 * 第一屏也显式带 ?p=1:不带时阅读器会按「上次读到哪」自动落屏,未必是第一屏。
 */
export function poemHref(ch, idx, parts) {
  const base = `/ru/shijing/${ch}`
  const i = parts ? parts.findIndex((pt) => idx >= pt.from && idx < pt.to) : -1
  const q = i >= 0 ? `?p=${i + 1}` : ''
  return `${base}${q}#seg-${ch}-${idx}`
}
