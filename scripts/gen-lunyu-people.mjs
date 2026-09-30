// I5 · 论语孔门弟子出场索引(docs/design-v24.md §2)。
// 从站内原文 src/data/ru/classics/lunyu.json **派生** → src/data/ru/lunyu-people.json。
//   node scripts/gen-lunyu-people.mjs
// 原文变了就重跑;check-data 的 check-lunyu-people 闸会重新派生一遍比对,旧了会报警告。
//
// 人名表(PEOPLE)人工列一次,出场由脚本 grep:
//   full  —— 全称/字/尊称,原文里出现即计(子贡、仲由、冉子、南容……)
//   solo  —— 单字呼名(由/赐/回/参/商/师/求/偃/雍/赤/点/柴/鲤/枨),**只在呼格语境计**:
//            其后紧跟「也 ， ！ 乎 曰」之一(「由也果」「赐！」「参乎」「点，尔何如」);
//            「回」作动词、「师」作老师/乐官、「求」作动词、「予」作第一人称,一律不计。
//   extra —— 呼格正则漏掉、但确属呼名的整句片段(「吾与回言」「曾由与求之问」「赐不受命」……),
//            逐条人工列出,term 指明片段里哪个字是名。
//   「予」(宰我之名)与第一人称同形,不走 solo,只收 extra 三处。
// EXCLUDE 是人工排除表:命中落在这些片段里的一律作废(「末由也已」「观其所由」「士师」「富而可求也」
// 「有若无」……),每条写明理由。每个 hit 附 evidence(命中处原文片段 ≤20 字,为该段原文精确子串)。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { matchPersonIn, deriveIndex } from './lib/people-index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SRC = 'src/data/ru/classics/lunyu.json'
export const OUT = 'src/data/ru/lunyu-people.json'

// 全角标点一律转义写(工具链可能把字面量全角标点静默改成半角)
const P = {
  comma: '，', // ，
  bang: '！', // !
  q: '？', // ?
  colon: '：', // :
  semi: '；', // ;
  period: '。', // 。
  dun: '、', // 、
  lq: '「', rq: '」', // 「」
  lq2: '『', rq2: '』', // 『』
}
// 呼格:单字名之后紧跟的字
const VOCATIVE_NEXT = `也${P.comma}${P.bang}乎曰`

