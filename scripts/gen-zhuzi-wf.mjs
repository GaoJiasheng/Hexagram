// 生成诸子译注延并发 workflow 脚本(一次性)。读 9 部 classics 取章/段数,>55 段的章切 ≤45 段区间。
// 产出: scripts/.zhuzi-translate-wf.js  (再用 Workflow({scriptPath}) 跑)。输出单元 shape 与 assemble-newtexts.mjs 一致。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const BOOKS = [
  ['fa', 'hanfeizi'], ['fa', 'shangjunshu'], ['fa', 'shenzi'], ['fa', 'yinwenzi'], ['mo', 'mozi'],
  ['bing', 'sunzi'], ['bing', 'wuzi'], ['bing', 'simafa'], ['bing', 'weiliaozi'], ['bing', 'sanlue'], ['bing', 'liutao'],
  ['zong', 'guiguzi'], ['zong', 'zhanguoce'],
  ['zhongyi', 'suwen'], ['zhongyi', 'lingshu'], ['zhongyi', 'shanghanlun'], ['zhongyi', 'bencaojing'], ['zhongyi', 'jinkui'], ['zhongyi', 'nanjing'],
  ['moulue', 'luozhijing'], ['moulue', 'rongkujian'], ['moulue', 'quanmou'], ['moulue', 'taohuishu'], ['moulue', 'zhixue'],
  ['moulue', 'changduanjing'], ['moulue', 'caigentan'], ['moulue', 'weiluyehua'], ['moulue', 'xiaochuangyouji'],
  ['bing', 'weigongwendui'],
  ['dao', 'zhuangzi-waipian'], ['dao', 'zhuangzi-zapian'], ['dao', 'liezi'], ['dao', 'wenzi'], ['dao', 'huangting'],
  ['fo', 'yijiaojing'], ['fo', 'badaren'], ['fo', 'amituojing'], ['fo', 'xinxinming'], ['fo', 'zhengdaoge'], ['fo', 'weimojie'],
  ['xin', 'daxuewen'],
  ['ru', 'xunzi'], ['ru', 'yanshi'], ['ru', 'jinsilu'], ['ru', 'shijing'],
  ['dao', 'wuzhenpian'],
  // 诗词曲三组(二十四期)。唐诗按七类分章、章内以《诗题》段分首(同诗经/长短经);
  // 宋词元曲一首即一章。作业标准见 docs/poetry-production-standard.md。
  ['tangshi', 'tangshi300'], ['songci', 'songci300'], ['yuanqu', 'yuanqu'],
  // 观数(命理学,2026-09-19 立项)。四部底本见 scripts/corpus/mingli.config.mjs;守【研习不断命】铁律。
  ['mingli', 'yuanhai'], ['mingli', 'zhenquan'], ['mingli', 'ditiansui'], ['mingli', 'qiongtong'],
  ['mingli', 'sanming'], ['mingli', 'wuxingdayi'], ['mingli', 'lixuzhong'], ['mingli', 'luoluzi'], ['mingli', 'yuzhao'],
]
const ONLY = process.argv[2]          // 可选:只为某 slug 或某 corpus 生成(逗号可多选,如 liutao,jinkui)
// 可选:--models=<译>,<校>(如 --models=opus,sonnet)。不给则两段都继承主会话模型(原行为)。
// owner 2026-09-19:大批量内容生产时分摊用量——翻译要质量用 opus,校对是核对型的活用 sonnet。
const MODELS_ARG = (process.argv.find((a) => a.startsWith('--models=')) || '').slice('--models='.length)
const [MODEL_T, MODEL_V] = MODELS_ARG ? MODELS_ARG.split(',') : []
const ONLY_SET = ONLY ? new Set(ONLY.split(',')) : null
const SEL = ONLY_SET ? BOOKS.filter(([c, s]) => ONLY_SET.has(s) || ONLY_SET.has(c)) : BOOKS
// 四库白文(无标点)的书:译注代理须先断句,产出 punctuated(见 scripts/lib/punct-layer.mjs 的硬不变式)
const PUNCT_BOOKS = new Set(['sanming', 'lixuzhong', 'yuzhao'])
const SPLIT = 50 // 单元最大段;>55 段的章按此切片
// 可选:--chapters=4,7 只为这几章生成(补译/重译用;须与单个 slug 连用)
const CH_ARG = (process.argv.find((a) => a.startsWith('--chapters=')) || '').slice('--chapters='.length)
const CH_SET = CH_ARG ? new Set(CH_ARG.split(',').map(Number)) : null
// 可选:--units=57:50,57:300,58:50 只生成这几个切片(章号:起始段;补跑错位切片用,装配须带 --merge)
const UN_ARG = (process.argv.find((a) => a.startsWith('--units=')) || '').slice('--units='.length)
const UN_SET = UN_ARG ? new Set(UN_ARG.split(',')) : null
// 可选:--bundle=3200 小篇合包(2026-09-21):相邻的短章(单章 ≤55 段)攒到约 N 字/≤50 段/≤12 篇交给**一个**代理,
// 产出后在 workflow 里按篇拆回普通单元,装配器无感。为三命通会卷六(150 篇、每篇两百来字)而设——
// 一篇一个代理时,每个代理的固定开销(系统提示 + CLAUDE.md)远大于正文,合包省掉约八成。
const BUNDLE = Number((process.argv.find((a) => a.startsWith('--bundle=')) || '').slice('--bundle='.length)) || 0
const units = []
// 切片首末段的开头几个字:写进提示语当**锚**。只说「下标 50 到 99」时,个别代理按 1 起理解,整片译文错一段
// (2026-09-19 渊海第 57/58 篇、穷通第 7 章共 4 个切片中招);给了锚就没有歧义。
const headOf = (c, i) => [...(c.paragraphs[i]?.original || '')].slice(0, 12).join('')
// 本片段的原文直接排进提示语(2026-09-19):此前让代理自己 Read 整本 classics json(三命通会 1.8MB),
// 每个代理光翻文件就要十几万 token。内嵌后拿到的就是要译的这几十段。
const parasOf = (c, from, to) => c.paragraphs.slice(from, to + 1).map((p, k) =>
  `[${from + k}] ${p.original}` + (p.pillars ? '〔命例段:四柱 ' + p.pillars.join(' ') + ',留空不译〕' : '')).join('\n')
