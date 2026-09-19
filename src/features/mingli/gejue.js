// 《渊海子平》「又地支藏遁歌」——歌诀卡的规则层(纯函数、零依赖、同步)。
//
// 这首歌诀就是十二地支各自藏着哪些天干的口诀,后世十神、格局全从这张表查起
// (design-v23:规则层不能凭记忆写,得和底本对得上)。parseCangdunGe 只做一件事——
// 把歌诀原文拆成十二句、认出每句讲的地支字与出现的天干字,不查表、不下结论,
// 好让单测拿它跟共享规则层的 cangGan() 互校:两个独立来源对得上才算数。

import { GAN, ZHI, cangGan } from '../shared/ganzhi/index.js'

const GAN_SET = new Set(GAN)
const ZHI_SET = new Set(ZHI)

// 全角标点须转义写 \uXXXX——工具链会把字面量全角标点悄悄转成半角(CLAUDE.md 已踩过的坑)。
const SEP_RE = /[\uFF0C\uFF1B\u3002]/ // ，；。

/**
 * 歌诀原文 → 十二句,顺序照歌诀原序。
 * 每句 { zhi, gans, line }:zhi 是句中第一个出现的地支字,gans 是句中出现的天干字集合
 * (按出现顺序、去重;「金木水火土」这些五行字不是天干,天然被 GAN_SET 排除)。
 */
export function parseCangdunGe(text) {
  const lines = String(text ?? '').split(SEP_RE).map((s) => s.trim()).filter(Boolean)
  return lines.map((line) => {
    let zhi = null
    const gans = []
    for (const ch of line) {
      if (!zhi && ZHI_SET.has(ch)) zhi = ch
      if (GAN_SET.has(ch) && !gans.includes(ch)) gans.push(ch)
    }
    return { zhi, gans, line }
  })
}

/**
 * 十二张卡:{ zhi, answer, line }。
 * answer 取自共享规则层 cangGan(zhi)(本气→中气→余气的顺序),不是从歌诀句子里现拼——
 * 歌诀句子只用来核对与显示。
 */
export function buildDeck(text) {
  return parseCangdunGe(text).map(({ zhi, line }) => ({ zhi, answer: cangGan(zhi), line }))
}

/** 判卷:picked 对 answer,不计顺序。 */
export function judge(answer, picked) {
  const ansSet = new Set(answer)
  const pickedSet = new Set(picked)
  const right = answer.filter((g) => pickedSet.has(g))
  const missed = answer.filter((g) => !pickedSet.has(g))
  const wrong = picked.filter((g) => !ansSet.has(g))
  return { right, missed, wrong, ok: missed.length === 0 && wrong.length === 0 }
}

/**
 * 确定性洗牌(Fisher–Yates,随机源是一个简单 LCG)。
 * 同 seed 必得同结果——练习卡的「下一轮」要能被单测重复验证,不能用 Math.random。
 */
export function shuffle(arr, seed = 1) {
  const out = arr.slice()
  let s = (seed >>> 0) || 1
  const next = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0 // Numerical Recipes 参数
    return s / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
