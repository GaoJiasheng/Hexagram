export const meta = {
  name: 'baihua-review',
  description: '白话代理复核:每章一个 opus 代理逐段对照原文修事实错误(不重写风格),另报站内译文疑误',
  phases: [{ title: 'Review', detail: '读输入文件 → 写修正后白话 → 只交回改了什么' }],
}

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'findings'],
  properties: {
    verdict: { enum: ['ok', 'fixed', 'skip'] },
    findings: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['where', 'wrong', 'fix'],
      properties: { where: { type: 'string' }, wrong: { type: 'string' }, fix: { type: 'string' }, why: { type: 'string' } },
    } },
    translationIssues: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['para', 'wrong', 'suggest'],
      properties: { para: { type: 'integer' }, wrong: { type: 'string' }, suggest: { type: 'string' }, why: { type: 'string' } },
    } },
    note: { type: 'string' },
  },
}

const GROUP = { yijing: '易经研习', dao: '道藏研读', ru: '儒典研读', fo: '释典研读', xin: '阳明心学', fa: '法家', mo: '墨家', bing: '兵家', zong: '纵横家', zhongyi: '中医典籍', moulue: '谋略杂纂', tangshi: '唐诗', songci: '宋词', yuanqu: '元曲', guwen: '古文研读' }
// args = { dir: 'scripts/.baihua-review/<批名> 的绝对路径', ids: ['组|书|章', …] }(prep 打印的 ids.json;不手抄路径)
const unitOf = (dir, id) => {
  const [corpus, slug, key] = id.split('|')
  const f = `${corpus}-${slug}-${key}.json`
  return { corpus, slug, key, group: GROUP[corpus] || corpus, label: `${slug}·${key}`, inFile: `${dir}/in/${f}`, outFile: `${dir}/out/${f}` }
}

const PROMPT = (u) => `你是观象站「${u.group}」组的校读者。任务:人读复核一篇已发布的白话深读,只改错、不重写。

输入文件(用 Read 读它,JSON):${u.inFile}
  · original:该章原文,每段以 [段号] 起头,段后「译:」是站内现有译文(译文也可能有错,以原文为准)
  · baihua:现有白话(title / subtitle / centralIdea / blocks;figure 块的 svg 已用 "__SVG__" 占位,不要动)
  · redline:本组红线

逐段对照原文与白话,找这几类问题(这几类都是机器闸抓不到的):
1. 事实错:引文归属错(把甲书 / 甲人的话安到乙头上)、把注释或后人评语当作原文、人名 / 地名 / 年代 / 朝代 / 官职 / 数字 / 术语错、读错原文句意、原文没说的话被当成原文说的、史事与传说混为一谈
2. 讲偏:整段主旨与原文相反,或把一家之言写成定论、把有争议的说法写成公认
3. 红线:违反 redline 的措辞
4. 引文块(quote)的 translation 译错原文

修正原则:
· 只改错的句子,尽量保持原句式与篇幅;风格、结构、分段、小标题一律不动;不新增也不删除 figure / widget 块;不删段落(整段错才改写该段)
· quote 块的 original 是原文精确子串,不要改它;若 quote 本身就选错了原文,改 translation 与其后解释即可,并在 findings 说明
· 文中「第 N 段」一类段号指的是 original 里的 [段号],核对时以它为准
· **依据必须在输入文件里**:能对回 original 某一段的才改。凡依据在输入之外的外部事实(他书原话、史书记载、年代、卷次),只有你十分确定时才改,why 里写明「外部依据」;**不要凭记忆把他书的原话写进引号**——拿不准就不改、列为存疑
· 不确定的地方**不改**,写进 findings 的 why 里说明存疑(wrong 照录原句,fix 写「未改(存疑)」)
· 写法上的好坏(啰嗦、套话、不够生动)不在本轮范围,不要改
· 全文守 redline;修正文字用简体中文,标点用全角

另:若发现**站内译文**(original 里「译:」那一行)译错,不要改它(那是另一层数据),记进 translationIssues(para:段号;wrong:译文里错的那几个字;suggest:应作;why:依据)。

做完后:
· 若白话一处都不用改:不写文件,返回 verdict:"ok",findings 为空(translationIssues 照报)
· 若有修改:把**修正后的完整白话对象**(与输入 baihua 同形:title / subtitle / centralIdea / blocks,figure 的 svg 仍写 "__SVG__";其他字段原样保留)用 Write 写到 ${u.outFile},然后返回 verdict:"fixed",findings 逐条列出(where:在哪一块 / 哪一句;wrong:原来怎么写;fix:改成什么;why:依据原文第几段)
· 输入文件读不到或格式异常:返回 verdict:"skip",note 说明

只用 Read / Write 两个工具;不要读仓库里别的文件;不要把任务交给别的代理;最后务必按 schema 交回结果(输出文件只是正文,汇报仍要交)。`

phase('Review')
const units = Array.isArray(args?.ids) ? args.ids.map((id) => unitOf(args.dir, id)) : (Array.isArray(args?.units) ? args.units : [])
log('复核 ' + units.length + ' 章')
const results = await pipeline(
  units,
  (u) => agent(PROMPT(u), { label: '校:' + u.label, phase: 'Review', schema: SCHEMA, model: 'opus' })
    .then((r) => ({ corpus: u.corpus, slug: u.slug, key: u.key, label: u.label, result: r })),
)
const ok = results.filter(Boolean)
log('完成 ' + ok.length + '/' + units.length + ' 章 · 需改 ' + ok.filter((r) => r.result?.verdict === 'fixed').length)
return ok
