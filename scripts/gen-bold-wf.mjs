// P1 富文本·只加粗 workflow 生成器(审读 P1 的 R4 单独抽出,不改写正文)。
// 用法:node scripts/gen-bold-wf.mjs <corpus> <slug> <ch1,ch2,...>
// 产出 scripts/.bold-<corpus>-<slug>-wf.js:每章一代理,只返回「要加粗的精确子串」,
// 由 apply-bold.mjs 确定性地把 **…** 包上——输出极小(短语表而非整块重写)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, slug, chList] = process.argv.slice(2)
const chapters = chList.split(',').map((x) => x.trim())
const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))

const RULES = `你是资深中文编辑。下面是一章「白话深读」文章(块带下标 i)。你的唯一任务:挑出最该【加粗强调】的句子或短语,只返回原文里的精确连续子串,不改一个字。
只挑四类:①本章题眼/金句 ②「…之谓…」式或下定义的句子 ③防误读的转折句(如「无为不是不做,是不妄为」) ④各节收束的一句话结论。
数量:厚章(正文>4000字)挑 8-12 处、中章 6-9 处、短章 4-6 处;宁少勿滥,只加真正的题眼。
铁律:①禁挑 type=quote 的引文块、禁挑免责/声明句(不是算命/不作断语/不是预言之类) ②每个 span 必须是该块 text 里出现的精确连续子串(含标点,原样复制,不得改写/截断/合并跨句) ③一个块最多挑 2 处、每处 ≤40 字(挑句中最精炼的核心短语,不要整段) ④只返回确有可加粗处的块,没有就不返回。`

const units = chapters.map((ch) => {
  const c = book[ch]
  const blocks = (c.blocks || [])
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => (b.type === 'lead' || b.type === 'p') && typeof b.text === 'string')
    .map(({ b, i }) => ({ i, text: b.text }))
  return { ch, payload: JSON.stringify({ centralIdea: c.centralIdea, blocks }) }
})

const script = `export const meta = {
  name: 'bold-${corpus}-${slug}',
  description: '白话加粗 ${corpus}/${slug} ${chapters[0]}-${chapters[chapters.length - 1]}(只标题眼,不改字)',
  phases: [{ title: '加粗' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    bolds: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
      properties: { i: { type: 'integer' }, spans: { type: 'array', maxItems: 2, items: { type: 'string' } } },
      required: ['i', 'spans'] } },
  }, required: ['bolds'],
}
const UNITS = ${JSON.stringify(units)}
const RULES = ${JSON.stringify(RULES)}
const out = await Promise.all(UNITS.map(u => (async () => {
  const r = await agent(RULES + '\\n\\n【章 JSON】\\n' + u.payload, { label: 'bold:${slug}#' + u.ch, phase: '加粗', schema: SCHEMA, effort: 'low' })
  return { corpus: '${corpus}', slug: '${slug}', ch: u.ch, bolds: r ? r.bolds : null }
})()))
return out
`
const outPath = path.join(ROOT, `scripts/.bold-${corpus}-${slug}-wf.js`)
fs.writeFileSync(outPath, script)
console.log(`生成 ${chapters.length} 章加粗单元 → scripts/.bold-${corpus}-${slug}-wf.js (${slug} 第 ${chapters[0]}–${chapters[chapters.length - 1]} 章)`)
