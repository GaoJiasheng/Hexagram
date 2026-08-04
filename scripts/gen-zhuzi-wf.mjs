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
]
const ONLY = process.argv[2]          // 可选:只为某 slug 或某 corpus 生成(逗号可多选,如 liutao,jinkui)
const ONLY_SET = ONLY ? new Set(ONLY.split(',')) : null
const SEL = ONLY_SET ? BOOKS.filter(([c, s]) => ONLY_SET.has(s) || ONLY_SET.has(c)) : BOOKS
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

const CN = { hanfeizi: '韩非子', shangjunshu: '商君书', shenzi: '慎子', yinwenzi: '尹文子', wenzi: '文子', mozi: '墨子', sunzi: '孙子兵法', wuzi: '吴子', simafa: '司马法', weiliaozi: '尉缭子', sanlue: '三略', guiguzi: '鬼谷子', zhanguoce: '战国策', suwen: '黄帝内经·素问', lingshu: '黄帝内经·灵枢', shanghanlun: '伤寒论', bencaojing: '神农本草经', luozhijing: '罗织经', rongkujian: '小人经', quanmou: '权谋术', taohuishu: '韬晦术', zhixue: '止学', liutao: '六韬', jinkui: '金匮要略', nanjing: '难经', 'zhuangzi-waipian': '庄子外篇', 'zhuangzi-zapian': '庄子杂篇', liezi: '列子', yijiaojing: '佛遗教经', badaren: '八大人觉经', amituojing: '阿弥陀经', xinxinming: '信心铭', zhengdaoge: '永嘉证道歌', daxuewen: '大学问', xunzi: '荀子', yanshi: '颜氏家训', jinsilu: '近思录', weimojie: '维摩诘经', huangting: '黄庭内景经', shijing: '诗经', wuzhenpian: '悟真篇',
  changduanjing: '长短经', caigentan: '菜根谭', weiluyehua: '围炉夜话', xiaochuangyouji: '小窗幽记', weigongwendui: '李卫公问对',
  tangshi300: '唐诗三百首', songci300: '宋词三百首', yuanqu: '元曲选' }
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
    return base + ' 元散曲一首即一章,章题为「宫调·曲牌·题目」。**曲牌同样是格律调名、与内容无关**'
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

const MOULUE_FAKE_BOOKS = new Set(['luozhijing', 'rongkujian', 'quanmou', 'taohuishu', 'zhixue'])

function verifyPrompt(u, draft) {
  const len = u.end - u.start + 1
  const isFakeMoulue = u.corpus === 'moulue' && MOULUE_FAKE_BOOKS.has(u.book)
  const isRealMoulue = u.corpus === 'moulue' && !MOULUE_FAKE_BOOKS.has(u.book)
  const isShi = u.corpus === 'tangshi' || u.corpus === 'songci' || u.corpus === 'yuanqu'
  const fixT = isShi
    ? '译文里凡属解读(点明情怀、主旨、寓意、艺术效果)的半截一律删去,只留字面直译;典故解释从译文移入注疏;注疏里凡注情感/主旨者删;词牌曲牌首见而未注明「调名,与内容无关」者补注'
    : u.corpus === 'zhongyi' ? '注疏/延伸中删去诊疗指导、方药功效用法用量、病症/疗效断语、养生医嘱'
      : isFakeMoulue ? '注疏/延伸中删去处世权术教程式发挥、为伪书张目或褒扬其术的措辞,延伸须存真伪批判'
        : isRealMoulue ? '注疏/延伸中删去处世权术施用教程或成功学鸡汤式过度引申的措辞'
          : '删去鸡汤、拔高、现代政治影射、权术/厚黑发挥'
  const fixY = isShi ? '心灵鸡汤/励志格言/人生启示/处世哲理发挥、把生平当诗意唯一解、把传说当史实(相传者须标「相传」)'
    : u.corpus === 'zhongyi' ? '诊疗医嘱/功效宣称'
      : isFakeMoulue ? '处世权术教程或为伪书张目之辞'
        : isRealMoulue ? '权术施用教程或成功学鸡汤式发挥'
          : '现实政治影射'
  return '校对修正《' + CN[u.book] + '·' + u.title + '》(原文第 ' + u.start + '–' + u.end + ' 段)译注草稿,返回修正后完整结构。' + styleRule(u) + '\\n\\n' +
    '先 Read ' + FILE(u.corpus, u.book) + ' 中 no===' + u.no + ' 的章,核对其第 ' + u.start + '..' + u.end + ' 段。草稿:\\n' + JSON.stringify(draft) + '\\n\\n' +
    '逐项改正后按 schema 返回:\\n' +
    '- translations 长度必须恰为 ' + len + ',与第 ' + u.start + '.. 段逐一对齐;漏译/臆增/错解/把注混入译文者改正;' + fixT + ';口吻平实。\\n' +
    '- zhushi:key 为片段内相对下标("0".."' + (len - 1) + '");每条 term 必须是对应段 original 的精确子串,否则删或改;note≤40;删 ref/链接;每段≤4 条。\\n' +
    '- yanyi:' + (u.yanyi ? ('保持 1–2 段,删空泛说教与' + fixY + ',确保实质、出处可靠。') : '空数组 []。') + '\\n\\n' +
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
