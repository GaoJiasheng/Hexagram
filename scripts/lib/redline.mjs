// 各组白话红线触发词(软警告,人工复核;workflow 校对 agent 是主防线)。
// check-data 与 scripts/redline-review.mjs 共用:命中片段 + 签名(sig)——人读复核过的章登记在
// scripts/lib/redline-reviewed.json,签名一致才算「已复核」;章文改动致命中变化即重新报警。
import { createHash } from 'node:crypto'

// 各组红线触发词(软警告,人工复核;workflow 校对 agent 是主防线)
export const RED_SHI = /(人生启示|人生哲理|处世哲理|给我们的启示|告诉我们一个道理|励志|正能量|心灵鸡汤|这首诗教我们|启示我们要|值得我们学习)/
export const REDLINE = {
  zhongyi: /(包治|药到病除|立竿见影|疗效显著|可治愈|用法用量为|每日.{0,4}服用|建议服用|对照自诊|照方自疗)/,
  moulue: /(教你如何驭|实操技巧|职场必备|学会这招|驭人之术值得|照着用就能)/,
  dao: /(长生不老|羽化登仙|修炼成仙|包你成仙|烧符念咒可)/,
  fo: /(消业障|保佑你|必得往生|皈依方能|烧香拜佛即可)/,
  yijing: /(预示你|预示着你|你的运势|你将.{0,4}(大吉|大凶|有难)|必有.{0,3}之(灾|祸)|趋吉避凶之法|算出你|占得此卦.{0,8}(宜|忌|大吉|大凶)|你的命运)/,
  // 诗词曲三组第一红线是「不鸡汤」——给诗写「人生启示」比译错一个字更糟(见 poetry-production-standard.md §6)
  tangshi: RED_SHI, songci: RED_SHI, yuanqu: RED_SHI,
  // 观数第一红线是「研习不断命」:我方文字不得对读者下断语、不得教人拿去套(原典断语在 quote 里照录不算)
  mingli: /(你的命|你的八字|你命中|你这个命|命中注定|必定(发财|升官|离婚|克)|可以断定此人|据此可断|照此断命|学会了就能(算|断)|教你(算|断|看)命|(大吉|大凶)之命|改运|转运方法|旺夫|克夫|克妻)/,
}

/** 扫一章白话:返回全部命中(词 + 前后文)与签名。article 为该章对象。 */
export function redlineHits(corpus, article, ctx = 18) {
  const re = REDLINE[corpus]
  if (!re) return { hits: [], sig: '' }
  const blob = JSON.stringify(article)
  const g = new RegExp(re.source, 'g')
  const hits = []
  let m
  while ((m = g.exec(blob))) {
    hits.push({ word: m[0], ctx: blob.slice(Math.max(0, m.index - ctx), m.index + m[0].length + ctx).replace(/\\n|\\"|"/g, ' ') })
  }
  const sig = hits.length ? createHash('sha1').update(hits.map((h) => h.ctx).join('|')).digest('hex').slice(0, 10) : ''
  return { hits, sig }
}