for (const [corpus, slug] of SEL) {
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
  for (const c of book.chapters) {
    if (CH_SET && !CH_SET.has(c.no)) continue
    const n = c.paragraphs.length
    const title = c.title || `第${c.no}章`
    if (n <= 55) {
      units.push({ corpus, book: slug, no: c.no, title, start: 0, end: n - 1, yanyi: true, punct: PUNCT_BOOKS.has(slug), head: headOf(c, 0), tail: headOf(c, n - 1), paras: parasOf(c, 0, n - 1), _c: c })
    } else {
      for (let s = 0; s < n; s += SPLIT) {
        units.push({ corpus, book: slug, no: c.no, title, start: s, end: Math.min(s + SPLIT, n) - 1, yanyi: s === 0, punct: PUNCT_BOOKS.has(slug), head: headOf(c, s), tail: headOf(c, Math.min(s + SPLIT, n) - 1), paras: parasOf(c, s, Math.min(s + SPLIT, n) - 1) })
      }
    }
  }
}

// 小篇合包:把相邻的整章单元(带 _c)并成一个 bundle 单元。段下标在包内连续编号,〔篇〕标记行只是分界、不是原文。
if (BUNDLE) {
  const out = []
  let cur = null
  const flush = () => {
    if (!cur) return
    if (cur.parts.length === 1) { out.push(cur.parts[0].u) } else {
      let o = 0
      const lines = []
      for (const p of cur.parts) {
        lines.push('〔第 ' + (lines.filter((l) => l.startsWith('〔第')).length + 1) + ' 篇:《' + p.u.title + '》,共 ' + p.n + ' 段〕')
        p.u._c.paragraphs.forEach((para, k) => lines.push(`[${o + k}] ${para.original}` + (para.pillars ? '〔命例段:四柱 ' + para.pillars.join(' ') + ',留空不译〕' : '')))
        o += p.n
      }
      const first = cur.parts[0].u, last = cur.parts[cur.parts.length - 1].u
      out.push({ corpus: first.corpus, book: first.book, no: first.no, title: first.title + ' 等 ' + cur.parts.length + ' 篇', start: 0, end: o - 1, yanyi: true, punct: first.punct,
        head: first.head, tail: last.tail, paras: lines.join('\n'), parts: cur.parts.map((p) => ({ no: p.u.no, title: p.u.title, n: p.n })) })
    }
    cur = null
  }
  for (const u of units) {
    if (!u._c) { flush(); out.push(u); continue }
    const n = u.end + 1
    const chars = u._c.paragraphs.reduce((a, p) => a + p.original.length, 0)
    if (cur && (cur.book !== u.book || cur.chars + chars > BUNDLE || cur.paras + n > 50 || cur.parts.length >= 12)) flush()
    if (chars > BUNDLE) { flush(); out.push(u); continue }
    cur ??= { book: u.book, chars: 0, paras: 0, parts: [] }
    cur.parts.push({ u, n }); cur.chars += chars; cur.paras += n
  }
  flush()
  units.length = 0; units.push(...out)
}
for (const u of units) delete u._c

if (UN_SET) { for (let i = units.length - 1; i >= 0; i--) if (!UN_SET.has(`${units[i].no}:${units[i].start}`)) units.splice(i, 1) }

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
    punctuated: { type: 'array', items: { type: 'string' } },   // 仅四库白文:断句本,与 translations 同长同序
    zhushi: { type: 'object', additionalProperties: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['term', 'note'],
      properties: { term: { type: 'string' }, reading: { type: 'string' }, note: { type: 'string' } } } } },
    yanyi: { type: 'array', items: { type: 'string' } },
  },
}

const UNITS = ${JSON.stringify(units, null, 0)}

const CN = { hanfeizi: '韩非子', shangjunshu: '商君书', shenzi: '慎子', yinwenzi: '尹文子', wenzi: '文子', mozi: '墨子', sunzi: '孙子兵法', wuzi: '吴子', simafa: '司马法', weiliaozi: '尉缭子', sanlue: '三略', guiguzi: '鬼谷子', zhanguoce: '战国策', suwen: '黄帝内经·素问', lingshu: '黄帝内经·灵枢', shanghanlun: '伤寒论', bencaojing: '神农本草经', luozhijing: '罗织经', rongkujian: '小人经', quanmou: '权谋术', taohuishu: '韬晦术', zhixue: '止学', liutao: '六韬', jinkui: '金匮要略', nanjing: '难经', 'zhuangzi-waipian': '庄子外篇', 'zhuangzi-zapian': '庄子杂篇', liezi: '列子', yijiaojing: '佛遗教经', badaren: '八大人觉经', amituojing: '阿弥陀经', xinxinming: '信心铭', zhengdaoge: '永嘉证道歌', daxuewen: '大学问', xunzi: '荀子', yanshi: '颜氏家训', jinsilu: '近思录', weimojie: '维摩诘经', huangting: '黄庭内景经', shijing: '诗经', wuzhenpian: '悟真篇',
  changduanjing: '长短经', caigentan: '菜根谭', weiluyehua: '围炉夜话', xiaochuangyouji: '小窗幽记', weigongwendui: '李卫公问对',
  tangshi300: '唐诗三百首', songci300: '宋词三百首', yuanqu: '元曲选',
  yuanhai: '渊海子平', zhenquan: '子平真诠', ditiansui: '滴天髓阐微', qiongtong: '穷通宝鉴',
  sanming: '三命通会', wuxingdayi: '五行大义', lixuzhong: '李虚中命书', luoluzi: '珞琭子三命消息赋', yuzhao: '玉照定真经' }
