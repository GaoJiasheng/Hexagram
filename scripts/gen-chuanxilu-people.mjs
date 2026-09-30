// 《传习录》问学人物索引(design-v24 §14,论语版 §2 的推广)。
// 从站内原文 src/data/xin/classics/chuanxilu.json **派生** → src/data/xin/chuanxilu-people.json。
//   node scripts/gen-chuanxilu-people.mjs
// 《传习录》的人多以名或字的**短称**出现(「爱问」「澄曰」「侃问」「九川问」「德洪」「汝中」),所以这里的 solo 是短称、
// 只在其后紧跟「问 曰 因 又 请 对 在 尝 举 谓」之一时计(爱问 / 澄曰 / 侃因 / 爱又 / 九川请 / 德洪对……),
// 「爱」作动词(爱人、仁爱)、「侃」「澄」作他义时接不上这些字,自然不计。顾东桥(顾璘)只见于中卷书题、正文不称其名,故不列。每个 hit 附命中片段可回查;0 命中的人自动删。
// note 一句:姓名字号据《传习录》本文题署与《明儒学案》通行说法,存疑处写「一说」;心学思想史视角,不作成功学发挥。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deriveIndex, matchPersonIn, P } from './lib/people-index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SRC = 'src/data/xin/classics/chuanxilu.json'
export const OUT = 'src/data/xin/chuanxilu-people.json'

export const VOCATIVE_NEXT = '问曰因又请对在尝举谓'

export const PEOPLE = [
  { id: 'xuai', name: '徐爱', full: ['徐爱', '曰仁'], solo: ['爱'],
    extra: [{ phrase: '门人徐爱书', term: '徐爱' }],
    note: '字曰仁,余姚人,阳明妹婿,最早及门的弟子;卷上开头十四条即其所录并序,「爱始闻而骇,既而疑」一段为全书发端。早卒,阳明哭之恸。' },
  { id: 'lucheng', name: '陆澄', full: ['陆澄', '陆原静', '原静'], solo: ['澄'],
    extra: [],
    note: '字原静,一字清伯,归安人;卷上所录问答最多,「主一之功」「精一」「未发之中」诸条多出其问;卷中《答陆原静书》两通即答其所问。' },
  { id: 'xuekan', name: '薛侃', full: ['薛侃', '尚谦'], solo: ['侃'],
    extra: [],
    note: '字尚谦,揭阳人;卷上「侃去花间草」一段问善恶,阳明答「无善无恶者理之静」;初刻《传习录》即其所辑。' },
  { id: 'chenjiuchuan', name: '陈九川', full: ['陈九川', '九川', '惟濬'], solo: [],
    extra: [],
    note: '字惟濬,临川人;卷下开头所录出其手,「格物是止至善之功」「日间功夫」诸问,又记阳明在赣、在南昌时事。' },
  { id: 'huangzhi', name: '黄直', full: ['黄直', '黄以方'], solo: ['以方'],
    extra: [],
    note: '字以方,金溪人;卷下多条出其所录,「以方问」格物、「先生游南镇」看花一段亦在其中。' },
  { id: 'huangxiuyi', name: '黄修易', full: ['黄修易', '勉叔'], solo: [],
    extra: [],
    note: '字勉叔;卷下所录数条,问「良知之体」「静坐」等。' },
  { id: 'huangshengzeng', name: '黄省曾', full: ['黄省曾', '黄勉之'], solo: [],
    extra: [],
    note: '字勉之,吴县人;卷下所录一组问答出其手,问「颜子没而圣学亡」等。' },
  { id: 'qiandehong', name: '钱德洪', full: ['钱德洪', '德洪'], solo: [],
    extra: [],
    note: '名宽,以字行,后改名德洪,字洪甫,余姚人;与王畿并称教授师,天泉证道「四句教」一夕之辩,「德洪对」「德洪曰」即其人;《传习录》下卷经其编定。' },
  { id: 'wangji', name: '王畿', full: ['王畿', '汝中'], solo: [],
    extra: [],
    note: '字汝中,号龙溪,山阴人;天泉桥上与钱德洪论「四句教」,主「无善无恶」四无之说,阳明谓「汝中之见,是我这里接利根人的」。' },
  { id: 'ouyangchongyi', name: '欧阳崇一', full: ['欧阳崇一', '崇一'], solo: [],
    extra: [],
    note: '欧阳德,字崇一,泰和人;卷中《答欧阳崇一》一通答其「良知与见闻」之问,卷下亦有其问。' },
  { id: 'niewenwei', name: '聂文蔚', full: ['聂文蔚', '文蔚'], solo: [],
    extra: [],
    note: '聂豹,字文蔚,永丰人;卷中《答聂文蔚》两通,「拔本塞源」之论即在答其第一书。' },
  { id: 'luozhengan', name: '罗整庵', full: ['罗整庵', '整庵'], solo: [],
    extra: [],
    note: '罗钦顺,号整庵,泰和人,与阳明同时之理学名家;卷中《答罗整庵少宰书》辩《大学》古本与格物之说。' },
  { id: 'zhoudaotong', name: '周道通', full: ['周道通', '道通'], solo: [],
    extra: [],
    note: '周冲,字道通,宜兴人;卷中《答周道通书》答其「日用功夫」诸问。' },
  { id: 'xiaohui', name: '萧惠', full: ['萧惠'], solo: [],
    extra: [],
    note: '卷上所录数条出其问:「己私难克」「好仙好释」,阳明谓「汝那一点良知,是尔自家底准则」。' },
  { id: 'liuguanshi', name: '刘观时', full: ['刘观时'], solo: [],
    extra: [],
    note: '卷上问「未发之中是如何」,阳明答「哑子吃苦瓜,与你说不得」。' },
  { id: 'mazixin', name: '马子莘', full: ['马子莘', '子莘'], solo: [],
    extra: [],
    note: '马明衡,字子莘,莆田人;卷上问「修道之教」,阳明以「道即性即命」答之。' },
  { id: 'wangjiaxiu', name: '王嘉秀', full: ['王嘉秀'], solo: [],
    extra: [],
    note: '卷上问「佛以出离生死诱人入道,仙以长生久视诱人入道」,阳明答以「圣人尽性至命」。' },
  { id: 'mengyuan', name: '孟源', full: ['孟源'], solo: [],
    extra: [],
    note: '字伯生;卷上记其「有自是好名之病」,阳明数言之,「源从傍曰」一段即其人。' },
  { id: 'hetingren', name: '何廷仁', full: ['何廷仁', '廷仁'], solo: [],
    extra: [],
    note: '何秦,字廷仁,雩都人;卷下所记问学者之一。' },
  { id: 'huangchengfu', name: '黄诚甫', full: ['黄诚甫', '诚甫'], solo: [],
    extra: [],
    note: '黄宗明,字诚甫;卷上问「汝与回也孰愈」章,又问「先儒论六经」。' },
  { id: 'zhengchaoshuo', name: '郑朝朔', full: ['郑朝朔', '朝朔'], solo: [],
    extra: [],
    note: '郑一初,字朝朔;卷上问「至善亦须有从事物上求者」,阳明答以「至善只是此心纯乎天理之极」。' },
  { id: 'tangxu', name: '唐诩', full: ['唐诩'], solo: [],
    extra: [],
    note: '卷上问「立志是常存个善念,要为善去恶否」,阳明答以「善念存时,即是天理」。' },
  { id: 'caixiyuan', name: '蔡希渊', full: ['蔡希渊', '希渊'], solo: [],
    extra: [],
    note: '蔡宗兖,字希渊,山阴人;卷上问「文中子」「圣人可学而至」,阳明以「精金」喻圣人。' },
  { id: 'wangruzhi', name: '王汝止', full: ['王汝止', '汝止'], solo: [],
    extra: [],
    note: '王艮,字汝止,号心斋,泰州人;卷下记其「出游归,先生问曰:游何见」,答「见满街人都是圣人」。' },
]

