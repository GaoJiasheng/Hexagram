// 变占规则 — 朱熹《易学启蒙》简表
// getDivinationResult(hexagram, movingLines[], hexagramByBinary) → DivinationResult
// 每个所占文本(卦辞/爻辞)附 commentary:卦辞配彖传,爻辞配小象传,用九用六配各自小象(均十翼原文,只释卦象不断吉凶)

import { getBianGua, lineTitle } from './transforms.js'

// 卦辞 → 彖传
const tuanOf = (h) =>
  h?.tuan?.original ? { kind: 'tuan', original: h.tuan.original, translation: h.tuan.translation } : null
// 爻辞 → 小象传
const xiangOf = (line) =>
  line?.xiaoxiang?.original
    ? { kind: 'xiang', original: line.xiaoxiang.original, translation: line.xiaoxiang.translation }
    : null

export function getDivinationResult(hexagram, movingLines, hexagramByBinary) {
  const dong = [...movingLines].sort((a, b) => a - b) // 1-indexed, 升序
  const n = dong.length
  const bianBinary = n > 0 ? getBianGua(hexagram.binary, dong) : hexagram.binary
  const bianHex = n > 0 ? hexagramByBinary.get(bianBinary) : null

  if (n === 0) {
    return {
      ruleName: '无动爻',
      ruleNote: '依《易学启蒙》：无动爻者，以本卦卦辞占，兼参大象传。',
      primaryTexts: [
        { label: hexagram.name + '·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram) },
      ],
      secondaryTexts: [{ label: hexagram.name + '·象曰', text: hexagram.daxiang, collapsible: true }],
      bianHex: null,
    }
  }

  if (n === 1) {
    const line = hexagram.lines[dong[0] - 1]
    return {
      ruleName: '一爻变',
      ruleNote: '依《易学启蒙》：一爻变者，以本卦变爻之辞占。',
      primaryTexts: [
        {
          label: hexagram.name + '·' + line.title,
          text: { original: line.original, translation: line.translation },
          commentary: xiangOf(line),
        },
      ],
      secondaryTexts: [
        { label: hexagram.name + '·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true },
        ...(bianHex ? [{ label: bianHex.name + '·卦辞', text: bianHex.judgment, commentary: tuanOf(bianHex), collapsible: true }] : []),
      ],
      bianHex,
    }
  }

  if (n === 2) {
    const upperPos = dong[1]
    const lowerPos = dong[0]
    const upperLine = hexagram.lines[upperPos - 1]
    const lowerLine = hexagram.lines[lowerPos - 1]
    return {
      ruleName: '二爻变',
      ruleNote: '依《易学启蒙》：二爻变者，以本卦二变爻之辞占，以上爻为主。',
      primaryTexts: [
        {
          label: hexagram.name + '·' + upperLine.title + '（主）',
          text: { original: upperLine.original, translation: upperLine.translation },
          commentary: xiangOf(upperLine),
        },
        {
          label: hexagram.name + '·' + lowerLine.title,
          text: { original: lowerLine.original, translation: lowerLine.translation },
          commentary: xiangOf(lowerLine),
        },
      ],
      secondaryTexts: [
        { label: hexagram.name + '·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true },
        ...(bianHex ? [{ label: bianHex.name + '·卦辞', text: bianHex.judgment, commentary: tuanOf(bianHex), collapsible: true }] : []),
      ],
      bianHex,
    }
  }

  if (n === 3) {
    return {
      ruleName: '三爻变',
      ruleNote: '依《易学启蒙》：三爻变者，以本卦与变卦之卦辞占，本卦为贞，变卦为悔。',
      primaryTexts: [
        { label: hexagram.name + '（贞）·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram) },
        ...(bianHex
          ? [{ label: bianHex.name + '（悔）·卦辞', text: bianHex.judgment, commentary: tuanOf(bianHex) }]
          : []),
      ],
      secondaryTexts: [],
      bianHex,
    }
  }

  if (n === 4) {
    const allLines = [1, 2, 3, 4, 5, 6]
    const staticLines = allLines.filter(l => !dong.includes(l)).sort((a, b) => a - b)
    const lowerStatic = staticLines[0]
    const upperStatic = staticLines[1]
    const result = {
      ruleName: '四爻变',
      ruleNote: '依《易学启蒙》：四爻变者，以变卦中二不变爻之辞占，以下爻为主。',
      primaryTexts: [],
      secondaryTexts: [
        { label: hexagram.name + '（本卦）·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true },
      ],
      bianHex,
    }
    if (bianHex) {
      const lowerLine = bianHex.lines[lowerStatic - 1]
      const upperLine = bianHex.lines[upperStatic - 1]
      result.primaryTexts = [
        {
          label: bianHex.name + '·' + lowerLine.title + '（主）',
          text: { original: lowerLine.original, translation: lowerLine.translation },
          commentary: xiangOf(lowerLine),
        },
        {
          label: bianHex.name + '·' + upperLine.title,
          text: { original: upperLine.original, translation: upperLine.translation },
          commentary: xiangOf(upperLine),
        },
      ]
    }
    return result
  }

  if (n === 5) {
    const allLines = [1, 2, 3, 4, 5, 6]
    const staticLine = allLines.find(l => !dong.includes(l))
    const result = {
      ruleName: '五爻变',
      ruleNote: '依《易学启蒙》：五爻变者，以变卦中唯一不变爻之辞占。',
      primaryTexts: [],
      secondaryTexts: [
        { label: hexagram.name + '（本卦）·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true },
      ],
      bianHex,
    }
    if (bianHex && staticLine) {
      const line = bianHex.lines[staticLine - 1]
      result.primaryTexts = [
        {
          label: bianHex.name + '·' + line.title,
          text: { original: line.original, translation: line.translation },
          commentary: xiangOf(line),
        },
      ]
    }
    return result
  }

  // n === 6
  if (hexagram.id === 1 && hexagram.extra?.use) {
    return {
      ruleName: '六爻皆变',
      ruleNote: '依《易学启蒙》：乾卦六爻皆变，以用九之辞占。',
      primaryTexts: [
        {
          label: '乾·用九',
          text: { original: hexagram.extra.use.original, translation: hexagram.extra.use.translation },
          commentary: xiangOf(hexagram.extra.use),
        },
      ],
      secondaryTexts: [{ label: '乾·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true }],
      bianHex,
    }
  }
  if (hexagram.id === 2 && hexagram.extra?.use) {
    return {
      ruleName: '六爻皆变',
      ruleNote: '依《易学启蒙》：坤卦六爻皆变，以用六之辞占。',
      primaryTexts: [
        {
          label: '坤·用六',
          text: { original: hexagram.extra.use.original, translation: hexagram.extra.use.translation },
          commentary: xiangOf(hexagram.extra.use),
        },
      ],
      secondaryTexts: [{ label: '坤·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true }],
      bianHex,
    }
  }
  return {
    ruleName: '六爻皆变',
    ruleNote: '依《易学启蒙》：六爻皆变者，以变卦卦辞占。',
    primaryTexts: bianHex
      ? [{ label: bianHex.name + '·卦辞', text: bianHex.judgment, commentary: tuanOf(bianHex) }]
      : [],
    secondaryTexts: [{ label: hexagram.name + '（本卦）·卦辞', text: hexagram.judgment, commentary: tuanOf(hexagram), collapsible: true }],
    bianHex,
  }
}