const REF = {
  fa: '陈奇猷《韩非子集释》、王先慎《韩非子集解》、蒋礼鸿《商君书锥指》',
  mo: '孙诒让《墨子间诂》、吴毓江《墨子校注》',
  bing: '曹操等十一家注《孙子》、施子美《武经七书讲义》',
  zong: '许富宏《鬼谷子集校集注》、俞棪《鬼谷子新注》',
  zhongyi: '王冰次注《素问》、张介宾《类经》、张志聪《黄帝内经集注》;成无己《注解伤寒论》;孙星衍辑《神农本草经》',
  moulue: '伪书 5 部真伪考辨(百度百科/维基/腾讯短史记等,无可靠古注);真书 4 部:《四库全书总目》(长短经)、通行注本与作者生平考(菜根谭/围炉夜话/小窗幽记)',
  dao: '郭象《庄子注》、成玄英《庄子疏》、王先谦《庄子集解》、郭庆藩《庄子集释》;张湛《列子注》',
  fo: '鸠摩罗什译本;天亲《佛遗教经论》、智旭《阿弥陀经要解》、丁福保《佛学大辞典》;禅宗灯录',
  xin: '陈荣捷《王阳明传习录详注集评》、邓艾民《传习录注疏》;《王文成公全书》',
  ru: '王先谦《荀子集解》、梁启雄《荀子简释》;王利器《颜氏家训集解》;江永/茅星来《近思录集注》、叶采《近思录集解》',
  tangshi: '清·蘅塘退士原选;喻守真《唐诗三百首详析》、金性尧《唐诗三百首新注》、《全唐诗》',
  songci: '朱孝臧原选;唐圭璋《宋词三百首笺注》、龙榆生《唐宋词格律》、《全宋词》',
  yuanqu: '隋树森《全元散曲》、王季思《元散曲选注》、《太平乐府》《阳春白雪》',
  // 命理三家(旺衰/格局/调候)原注家;不得引用徐乐吾、韦千里、袁树珊等民国以后人的评注(版权与站规双重考量)。
  mingli: '任铁樵(《滴天髓阐微》)、沈孝瞻(《子平真诠》)、余春台(《穷通宝鉴》整理);不得引用徐乐吾、韦千里、袁树珊等民国以后人的评注',
}
const TIELU = '【铁律·思想史视角】诸子取思想史与文献研习视角:译文平实直译字面义,如实呈现其说(法家之严刻、纵横之机变照译不讳),但不作现代政治影射、不作厚黑/权术/帝王术教程式发挥、不借古讽今、不下现实政治褒贬;注疏作字词名物训诂,延伸讲思想/人物/源流。'
const TIELU_YI = '【铁律·研习不诊疗】中医典籍取医学史与文献研习视角:译文平实直译经文字面义(含本草经/伤寒论原文里的主治、方剂,属原典照译,非医嘱);但注疏与延伸一律不作诊疗、不述方药功效用法用量宜忌、不下病症/疗效断语、不教自我诊断施治或养生导引;注疏作字词名物术语训诂,延伸讲医学史、人物(扁鹊/仓公/华佗/张仲景/皇甫谧/孙思邈/李时珍等)、学派源流、概念思想史(阴阳五行入医、藏象、运气)。内容为古籍研习、非医疗建议。'
const TIELU_FO = '【铁律·研习不宣化】释典取义理与文献研习视角:译文平实直译经文字面义(含极乐庄严、念佛往生、戒律因果等,属原典照译);但注疏与延伸一律不作信仰劝化、不下吉凶/果报/往生承诺断语、不劝人皈信修持奉诵;注疏作名相(般若/涅槃/陀罗尼/四谛/五阴/三十二相等)、人名、典故训诂(0–4 条/段、≤40 字、无 ref),延伸讲经典译史、宗派源流、义理思想(禅宗顿悟、净土、戒学)。内容为佛典研习、非宗教宣化。'
const TIELU_DAO = '【铁律·道家研习】道藏典籍取思想史与文献研习视角:译文平实直译字面义,寓言人名/地名/物名(鲲鹏/河伯/北海若/庖丁/愚公/夸父/纪昌等)保留,注疏释之;但不作宗教信仰宣化、不下吉凶/福报/成仙断语、不演绎内丹工法或养生导引术;注疏作字词名物训诂(0–4 条/段、≤40 字、无 ref,模块不互链),延伸讲义理/寓言/思想源流/学派流变,如实呈现(列子今本经魏晋缀辑、真伪存疑须如实点出)。'
const TIELU_MOU = '【铁律·伪书批判】本组为《天下无谋》托名谋略书,学界多判为后世托名或现代伪作(罗织经更被揭为今人伪造)。译文平实直译其字面义,如实呈现其权术、构陷、厚黑之说以见其面目;但**注疏作字词训诂、延伸取文献批判与思想史视角**(讲此书何时出现、为何托名古人、映照何种世态人心、与真史/真人著作不合之处),**绝不作处世权术/厚黑/构陷之教程、不教人施用、不为其术张目、不下「高明」之褒**;延伸须点出真伪存疑。内容为伪书现象与文献研究,非处世指南。'
// 谋略组扩书(真书,与上面 5 部伪书性质不同,不作「伪书批判」框注):长短经(反经)取思想史/治国用人视角,
// 菜根谭/围炉夜话/小窗幽记(清言三书)取处世智慧文献研习视角。二者均不作现代权术施用教程。
const TIELU_MOU_ZHEN_CHANGDUAN = '【铁律·真书·思想史研习】《长短经》(反经)为唐赵蕤真实著作(非托名伪书),《四库全书总目》详载源流,与本组其余 5 部伪书性质不同,不作「托名伪书」框注。译文平实直译其识人用人、治乱兴亡、兵权奇正之说;注疏作字词名物训诂,延伸取思想史与文献源流视角(讲赵蕤生平、此篇论旨、与《战国策》纵横家渊源、后世评价),**不作现代政治/职场权术施用教程、不借古讽今、不下现实政治褒贬**。'
const TIELU_MOU_ZHEN_QINGYAN = '【铁律·真书·处世智慧研习】本书为真实古籍(非托名伪书),与本组其余 5 部伪书性质不同,不作「托名伪书」框注。译文平实直译其处世格言;注疏作字词训诂,延伸取思想史与文献研习视角(讲作者生平、格言旨趣、儒释道思想渊源),**不作成功学/心灵鸡汤式过度引申、不作处世权术教程,存其温厚劝世本色**。'
// 观数(命理学,2026-09-19 立项)。铁律文本原样使用(owner 派工原文,常量名 TIELU_MINGLI)。
const TIELU_MINGLI = '【铁律·研习不断命】本组是命理典籍的文献研读,不是算命。①译文:原典里的断语(此造必贵、主刑克、寿夭贫富等)一律照译,不删不讳、不加强也不软化;②注疏:只作字词训诂与术语解释(十神、格局、用神、通根、透干等术语释义),不评判命例中人的吉凶,不补充原文没有的断语;③延伸:讲这一章在命理学说史上的位置、与他书(渊海子平/子平真诠/滴天髓/穷通宝鉴/三命通会)的异同、术语源流,可如实指出此说无从验证或诸家分歧;绝不教读者拿去给自己或他人断命,不出现「你可据此判断自己……」式的套用指引,不下任何预测性断语;④真伪与底本如实交代(《滴天髓》原文托名京图、刘基,实际作者不可考;《栏江网》撰人不详)。'
// 诗词曲三组(集部)。与经子诸组最大的不同:它们不讲道理,不能照「义理—训诂」那套写。
// 作业标准 docs/poetry-production-standard.md,红线第一条是**不作心灵鸡汤、不作励志格言**。
const TIELU_SHI = '【铁律·诗词曲研习】唐诗/宋词/元曲取文学与文献研习视角。'
  + '译文:**一句对一句**,不重组、不合并、不添意(原文四句译文四句);**保留意象,不作解释**'
  + '——「感时花溅泪」译作「感伤时局,看花也落泪」即止,绝不续写「表达了诗人深沉的爱国情怀」那半截(那是延伸层的事);'
  + '典故照直译出、考释放注疏(「庄生晓梦迷蝴蝶」译「庄周清晨梦中梦见自己化为蝴蝶」,不在译文里塞「用《庄子·齐物论》典」);'
  + '歧解取通行说、分歧写进注疏,不在译文里骑墙。'
  + '注疏:只注**读不懂的**(僻字、通假、专名、典故、名物、格律术语),**不注情感、不注主旨**;每条 ≤40 字、term 须原文精确子串、无 ref。'
  + '延伸:讲创作本事(须分清史实与传说,相传者标「相传」)、意象源流(「杨柳」何以关送别)、声律安排、后世化用、同题异作对读。'
  + '**⛔ 全程不作心灵鸡汤、不作励志格言、不作人生启示与处世哲理发挥**(给诗写「人生启示」比译错一个字更糟);'
  + '不把作者生平当诗意的唯一解;不作现实影射(边塞诗不读成当代国际关系);不把传说当史实。'
