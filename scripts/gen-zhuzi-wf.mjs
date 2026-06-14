// 生成诸子译注延并发 workflow 脚本(一次性)。读 9 部 classics 取章/段数,>55 段的章切 ≤45 段区间。
// 产出: scripts/.zhuzi-translate-wf.js  (再用 Workflow({scriptPath}) 跑)。输出单元 shape 与 assemble-newtexts.mjs 一致。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const BOOKS = [
  ['fa', 'hanfeizi'], ['fa', 'shangjunshu'], ['mo', 'mozi'],
  ['bing', 'sunzi'], ['bing', 'wuzi'], ['bing', 'simafa'], ['bing', 'weiliaozi'], ['bing', 'sanlue'],
  ['zong', 'guiguzi'], ['zong', 'zhanguoce'],
  ['zhongyi', 'suwen'], ['zhongyi', 'lingshu'], ['zhongyi', 'shanghanlun'], ['zhongyi', 'bencaojing'],
  ['moulue', 'luozhijing'], ['moulue', 'rongkujian'], ['moulue', 'quanmou'], ['moulue', 'taohuishu'], ['moulue', 'zhixue'],
]
const ONLY = process.argv[2]          // 可选:只为某 slug 或某 corpus 生成(如 zhanguoce / zhongyi)
const SEL = ONLY ? BOOKS.filter(([c, s]) => s === ONLY || c === ONLY) : BOOKS
const SPLIT = 50 // 单元最大段;>55 段的章按此切片
const units = []
for (const [corpus, slug] of SEL) {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
  for (const c of book.chapters) {
    const n = c.paragraphs.length
    const title = c.title || `第${c.no}章`
    if (n <= 55) {
      units.push({ corpus, book: slug, no: c.no, title, start: 0, end: n - 1, yanyi: true })
    } else {
      for (let s = 0; s < n; s += SPLIT) {
        units.push({ corpus, book: slug, no: c.no, title, start: s, end: Math.min(s + SPLIT, n) - 1, yanyi: s === 0 })
      }
    }
  }
}

