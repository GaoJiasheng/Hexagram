// 断句层(2026-09-19,观数):四库白文(《三命通会》《李虚中命书》《玉照定真经》)底本一个标点都没有,
// 学习站没法读。标点是**编辑内容**(与译文同级),不是底本——所以:
//   · 底本仍是管线生成物,一字不改;标点另存 scripts/authored/<corpus>-punct.json(章号 → 段序数组)
//   · 管线合并时过一道**硬不变式**:断句本去掉标点与空白后,必须与底本去掉空白后**逐字相等**;
//     不等(多字、少字、改字、繁简被动过)→ 该段不采用,保留白文,并报 warning
// 这样「只加标点不动字」这件事是机器可证的,不靠信任。fetch-corpus / assemble-newtexts / check-data 共用。
const PUNCT = /[\s　，。；：！？、「」『』《》〈〉（）()“”‘’·—…,.;:!?"'\-]/g

/** 只留「字」:去标点、去一切空白(含四库列对齐残留的全角空格)。 */
export const core = (s) => String(s || '').replace(PUNCT, '')

/** 断句本是否只加了标点(没动任何一个字)。 */
export const samePunctless = (punctuated, original) => core(punctuated) === core(original)

/** 断句本至少得真的加了标点(否则没有意义),且不能把原文的空白信息以外的东西塞进来。 */
export function validPunctuated(punctuated, original) {
  if (typeof punctuated !== 'string' || !punctuated) return false
  if (!samePunctless(punctuated, original)) return false
  return /[，。；：！？、]/.test(punctuated) || [...core(original)].length <= 6
}
