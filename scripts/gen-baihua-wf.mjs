// 生成「白话模块」并发 workflow 脚本(design-v22 §5 / A4)。
// 用法: node scripts/gen-baihua-wf.mjs <corpus> <slug> [chFrom] [chTo]
//   读 src/data/<corpus>/classics/<slug>.json,为 [chFrom,chTo] 各章建一个单元;
//   产出 scripts/.baihua-<corpus>-<slug>-wf.js,再用 Workflow({scriptPath}) 跑;
//   workflow 输出单元 shape {corpus, book, no, featured, data} 交 assemble-baihua.mjs 装配。
// 流水:起草 agent(读真原文,按白话规范成文 + 内联 SVG 图) → 校对 agent(核引文逐字/红线/篇幅/图色)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const corpus = process.argv[2]
const slug = process.argv[3]
const chFrom = process.argv[4] ? Number(process.argv[4]) : null
const chTo = process.argv[5] ? Number(process.argv[5]) : null
if (!corpus || !slug) { console.error('用法: node scripts/gen-baihua-wf.mjs <corpus> <slug> [chFrom] [chTo]'); process.exit(1) }

const texts = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/texts.json`), 'utf8'))
const meta = texts.find((t) => t.slug === slug)
if (!meta) { console.error(`texts.json 无 slug=${slug}`); process.exit(1) }
const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
const bookTitle = meta.title
const unit = meta.sectionUnit || '章'

const firstNo = book.chapters[0]?.no
// 已有白话的章跳过(断点续跑/补缺只生成缺章,不重做)
const existPath = path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`)
const done = fs.existsSync(existPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(existPath, 'utf8')))) : new Set()
const units = book.chapters
  .filter((c) => (chFrom == null || c.no >= chFrom) && (chTo == null || c.no <= chTo))
  .filter((c) => !done.has(String(c.no)))
  .map((c) => ({
    corpus, book: slug, no: c.no,
    title: c.title || `第${c.no}${unit}`,
    chars: c.paragraphs.map((p) => p.original).join('').length,
    featured: c.no === firstNo,        // 书首章 = 总纲,给 hero
  }))
if (!units.length) { console.log(`${bookTitle}:[${chFrom ?? 1}–${chTo ?? '末'}] 该范围已全有白话,无需生成。`); process.exit(0) }

// ── 各组红线(design-v22 §3.6)──
const RED = {
  dao: '【红线·道】讲思想/寓言/源流;不宗教宣化、不下吉凶/福报/成仙断语、不演内丹工法;真伪如实。',
  fo: '【红线·佛】研习不宣化;不下果报/往生劝信断语、不劝皈信;名相作训读。',
  ru: '【红线·儒】思想史视角;不作现代成功学/职场鸡汤。',
  xin: '【红线·心】心学思想;不鸡汤、不成功学。',
  fa: '【红线·法】思想史视角;不作权术教程、不作政治影射。',
  mo: '【红线·墨】思想史视角;不作权术教程、不作政治影射。',
  bing: '【红线·兵】思想史视角;不作权术/兵法实操教程、不作政治影射。',
  zong: '【红线·纵横】思想史视角;不作权术/游说话术教程、不作政治影射。',
  zhongyi: '【红线·中医·最严】研习不诊疗:只作医史/字词训读,绝不教自疗、不述功效用法用量、不下病症/疗效断语;每篇带「⚠ 本文为古籍研习、非医疗建议」。',
  moulue: '【红线·谋略】伪书批判:译白其权术面目,但点真伪、指其偷换史实/泯善恶,绝不为伪书张目、不教施用。',
}
const FILE = (c, b) => `${ROOT}/src/data/${c}/classics/${b}.json`

const SPEC = [
  '这是为古籍研习站写的「白话」深读 —— **首先是一篇公众号文章,不是逐句翻译作业**。',
  '灵魂:大白话把中心思想讲透 + 人人(下里巴人)跟得上的「脑回路」(把古人的思路翻成现代推理链)+ 接地气的比喻。逐句走读只是其中一环、为中心思想服务,绝不喧宾夺主、不能沦为「一句原文一句翻译」清单。',
  '脊柱(必备,顺序):①导语 hook ②共情入口(一个谁都遇到过的现代瞬间)③立骨架(出处/在全书位置/关键句/生僻字音,复用站内题解/注疏)④逐句走读(穿插,引原文句→大白话→脑回路/比喻讲透,讲不出新意的并讲带过)⑤中心思想贯通(重头戏)⑥落地(1–3 条可用启发,守红线不鸡汤)⑦收束(首尾呼应)⑧原文出处与参考(refs)。',
  '可选纵深层(有料才加,不强凑):源流/版本、注释分野、时代背景、当代回响/跨典互见、比喻系统。',
  '语言:大白话第一;引经据典克制(每条短、为论点服务);脑回路与比喻是魂(抽象处必有比喻落地)。',
  '诚实:引文必须逐字取站内原文(quote.original 须为该章某原文段的精确连续子串);白话与站内译文一致;出处到章;异解如实标分歧不替读者拍板;不杜撰史实。',
].join('\n')

const FIGSPEC = [
  '配图(每章 2–4 张,流程/对比/列举优先,图比文更直观处才出;纯叙述不硬塞):',
  '- 类型 ftype 取:金句卡 / 对比 / 古今义对比 / 结构图 / 列举 / 时间线 等。**金句卡每章必出 1 张**;结构/列举按内容;时间线仅当该章确有版本流变/历史脉络才出(没有就不出,不编造)。',
  '- 一律内联 SVG(不用栅格图):<svg viewBox=... style="width:100%;height:auto;font-family:var(--font-serif)">…;文字/线条颜色一律用 CSS 变量,**只能写 style="fill:var(--ink)" / style="stroke:var(--line)" / style="fill:var(--cinnabar)"(强调)等,绝不写死 #hex 颜色**(否则不随明暗/组色自适应);text-anchor 居中排版;可用 var(--ink-soft)/var(--ink-faint)/var(--paper-raised)。',
  '- 每图配 caption(讲清它在说什么 + 出处)。',
].join('\n')