const script = `export const meta = {
  name: 'zhuzi-translate',
  description: '诸子九书(法/墨/兵/纵横)译注延 并发翻译+校验',
  phases: [
    { title: 'Translate', detail: '逐章/片 译文+注疏+延伸' },
    { title: 'Verify', detail: '忠实性+格式+思想史铁律校正' },
  ],
}

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['translations', 'zhushi', 'yanyi'],
  properties: {
    translations: { type: 'array', items: { type: 'string' } },
    zhushi: { type: 'object', additionalProperties: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['term', 'note'],
      properties: { term: { type: 'string' }, reading: { type: 'string' }, note: { type: 'string' } } } } },
    yanyi: { type: 'array', items: { type: 'string' } },
  },
}

const UNITS = ${JSON.stringify(units, null, 0)}

const CN = { hanfeizi: '韩非子', shangjunshu: '商君书', mozi: '墨子', sunzi: '孙子兵法', wuzi: '吴子', simafa: '司马法', weiliaozi: '尉缭子', sanlue: '三略', guiguzi: '鬼谷子', zhanguoce: '战国策', suwen: '黄帝内经·素问', lingshu: '黄帝内经·灵枢', shanghanlun: '伤寒论', bencaojing: '神农本草经', luozhijing: '罗织经', rongkujian: '小人经', quanmou: '权谋术', taohuishu: '韬晦术', zhixue: '止学' }
const REF = {
  fa: '陈奇猷《韩非子集释》、王先慎《韩非子集解》、蒋礼鸿《商君书锥指》',
  mo: '孙诒让《墨子间诂》、吴毓江《墨子校注》',
  bing: '曹操等十一家注《孙子》、施子美《武经七书讲义》',
  zong: '许富宏《鬼谷子集校集注》、俞棪《鬼谷子新注》',
  zhongyi: '王冰次注《素问》、张介宾《类经》、张志聪《黄帝内经集注》;成无己《注解伤寒论》;孙星衍辑《神农本草经》',
  moulue: '各书真伪考辨(百度百科/维基/腾讯短史记等)——本组为托名伪书,无可靠古注',
}
const TIELU = '【铁律·思想史视角】诸子取思想史与文献研习视角:译文平实直译字面义,如实呈现其说(法家之严刻、纵横之机变照译不讳),但不作现代政治影射、不作厚黑/权术/帝王术教程式发挥、不借古讽今、不下现实政治褒贬;注疏作字词名物训诂,延伸讲思想/人物/源流。'
const TIELU_YI = '【铁律·研习不诊疗】中医典籍取医学史与文献研习视角:译文平实直译经文字面义(含本草经/伤寒论原文里的主治、方剂,属原典照译,非医嘱);但注疏与延伸一律不作诊疗、不述方药功效用法用量宜忌、不下病症/疗效断语、不教自我诊断施治或养生导引;注疏作字词名物术语训诂,延伸讲医学史、人物(扁鹊/仓公/华佗/张仲景/皇甫谧/孙思邈/李时珍等)、学派源流、概念思想史(阴阳五行入医、藏象、运气)。内容为古籍研习、非医疗建议。'
const TIELU_MOU = '【铁律·伪书批判】本组为《天下无谋》托名谋略书,学界多判为后世托名或现代伪作(罗织经更被揭为今人伪造)。译文平实直译其字面义,如实呈现其权术、构陷、厚黑之说以见其面目;但**注疏作字词训诂、延伸取文献批判与思想史视角**(讲此书何时出现、为何托名古人、映照何种世态人心、与真史/真人著作不合之处),**绝不作处世权术/厚黑/构陷之教程、不教人施用、不为其术张目、不下「高明」之褒**;延伸须点出真伪存疑。内容为伪书现象与文献研究,非处世指南。'
const FILE = (c, b) => '/Users/gavin/work/hexagram/src/data/' + c + '/classics/' + b + '.json'

function styleRule(u) {
  if (u.corpus === 'moulue') {
    return TIELU_MOU + ' 本书《' + CN[u.book] + '》旧题托名、真伪存疑;直译其辞,延伸批判性指出托名与世态,不教施用、不褒其术。'
  }
  if (u.corpus === 'zhongyi') {
    const base = TIELU_YI + ' 参' + REF.zhongyi + '。'
    if (u.book === 'bencaojing') return base + ' 本草经经文逐药含「主治…」,属原典须照译;但注疏只释药名/别名/产地/类属源流,绝不展开功效、用法、剂量、宜忌,延伸只讲本草学史不荐用。'
    if (u.book === 'shanghanlun') return base + ' 伤寒论方剂只随经文录方名与组成,注疏/延伸不述主治、用法、用量;六经辨证、脉证作文献训诂,不导向「对照自诊」。'
    return base + ' 内经问答体(黄帝问、岐伯对)逐段直译,人名(黄帝/岐伯/雷公等)保留;藏象、经络、脉证、运气等作文献训诂,不导向自查自疗。'
  }
  const base = TIELU + ' 参' + REF[u.corpus] + '。'
  if (u.corpus === 'fa') return base + ' 法/术/势、刑名、耕战等术语注疏释之;寓言(守株待兔、自相矛盾等)译文存名、注疏点出处。'
  if (u.corpus === 'mo') return base + ' 兼爱/非攻/尚贤/天志取主流解;《经》《经说》《大取》《小取》近名辩,直译保其论证结构,不臆补;墨家科技(光学/力学/几何)条目注疏点明不演绎。'
  if (u.corpus === 'bing') return base + ' 形/势/虚实/奇正等兵学概念注疏释之,不演绎现代战例、不作权谋鸡汤。'
  return base + ' 捭阖/反应/内揵等术语译文取主流一解、注疏可「一说」备异。'
}

function translatePrompt(u) {
  const len = u.end - u.start + 1
  const rangeDesc = u.start === 0 && len > 0
    ? ('本章共 ' + len + ' 段全译:translations[i] 对应原文第 i 段。')
    : ('本片段只译下标 ' + u.start + ' 到 ' + u.end + ' 的段(共 ' + len + ' 段):translations[0] 对应原文第 ' + u.start + ' 段,依次类推。')
  return '你在为古籍研习站做《' + CN[u.book] + '·' + u.title + '》的白话译注。' + styleRule(u) + '\\n\\n' +
    '第一步:用 Read 读 ' + FILE(u.corpus, u.book) + ',找到 chapters 里 no===' + u.no + ' 的那一章(其 paragraphs 为原文段,每段含 original)。' + rangeDesc + '\\n\\n' +
    '按 schema 产出:\\n' +
    '1) translations:数组,长度必须恰为 ' + len + ',与本片段各段下标对应。平实直译、一段对一段;不增义、不删、不合并、不臆解;禁鸡汤/拔高/现代政治影射/权术发挥口吻。\\n' +
    '2) zhushi:对象,key 为**本片段内的相对下标字符串**("0".."' + (len - 1) + '",即 translations 的下标,不是原文绝对下标)。每段挑 0–4 个值得注的词(生僻字、人名地名、典故、名物制度、术语、通假;长词专名优先),{term, reading?, note}。**term 必须是对应段 original 的精确连续子串**;note≤40 汉字,训诂体;不加 ref/链接字段。无可注的段不出 key。\\n' +
    '3) yanyi:' + (u.yanyi ? ('1–2 段本章/篇级延伸,讲此篇义理要点、著名文句、相关人物与源流(参' + REF[u.corpus] + ');脱锚分级,守思想史铁律不作现实政治影射/权术发挥,不空泛说教。每段 80–160 字。') : '本片段不出延伸,返回空数组 []。') + '\\n\\n' +
    '只返回结构化结果。'
}

function verifyPrompt(u, draft) {
  const len = u.end - u.start + 1
  return '校对修正《' + CN[u.book] + '·' + u.title + '》(原文第 ' + u.start + '–' + u.end + ' 段)译注草稿,返回修正后完整结构。' + styleRule(u) + '\\n\\n' +
    '先 Read ' + FILE(u.corpus, u.book) + ' 中 no===' + u.no + ' 的章,核对其第 ' + u.start + '..' + u.end + ' 段。草稿:\\n' + JSON.stringify(draft) + '\\n\\n' +
    '逐项改正后按 schema 返回:\\n' +
    '- translations 长度必须恰为 ' + len + ',与第 ' + u.start + '.. 段逐一对齐;漏译/臆增/错解/把注混入译文者改正;' + (u.corpus === 'zhongyi' ? '注疏/延伸中删去诊疗指导、方药功效用法用量、病症/疗效断语、养生医嘱' : u.corpus === 'moulue' ? '注疏/延伸中删去处世权术教程式发挥、为伪书张目或褒扬其术的措辞,延伸须存真伪批判' : '删去鸡汤、拔高、现代政治影射、权术/厚黑发挥') + ';口吻平实。\\n' +
    '- zhushi:key 为片段内相对下标("0".."' + (len - 1) + '");每条 term 必须是对应段 original 的精确子串,否则删或改;note≤40;删 ref/链接;每段≤4 条。\\n' +
    '- yanyi:' + (u.yanyi ? ('保持 1–2 段,删空泛说教与' + (u.corpus === 'zhongyi' ? '诊疗医嘱/功效宣称' : u.corpus === 'moulue' ? '处世权术教程或为伪书张目之辞' : '现实政治影射') + ',确保实质、出处可靠。') : '空数组 []。') + '\\n\\n' +
    '只返回修正后的结构化结果。'
}

phase('Translate')
const results = await pipeline(
  UNITS,
  (u) => agent(translatePrompt(u), { label: '译:' + CN[u.book] + '·' + u.title + '#' + u.start, phase: 'Translate', schema: SCHEMA }),
  (draft, u) => {
    if (!draft) return { ...u, data: null }
    return agent(verifyPrompt(u, draft), { label: '校:' + CN[u.book] + '·' + u.title + '#' + u.start, phase: 'Verify', schema: SCHEMA })
      .then((v) => ({ ...u, data: v || draft }))
  },
)
const ok = results.filter(Boolean)
log('完成 ' + ok.filter((r) => r.data).length + '/' + UNITS.length + ' 单元')
return ok
`

const outName = `scripts/.${ONLY || 'zhuzi'}-translate-wf.js`
fs.writeFileSync(path.join(ROOT, outName), script)
console.log(`生成 ${units.length} 单元 → ${outName}`)
const byCorpus = {}
for (const u of units) byCorpus[u.corpus] = (byCorpus[u.corpus] || 0) + 1
console.log('单元分布:', JSON.stringify(byCorpus))