// 人工排除表:命中落在这些片段之内即作废。phrase 须为原文实有字样(闸与单测会查),reason 写明为什么不是人名。
// 排除表:短称只在呼格计,「爱」「澄」「侃」作他义时后面接不上「问曰因又…」,实测无误伤;有了再加(phrase 须为原文实有字样,闸会查)
export const EXCLUDE = []
export const SKIP_PARA = []

const CFG = { PEOPLE, EXCLUDE, SKIP_PARA, vocativeNext: VOCATIVE_NEXT, book: 'chuanxilu', src: SRC }
export const matchPerson = (person, text) => matchPersonIn(person, text, CFG)
export const derive = (book) => deriveIndex(book, CFG)

function main() {
  const book = JSON.parse(readFileSync(join(ROOT, SRC), 'utf8'))
  const out = derive(book)
  const dropped = PEOPLE.filter((p) => !out.people.some((q) => q.id === p.id)).map((p) => p.name)
  writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2) + '\n')
  const total = out.people.reduce((n, p) => n + p.hits.length, 0)
  console.log(`${OUT}: ${out.people.length} 人 · ${total} 条出场${dropped.length ? ` · 0 命中已删:${dropped.join('、')}` : ''}`)
  for (const p of out.people) {
    const solo = p.hits.filter((h) => h.term.length <= 2 && !p.name.includes(h.term)).length
    console.log(`  ${p.name.padEnd(5, '　')} ${String(p.pian).padStart(2)} 卷 ${String(p.hits.length).padStart(3)} 段${solo ? `(短称证 ${solo})` : ''}  称谓:${[p.name, ...p.aliases].join('/')}`)
  }
}

void P
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