// 人名表。note 一句:姓名字号据《史记·仲尼弟子列传》与朱熹《论语集注》,事迹只取本书所载;
// 存疑处写「旧说」「一说」。思想史视角,不作现代借用。
export const PEOPLE = [
  { id: 'zigong', name: '子贡', full: ['子贡'], solo: ['赐'],
    extra: [{ phrase: '赐不受命', term: '赐' }, { phrase: '赐之墙', term: '赐' }],
    note: '端木赐，字子贡，卫人；先进篇列入「言语」科，善辞令，孔子许以「瑚琏」之器。' },
  { id: 'zilu', name: '子路', full: ['子路', '季路', '仲由'], solo: ['由'],
    extra: [{ phrase: '其由与', term: '由' }, { phrase: '由与求', term: '由' }, { phrase: '由之瑟', term: '由' }, { phrase: '由之行诈', term: '由' }],
    note: '仲由，字子路，一字季路，鲁卞人；先进篇列入「政事」科，性刚好勇，于孔子亦直言不讳（如「子见南子，子路不说」）。' },
  { id: 'yanyuan', name: '颜渊', full: ['颜渊', '颜回'], solo: ['回'],
    extra: [{ phrase: '与回言', term: '回' }, { phrase: '望回', term: '回' }, { phrase: '回何敢死', term: '回' }, { phrase: '回虽不敏', term: '回' }],
    note: '颜回，字子渊，鲁人；「德行」科之首，孔子独许其好学，不幸早卒，孔子哭之恸。' },
  { id: 'zengzi', name: '曾子', full: ['曾子'], solo: ['参'], extra: [],
    note: '曾参，字子舆，鲁南武城人；书中尊称「曾子」，程子谓《论语》成于有子、曾子之门人。' },
  { id: 'zixia', name: '子夏', full: ['子夏'], solo: ['商'],
    extra: [{ phrase: '师与商', term: '商' }, { phrase: '商闻之', term: '商' }],
    note: '卜商，字子夏；先进篇列入「文学」科，孔子许其「起予者商也，始可与言诗已矣」。' },
  { id: 'zizhang', name: '子张', full: ['子张'], solo: ['师'],
    extra: [{ phrase: '师与商', term: '师' }, { phrase: '师愈', term: '师' },
      { phrase: '吾友张也', term: '张' }, { phrase: '堂堂乎张也', term: '张' }],
    note: '颛孙师，字子张，陈人；屡问干禄、崇德、辨惑、行与达，孔子评其「师也过」，第十九篇即以其名为题。' },
  { id: 'ziyou', name: '子游', full: ['子游', '言游'], solo: ['偃'],
    extra: [{ phrase: '偃之言', term: '偃' }, { phrase: '偃之室', term: '偃' }],
    note: '言偃，字子游，吴人；先进篇列入「文学」科，为武城宰，以弦歌行礼乐之教。' },
  { id: 'ranyou', name: '冉有', full: ['冉有', '冉求', '冉子'], solo: ['求'],
    extra: [{ phrase: '由与求', term: '求' }, { phrase: '唯求则非邦', term: '求' }],
    note: '冉求，字子有，鲁人；先进篇列入「政事」科，仕为季氏宰，孔子以其为季氏聚敛而谓「非吾徒也」。' },
  { id: 'zaiwo', name: '宰我', full: ['宰我', '宰予'], solo: [],
    extra: [{ phrase: '于予与', term: '予' }, { phrase: '予之不仁', term: '予' }, { phrase: `予也${P.comma}有三年之爱`, term: '予' }],
    note: '宰予，字子我，鲁人；先进篇列入「言语」科，昼寝见责，又以三年之丧为久而问于孔子。' },
  { id: 'fanchi', name: '樊迟', full: ['樊迟', '樊须'], solo: [], extra: [],
    note: '樊须，字子迟；数问仁、问知，又请学稼、学圃，孔子谓「小人哉，樊须也」。' },
  { id: 'zhonggong', name: '仲弓', full: ['仲弓'], solo: ['雍'],
    extra: [{ phrase: '雍之言', term: '雍' }, { phrase: '雍虽不敏', term: '雍' }],
    note: '冉雍，字仲弓；先进篇列入「德行」科，孔子许以「可使南面」。' },
  { id: 'minziqian', name: '闵子骞', full: ['闵子骞', '闵子'], solo: [], extra: [],
    note: '闵损，字子骞，鲁人；先进篇列入「德行」科，孔子称其孝，曾辞季氏费宰之召。' },
  { id: 'gongxihua', name: '公西华', full: ['公西华', '子华'], solo: ['赤'],
    extra: [{ phrase: '赤之适齐', term: '赤' }, { phrase: '唯赤则非邦', term: '赤' }],
    note: '公西赤，字子华；长于礼仪宾客之事，孔子谓其「束带立于朝，可使与宾客言也」。' },
  { id: 'ranboniu', name: '冉伯牛', full: ['冉伯牛', '伯牛'], solo: [], extra: [],
    note: '冉耕，字伯牛；先进篇列入「德行」科，有疾，孔子自牖执其手而叹。' },
  { id: 'nangongkuo', name: '南宫适', full: ['南宫适', '南容'], solo: [], extra: [],
    note: '朱注以为即南容，字子容；三复「白圭」之诗，孔子以兄之子妻之。' },
  { id: 'gongyechang', name: '公冶长', full: ['公冶长'], solo: [], extra: [],
    note: '孔子谓其「虽在缧絏之中，非其罪也」，以其子妻之。' },
  { id: 'yuansi', name: '原思', full: ['原思'], solo: [],
    extra: [{ phrase: '宪问', term: '宪' }],
    note: '原宪，字子思；为孔子家宰，辞粟九百，又问「耻」（宪问篇首章）。' },
  { id: 'zigao', name: '子羔', full: ['子羔'], solo: ['柴'], extra: [],
    note: '高柴，字子羔；孔子谓「柴也愚」，子路使为费宰，孔子以为「贼夫人之子」。' },
  { id: 'zijian', name: '子贱', full: ['子贱'], solo: [], extra: [],
    note: '宓不齐，字子贱；孔子称「君子哉若人」。' },
  { id: 'youzi', name: '有子', full: ['有子', '有若'], solo: [], extra: [],
    note: '有若，鲁人；书中尊称「有子」，其「孝弟也者，其为仁之本与」一章居全书第二章。' },
  { id: 'qidiaokai', name: '漆雕开', full: ['漆雕开'], solo: [], extra: [],
    note: '孔子弟子；孔子使之仕，对以「吾斯之未能信」，孔子悦之。' },
  { id: 'simaniu', name: '司马牛', full: ['司马牛'], solo: [], extra: [],
    note: '旧注以为宋桓魋之弟；问仁、问君子，有「人皆有兄弟，我独亡」之忧。' },
  { id: 'ziqin', name: '子禽', full: ['子禽', '陈亢'], solo: [], extra: [],
    note: '陈亢，字子禽；问子贡夫子如何闻政，又问伯鱼「子亦有异闻乎」，是孔子弟子抑子贡弟子，旧说不一。' },
  { id: 'boyu', name: '伯鱼', full: ['伯鱼'], solo: ['鲤'],
    extra: [{ phrase: '鲤趋', term: '鲤' }, { phrase: '鲤退', term: '鲤' }],
    note: '孔鲤，字伯鱼，孔子之子，先颜渊而卒；孔子庭训以学诗、学礼。' },
  { id: 'wumaqi', name: '巫马期', full: ['巫马期'], solo: [], extra: [],
    note: '巫马施，字子期（朱注）；陈司败问昭公知礼一事，由其转告孔子。' },
  { id: 'zengxi', name: '曾皙', full: ['曾皙'], solo: ['点'], extra: [],
    note: '曾点，字皙，曾参之父；侍坐言志，愿「浴乎沂，风乎舞雩」，孔子叹「吾与点也」。' },
  { id: 'yanlu', name: '颜路', full: ['颜路'], solo: [], extra: [],
    note: '颜无繇，字路，颜渊之父；颜渊死，请孔子之车以为椁，孔子不许。' },
  { id: 'tantaimieming', name: '澹台灭明', full: ['澹台灭明'], solo: [], extra: [],
    note: '字子羽，武城人；子游为武城宰，举其「行不由径」、非公事不至其室。' },
  { id: 'shencheng', name: '申枨', full: ['申枨'], solo: ['枨'], extra: [],
    note: '朱注谓弟子姓名；孔子叹未见刚者，或举申枨，孔子以「枨也欲，焉得刚」答之。' },
  { id: 'gongboliao', name: '公伯寮', full: ['公伯寮'], solo: [], extra: [],
    note: '《史记·仲尼弟子列传》作公伯缭；愬子路于季孙，孔子答以道之行废皆命。' },
]