const FILE = (c, b) => '/Users/gavin/work/hexagram/src/data/' + c + '/classics/' + b + '.json'

function styleRule(u) {
  if (u.corpus === 'tangshi' || u.corpus === 'songci' || u.corpus === 'yuanqu') {
    const base = TIELU_SHI + ' 参' + REF[u.corpus] + '。'
    if (u.corpus === 'tangshi') {
      return base + ' 唐诗三百首按七类分卷,**卷内以独立成段的「《诗题》」标记一首之界——该标记段的'
        + ' translations 对应位置留空字符串""(不译、不注),真正译文从下一段诗句开始**;一段即一句(或一联),逐段直译。'
        + ' 格律术语(五古/七律/乐府旧题/平仄/对仗/拗救)、地名官名、典故出处入注疏。'
        + ' 延伸(每卷 1–2 段)讲该类体裁之成立与代表作,不逐首铺陈(逐首是白话层的事)。'
    }
    if (u.corpus === 'songci') {
      return base + ' 宋词一首即一章,章题即「词牌·词题(作者)」。**词牌是格律调名、与内容无关**'
        + '——《木兰花》不写木兰花、《点绛唇》不写点唇,凡首见其调,注疏须点明「词牌名,与内容无关」,'
        + '这是初学者最常见的误解、漏注等于放任误读;有本事者(如《宴山亭》为赵佶北行途中作)延伸里标明,分清史实与传说。'
        + ' 上下片(阕)的过片、领字、押韵与句读作格律训诂。'
    }
    return base + ' 元散曲一首即一章,章题为「宫调·曲牌·题目」。'
      + ' **章内常把「【中吕】喜春来」这样的宫调曲牌行、以及「春宴」这样的曲题行单独列成段**(全书 130 行宫调曲牌 + 63 行曲题);这类段的 translations 对应位置**留空字符串""**(不译),改在注疏里点明「【中吕】是宫调、喜春来是曲牌名、春宴才是题目」——真正的译文从曲文那段开始。'
      + ' **曲牌同样是格律调名、与内容无关**'
      + '(《天净沙》不写沙、《山坡羊》不写羊),首见须注明;宫调(正宫/南吕/双调等)、衬字、务头、小令与套数之别作格律训诂。'
      + ' 曲语近口语、多方言俚词与叠字,直译存其本色,不雅化、不改写成诗的腔调。'
      + ' **本编为本站选目、非传世选本**,延伸涉及选目处须如实点明。'
  }
  if (u.corpus === 'moulue') {
    if (u.book === 'changduanjing') {
      return TIELU_MOU_ZHEN_CHANGDUAN + ' **组内以独立成段的「《篇名》」标记篇界(如诗经体例)——该标记段的 translations 对应位置留空字符串""(不译、不注),真正译文从下一段开始。**'
    }
    if (u.book === 'caigentan' || u.book === 'weiluyehua' || u.book === 'xiaochuangyouji') {
      return TIELU_MOU_ZHEN_QINGYAN + (u.book === 'caigentan' ? ' 《菜根谭》条目独立成段,逐条直译。' : u.book === 'weiluyehua' ? ' 《围炉夜话》条目独立成段,逐条直译,首段为作者自序、按序文风格译。' : ' 《小窗幽记》(醉古堂剑扫)条目独立成段,逐条直译,句式讲究骈俪对仗,译文尽量存其对仗神韵。')
    }
    return TIELU_MOU + ' 本书《' + CN[u.book] + '》旧题托名、真伪存疑;直译其辞,延伸批判性指出托名与世态,不教施用、不褒其术。'
  }
  if (u.corpus === 'zhongyi') {
    const base = TIELU_YI + ' 参' + REF.zhongyi + '。'
    if (u.book === 'bencaojing') return base + ' 本草经经文逐药含「主治…」,属原典须照译;但注疏只释药名/别名/产地/类属源流,绝不展开功效、用法、剂量、宜忌,延伸只讲本草学史不荐用。'
    if (u.book === 'shanghanlun' || u.book === 'jinkui') return base + ' 伤寒论/金匮方剂只随经文录方名与组成,注疏/延伸不述主治、用法、用量;辨证、脉证作文献训诂,不导向「对照自诊」。'
    if (u.book === 'nanjing') return base + ' 难经为八十一问答(难)发明内经奥义,脉学(独取寸口)、经络、藏象、俞穴、针法作文献训诂,不述诊疗、不导向自查自疗。'
    return base + ' 内经问答体(黄帝问、岐伯对)逐段直译,人名(黄帝/岐伯/雷公等)保留;藏象、经络、脉证、运气等作文献训诂,不导向自查自疗。'
  }
  if (u.corpus === 'ru') {
    const base = '【研习·儒家】儒典取义理与思想史视角:译文平实直译,仁义礼智、性命理气等概念注疏释之(0–4 条/段、≤40 字、无 ref),延伸讲义理/学派源流/与孔孟程朱异同,如实呈现不作现代借用。参' + REF.ru + '。'
    if (u.book === 'yanshi') return base + '颜氏家训为家训体,平实直译;家庭教化/治学/处世/南北朝史事名物注疏释之,延伸讲家训源流与颜之推身世,不作现代育儿/成功学发挥。'
    if (u.book === 'jinsilu') return base + '近思录为朱熹、吕祖谦辑周敦颐张载二程语录,直译其理学语录(卷首「此卷论…」为注本提要照译);理/气/性/命/敬/格物致知等概念注疏释之,延伸讲程朱理学源流与编纂体例。'
    if (u.book === 'shijing') return '【研习·诗经】诗经为最早诗歌总集,四言为主,多用赋比兴,多草木鸟兽虫鱼名物、方言古语、通假异文。译文平实直译字面意象与情境,不预设「美刺讽谏」说教式解读(可在延伸里提汉儒经学传统,但主译取诗本身情境与今人训诂);名物字词、通假、地名邦国、礼制习俗注疏释之(0–4 条/段、≤40 字、无 ref)。**每组含数首诗,组内以独立成段的「《诗题》」标记诗界——该标记段的 translations 对应位置留空字符串""(不译、不注),真正译文从下一段诗句开始。**延伸(每组 1–2 段)讲该组代表诗篇的主题、艺术手法(赋比兴)与经学阐释源流(如汉儒美刺说与今人从抒情角度读的分歧),如实呈现分歧、不强行统一解读、不作现代恋爱/成功学式过度引申。参程俊英《诗经译注》、余冠英《诗经选》、陈子展《诗经直解》、《毛诗正义》。'
    return base + '荀子多长篇论说,直译不缩写不臆补,如实呈现性恶/隆礼重法之说;《成相》弹词、《赋》隐语存其体例。'
  }
  if (u.corpus === 'xin') {
    return '【研习·心学】阳明心学取义理与思想史视角:译文平实直译,致良知/知行合一/心即理/万物一体/格物诚意等名相注疏释之(0–4 条/段、≤40 字、无 ref),延伸讲心学源流(象山—阳明)、与朱子学异同、王门后学,不作现代成功学/心灵鸡汤式发挥。参' + REF.xin + '。《大学问》为问答体,「大人者以天地万物为一体」诸句直译;末「德洪曰」一段为钱德洪后记,如实译并注其为录者跋语。'
  }
  if (u.corpus === 'fo') {
    const base = TIELU_FO + ' 参' + REF.fo + '。'
    if (u.book === 'amituojing') return base + ' 阿弥陀经述极乐依正庄严、持名,照译原文;注疏释名相(舍利弗/阿耨多罗三藐三菩提/极乐等),延伸讲净土思想源流,绝不作往生劝信。'
    if (u.book === 'weimojie') return base + ' 维摩诘经为大乘居士说法,演不二法门、烦恼即菩提、不舍世间而行佛道;译文照译,名相(维摩诘/文殊/声闻/不二法门/芥子须弥等)、人名注疏释之,延伸讲居士佛教与僧肇等注疏源流,守研习不宣化、不下果报断语。'
    if (u.book === 'xinxinming' || u.book === 'zhengdaoge') return base + ' 禅宗偈颂(信心铭四言/证道歌七言长短句)直译其禅理,「至道无难」「绝学无为」等取主流解;延伸讲禅宗源流、一宿觉等典故,不作宗门玄谈、不劝修。'
    return base + ' 遗教经/八大人觉经为佛临终教诫与修学纲目,直译经文;持戒、四大、五阴、少欲等名相注疏释之,延伸讲遗教三经源流。'
  }
  if (u.corpus === 'mingli') {
    const base = TIELU_MINGLI + ' 参' + REF.mingli + '。'
    if (u.book === 'yuanhai') return base + ' 渊海子平多歌诀赋体(四言/七言韵语夹杂散论),译文求**达意**、不为凑韵而硬译或增字删字;十神(比肩/劫财/食神/伤官/偏财/正财/偏官/正官/偏印/正印)、十二长生(长生/沐浴/冠带/临官/帝旺/衰/病/死/墓/绝/胎/养)等术语注疏释之。'
    if (u.book === 'zhenquan') return base + ' **底本说明:本站真诠已据三种白文本逐段对校,剔除了民国徐乐吾《评注》一系增益的文字——包括著名的「取用之法约略归纳为五种:扶抑、病药、调候、专旺、通关」一段、「旺衰强弱四字……党众为强,助寡为弱」一段与书末「附论杂格取运」整篇。这些都不是沈孝瞻的话:注疏与延伸里不得把它们当作沈氏原文来引述或据以立论;如需提及,只能如实说「此为后世评注本所增,不见于白文本」。** 子平真诠为论说体(设问自答、层层递进),译文取议论文笔调、逻辑连词(何谓/盖/然/是故)照译不省;格局/用神/相神/月令等术语前后统一译法,不同章节不得改换译语。全书数十篇命造实例(如「甲午、乙酉、丙戌、丁亥」+ 具体人物或宦称)属沈孝瞻原文举证,照译;不得引入徐乐吾等后人评注例证。'
    if (u.book === 'ditiansui') return base + ' 滴天髓阐微逐章分四类段落:①原文纲领(简短韵语,如「欲识三元万法宗」)②原注(旧题刘基注,以「原注：」开头)③任氏曰(任铁樵阐发,以「任氏曰：」开头)④命例——命例已由管线结构化合并为单独一段(kind:"mingli",original 为四柱与大运干支以空格相连、pillars/dayun 为结构化字段),**该类段的 translations 对应位置留空字符串""(不译、不注)**,真正需要译注延的是命例段之后紧跟的那段分析文字(任氏就该命例的议论)。十干十二支、十神、通根、清浊、真假、中和等术语注疏释之。'
    if (u.book === 'sanming') return base + ' 《三命通会》为明万民英所辑类书,十二卷,体例驳杂:卷一至卷三论五行干支纳音与神煞,卷四至卷六论十干十二月与格局,卷七论女命六亲等,卷八卷九为「六十日 × 十二时」逐条断语(每段以「某某日某某时」起首,断语照译,不加评判),卷十至卷十二收录歌赋(消息赋、玉井奥诀等,韵语求达意)。万氏多引旧说而后下按语,译文须分清「引旧说」与「万氏自己的话」。延伸讲这一篇在全书中的位置、所采旧说的来历、与站内他书(渊海子平/子平真诠/滴天髓阐微/穷通宝鉴)的异同;本书是类书,**延伸每篇 1 段即可(80–140 字)**,短篇可更短。'
    if (u.book === 'wuxingdayi') return base + ' 《五行大义》隋萧吉撰,汇集先秦两汉五行说,广引经传纬书(许多所引之书今已亡佚),是五行干支学说的渊薮而**非命书**——不谈个人禄命。译文须分清萧吉自己的话与他引的书;所引佚书只据上下文作解,不臆补。延伸讲该篇所论在五行学说史上的位置及其与后世命书术语的渊源。'
    if (u.book === 'lixuzhong') return base + ' 《李虚中命书》旧题鬼谷子撰、唐李虚中注,四库馆臣已疑其依托,今多认为出宋人之手。体例为正文(简古韵语)与注文相间。其法以年为主、重纳音与禄马贵人,与子平法以日为主不同——注疏与延伸须点明这一区别,不要用子平术语硬套。'
    if (u.book === 'luoluzi') return base + ' 《珞琭子三命消息赋》撰人不详,本站取宋徐子平注本:赋文一行、注文一行相间。赋为骈俪韵语,译文求达意;注文照译。此赋是早期禄命术的纲领性文献,以年为主,延伸可讲其与后世子平法的承转。'
    if (u.book === 'yuzhao') return base + ' 《玉照定真经》旧题晋郭璞撰、张颙注,依托之书,经注疑出一手。经文为极简的断语式短句,其下为注;多以卦象、神煞、纳音立说。断语照译不评;延伸讲其术语来历与在禄命术史上的位置,真伪如实交代。'
    if (u.book === 'qiongtong') return base + ' 穷通宝鉴以「五行总论」开篇,其后十干各章内有「三春甲木总论」「三春甲木」等小节题行(原书自身的小标题,不是维基文库或本站另加的)——**这类小节题行段的 translations 对应位置留空字符串""(不译、不注)**,真正的译文从其后的正文句开始;书中命例已由管线结构化为单独一段(original 形如「丙午 庚寅 丙午 庚寅」四个干支以空格相连,即年月日时四柱),**命例段同样留空字符串""**,其后紧跟的短案语(如「两间不杂，按察」「庚运夺魁」)是原书对该命例的评语,须照译;**译文数组必须与原文段一一对位——交稿前逐段核对:第 i 条译文译的必须是第 i 段原文,留空的位置不得被后文顶上**;调候用神的「先用某,次用某」表述须严格按原文次序译准(先取谁调候、次取谁辅佐,顺序不可颠倒或省略),十干喜某忌某的判断照译不改写为判断句之外的语气。'
    return base
  }
  if (u.corpus === 'dao') {
    const base = TIELU_DAO + ' 参' + REF.dao + '。'
    if (u.book === 'liezi') return base + ' 列子今本经晋张湛辑注、杂魏晋玄佛语,延伸宜如实标真伪存疑;寓言(愚公移山/杞人忧天/纪昌学射/薛谭学讴等)译文存名、注疏点其旨。'
    if (u.book === 'wenzi') return base + ' 文子(通玄真经)为黄老道家,多「老子曰」演申道德之旨,直译其说;道/德/无为/精诚等概念注疏释之,延伸讲黄老源流、与《老子》《淮南子》之关系,今本真伪(旧疑伪托、1973 定州汉简证有古本而今本多异)如实点出。'
    if (u.book === 'huangting') return base + ' 黄庭内景经为上清派七言韵语存思养生经,丹道隐语(黄庭/三宫/三部八景/泥丸/丹田/脏神名)平实直译取字面义;注疏释名物术语,延伸讲存思养生学说与上清派源流,不演工法、不下成仙断语。'
    if (u.book === 'wuzhenpian') return base + ' 悟真篇以七律/绝句/词寓性命双修之理于丹道隐语意象(龙虎/铅汞/婴儿姹女/黄婆/坎离/刀圭等,实喻身中阴阳精气,非实指外物或炼丹操作物质);译文平实直译字面意象,不展开破译其「真实所指」、不代为演绎内丹步骤;隐语术语注疏释其字面义与丹道语境泛称、不详解修炼法;第一章(悟真篇序)、末章(读周易参同契)为散文/长篇韵文,直译;中间四组诗词各首独立,延伸讲张伯端生平、丹经源流(与参同契并称丹经之祖)、南宗内丹学影响,不演内丹工法、不下成仙断语。参翁葆光《悟真篇注疏》、《悟真篇集释》、陈致虚《悟真篇三注》。'
    return base + ' 庄子外杂篇以寓言、论辩为主,直译不缩写不臆补,以郭象注、成玄英疏为主流参照;论辩段(秋水/天下等)存其思理结构,《天下》评诸家如实直译。'
  }
  const base = TIELU + ' 参' + REF[u.corpus] + '。'
  if (u.corpus === 'fa') return base + ' 法/术/势、刑名、耕战等术语注疏释之;寓言(守株待兔、自相矛盾等)译文存名、注疏点出处。'
  if (u.corpus === 'mo') return base + ' 兼爱/非攻/尚贤/天志取主流解;《经》《经说》《大取》《小取》近名辩,直译保其论证结构,不臆补;墨家科技(光学/力学/几何)条目注疏点明不演绎。'
  if (u.corpus === 'bing') return base + ' 形/势/虚实/奇正等兵学概念注疏释之,不演绎现代战例、不作权谋鸡汤。'
  return base + ' 捭阖/反应/内揵等术语译文取主流一解、注疏可「一说」备异。'
}

