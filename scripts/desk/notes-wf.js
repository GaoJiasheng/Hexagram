export const meta = {
  name: 'desk-notes',
  description: '书桌详注:每单元 Sonnet 起草 → Opus 核查外部说法与红线',
  phases: [{ title: 'Draft', detail: '读输入分片,写详注到输出分片' }, { title: 'Verify', detail: '逐条核:子串、外部说法、红线' }],
}

const SCHEMA = { type: 'object', additionalProperties: false, required: ['notes'], properties: { notes: { type: 'integer' }, changed: { type: 'integer' }, note: { type: 'string' } } }

const SPEC = `每条注四个字段:
- k:被注的词,必须是该段 o(原文)的**精确子串**(照抄底本字形,不带两端标点);取完整的词或短语(2–6 字为宜,单字也可)。同一段里各条的 k 按「在 o 中第一次出现的位置」**不能互相重叠**,同一个词在同一段只注一次。
- d:一句话释义,不超过 30 个字,让人一眼明白这个词在这句里是什么意思。
- x:展开,**60–120 个字(写完数一下,不到 60 字的补足)**。讲清其中一两样:为什么这么讲(字义来历、与今义的差别)、这个词在这句里起什么作用、历代注家或不同版本有分歧时各家怎么说、它在本书别处怎样呼应。不要复述 d,不要空话套话。
- r:读音(汉语拼音带声调),只在生僻字、多音字需要时给,否则不要这个字段。
注哪些:难字、通假与古今异义、专名(人名、地名、官职、器物、典制)、这一章的关键概念、今人容易按现代义读错的常用字(只在确实会读错时)、有重要异文或句读分歧处。**密度:平均每百个原文字 12–14 条**;很短的段至少 1 条,确实无可注的可以没有。items 里的 old 是站内已有的简注,可吸收、可改写,不必受它限制。
口径:讲训诂、思想、史实、源流;有争议处并陈不裁断;不写鸡汤、不作人生启示、不作现代影射;严守输入里的 redline。
**外部说法从严**:版本异文(帛书、竹简、别本)、某注家怎么讲、某事见于某书某篇——只写你十分确定的;拿不准就不点名、不加引号,改用「一说」「旧注多解作」这类转述,或干脆不写。绝不凭印象把他书的原话放进引号。
文字用简体中文、全角标点,平实。`

const DRAFT = (dir, book, id) => `你在给古籍学习 App「观象 · 书桌」写《${book}》的详注。读者是成年的自学者:点一个带虚线的词,先看到一句话释义,下面再有一段展开。

输入文件(用 Read 读,JSON):${dir}/in/${id}.json
  · items:要注的各段。ch 章号、chTitle 章题、seg 段下标(0 起;周易六十四卦里是部位键:judgment 卦辞、tuan 彖、daxiang 大象、l1–l6 爻辞、x1–x6 小象、use / xuse 用九用六及其小象、w0… 文言各段)、o 原文(底本,一个字不能改)、t 站内译文(参考,可能有错,以原文为准)、label(周易里的「卦辞」「初九」等)、old 已有简注
  · redline:本书红线

${SPEC}

把结果用 Write 写到 ${dir}/out/${id}.json,格式:{"<章号>": {"<段下标或部位键>": [ {"k":"…","d":"…","x":"…"}, … ]}}(章号、段下标 / 部位键都是字符串,照抄 item 的 ch 与 seg;只写有注的段)。
写完后自查一遍:每条 k 是否确为该段 o 的子串、同段是否重叠、字数是否合规,有问题就改文件。
只用 Read / Write;不要读仓库里别的文件;不要委派。最后按 schema 交回:notes = 你写的总条数,note 里一句话说有无拿不准处。`

const VERIFY = (dir, book, id) => `你是《${book}》详注的核查者。另一个代理已把详注写到了 ${dir}/out/${id}.json;原文与译文在 ${dir}/in/${id}.json(items 里每段的 o 是底本原文,seg 是段下标、周易六十四卦里是部位键如 judgment / l1 / x1 / w0;redline 是本书红线)。两个文件都用 Read 读。

逐条核,有问题就**用 Edit 工具在 ${dir}/out/${id}.json 里就地改那一处**(只替换有问题的那几个字段或那一条),不要把整份文件重写一遍——绝大多数条目是对的,原样留着。改完文件仍须是合法 JSON,格式不变:{"<章号>": {"<段下标或部位键>": [{k,d,x,r?}]}}。
核这几样:
1. k 必须是该段 o 的精确子串;同段各条按首次出现位置不重叠、不重复。不合的改 k 或删条。
2. 释义与展开对不对:字义、词性、句意、读音有没有错;有没有把一家之言写成定论。错的改对。
   **读音单独再过一遍**(以往核查改得最多的就是读音):r 字段和 x 里提到的读音,凡是通假字、多音字、生僻字,你十分确定才留;拿不准的把 r 字段删掉、x 里那半句也删掉,不要猜一个填上;原稿没给读音的不必补。
3. **外部说法**(最要紧):x 里凡是「帛书 / 竹简 / 某本作某字」「某注家说……」「见某书某篇」「某年某事」这类不在输入文件里的说法,你十分确定是对的才保留;拿不准的,改成不点名的转述(「一说」「旧注多解作」),或删掉那半句;带引号的他书原话,不能确证逐字无误就去掉引号改转述。
4. 红线:违反 redline 的措辞改掉。
5. 字数:d ≤ 30 字,x 不超过 120 字。x 偏短(45 字以上)但说清楚了的**不必补长**——不要为了凑字数去改写。
不要为改而改:写得对的一个字不动;不新增条目,除非某段明显该注却一条都没有。
只用 Read / Edit(确需整段重排时才用 Write);不要读仓库里别的文件;不要委派。最后按 schema 交回:notes = 核后的总条数,changed = 你改动或删除的条数,note 里一句话说主要改了什么。`

// 两种传参:{dir, book, ids}(一本书)或 {jobs: [{dir, book, id}]}(跨书,抽查时用)
const jobs = args.jobs || args.ids.map((id) => ({ dir: args.dir, book: args.book, id }))
log(`详注:${jobs.length} 个单元(${[...new Set(jobs.map((j) => j.book))].join('、')})`)
// args.verifyOnly:起草已由别处完成(如本机 Codex 写好了 out/<单元>.json),这里只跑核查
const results = await pipeline(
  jobs,
  (j) => args.verifyOnly ? Promise.resolve({ notes: 0 }) : agent(DRAFT(j.dir, j.book, j.id), { label: `注:${j.book} ${j.id}`, phase: 'Draft', schema: SCHEMA, model: 'sonnet' }),
  // args.verifyModel:整批核查用哪个模型(默认 opus);全站连跑时用 'sonnet' 做全量核查,Opus 另跑抽查(owner 2026-11-23 定)
  (draft, j) => agent(VERIFY(j.dir, j.book, j.id), { label: `核:${j.book} ${j.id}`, phase: 'Verify', schema: SCHEMA, model: args.verifyModel || 'opus' })
    .then((v) => ({ book: j.book, id: j.id, draft: draft?.notes ?? 0, kept: v?.notes ?? 0, changed: v?.changed ?? 0, note: v?.note || '' })),
)
const ok = results.filter(Boolean)
log(`完成 ${ok.length}/${jobs.length} 个单元 · 注 ${ok.reduce((a, r) => a + r.kept, 0)} 条 · 核查改动 ${ok.reduce((a, r) => a + r.changed, 0)} 条`)
return ok
