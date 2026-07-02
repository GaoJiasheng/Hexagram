// P1 白话编辑打磨 workflow 生成器(审读报告 docs/baihua-review-yidao.md 的 P1)。
// 用法:node scripts/gen-polish-wf.mjs <corpus> <slug> <ch1,ch2,...>
// 产出 scripts/.polish-<corpus>-<slug>-wf.js:每章一个编辑代理,只输出「改动的块」,引文/义理一字不动。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [corpus, slug, chList] = process.argv.slice(2)
const chapters = chList.split(',').map((x) => x.trim())
const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`), 'utf8'))

const RULES = `你是资深中文编辑。对下面这章「白话深读」做一次编辑打磨(不重写、不扩写),只改以下五类,输出改动的块:
R1 去口癖:「脑回路」全章最多保留1处(其余换多样表达:他的思路是/这一步推理/妙在/这么想的…);「翻成大白话」最多1处;删「打个比方」前的自夸引导语(如「一个绝妙的比喻」「说个精彩的比方」直接进入比喻);「题眼」最多2处。
R2 开头:若 lead 块以「你有没有」「你一定」等第二人称设问起笔,重写开头第一二句为别的起法(场景直陈/小故事/直接抛原文金句/数字对比),内容信息保留、长度相近。
R3 免责降频:「不是算命/不作吉凶断语/不是预言/不教修炼」类声明,全章最多保留2处(开头1处+筮法或丹道关口1处),其余整句删除或并入邻句;若全章只有1-2处则不动。
R4 加粗(最重要):在 lead/p 块中给最值得强调的句子或短语加 **…**,厚章6-12处、短章4-8处,只加四类:①本章题眼金句 ②「…之谓…」式或下定义的句子 ③防误读的转折句(如「无为不是不做,是不妄为」) ④各节收束的一句话结论。禁止给引文块加粗、禁止给免责声明加粗;若正文用『』整句包裹作强调,改成 **…**(正常引号用法不动)。
R5 若 h2 是「逐句走读(一)」这类纯序号标题,改成含内容的小标题(用该节核心词,8字内)。
铁律:引文块(type=quote)一个字不许动、不许出现在输出里;义理/爻位/象数/史实表述不改;不增删块;没改的块不要输出;改动块的 text 完整给出(是替换不是补丁);保持全角标点。`

const units = chapters.map((ch) => {
  const c = book[ch]
  const payload = { centralIdea: c.centralIdea, blocks: (c.blocks || []).map((b, i) => (b.type === 'quote' ? { i, type: 'quote', original: '(引文,禁改)' } : b.type === 'figure' ? { i, type: 'figure', caption: b.caption } : { i, type: b.type, text: b.text })) }
  return { ch, payload: JSON.stringify(payload) }
})

const script = `export const meta = {
  name: 'polish-${corpus}-${slug}',
  description: '白话编辑打磨 ${corpus}/${slug} ${chapters[0]}-${chapters[chapters.length - 1]}(去口癖/开头/免责/加粗)',
  phases: [{ title: '打磨' }],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    edits: { type: 'array', maxItems: 60, items: { type: 'object', additionalProperties: false,
      properties: { i: { type: 'integer' }, field: { type: 'string', enum: ['text', 'caption'] }, text: { type: 'string' } },
      required: ['i', 'field', 'text'] } },
  }, required: ['edits'],
}
const UNITS = ${JSON.stringify(units)}
const RULES = ${JSON.stringify(RULES)}
const out = await Promise.all(UNITS.map(u => (async () => {
  const r = await agent(RULES + '\\n\\n【章 JSON(块带下标 i)】\\n' + u.payload, { label: 'polish:${slug}#' + u.ch, phase: '打磨', schema: SCHEMA, effort: 'low' })
  return { corpus: '${corpus}', slug: '${slug}', ch: u.ch, edits: r ? r.edits : null }
})()))
return out
`
const outPath = path.join(ROOT, `scripts/.polish-${corpus}-${slug}-wf.js`)
fs.writeFileSync(outPath, script)
console.log(`生成 ${chapters.length} 章打磨单元 → scripts/.polish-${corpus}-${slug}-wf.js (${slug} 第 ${chapters[0]}–${chapters[chapters.length - 1]} 章)`)
