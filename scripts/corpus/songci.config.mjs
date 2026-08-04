// 宋词抓取配置 —— fetch-corpus.mjs 读此驱动。
//
// 底本:《宋詞三百首》朱孝臧(彊村)一九二四年编,词选里流传最广的一部。
// 结构:与唐诗**完全不同** —— 维基文库上全书正文在**同一页**,
// 每首以 `=='''词牌·题'''（[[Author:作者]]）==` 起一节,共 282 首。
//
// 解析:走 splitHeadings —— **一首一章**,章题即「词牌·题」。
// 不像唐诗那样再分组:朱本按作者时代顺次编排,本身没有卷/类的分层,
// 硬造分组等于替编者做他没做的事。白话粒度因此是「章级」,章键就是序号,
// 不需要唐诗/诗经那套「组-序」细粒度键。
//
// ⚠️ 章数 282 由 scripts/gen-poetry-lists.mjs 实测得出,不是记忆里的「三百」——
// 朱本传世本子各家收词数略有出入,以本站抓取的这一版为准。

import { createRequire } from 'node:module'
const PL = createRequire(import.meta.url)('./_poetry-lists.json')

export const BOOKS = [
  {
    slug: 'songci300',
    title: '宋词三百首',
    pages: ['宋詞三百首'],
    splitHeadings: true,
    exactChapters: PL.songci.poems.length,
  },
]
