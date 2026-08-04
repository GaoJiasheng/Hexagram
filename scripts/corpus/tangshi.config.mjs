// 唐诗抓取配置 —— fetch-corpus.mjs 读此驱动。
//
// 底本:《唐詩三百首》蘅塘退士(孫洙)乾隆二十八年(1763)编,流传最广的唐诗选本。
// 结构:维基文库上目录页 + 各诗独立页(**顶层页名**,不是 詩經/關雎 那种子页形式)。
// 目录页按七类分段:五言古詩 / 七言古詩 / 樂府 / 五言律詩 / 七言律詩 / 五言絕句 / 七言絕句。
//
// 解析:沿用诗经那套 groupPages —— **一类一章、一诗一页**,诗题作为独立段插在诗句之前,
// 前端配 texts.json 的 poemTitles:true 把诗题段升格为「诗头」(不占段号)。
// 白话粒度因此是「诗级」,章键形如「组-序」(1-1 = 五言古诗第一首)。
//
// ⚠️ **篇目不手打**:PL.tangshi.groups 由 scripts/gen-poetry-lists.mjs 从目录页推导,
// 重跑即可复现。底本页若变动,那份 JSON 的 diff 会把变化显出来 —— 这是刻意的。

import { createRequire } from 'node:module'
const PL = createRequire(import.meta.url)('./_poetry-lists.json')

// 目录页给的显示名(如 琵琶行|琵琶行並序)只作备注,一律以**页名**为准 ——
// parsePoemPage 的诗题也取页名,两处必须一致,否则诗题段与正文对不上。
const GROUPS = PL.tangshi.groups.map((g) => ({
  title: g.title,
  pages: g.pages.map((p) => (typeof p === 'string' ? p : p.page)),
}))

export const BOOKS = [
  // preferSection:个别诗页把几种底本并列成节(《静夜思》页有 李太白全集 / 唐詩三百首 / 全唐詩
  // 三种异文,不选节就三种全抓进来、一首诗变十二句)。本站底本既是《唐诗三百首》,该节存在时只取它。
  { slug: 'tangshi300', title: '唐诗三百首', groupPages: GROUPS, exactChapters: GROUPS.length, preferSection: '唐詩三百首' },
]
