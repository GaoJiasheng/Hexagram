// `ring` 件(RingChart,通用环形序列)的 props 校验 —— 纯 JS、零依赖,浏览器与 check-data 共用。
// 由主会话接进 schema.js 的 VALIDATORS:`ring: validateRing`(design-v24 §4 / design-v23 §5)。
//
// props 契约:
//   items   必填,3–24 项,每项 { label, note?, quote?, cite?, href? }
//             label  非空,≤ 6 字(环上节点放得下)
//             quote  原文引句(调用方负责从底本切片;数据闸另行回查)
//             cite   出处短名(如「维摩诘经·法供养品」),有 href 时作链接文字
//             href   站内路径,须以 / 起头
//   center? 字符串(只作中心标题),或与 item 同形的对象(可点,出释义)
//   focus?  整数,预选第几项(0 起),须在 items 范围内
//   arrows? 布尔:相邻项之间画顺时针箭头(序列有先后时用)
//   loop?   布尔,默认 true:arrows 时末项接回首项的一段画实线;false 画虚线(环是示意、经文只说到末项为止)
//   foot?   字符串,件底一行说明

const isStr = (v) => typeof v === 'string' && v.length > 0
const isArr = Array.isArray
const isObj = (v) => v !== null && typeof v === 'object' && !isArr(v)

export const RING_MIN = 3
export const RING_MAX = 24
export const RING_LABEL_MAX = 6

function checkEntry(e, where, out) {
  if (!isObj(e)) { out.push(`${where} 须为对象`); return }
  if (!isStr(e.label)) out.push(`${where}.label 须为非空字符串`)
  else if ([...e.label].length > RING_LABEL_MAX) out.push(`${where}.label「${e.label}」超过 ${RING_LABEL_MAX} 字`)
  for (const f of ['note', 'quote', 'cite']) {
    if (e[f] !== undefined && typeof e[f] !== 'string') out.push(`${where}.${f} 须为字符串`)
  }
  if (e.href !== undefined && !(isStr(e.href) && e.href.startsWith('/'))) out.push(`${where}.href 须为站内路径(以 / 起头)`)
}

/** 校验 ring 件的 props。返回错误信息数组,空 = 合法。 */
export function validateRing(p) {
  const e = []
  if (!isObj(p)) return ['props 须为对象']
  if (!isArr(p.items)) e.push('items 须为数组')
  else {
    if (p.items.length < RING_MIN || p.items.length > RING_MAX) e.push(`items 须为 ${RING_MIN}–${RING_MAX} 项(现 ${p.items.length})`)
    p.items.forEach((it, i) => checkEntry(it, `items[${i}]`, e))
  }
  if (p.center !== undefined) {
    if (typeof p.center === 'string') { if (!p.center) e.push('center 不能为空串') }
    else checkEntry(p.center, 'center', e)
  }
  if (p.focus !== undefined) {
    const n = isArr(p.items) ? p.items.length : 0
    if (!Number.isInteger(p.focus) || p.focus < 0 || p.focus >= n) e.push(`focus 须为 0–${Math.max(n - 1, 0)} 的整数`)
  }
  for (const f of ['arrows', 'loop']) if (p[f] !== undefined && typeof p[f] !== 'boolean') e.push(`${f} 须为布尔`)
  if (p.foot !== undefined && typeof p.foot !== 'string') e.push('foot 须为字符串')
  return e
}
