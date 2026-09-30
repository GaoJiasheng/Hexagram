// 《孟子》问答人物索引(design-v24 §14,论语版 §2 的推广)。
// 从站内原文 src/data/ru/classics/mengzi.json **派生** → src/data/ru/mengzi-people.json。
//   node scripts/gen-mengzi-people.mjs
// 人名表人工列一次:与孟子对话的国君、弟子、论敌,以及书中屡引的孔门中人;出场由 scripts/lib/people-index.mjs 逐段 grep,
// 每个 hit 附命中片段(evidence)可回查;0 命中的人自动从表里删。
// 《孟子》里的人几乎都以全称出现(万章问曰、公孙丑问曰),单称只收几个原文确有且不歧义的(章子=匡章、子敖=王驩、徐子=徐辟、
// 许子=许行、夷子=夷之、陈子=陈臻);「王」「文公」「穆公」一类单称各章所指不同,不计。
// note 一句:只写本书所载与旧注(赵岐注、朱熹集注)的通行说法,存疑处写「旧注谓」;思想史视角,不作现代借用。
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deriveIndex, matchPersonIn } from './lib/people-index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const SRC = 'src/data/ru/classics/mengzi.json'
export const OUT = 'src/data/ru/mengzi-people.json'

export const PEOPLE = [
  // ── 国君 ──
  { id: 'lianghuiwang', name: '梁惠王', full: ['梁惠王'], note: '魏惠王,迁都大梁故称梁;孟子见之在其晚年,「叟！不远千里而来」一问开卷,篇以其名。' },
  { id: 'liangxiangwang', name: '梁襄王', full: ['梁襄王'], note: '惠王之子;孟子见之出而语人「望之不似人君」,答其「天下恶乎定」曰「定于一」。' },
  { id: 'qixuanwang', name: '齐宣王', full: ['齐宣王', '宣王'], note: '田氏齐君,书中与孟子对话最多的国君;问齐桓晋文之事,孟子以「保民而王」答之,又论「以羊易牛」、明堂、汤放桀武王伐纣。' },
  { id: 'tengwengong', name: '滕文公', full: ['滕文公'], note: '滕国之君;为世子时过宋见孟子,孟子「道性善,言必称尧舜」;即位后问为国、行三年之丧、问井地,篇以其名。' },
  { id: 'zoumugong', name: '邹穆公', full: ['邹穆公'], extra: [{ phrase: '穆公问曰', term: '穆公' }], note: '邹君;与鲁战,「有司死者三十三人而民莫之死」,问孟子当如何,孟子以「出乎尔者,反乎尔者」答之。' },
  { id: 'lupinggong', name: '鲁平公', full: ['鲁平公'], note: '鲁君;将出见孟子,为嬖人臧仓所沮而止,孟子谓「吾之不遇鲁侯,天也」。' },
  // ── 弟子 ──
  { id: 'gongsunchou', name: '公孙丑', full: ['公孙丑'], note: '齐人,孟子弟子;问「不动心」与「浩然之气」,又问伯夷伊尹孔子之异,篇以其名。' },
  { id: 'wanzhang', name: '万章', full: ['万章'], note: '孟子弟子;问舜、伊尹、孔子、百里奚诸事与士之交际、不见诸侯之义,篇以其名。旧说孟子「退而与万章之徒序《诗》《书》」。' },
  { id: 'gongduzi', name: '公都子', full: ['公都子'], note: '孟子弟子;转述「外人皆称夫子好辩」,又举告子「性无善无不善」诸说问性善,孟子「乃若其情,则可以为善」一段由此而发。' },
  { id: 'chenzhen', name: '陈臻', full: ['陈臻', '陈子'], note: '孟子弟子;问齐馈金不受而宋、薛受之何故,又以时子之言转告孟子。旧注谓「陈子」即陈臻。' },
  { id: 'chongyu', name: '充虞', full: ['充虞'], note: '孟子弟子;问葬母之棺「若以美然」,又问「夫子若有不豫色然」,孟子答以「五百年必有王者兴」。' },
  { id: 'yuezhengzi', name: '乐正子', full: ['乐正子', '乐正克'], note: '乐正克,孟子弟子,仕于鲁;从子敖之齐见孟子被责;鲁欲使为政,孟子「喜而不寐」,许其「善人也,信人也」。' },
  { id: 'xupi', name: '徐辟', full: ['徐辟', '徐子'], note: '孟子弟子;墨者夷之因他求见孟子,由他往返传话;又问「仲尼亟称于水」何取。旧注谓「徐子」即徐辟。' },
  { id: 'wulüzi', name: '屋庐子', full: ['屋庐子'], note: '孟子弟子;任人问「礼与食孰重」,他不能对,转问孟子;又与任人论季子、储子之交。' },
  { id: 'xianqiumeng', name: '咸丘蒙', full: ['咸丘蒙'], note: '孟子弟子;问舜为天子而瞽瞍北面朝之事,孟子以「说《诗》者不以文害辞,不以辞害志」答之。' },
  { id: 'pengeng', name: '彭更', full: ['彭更'], note: '孟子弟子;问「后车数十乘,从者数百人,以传食于诸侯,不以泰乎」,孟子答以「食功」与「食志」。' },
  { id: 'chendai', name: '陈代', full: ['陈代'], note: '孟子弟子;劝孟子「枉尺而直寻」以见诸侯,孟子以王良、嬖奚之事答之,「枉己者,未有能直人者也」。' },
  { id: 'taoying', name: '桃应', full: ['桃应'], note: '孟子弟子;设问「舜为天子,皋陶为士,瞽瞍杀人,则如之何」,孟子答以「窃负而逃」。' },
  { id: 'gaozi2', name: '高子', full: ['高子'], note: '论《小弁》为「小人之诗」,孟子谓其「固哉」;又「齐人蹶泄」一章孟子以山径之蹊喻其心为茅塞。旧注谓齐人,孟子弟子。' },
  { id: 'gongminggao', name: '公明高', full: ['公明高'], note: '旧注谓曾子弟子;万章问舜往于田号泣,孟子引「公明高曰」及长息问公明高之事。' },
  // ── 论敌与游士 ──
  { id: 'gaozi', name: '告子', full: ['告子'], note: '与孟子论性者;主「生之谓性」「性犹湍水」「食色,性也」「仁内义外」,孟子逐条驳之,篇以其名。又孟子自言「告子先我不动心」。' },
  { id: 'xuxing', name: '许行', full: ['许行', '许子'], note: '「为神农之言者」,自楚之滕,主贤者与民并耕而食;孟子以「劳心者治人,劳力者治于人」驳陈相之述。' },
  { id: 'chenxiang', name: '陈相', full: ['陈相'], note: '陈良之徒,与其弟陈辛负耒耜自宋之滕,见许行而弃所学学之;孟子责其「师死而遂倍之」。' },
  { id: 'yizhi', name: '夷之', full: ['夷之', '夷子'], note: '墨者;因徐辟求见孟子,主「爱无差等,施由亲始」,孟子以「天之生物也,使之一本」难之。' },
  { id: 'chunyukun', name: '淳于髡', full: ['淳于髡'], note: '齐辩士;问「男女授受不亲,礼与」、「嫂溺则援之以手」,又以「名实」讥孟子去齐。' },
  { id: 'jingchun', name: '景春', full: ['景春'], note: '旧注谓纵横家言者;称公孙衍、张仪「一怒而诸侯惧」为大丈夫,孟子以「富贵不能淫,贫贱不能移,威武不能屈」正之。' },
  { id: 'baigui', name: '白圭', full: ['白圭'], note: '主「二十而取一」,孟子谓「貉道也」;又自言「丹之治水也愈于禹」,孟子以「以邻国为壑」责之。' },
  { id: 'songkeng', name: '宋牼', full: ['宋牼'], note: '将之楚,欲说秦楚罢兵;孟子在石丘遇之,问其「以利说」,谓「先生之志则大矣,先生之号则不可」。' },
  { id: 'shenzi', name: '慎子', full: ['慎子'], note: '鲁将,鲁欲使之取南阳;孟子责其「不教民而用之,谓之殃民」,慎子「勃然不悦」。' },
  { id: 'caojiao', name: '曹交', full: ['曹交'], note: '曹君之弟;问「人皆可以为尧舜,有诸」,孟子答以「徐行后长者谓之弟」,勉其「归而求之,有余师」。' },
  { id: 'mengjizi', name: '孟季子', full: ['孟季子'], note: '问公都子「何以谓义内也」,公都子不能答而问孟子,「敬叔父」「敬弟」之辨由此而来。' },
  { id: 'kuangzhang', name: '匡章', full: ['匡章', '章子'], note: '齐人,「通国皆称不孝」;孟子与之游而礼貌之,论「世俗所谓不孝者五」,谓章子「父子责善而不相遇」。' },
  { id: 'zhouxiao', name: '周霄', full: ['周霄'], note: '魏人;问「古之君子仕乎」「君子之难仕,何也」,孟子以「士之失位也,犹诸侯之失国家也」答之。' },
  { id: 'daibusheng', name: '戴不胜', full: ['戴不胜'], note: '宋臣;孟子问其「欲子之王之善与」,以「一齐人傅之,众楚人咻之」为喻。' },
  { id: 'daiyingzhi', name: '戴盈之', full: ['戴盈之'], note: '宋大夫;言什一之税与去关市之征「今兹未能,请轻之,以待来年」,孟子以「日攘其邻之鸡」喻之。' },
  { id: 'jingzi', name: '景子', full: ['景丑氏', '景子'], note: '景丑氏;孟子不朝齐王而出吊于东郭氏,宿于景丑氏,景子以「内则父子,外则君臣」责之,孟子答以「天下有达尊三」。' },
  { id: 'wanghuan', name: '王驩', full: ['王驩', '子敖'], note: '字子敖,齐王嬖臣;为辅行使于滕,孟子「未尝与之言行事」;又右师之吊,孟子不与之言,答以「我欲行礼,子敖以我为简」。' },
  { id: 'chenjia', name: '陈贾', full: ['陈贾'], note: '齐大夫;齐伐燕后为齐王解「周公使管叔监殷」之过,孟子讥「今之君子,过则顺之」。' },
  { id: 'chuzi', name: '储子', full: ['储子'], note: '齐人;为齐王瞷孟子「有以异于人乎」;又为相而未至邹见孟子。' },
  { id: 'shentong', name: '沈同', full: ['沈同'], note: '齐臣;以私问「燕可伐与」,孟子曰「可」,后齐伐燕,或问「劝齐伐燕,有诸」,孟子辩之。' },
  { id: 'tenggeng', name: '滕更', full: ['滕更'], note: '滕君之弟;在门而不答,公都子问其故,孟子举「挟贵」「挟贤」等「五者不答」。' },
  { id: 'moji', name: '貉稽', full: ['貉稽'], note: '自言「稽大不理于口」,孟子以「无伤也,士憎兹多口」慰之,引《诗》「肆不殄厥愠」。' },
  { id: 'haoshengbuhai', name: '浩生不害', full: ['浩生不害'], note: '齐人;问「乐正子何人也」,孟子答以「善人也,信人也」,并出「善、信、美、大、圣、神」六等之目。' },
  { id: 'penchengkuo', name: '盆成括', full: ['盆成括'], note: '仕于齐,孟子闻之曰「死矣盆成括」,谓其「小有才,未闻君子之大道」。' },
  // ── 屡引的孔门中人与先贤 ──
  { id: 'kongzi', name: '孔子', full: ['孔子', '仲尼'], note: '书中引称最多之先师;孟子自言「乃所愿,则学孔子也」,谓「自有生民以来,未有孔子也」。' },
  { id: 'zengzi', name: '曾子', full: ['曾子'], note: '孔子弟子曾参;孟子引其「自反而缩,虽千万人吾往矣」,又记其养曾皙「必有酒肉」之事。' },
  { id: 'zisi', name: '子思', full: ['子思'], note: '孔子之孙;书中记其居于卫、鲁缪公之事,旧说孟子受业于子思之门人。' },
  { id: 'zigong', name: '子贡', full: ['子贡'], note: '孔子弟子;孟子引其「见其礼而知其政,闻其乐而知其德」,又记孔子没后子贡庐墓六年。' },
  { id: 'zilu', name: '子路', full: ['子路'], note: '孔子弟子;孟子谓「子路人告之以有过则喜」。' },
  { id: 'yanyuan', name: '颜渊', full: ['颜渊', '颜回', '颜子'], note: '孔子弟子;孟子谓「颜渊曰:舜何人也,予何人也,有为者亦若是」,又以禹、稷、颜回「同道」。' },
  { id: 'yiyin', name: '伊尹', full: ['伊尹'], note: '汤之相;孟子屡称之为「圣之任者」,记其「以尧舜之道要汤」、放太甲于桐等事,辨其非「割烹要汤」。' },
  { id: 'boyi', name: '伯夷', full: ['伯夷'], note: '孟子称之为「圣之清者」,谓「目不视恶色,耳不听恶声」,与伊尹、柳下惠、孔子并论。' },
  { id: 'liuxiahui', name: '柳下惠', full: ['柳下惠'], note: '孟子称之为「圣之和者」,「不羞污君,不辞小官」,与伯夷并论「隘与不恭,君子不由也」。' },
]

// 人工排除表:命中落在这些片段之内即作废。
// 排除表:《孟子》人名全称无歧义,暂无需排除;有了再加(phrase 须为原文实有字样,闸会查)
export const EXCLUDE = []
export const SKIP_PARA = []
// 单称不走呼格正则(《孟子》人物几乎全用全称;邹穆公只以「穆公问曰」出场,列在 extra),vocativeNext 留空集
export const VOCATIVE_NEXT = ''

const CFG = { PEOPLE, EXCLUDE, SKIP_PARA, vocativeNext: VOCATIVE_NEXT, book: 'mengzi', src: SRC }
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
    console.log(`  ${p.name.padEnd(5, '　')} ${String(p.pian).padStart(2)} 篇 ${String(p.hits.length).padStart(3)} 段  称谓:${[p.name, ...p.aliases].join('/')}`)
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main()
