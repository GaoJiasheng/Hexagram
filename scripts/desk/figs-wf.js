export const meta = {
  name: 'desk-figs',
  description: '书桌图解:把白话 / 观书文章里的 SVG 图转成结构化数据(Sonnet 转,机器闸自查)',
  phases: [{ title: 'Convert', detail: '读单元输入,写结构化 fig,跑自查直到全过' }],
}

const SCHEMA = { type: 'object', additionalProperties: false, required: ['total', 'passed'], properties: { total: { type: 'integer' }, passed: { type: 'integer' }, note: { type: 'string' } } }

const PROMPT = (root, book, id) => `你在把古籍学习 App「观象 · 书桌」文章里的 SVG 图解,转成结构化数据,供 App 用原生版式重排。

先用 Read 读规则与格式:${root}/scripts/.desk-figs/RULES.md(硬性规则 + 十种 kind 的字段与例子,照它做)。
再读输入:${root}/scripts/.desk-figs/${book}/in/${id}.json —— {book, items:[{key, ftype, caption, chapter, svg}]}。

对 items 里的每一张图:看 SVG 里各 <text> 的文字与位置(x / y),判断它是哪种版式,写出 fig。
把结果用 Write 写到 ${root}/scripts/.desk-figs/${book}/out/${id}.json,格式 {"<key>": fig, …},每个 key 一张,不多不少。

写完后用 Bash 跑自查(在 ${root} 目录下):
  node scripts/desk/figs-check.mjs ${book} ${id}
它会列出没过闸的图和原因(漏字「…」= SVG 里有、你没收的字;多字「…」= 你写了、SVG 里没有的字),并给出那张图原图的全部文字。
照它改 out 文件(用 Edit 改那一张即可),再跑,直到「全部通过」。最多改三轮;三轮后仍过不了的图,把它改成 kind "notes"(lines 里一行 SVG 文字一项,原样照抄)再试一次;还不过就留着,在 note 里报它的 key。

要点:字一个不改、不补、不删;图注 caption 里的字不许抄进 fig;卦符号、纯箭头、角上的「观」「象」印章不收;拿不准版式用 rows 或 notes。
除了上述两个文件与自查命令,不要读写别的文件,不要委派。最后按 schema 交回:total = 本单元图数,passed = 自查通过的张数,note 一句话(有没过的就列 key)。`

// args: { root, books: [{ book, ids: [...] }] }
const jobs = args.books.flatMap((b) => b.ids.map((id) => ({ book: b.book, id })))
log(`图解转换:${jobs.length} 个单元(${args.books.map((b) => b.book + ' ' + b.ids.length).join('、')})`)
const results = await parallel(jobs.map((j) => () =>
  agent(PROMPT(args.root, j.book, j.id), { label: `图:${j.book} ${j.id}`, phase: 'Convert', schema: SCHEMA, model: args.model || 'sonnet' })
    .then((r) => ({ ...j, total: r?.total ?? 0, passed: r?.passed ?? 0, note: r?.note || '' }))))
const ok = results.filter(Boolean)
const total = ok.reduce((a, r) => a + r.total, 0), passed = ok.reduce((a, r) => a + r.passed, 0)
log(`完成 ${ok.length}/${jobs.length} 个单元 · 图 ${total} 张 · 自查通过 ${passed} 张`)
return { units: ok.length, total, passed, failed: ok.filter((r) => r.passed < r.total).map((r) => `${r.book}/${r.id}:${r.note}`.slice(0, 160)) }
