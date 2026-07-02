// P1 富文本·只加粗(批式:单代理处理多章,摊薄固定开销)。
// 用法:node scripts/gen-bold-batch-wf.mjs <corpus> <slug> <ch1,ch2,...> [chunk=5]
// 与 gen-bold-wf 同规则,但每 chunk 章合成一个代理调用,返回按章键的 bolds。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, slug, chList, chunkArg] = process.argv.slice(2)
const chapters = chList.split(',').map((x) => x.trim())
const CHUNK = Number(chunkArg) || 5
const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))

const RULES = `你是资深中文编辑。下面是【多章】白话深读文章,每章有 ch 编号与 blocks(块带下标 i)。为每一章挑出最该【加粗强调】的句子或短语,只返回原文里的精确连续子串,不改一个字。
只挑四类:①本章题眼/金句 ②「…之谓…」式或下定义的句子 ③防误读的转折句 ④各节收束的一句话结论。
数量:每章按篇幅挑 6-12 处;宁少勿滥,只加真正的题眼。
铁律:①禁挑免责/声明句(不是算命/不作断语/不是预言之类) ②每个 span 必须是该章该块 text 里出现的精确连续子串(含标点,原样复制,不改写/截断/跨句合并) ③一个块最多挑 2 处、每处 ≤40 字 ④为【每一章】都返回结果(哪怕某块没有可加粗处就不列该块)。`

function chapterPayload(ch) {
  const c = book[ch]
  const blocks = (c.blocks || [])
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => (b.type === 'lead' || b.type === 'p') && typeof b.text === 'string')
    .map(({ b, i }) => ({ i, text: b.text }))
  return { ch, blocks }
}

const groups = []
for (let i = 0; i < chapters.length; i += CHUNK) {
  const chs = chapters.slice(i, i + CHUNK)
  groups.push({ chs, payload: JSON.stringify({ chapters: chs.map(chapterPayload) }) })
}

const script = `export const meta = {
  name: 'bold-batch-${corpus}-${slug}',
  description: '白话加粗(批式) ${corpus}/${slug} ${chapters[0]}-${chapters[chapters.length - 1]}',
  phases: [{ title: '加粗' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    chapters: { type: 'array', items: { type: 'object', additionalProperties: false,
      properties: { ch: { type: 'string' },
        bolds: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
          properties: { i: { type: 'integer' }, spans: { type: 'array', maxItems: 2, items: { type: 'string' } } },
          required: ['i', 'spans'] } } },
      required: ['ch', 'bolds'] } },
  }, required: ['chapters'],
}
const GROUPS = ${JSON.stringify(groups)}
const RULES = ${JSON.stringify(RULES)}
const out = await Promise.all(GROUPS.map((g, gi) => (async () => {
  const r = await agent(RULES + '\\n\\n【多章 JSON】\\n' + g.payload, { label: 'bold:${slug}#' + g.chs[0] + '+', phase: '加粗', schema: SCHEMA, effort: 'low' })
  return (r && r.chapters ? r.chapters : []).map(c => ({ corpus: '${corpus}', slug: '${slug}', ch: c.ch, bolds: c.bolds }))
})()))
return out.flat()
`
const outPath = path.join(ROOT, `scripts/.bold-${corpus}-${slug}-wf.js`)
fs.writeFileSync(outPath, script)
console.log(`生成 ${groups.length} 组(每组≤${CHUNK}章,共${chapters.length}章)→ scripts/.bold-${corpus}-${slug}-wf.js`)