// 人工排除表:命中落在这些片段之内即作废。phrase 须为原文实有字样(闸与单测会查),reason 写明为什么不是人名。
export const EXCLUDE = [
  { phrase: '末由也已', reason: '「虽欲从之，末由也已」——由，途径，非子路' },
  { phrase: `所由${P.comma}`, reason: '「观其所由」——由，所经由，非子路' },
  { phrase: `士师${P.comma}`, reason: '「为士师」——士师，狱官，非子张' },
  { phrase: '可求', reason: '「富而可求也」「如不可求」——求，求取，非冉有' },
  { phrase: '不忮不求', reason: '《诗》句，求，贪求，非冉有' },
  { phrase: '有若无', reason: '「有若无，实若虚」——有若，像是有，非有子' },
]

// 整段跳过:底本混入的非《论语》文字。曾有一处——雍也第六第 12 段是维基文库页面上的现代「注解」,
// 2026-09-30 已在管线 ru config 用 dropParaRe 剔除(原文 29→28 段),故现为空;再遇同类情形优先修管线,这里只是最后兜底。
export const SKIP_PARA = []

// 通用派生器抽到 scripts/lib/people-index.mjs(2026-10-01,§13 推广到孟子 / 传习录);这里只留本书的人名表与排除表
const CFG = { PEOPLE, EXCLUDE, SKIP_PARA, vocativeNext: VOCATIVE_NEXT, book: 'lunyu', src: SRC }
export const matchPerson = (person, text) => matchPersonIn(person, text, CFG)
export const derive = (lunyu) => deriveIndex(lunyu, CFG)

function main() {
  const lunyu = JSON.parse(readFileSync(join(ROOT, SRC), 'utf8'))
  const out = derive(lunyu)
  const dropped = PEOPLE.filter((p) => !out.people.some((q) => q.id === p.id)).map((p) => p.name)
  writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2) + '\n')
  const total = out.people.reduce((n, p) => n + p.hits.length, 0)
  console.log(`${OUT}: ${out.people.length} 人 · ${total} 条出场${dropped.length ? ` · 0 命中已删:${dropped.join('、')}` : ''}`)
  for (const p of out.people) {
    const solo = p.hits.filter((h) => h.term.length === 1).length
    console.log(`  ${p.name.padEnd(5, '　')} ${String(p.pian).padStart(2)} 篇 ${String(p.hits.length).padStart(3)} 段`
      + `${solo ? `(单字呼名证 ${solo})` : ''}  称谓:${[p.name, ...p.aliases].join('/')}`)
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
