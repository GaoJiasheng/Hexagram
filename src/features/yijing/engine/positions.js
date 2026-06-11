// 爻位分析 — 当位/得中/相应/乘承/三才/爻位身份/贞悔

import { lineTitle } from './transforms.js'

const CORRES = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 }

const SANCAI = { 1: '地', 2: '地', 3: '人', 4: '人', 5: '天', 6: '天' }
const SHENFEN = { 1: '元士', 2: '大夫', 3: '三公', 4: '诸侯', 5: '天子', 6: '宗庙' }

export function analyzePosition(pos, binary) {
  const i = pos - 1
  const isYang = binary[i] === '1'
  const isOddPos = pos % 2 === 1

  const dangWei = isYang === isOddPos
  const deZhong = pos === 2 || pos === 5
  const zhongZheng = dangWei && deZhong

  const corresPos = CORRES[pos]
  const corresYang = binary[corresPos - 1] === '1'
  const xianYing = isYang !== corresYang
  const corresTitle = lineTitle(corresPos, corresYang)

  const chengGang = !isYang && pos > 1 && binary[i - 1] === '1'
  const chengYang = !isYang && pos < 6 && binary[i + 1] === '1'

  return {
    pos,
    isYang,
    dangWei,
    deZhong,
    zhongZheng,
    xianYing,
    corresPos,
    corresTitle,
    chengGang,
    chengYang,
    title: lineTitle(pos, isYang),
    sancai: SANCAI[pos],
    shenfen: SHENFEN[pos],
    zhenHui: pos <= 3 ? '贞' : '悔',
  }
}

export function analyzeAllPositions(binary) {
  return Array.from({ length: 6 }, (_, i) => analyzePosition(i + 1, binary))
}

export function describePosition(a) {
  const yangYin = a.isYang ? '阳' : '阴'
  const qiOu = a.pos % 2 === 1 ? '奇' : '偶'
  const chips = []

  if (a.zhongZheng) chips.push('中正')
  else {
    if (a.dangWei) chips.push('当位')
    else chips.push('失位')
    if (a.deZhong) chips.push('得中')
  }
  chips.push(a.xianYing ? '应' + a.corresTitle : '敌' + a.corresTitle)
  if (a.chengGang) chips.push('乘刚')

  let desc
  if (a.zhongZheng) {
    desc = `${yangYin}居${qiOu}位，中正兼备，${a.xianYing ? '且与' + a.corresTitle + '相应，位正有援' : '然无外应，宜守中'}。`
  } else if (a.dangWei && a.xianYing) {
    desc = `${yangYin}居${qiOu}位（当位），与${a.corresTitle}相应——位正而有援。`
  } else if (a.dangWei && !a.xianYing) {
    desc = `${yangYin}居${qiOu}位（当位），与${a.corresTitle}敌应——位正然乏应，宜守中。`
  } else if (!a.dangWei && a.xianYing) {
    desc = `${yangYin}居${qiOu}位（失位），与${a.corresTitle}相应——位不正而有援，须审时。`
  } else {
    desc = `${yangYin}居${qiOu}位（失位），与${a.corresTitle}敌应——位不正且乏应，宜慎。`
  }
  if (a.deZhong && !a.zhongZheng) desc += '居卦中，得中。'
  if (a.chengGang) desc += '阴乘刚下，势位不安。'
  desc += `居${a.sancai}位，${a.shenfen}之象。`

  return { chips, desc }
}

// 贞悔一句：内卦为贞(主)，外卦为悔(客)
export function describeZhenHui(hexagram) {
  const { lowerTrigram, upperTrigram } = hexagram
  // trigramById 在调用处传入以避免循环依赖
  return null // 调用方自行取 trigramById
}