function translatePrompt(u) {
  const len = u.end - u.start + 1
  const rangeDesc = u.parts
    ? ('**这是一个合包:下面连排了 ' + u.parts.length + ' 篇短文,以「〔第 k 篇:《篇名》,共 n 段〕」分界(分界行不是原文、不占下标)。** 合计 ' + len + ' 段全译,方括号里是包内连续下标:translations[i] 对应下标 i 的那一段,跨篇照排、不要因为换篇而重新从 0 数。')
    : u.start === 0 && len > 0
    ? ('本章共 ' + len + ' 段全译:translations[i] 对应原文第 i 段。')
    : ('本片段只译 paragraphs 数组里**从 0 数起**下标 ' + u.start + ' 到 ' + u.end + ' 的段(共 ' + len + ' 段):translations[0] 对应 paragraphs[' + u.start + '],依次类推。**对位锚:paragraphs[' + u.start + '] 以「' + u.head + '」开头,paragraphs[' + u.end + '] 以「' + u.tail + '」开头——动笔前先核对这两段,translations 的第一条译的必须是前者、最后一条译的必须是后者。**')
  return '你在为古籍研习站做《' + CN[u.book] + '·' + u.title + '》的白话译注。' + styleRule(u) + '\\n\\n' +
    '**要译的原文已为你取好,见下(方括号里是它在本章 paragraphs 数组中的 0 起下标);不必去读数据文件——那个文件很大,读它是浪费。**' + rangeDesc + '\\n<原文>\\n' + u.paras + '\\n</原文>\\n(方括号下标与〔命例段…〕标记不是原文,term/punctuated 里不要带上。)\\n\\n' +
    (u.punct ? ('**本书底本是四库白文,一个标点都没有。** 先断句:\\n0) punctuated:数组,长度恰为 ' + len + ',与 translations 同序。把每段 original **只加标点、不增不删不改任何一个字**(繁简异体照旧,「□」缺字符照旧,原有的全角空格可去掉);用全角标点(，。；：？！、「」《》)。程序会逐段核对「去标点后与底本逐字相等」,不等的段整段作废——所以**务必逐字照抄,宁可少断不可错字**;很长的段尤其要当心漏字。kind 为 mingli 的命例段与纯干支行原样照抄即可。译文与注疏都据你的断句本来作;**zhushi 的 term 须是你 punctuated 对应段的精确连续子串**(尽量取不跨标点的词)。\\n') : '') +
    '按 schema 产出:\\n' +
    '1) translations:数组,长度必须恰为 ' + len + ',与本片段各段下标对应。平实直译、一段对一段;不增义、不删、不合并、不臆解;禁鸡汤/拔高/现代政治影射/权术发挥口吻。\\n' +
    '2) zhushi:对象,key 为**本片段内的相对下标字符串**("0".."' + (len - 1) + '",即 translations 的下标,不是原文绝对下标)。每段挑 0–4 个值得注的词(生僻字、人名地名、典故、名物制度、术语、通假;长词专名优先),{term, reading?, note}。**term 必须是对应段 original 的精确连续子串**;note≤40 汉字,训诂体;不加 ref/链接字段。无可注的段不出 key。\\n' +
    '3) yanyi:' + (u.parts ? ('**数组长度恰为 ' + u.parts.length + ',第 k 条对应第 k 篇**(按上面〔篇〕分界的次序,一篇一段,不可合并、不可漏篇)。每条讲该篇在全书中的位置、所采旧说的来历或与站内他书的异同(参' + REF[u.corpus] + ');60–140 字,极短的篇可更短;守铁律,不空泛说教。') : u.yanyi ? ('1–2 段本章/篇级延伸,讲此篇义理要点、著名文句、相关人物与源流(参' + REF[u.corpus] + ');脱锚分级,守思想史铁律不作现实政治影射/权术发挥,不空泛说教。每段 80–160 字。') : '本片段不出延伸,返回空数组 []。') + '\\n\\n' +
    '只返回结构化结果。'
}

