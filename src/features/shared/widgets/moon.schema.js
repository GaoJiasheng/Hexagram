// `moon` 件(参同契月相纳甲盘)的 props 校验 —— 纯 JS,浏览器与 check-data 共用。
// 主会话把它接进 schema.js 的 VALIDATORS:`moon: validateMoon`。
//
// props 契约(design-v24 §3):
//   phase?   整数 0–7:0 朔 · 1 初三震 · 2 初八兑 · 3 十五乾 · 4 十六巽 · 5 二十三艮 · 6 三十坤 · 7 晦朔合符(盘心坎离)
//   showHex? 布尔,默认 true:盘心出六画卦画(HexagramFigure);false 则只出卦名与三画卦符
//
// 返回错误信息数组,空数组 = 合法。

export function validateMoon(p) {
  const e = []
  if (p.phase !== undefined && !(Number.isInteger(p.phase) && p.phase >= 0 && p.phase <= 7)) e.push('phase 须为 0–7 的整数')
  if (p.showHex !== undefined && typeof p.showHex !== 'boolean') e.push('showHex 须为布尔')
  return e
}
