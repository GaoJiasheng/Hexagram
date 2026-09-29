// 战国策七国示意图 + 合纵连横时间轴(design-v24 §9)的纯函数:疆域六角格、时间轴泳道。
// 页面 ZhanguoceMapPage 与单测共用;不碰 DOM。
//
// 疆域画法:六角格按「加权距离」分给最近的国(power diagram:d² − w² 最小者得之),
// 离本国中心超过 reach 的格子不画——边缘因此参差,一眼看得出是示意,不是疆界。
// 这张图只表相对方位(秦西、齐东、燕东北、楚南),不给经纬、不对应任何一年的实际版图。

const SQRT3 = Math.sqrt(3)
export const HEX_R = 9          // 六角格外接圆半径(viewBox 单位)
const REACH = 1.6               // 每国最远画到 w × REACH

/** 某点归哪一国:加权距离(d² − w²)从小到大,取第一个在自己 reach 之内的;都够不着返回 null(不画)。
 *  小国(周)的加权区若超出它自己的 reach,就让给次近的大国,免得周边留出一圈空洞。 */
export function ownerAt(states, x, y) {
  const ranked = states
    .map((s) => { const d2 = (x - s.x) ** 2 + (y - s.y) ** 2; return { s, pd: d2 - s.w * s.w, d: Math.sqrt(d2) } })
    .sort((a, b) => a.pd - b.pd)
  const hit = ranked.find((r) => r.d <= r.s.w * REACH)
  return hit ? hit.s.id : null
}

function hexPath(cx, cy, r) {
  let d = ''
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90)
    d += `${k ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
  }
  return d + 'Z'
}

/**
 * 铺满画布的尖顶六角格,按 ownerAt 分国。
 * @returns {{ paths: Record<string,string>, count: Record<string,number> }} 每国一条合并 path(省 DOM)
 */
export function hexTerritories(view, states, r = HEX_R) {
  const dx = SQRT3 * r, dy = 1.5 * r
  const paths = {}, count = {}
  for (const s of states) { paths[s.id] = ''; count[s.id] = 0 }
  for (let row = 0; row * dy <= view.h; row++) {
    for (let col = 0; col * dx <= view.w; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0)
      const cy = row * dy
      if (cx < r || cx > view.w - r || cy < r || cy > view.h - r) continue
      const id = ownerAt(states, cx, cy)
      if (!id) continue
      paths[id] += hexPath(cx, cy, r - 1.1)   // 内缩一点,格与格之间留缝
      count[id]++
    }
  }
  return { paths, count }
}

// ---------- 时间轴 ----------
export const AXIS = { from: -380, to: -220 }
export const yearText = (y) => (y < 0 ? `前${-y}` : String(y))

export function makeXScale(W, padL, padR, axis = AXIS) {
  const span = axis.to - axis.from
  return (y) => padL + ((y - axis.from) / span) * (W - padL - padR)
}

/**
 * 一篇一条:from→to 画横条,右挂篇名;按起点排好后贪心分泳道(与全站时间轴同一思路)。
 * 篇名挂不下右缘时改挂条左。返回每条的 x1/x2/lane/nameRight 与总道数。
 */
export function layoutLanes(pieces, xOf, { W, padR = 8, minSpan = 5, gap = 6, charPx = 12.5 }) {
  const spans = pieces.map((it) => {
    const x1 = xOf(it.from)
    const x2 = Math.max(xOf(it.to), x1 + minSpan)
    const nameW = [...it.title].length * charPx + 22   // 篇名 + 前面的篇次数字
    const nameRight = x2 + nameW <= W - padR
    const occ = nameRight ? [x1, x2 + nameW] : [x1 - nameW, x2]
    return { it, x1, x2, nameRight, occ }
  }).sort((a, b) => a.occ[0] - b.occ[0] || a.occ[1] - b.occ[1])
  const laneEnd = []
  for (const sp of spans) {
    let lane = laneEnd.findIndex((end) => sp.occ[0] - end >= gap)
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(sp.occ[1]) } else laneEnd[lane] = sp.occ[1]
    sp.lane = lane
  }
  return { spans, lanes: laneEnd.length }
}

// ---------- 选择 ----------
/** sel 形如 'qin'(国)或 'p:handan'(地名);返回命中的篇次集合,sel 空则 null */
export function selectedChs(data, sel) {
  if (!sel) return null
  if (sel.startsWith('p:')) {
    const p = data.places.find((x) => x.id === sel.slice(2))
    return p ? new Set(p.chs) : new Set()
  }
  return new Set(data.pieces.filter((pc) => pc.states.includes(sel)).map((pc) => pc.ch))
}

export const piecesOfState = (data, id) => data.pieces.filter((pc) => pc.states.includes(id))