const MOULUE_FAKE_BOOKS = new Set(['luozhijing', 'rongkujian', 'quanmou', 'taohuishu', 'zhixue'])

function verifyPrompt(u, draft) {
  const len = u.end - u.start + 1
  const isFakeMoulue = u.corpus === 'moulue' && MOULUE_FAKE_BOOKS.has(u.book)
  const isRealMoulue = u.corpus === 'moulue' && !MOULUE_FAKE_BOOKS.has(u.book)
  const isShi = u.corpus === 'tangshi' || u.corpus === 'songci' || u.corpus === 'yuanqu'
  const fixT = isShi
    ? '译文里凡属解读(点明情怀、主旨、寓意、艺术效果)的半截一律删去,只留字面直译;典故解释从译文移入注疏;注疏里凡注情感/主旨者删;词牌曲牌首见而未注明「调名,与内容无关」者补注'
    : u.corpus === 'zhongyi' ? '注疏/延伸中删去诊疗指导、方药功效用法用量、病症/疗效断语、养生医嘱'
      : u.corpus === 'mingli' ? '注疏/延伸中删去对命例中人的吉凶评判、任何「你可据此判断自己……」式套用指引、预测性断语(原典自身的断语如「此造必贵」属照译范围,不删)'
        : isFakeMoulue ? '注疏/延伸中删去处世权术教程式发挥、为伪书张目或褒扬其术的措辞,延伸须存真伪批判'
          : isRealMoulue ? '注疏/延伸中删去处世权术施用教程或成功学鸡汤式过度引申的措辞'
            : '删去鸡汤、拔高、现代政治影射、权术/厚黑发挥'
  const fixY = isShi ? '心灵鸡汤/励志格言/人生启示/处世哲理发挥、把生平当诗意唯一解、把传说当史实(相传者须标「相传」)'
    : u.corpus === 'zhongyi' ? '诊疗医嘱/功效宣称'
      : u.corpus === 'mingli' ? '教读者拿去断命的套用指引、预测性断语'
        : isFakeMoulue ? '处世权术教程或为伪书张目之辞'
          : isRealMoulue ? '权术施用教程或成功学鸡汤式发挥'
            : '现实政治影射'
  return '校对修正《' + CN[u.book] + '·' + u.title + '》(原文第 ' + u.start + '–' + u.end + ' 段)译注草稿,返回修正后完整结构。' + styleRule(u) + '\\n\\n' +
    '原文如下(已取好,**不必去读数据文件**;方括号里是 0 起下标):\\n<原文>\\n' + u.paras + '\\n</原文>\\n\\n草稿:\\n' + JSON.stringify(draft) + '\\n\\n' +
    '**先核对位**:translations[0] 译的必须是 paragraphs[' + u.start + '](以「' + u.head + '」开头),最后一条译的必须是 paragraphs[' + u.end + '](以「' + u.tail + '」开头);若草稿整体错开了一段,先整体挪回来、补上缺的那一段,再做其余校对。\\n' +
    '逐项改正后按 schema 返回:\\n' +
    (u.punct ? ('- punctuated:长度恰为 ' + len + ';逐段核对**去掉标点与空白后与 original 逐字相等**(可写一小段脚本核:读 json 取该段 original,两边都删去标点空白后比较),有增删改字的改回;断句有误(破句、误属上下)的改正;term 须是 punctuated 对应段的精确子串。\\n') : '') +
    '- translations 长度必须恰为 ' + len + ',与第 ' + u.start + '.. 段逐一对齐;漏译/臆增/错解/把注混入译文者改正;' + fixT + ';口吻平实。\\n' +
    '- zhushi:key 为片段内相对下标("0".."' + (len - 1) + '");每条 term 必须是对应段 original 的精确子串,否则删或改;note≤40;删 ref/链接;每段≤4 条。\\n' +
    (u.parts ? ('- **这是合包(' + u.parts.length + ' 篇连排,〔第 k 篇…〕分界行不是原文)**:下标在包内连续编号;逐篇核对译文没有因换篇而错位——每篇首段的译文必须对得上该篇首段。\\n') : '') +
    '- yanyi:' + (u.parts ? ('数组长度恰为 ' + u.parts.length + ',第 k 条对应第 k 篇,缺的补、多的删、错配的挪回;删空泛说教与' + fixY + '。') : u.yanyi ? ('保持 1–2 段,删空泛说教与' + fixY + ',确保实质、出处可靠。') : '空数组 []。') + '\\n\\n' +
    '只返回修正后的结构化结果。'
}

