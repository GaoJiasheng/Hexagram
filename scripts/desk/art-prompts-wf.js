export const meta = {
  name: 'desk-art-prompts',
  description: '书桌插画:预先写好每张图的英文出图 prompt(Sonnet 写,机器闸自查),Codex 额度回来后只管出图',
  phases: [{ title: 'Write', detail: '读单元输入,写每张图的 imagery / chosen / prompt,跑自查直到通过' }],
}

const SCHEMA = { type: 'object', additionalProperties: false, required: ['total', 'passed'], properties: { total: { type: 'integer' }, passed: { type: 'integer' }, note: { type: 'string' } } }

const PROMPT = (root, set, id) => `你在给读书 App「观象 · 书桌」的插画写出图 prompt。图日后由另一个绘图模型照你的 prompt 一字不改地画,它看不到书,只看得到你写的这一段英文——所以画面好不好,全在你这一步。

先用 Read 读输入:${root}/scripts/.cache/desk-art/prompts/${set}/in/${id}.json
—— {set, book, title, category, used, items:[{id, kind, brief}]}。每张图的 brief 是这张图的全部依据:固定画风句、材料(书 / 章的内容摘录)、这张图在 App 里怎么摆(WHAT THIS IMAGE IS)、怎么设计、全部硬规矩,以及必须逐字照抄的「版式句」和「收尾句」。
used 是这本书已经画出来的图选过的题材,本单元每张都要避开。

对 items 里的每一张,写:
- imagery:3–5 条,每条是这张图(这一章 / 这本书)自己讲到的一个具体物象——作者讲的一个例子或故事、一个场景、一件东西、一个比喻;每条里用「…」或 “…” 括起材料里逐字有的那句原话(中文照抄,别改字,自查会去材料里找)。
- chosen:一句话说你选了哪一两个、为什么一看就认得出是这一章${set === 'guanshu' ? ';必须点明它属于的时代与地点(如 present-day Seoul、1930s Chicago、Song dynasty Kaifeng)' : ''}。
- prompt:最终的英文出图 prompt,顺序固定:brief 里的画风句(原样,含括号里的「淡彩水墨」)→ 场景 → 版式句(原样)→ 收尾句(原样,放在最末)。除画风句括号里那四个字,prompt 里不许有任何汉字或全角标点。

好图的标准(这是要点):
1. 一个具体、可认的主体,取自这一章真正说到的东西(引原话为证),不是情绪风景、不是抽象概念的符号。读过这一章的人一眼认得出是哪一章。
2. 构图写白:主体是什么、在画面哪里、多大;周围有哪一点点环境;哪里留白(照版式句的要求)。写画里「有」的东西,不写「没有什么」——禁画之物连否定句里也别点名(自查按禁词表查场景正文)。
3. 时代、地点、器物、衣着照 brief 的规矩与材料来定;人物只能很小、背影或远景。
4. 不编造 brief 以外关于这本书的事实;拿不准的细节就画得概括些。不要上网,不要读别的文件。
5. 同一单元的各张必须彼此是不同的主体与场景(封面取全书的统摄意象,横幅取书里一个具体场景,各章各取本章的),也不要和 used 撞。
6. 场景描写写足(约 500–1200 个英文字符),整条 prompt 600–2200 字符。

把结果用 Write 写到 ${root}/scripts/.cache/desk-art/prompts/${set}/out/${id}.json,形态 {"<item id>": {"imagery": [...], "chosen": "...", "prompt": "..."}, …},每个 item id 一条,不多不少;合法 JSON(字符串里的英文双引号要转义,原话引号优先用「」)。

写完后用 Bash 跑自查(在 ${root} 目录下):
  node scripts/desk/art-prompts-check.mjs ${set} ${id}
它列出每张没过的原因,末行「通过」或「未通过」。照它用 Edit 改 out 文件,再跑,直到「通过」;最多四轮,四轮后仍不过就停,在 note 里列没过的 item id。
除了这两个文件与自查命令,不要读写别的文件,不要委派。最后按 schema 交回:total = 本单元图数,passed = 最后一次自查合格的张数,note 一句话。`

// args: { root, set, n }(n 个单元:u001…)或 { root, set, ids: [...] }
const ids = args.ids || Array.from({ length: args.n }, (_, i) => 'u' + String(i + 1).padStart(3, '0'))
log(`插画 prompt(${args.set}):${ids.length} 个单元`)
const results = await parallel(ids.map((id) => () =>
  agent(PROMPT(args.root, args.set, id), { label: `prompt:${args.set} ${id}`, phase: 'Write', schema: SCHEMA, model: args.model || 'sonnet' })
    .then((r) => ({ id, total: r?.total ?? 0, passed: r?.passed ?? 0, note: r?.note || '' }))))
const ok = results.filter(Boolean)
const total = ok.reduce((a, r) => a + r.total, 0), passed = ok.reduce((a, r) => a + r.passed, 0)
log(`完成 ${ok.length}/${ids.length} 个单元 · 图 ${total} 张 · 自查合格 ${passed} 张;下一步 node scripts/desk/art-prompts-apply.mjs ${args.set}`)
return { units: ok.length, total, passed, failed: ok.filter((r) => r.passed < r.total).map((r) => `${r.id}:${r.note}`.slice(0, 160)) }
