// 《滴天髓阐微》命例走读单例校验 —— assemble-cases 与 check-data 共用同一份。
// 走读的每一步 = 图上几个字 + 任氏一句原话 + 我们一句人话。看守三件事:
//   ① 原话逐字出自解说段、且按原文先后排(不许重排任氏的推理次序)
//   ② 高亮的字确实在这个命例的四柱里
//   ③ 我们的话守「研习不断命」——不带断语用字;任氏记其人生平的话只许放在末尾的 record 步、照录不评
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥'
const VERDICT_RE = /[吉凶贵贱富贫寿夭祸福]/
const len = (s) => [...s].length

/** @returns {string[]} 错误信息;空数组 = 合法 */
export function validateCase(rec, book) {
  const e = []
  const ch = book.chapters.find((c) => c.no === rec.ch)
  if (!ch) return [`找不到第 ${rec.ch} 章`]
  const p = ch.paragraphs[rec.para], cp = ch.paragraphs[rec.commentPara]
  if (!p || !Array.isArray(p.pillars) || p.pillars.length !== 4) return [`第 ${rec.ch} 章第 ${rec.para} 段不是结构化命例`]
  if (!cp || rec.commentPara <= rec.para) return [`commentPara 不合法: ${rec.commentPara}`]
  if (cp.pillars) return ['commentPara 指向了另一个命例段']
  const chars = new Set(p.pillars.join(''))

  for (const [f, max] of [['title', 8], ['concept', 6], ['why', 36]]) {
    if (typeof rec[f] !== 'string' || !rec[f]) e.push(`缺 ${f}`)
    else if (len(rec[f]) > max) e.push(`${f} 超 ${max} 字`)
    else if (VERDICT_RE.test(rec[f])) e.push(`${f} 含断语用字: ${rec[f]}`)
  }
  if (!Array.isArray(rec.steps) || rec.steps.length < 3 || rec.steps.length > 6) return [...e, 'steps 须 3–6 步']

  let cursor = 0
  rec.steps.forEach((s, i) => {
    const tag = `steps[${i}]`
    if (typeof s.quote !== 'string' || len(s.quote) < 4 || len(s.quote) > 40) { e.push(`${tag}.quote 须 4–40 字`); return }
    const at = cp.original.indexOf(s.quote, cursor)
    if (at < 0) e.push(`${tag}.quote 不是解说段的原文子串,或次序/重叠不对: ${s.quote}`)
    else cursor = at + s.quote.length
    if (s.kind === 'record') {
      if (i !== rec.steps.length - 1) e.push(`${tag}: record 只许放在最后一步`)
      if (s.say !== undefined || s.focus !== undefined) e.push(`${tag}: record 步不带 say/focus`)
      return
    }
    if (s.kind !== undefined) e.push(`${tag}.kind 只许 record`)
    if (!Array.isArray(s.focus) || s.focus.length < 1 || s.focus.length > 4) e.push(`${tag}.focus 须 1–4 个字`)
    else for (const c of s.focus) {
      if (!(GAN.includes(c) || ZHI.includes(c)) || len(c) !== 1) e.push(`${tag}.focus 不是干支单字: ${c}`)
      else if (!chars.has(c)) e.push(`${tag}.focus 的「${c}」不在四柱 ${p.pillars.join(' ')} 里`)
    }
    if (typeof s.say !== 'string' || !s.say) e.push(`${tag} 缺 say`)
    else if (len(s.say) > 64) e.push(`${tag}.say 超 64 字`)
    else if (VERDICT_RE.test(s.say)) e.push(`${tag}.say 含断语用字: ${s.say}`)
  })
  if (rec.steps.filter((s) => s.kind !== 'record').length < 3) e.push('普通步骤不足 3 步')
  return e
}