phase('Translate')
const results = await pipeline(
  UNITS,
  (u) => agent(translatePrompt(u), { label: '译:' + CN[u.book] + '·' + u.title + '#' + u.start, phase: 'Translate', schema: SCHEMA${MODEL_T ? `, model: '${MODEL_T}'` : ''} }),
  (draft, u) => {
    if (!draft) return { ...u, data: null }
    return agent(verifyPrompt(u, draft), { label: '校:' + CN[u.book] + '·' + u.title + '#' + u.start, phase: 'Verify', schema: SCHEMA${MODEL_V ? `, model: '${MODEL_V}'` : ''} })
      .then((v) => ({ ...u, data: v || draft }))
  },
)
const ok = results.filter(Boolean)
log('完成 ' + ok.filter((r) => r.data).length + '/' + UNITS.length + ' 单元')
// 合包拆回逐篇单元(装配器只认普通单元);译文条数对不上的包整包作废(data:null),之后按篇单跑补齐。
const flat = []
for (const r of ok) {
  if (!r.parts) { flat.push(r); continue }
  const d = r.data
  const good = d && Array.isArray(d.translations) && d.translations.length === r.end + 1
    && (!d.punctuated || d.punctuated.length === r.end + 1)
  if (!good) log('合包作废(条数不符):' + r.title)
  let o = 0
  r.parts.forEach((p, k) => {
    const base = { corpus: r.corpus, book: r.book, no: p.no, title: p.title, start: 0, end: p.n - 1, yanyi: true, punct: r.punct }
    if (!good) { flat.push({ ...base, data: null }); o += p.n; return }
    const z = {}
    for (const [key, arr] of Object.entries(d.zhushi || {})) { const i = Number(key); if (i >= o && i < o + p.n) z[String(i - o)] = arr }
    const data = { translations: d.translations.slice(o, o + p.n), zhushi: z,
      yanyi: Array.isArray(d.yanyi) && d.yanyi.length === r.parts.length && d.yanyi[k] ? [d.yanyi[k]] : [] }
    if (d.punctuated) data.punctuated = d.punctuated.slice(o, o + p.n)
    flat.push({ ...base, data })
    o += p.n
  })
}
return flat
`

const outName = `scripts/.${ONLY || 'zhuzi'}-translate-wf.js`
fs.writeFileSync(path.join(ROOT, outName), script)
console.log(`生成 ${units.length} 单元 → ${outName}`)
const byCorpus = {}
for (const u of units) byCorpus[u.corpus] = (byCorpus[u.corpus] || 0) + 1
console.log('单元分布:', JSON.stringify(byCorpus))
