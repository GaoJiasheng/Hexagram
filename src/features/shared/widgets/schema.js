// widget 块的参数校验 —— 纯 JS、零 React,**浏览器与 check-data(Node)共用同一份**。
//
// 富文本块 `{ type:'widget', kind, props, caption? }`(design-v23 §5)。
// 与静态 `figure` 块相比:管线只写**参数**不画图 —— 省 token、风格统一、明暗自适应,
// 而且**参数错了机器查得出**(死 SVG 画错了谁也查不出)。这个文件就是那道闸。
//
// 加一个 widget:① 这里登记 kind 与校验 ② registry.jsx 登记懒加载组件 ③ design-v23 §5 补 props 契约。

import { GAN, ZHI, WUXING, isValidGanZhi, isGan, isZhi, cangGan } from '../ganzhi/index.js'

const isStr = (v) => typeof v === 'string' && v.length > 0
const isArr = Array.isArray
const oneOf = (list) => (v) => list.includes(v)

// 每个 kind 一个校验函数:收 props,返回错误信息数组(空 = 合法)。
const VALIDATORS = {
  // 四柱图。pillars 必填;focus 是要高亮的干/支字;show 控制显示哪几层。
  sizhu(p) {
    const e = []
    if (!isArr(p.pillars) || p.pillars.length !== 4) e.push('pillars 须为 4 个干支')
    else for (const gz of p.pillars) if (!isValidGanZhi(gz)) e.push(`不是合法干支: ${gz}`)
    if (p.focus !== undefined) {
      if (!isArr(p.focus)) e.push('focus 须为数组')
      else for (const c of p.focus) if (!isGan(c) && !isZhi(c)) e.push(`focus 里不是干支字: ${c}`)
    }
    if (p.show !== undefined && !(isArr(p.show) && p.show.every(oneOf(['shishen', 'canggan', 'nayin', 'changsheng', 'count'])))) {
      e.push('show 只许 shishen/canggan/nayin/changsheng/count')
    }
    return e
  },
  // 五行生克图。labels 给每行挂一个标签(中医:木→肝);highlight 预亮;mode 决定画哪种线。
  wuxing(p) {
    const e = []
    if (p.highlight !== undefined && !(isArr(p.highlight) && p.highlight.every(oneOf(WUXING)))) e.push('highlight 须为五行数组')
    if (p.center !== undefined && !WUXING.includes(p.center)) e.push(`center 不是五行: ${p.center}`)
    if (p.mode !== undefined && !['sheng', 'ke', 'both'].includes(p.mode)) e.push('mode 只许 sheng/ke/both')
    if (p.labels !== undefined) {
      if (typeof p.labels !== 'object' || isArr(p.labels)) e.push('labels 须为对象')
      else for (const k of Object.keys(p.labels)) if (!WUXING.includes(k)) e.push(`labels 的键不是五行: ${k}`)
    }
    return e
  },
  // 六十甲子盘。
  jiazi(p) {
    const e = []
    if (p.highlight !== undefined && !(isArr(p.highlight) && p.highlight.every(isValidGanZhi))) e.push('highlight 须为合法干支数组')
    return e
  },
  // 十神盘:换日主,全盘重标。
  shishen(p) {
    return p.dayGan !== undefined && !GAN.includes(p.dayGan) ? [`dayGan 不是天干: ${p.dayGan}`] : []
  },
  // 十二支盘:藏干 + 合冲刑害连线。
  dizhi(p) {
    const e = []
    if (p.show !== undefined && !(isArr(p.show) && p.show.every(oneOf(['liuhe', 'sanhe', 'sanhui', 'chong', 'xing', 'hai'])))) e.push('show 只许 liuhe/sanhe/sanhui/chong/xing/hai')
    if (p.focus !== undefined && !(isArr(p.focus) && p.focus.every(oneOf(ZHI)))) e.push('focus 须为地支数组')
    return e
  },
  // 起柱演示:which 决定演示五虎遁(年上起月)还是五鼠遁(日上起时)。
  qizhu(p) {
    const e = []
    if (p.which !== undefined && !['month', 'hour'].includes(p.which)) e.push('which 只许 month/hour')
    if (p.gan !== undefined && !GAN.includes(p.gan)) e.push(`gan 不是天干: ${p.gan}`)
    return e
  },
  // 节气年轮:拖日期看年柱/月柱在哪一刻换。
  jieqi(p) {
    return p.year !== undefined && !(Number.isInteger(p.year) && p.year >= 1900 && p.year <= 2100) ? ['year 须为 1900–2100 的整数'] : []
  },
  // 通用可点矩阵。cells 的键是 `行|列`;每格 text 必填,href/note 选填。
  matrix(p) {
    const e = []
    if (!isArr(p.rows) || !p.rows.length || !p.rows.every(isStr)) e.push('rows 须为非空字符串数组')
    if (!isArr(p.cols) || !p.cols.length || !p.cols.every(isStr)) e.push('cols 须为非空字符串数组')
    if (typeof p.cells !== 'object' || p.cells === null || isArr(p.cells)) e.push('cells 须为对象')
    else if (!e.length) {
      for (const [k, c] of Object.entries(p.cells)) {
        const [r, col, extra] = k.split('|')
        if (extra !== undefined || !p.rows.includes(r) || !p.cols.includes(col)) e.push(`cells 的键不在行列之内: ${k}`)
        if (!c || !isStr(c.text)) e.push(`cells[${k}] 缺 text`)
        if (c && c.href !== undefined && !(isStr(c.href) && c.href.startsWith('/'))) e.push(`cells[${k}].href 须为站内路径`)
        for (const f of ['note', 'quote', 'sub', 'caveat']) if (c && c[f] !== undefined && typeof c[f] !== 'string') e.push(`cells[${k}].${f} 须为字符串`)
      }
    }
    if (p.colorGan !== undefined && typeof p.colorGan !== 'boolean') e.push('colorGan 须为布尔')
    for (const f of ['foot', 'linkLabel', 'rowLabel', 'colLabel']) if (p[f] !== undefined && typeof p[f] !== 'string') e.push(`${f} 须为字符串`)
    return e
  },
  // 格局判定流程(子平真诠):日主 × 月令 → 藏干十神 → 谁透谁作主 → 格名。tou 须是该月令的藏干。
  geju(p) {
    const e = []
    if (p.dayGan !== undefined && !GAN.includes(p.dayGan)) e.push(`dayGan 不是天干: ${p.dayGan}`)
    if (p.monthZhi !== undefined && !ZHI.includes(p.monthZhi)) e.push(`monthZhi 不是地支: ${p.monthZhi}`)
    if (p.tou !== undefined) {
      if (!isArr(p.tou) || !p.tou.every((g) => GAN.includes(g))) e.push('tou 须为天干数组')
      else if (!e.length && !p.tou.every((g) => cangGan(p.monthZhi || '辰').includes(g))) e.push(`tou 里有不在 ${p.monthZhi || '辰'} 藏干中的字`)
    }
    return e
  },
}

export const WIDGET_KINDS = Object.keys(VALIDATORS)

/** 校验一个 widget 块。返回错误信息数组,空数组 = 合法。 */
export function validateWidget(block) {
  if (!block || block.type !== 'widget') return ['不是 widget 块']
  if (!WIDGET_KINDS.includes(block.kind)) return [`未知 widget kind: ${block.kind}`]
  const props = block.props ?? {}
  if (typeof props !== 'object' || isArr(props)) return ['props 须为对象']
  const errs = VALIDATORS[block.kind](props)
  if (block.caption !== undefined && typeof block.caption !== 'string') errs.push('caption 须为字符串')
  return errs
}
