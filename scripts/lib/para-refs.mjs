// 白话正文里的段号引用(M1,2026-10-01):check-data 的越界闸与 check-baihua-draft 的代理自查共用。
// 白话生成提示语 2026-10-01 前按 0 起算、阅读页按 1 起算,玉照白话因此 55 处差 1;
// 现在只能兜住两种硬伤:N = 0(必是 0 起算)与 N > 本章段数。只认明确指站内段号的写法,「分成三段」这类泛指不算。
// 白话正文里的段号引用:「第 N 段」「段 N」「段 N–M」(阿拉伯或汉字数字)。生成提示语 2026-10-01 前按 0 起算、
// 阅读页按 1 起算,玉照白话因此 55 处差 1。这里只能兜住两种硬伤:N = 0(必是 0 起算)与 N > 本章段数。
export const CN = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
export const cnNum = (t) => {
  if (/^[0-9０-９]+$/.test(t)) return Number(t.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)))
  let n = 0, cur = 0
  for (const ch of t) {
    if (ch === '百') { n += (cur || 1) * 100; cur = 0 }
    else if (ch === '十') { n += (cur || 1) * 10; cur = 0 }
    else if (ch in CN) cur = CN[ch]
    else return null
  }
  return n + cur
}
export const paraRefs = (text) => {
  const out = []
  // 只认明确指站内段号的写法:「站内/本站/原文/本章 第 N 段」「站内/本站/原文/本章 段 N(–M)」「（第N段）」;
  // 「分成三段」「第二段落」这类泛指不算(第一版把它们全算进去,43 条里多半误报)
  const re = /(?:(?:站内|本站|原文|本章|见|系于|在)\s*(?:卷一\s*)?第\s*([0-9０-９]+|[零〇一二两三四五六七八九十百]+)(?:\s*[–—至-]\s*([0-9０-９]+|[零〇一二两三四五六七八九十百]+))?\s*段|(?:站内|本站|原文|本章|见)\s*段\s*([0-9０-９]+)(?:\s*[–—-]\s*([0-9０-９]+))?|（第\s*([0-9０-９]+)\s*段）)/g
  let m
  while ((m = re.exec(text))) {
    for (const g of [m[1], m[2], m[3], m[4], m[5]]) { if (!g) continue; const n = cnNum(g); if (n !== null) out.push(n) }
  }
  return out
}