const draftPrompt = (u) => {
  const band = u.chars < 120 ? '约 2500–4500 字(短章,宁短不注水)' : u.chars < 600 ? '约 5000–8000 字' : '约 7000–10000 字(长篇,过长可只覆盖前半并在收束点明)'
  return `你在为研习站写《${bookTitle}·${u.title}》的「白话」整章深读。${RED[corpus] || ''}\n\n${SPEC}\n\n${FIGSPEC}\n\n` +
    `第一步:用 Read 读 ${FILE(corpus, slug)},找到 chapters 里 no===${u.no} 的那一章(paragraphs 为原文段,每段含 original 与 translation)。以这章原文为底成文。\n\n` +
    `篇幅:${band}。\n\n按 schema 产出一篇白话文章:\n` +
    `- title:"白话${bookTitle} · ${u.title}";subtitle:一句副题;centralIdea:一句话中心思想。\n` +
    `- blocks:有序数组,块类型 lead(导语)/p(段落)/h2(小节标题)/quote{original,translation}(逐句引文,original 必为该章原文段精确子串、translation 与站内译文一致)/figure{ftype,svg,caption}(内联 SVG 图)/refs{items:[…]}(出处与参考)。按脊柱顺序铺;逐句走读用 quote+p 穿插;金句卡等图穿插在合适处;末尾一个 refs 块。\n` +
    (u.featured ? `- 这是全书开篇总纲章:额外给 featured:true 和 hero:{badge:"开篇 · 全书总纲",headline:本章关键句,tagline:一句题词};正文不必再单列与 hero 重复的金句卡。\n` : `- 本章非开篇,**不要**输出 featured 或 hero 字段。\n`) +
    `\n只返回结构化结果。`
}

const verifyPrompt = (u, draft) => `校对修正《${bookTitle}·${u.title}》白话草稿,返回修正后完整结构。${RED[corpus] || ''}\n\n` +
  `先 Read ${FILE(corpus, slug)} 中 no===${u.no} 的章核对。草稿:\n${draft}\n\n` +
  `逐项改正:\n- 每个 quote.original 必须是该章某原文段的精确连续子串,否则改对或删;translation 与站内译文一致。\n` +
  `- 守红线:删去违红线的措辞(${corpus === 'zhongyi' ? '诊疗/功效用法用量/疗效断语' : corpus === 'moulue' ? '为伪书张目/教施用' : corpus === 'fo' ? '果报/往生劝信' : '鸡汤/成功学/权术/政治影射'})。\n` +
  `- 每张 figure 的 svg:颜色只用 var(--…)/currentColor,**不得写死 #hex**;有 viewBox 与 caption。\n` +
  `- 中心思想突出、脑回路与比喻到位、不沦为逐字翻译清单;篇幅合宜。\n- 末尾保留 refs 块。\n\n只返回修正后的结构化结果。`

const script = `export const meta = {
  name: 'baihua-${corpus}-${slug}',
  description: '白话深读 ${bookTitle} 起草+校对(design-v22)',
  phases: [ { title: 'Draft', detail: '据真原文成文 + 内联 SVG 图' }, { title: 'Verify', detail: '核引文逐字/红线/图色/篇幅' } ],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'subtitle', 'centralIdea', 'blocks'],
  properties: {
    title: { type: 'string' }, subtitle: { type: 'string' }, centralIdea: { type: 'string' },
    featured: { type: 'boolean' },
    hero: { type: 'object', additionalProperties: false, properties: { badge: { type: 'string' }, headline: { type: 'string' }, tagline: { type: 'string' } } },
    blocks: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['type'],
      properties: {
        type: { enum: ['lead', 'p', 'h2', 'quote', 'figure', 'refs'] },
        text: { type: 'string' }, original: { type: 'string' }, translation: { type: 'string' },
        ftype: { type: 'string' }, svg: { type: 'string' }, caption: { type: 'string' },
        items: { type: 'array', items: { type: 'string' } },
      },
    } },
  },
}

const UNITS = ${JSON.stringify(units, null, 0)}
const DRAFT = ${JSON.stringify(Object.fromEntries(units.map((u) => [u.no, draftPrompt(u)])))}
const VERIFY_HEAD = ${JSON.stringify(Object.fromEntries(units.map((u) => [u.no, verifyPrompt(u, '__DRAFT__')])))}

phase('Draft')
const results = await pipeline(
  UNITS,
  (u) => agent(DRAFT[u.no], { label: '草:${bookTitle}·' + u.title, phase: 'Draft', schema: SCHEMA }),
  (draft, u) => {
    if (!draft) return { ...u, data: null }
    const vp = VERIFY_HEAD[u.no].replace('__DRAFT__', JSON.stringify(draft).slice(0, 60000))
    return agent(vp, { label: '校:${bookTitle}·' + u.title, phase: 'Verify', schema: SCHEMA })
      .then((v) => ({ ...u, data: v || draft }))
  },
)
const ok = results.filter(Boolean)
log('完成 ' + ok.filter((r) => r.data).length + '/' + UNITS.length + ' 章')
return ok
`

const outName = `scripts/.baihua-${corpus}-${slug}-wf.js`
fs.writeFileSync(path.join(ROOT, outName), script)
console.log(`生成 ${units.length} 章单元 → ${outName}  (${bookTitle} 第 ${units[0]?.no}–${units[units.length - 1]?.no} ${unit})`)
