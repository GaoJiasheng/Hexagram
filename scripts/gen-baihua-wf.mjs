// 生成「白话模块」并发 workflow 脚本(design-v22 §5 / A4)。
// 用法: node scripts/gen-baihua-wf.mjs <corpus> <slug> [chFrom] [chTo]
//   读 src/data/<corpus>/classics/<slug>.json,为 [chFrom,chTo] 各章建一个单元;
//   产出 scripts/.baihua-<corpus>-<slug>-wf.js,再用 Workflow({scriptPath}) 跑;
//   workflow 输出单元 shape {corpus, book, no, featured, data} 交 assemble-baihua.mjs 装配。
// 流水:起草 agent(读真原文,按白话规范成文 + 内联 SVG 图) → 校对 agent(核引文逐字/红线/篇幅/图色)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const corpus = process.argv[2]
const slug = process.argv[3]
const chFrom = process.argv[4] ? Number(process.argv[4]) : null
const chTo = process.argv[5] ? Number(process.argv[5]) : null
if (!corpus || !slug) { console.error('用法: node scripts/gen-baihua-wf.mjs <corpus> <slug> [chFrom] [chTo]'); process.exit(1) }

const IS_YIJING = corpus === 'yijing'
const IS_HEX = IS_YIJING && slug === 'hexagrams'   // 64 卦(hexagrams.json,形态特殊),走整卦加厚支线
const IS_JZ = IS_YIJING && slug !== 'hexagrams'    // 经传/十翼(classics/<slug>.json,与 corpus 同构),走经传加厚支线

// 一卦的全部经传原文(供 chars 估算 + 引文子串校验池):卦辞+彖+大象+爻辞+小象+用九六+文言+序卦杂卦
function hexAllOriginal(q) {
  const parts = [q.judgment?.original, q.tuan?.original, q.daxiang?.original]
  for (const l of q.lines || []) { parts.push(l.original, l.xiaoxiang?.original) }
  if (q.extra?.use) { parts.push(q.extra.use.original, q.extra.use.xiaoxiang?.original) }
  for (const w of q.extra?.wenyan || []) parts.push(w.original)
  parts.push(q.xugua, q.zagua)
  return parts.filter(Boolean).join('')
}

let bookTitle, unit, units
if (IS_HEX) {
  bookTitle = '易经'; unit = '卦'
  const hexes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/yijing/hexagrams.json'), 'utf8'))
  const existPath = path.join(ROOT, 'src/data/yijing/baihua/hexagrams.json')
  const done = fs.existsSync(existPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(existPath, 'utf8')))) : new Set()
  units = hexes
    .filter((q) => (chFrom == null || q.id >= chFrom) && (chTo == null || q.id <= chTo))
    .filter((q) => !done.has(String(q.id)))
    .map((q) => ({
      corpus: 'yijing', book: 'hexagrams', no: q.id,
      title: `${q.name}（${q.fullName}）`,
      chars: hexAllOriginal(q).length,
      featured: q.id === 1,            // 乾为全书总纲,给 hero
    }))
} else if (IS_JZ) {
  // 易经经传/十翼:classics/<slug>.json(章/段结构,与 corpus 同构)
  unit = '章'
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/yijing/classics/${slug}.json`), 'utf8'))
  bookTitle = `易经·${book.title}`
  const firstNo = book.chapters[0]?.no
  const existPath = path.join(ROOT, `src/data/yijing/baihua/${slug}.json`)
  const done = fs.existsSync(existPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(existPath, 'utf8')))) : new Set()
  units = book.chapters
    .filter((c) => (chFrom == null || c.no >= chFrom) && (chTo == null || c.no <= chTo))
    .filter((c) => !done.has(String(c.no)))
    .map((c) => ({
      corpus: 'yijing', book: slug, no: c.no,
      title: c.title || `第${c.no}章`,
      chars: c.paragraphs.map((p) => p.original).join('').length,
      featured: slug === 'xici-shang' && c.no === firstNo,   // 系辞上首章 = 十翼义理总纲,给 hero
    }))
} else {
  const texts = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/texts.json`), 'utf8'))
  const meta = texts.find((t) => t.slug === slug)
  if (!meta) { console.error(`texts.json 无 slug=${slug}`); process.exit(1) }
  const book = JSON.parse(fs.readFileSync(path.join(ROOT, `src/data/${corpus}/classics/${slug}.json`), 'utf8'))
  bookTitle = meta.title
  unit = meta.sectionUnit || '章'
  const firstNo = book.chapters[0]?.no
  // 已有白话的章跳过(断点续跑/补缺只生成缺章,不重做)
  const existPath = path.join(ROOT, `src/data/${corpus}/baihua/${slug}.json`)
  const done = fs.existsSync(existPath) ? new Set(Object.keys(JSON.parse(fs.readFileSync(existPath, 'utf8')))) : new Set()
  units = book.chapters
    .filter((c) => (chFrom == null || c.no >= chFrom) && (chTo == null || c.no <= chTo))
    .filter((c) => !done.has(String(c.no)))
    .map((c) => ({
      corpus, book: slug, no: c.no,
      title: c.title || `第${c.no}${unit}`,
      chars: c.paragraphs.map((p) => p.original).join('').length,
      featured: c.no === firstNo,        // 书首章 = 总纲,给 hero
    }))
}
if (!units.length) { console.log(`${bookTitle}:[${chFrom ?? 1}–${chTo ?? '末'}] 该范围已全有白话,无需生成。`); process.exit(0) }

// ── 各组红线(design-v22 §3.6)──
const RED = {
  dao: '【红线·道】讲思想/寓言/源流;不宗教宣化、不下吉凶/福报/成仙断语、不演内丹工法;真伪如实。',
  fo: '【红线·佛】研习不宣化;不下果报/往生劝信断语、不劝皈信;名相作训读。',
  ru: '【红线·儒】思想史视角;不作现代成功学/职场鸡汤。',
  xin: '【红线·心】心学思想;不鸡汤、不成功学。',
  fa: '【红线·法】思想史视角;不作权术教程、不作政治影射。',
  mo: '【红线·墨】思想史视角;不作权术教程、不作政治影射。',
  bing: '【红线·兵】思想史视角;不作权术/兵法实操教程、不作政治影射。',
  zong: '【红线·纵横】思想史视角;不作权术/游说话术教程、不作政治影射。',
  zhongyi: '【红线·中医·最严】研习不诊疗:只作医史/字词训读,绝不教自疗、不述功效用法用量、不下病症/疗效断语;每篇带「⚠ 本文为古籍研习、非医疗建议」。',
  moulue: '【红线·谋略】伪书批判:译白其权术面目,但点真伪、指其偷换史实/泯善恶,绝不为伪书张目、不教施用。',
  yijing: '【红线·易】释卦象义理,不算命;爻辞「吉/凶/悔/吝/厉/无咎」照原典训读其本义(是古人对处境的判语),绝不引申为对今日读者的命运预言、不教占卜趋避、不下宿命断语。象数(错综/卦变/爻位)只讲能从卦象稳妥推出的,纳甲/八宫拿不准宁略不可杜撰。',
}
const FILE = (c, b) => `${ROOT}/src/data/${c}/classics/${b}.json`

const SPEC = [
  '这是为古籍研习站写的「白话」深读 —— **首先是一篇公众号文章,不是逐句翻译作业**。',
  '灵魂:大白话把中心思想讲透 + 人人(下里巴人)跟得上的「脑回路」(把古人的思路翻成现代推理链)+ 接地气的比喻。逐句走读只是其中一环、为中心思想服务,绝不喧宾夺主、不能沦为「一句原文一句翻译」清单。',
  '脊柱(必备,顺序):①导语 hook ②共情入口(一个谁都遇到过的现代瞬间)③立骨架(出处/在全书位置/关键句/生僻字音,复用站内题解/注疏)④逐句走读(穿插,引原文句→大白话→脑回路/比喻讲透,讲不出新意的并讲带过)⑤中心思想贯通(重头戏)⑥落地(1–3 条可用启发,守红线不鸡汤)⑦收束(首尾呼应)⑧原文出处与参考(refs)。',
  '可选纵深层(有料才加,不强凑):源流/版本、注释分野、时代背景、当代回响/跨典互见、比喻系统。',
  '语言:大白话第一;引经据典克制(每条短、为论点服务);脑回路与比喻是魂(抽象处必有比喻落地)。',
  '诚实:引文必须逐字取站内原文(quote.original 须为该章某原文段的精确连续子串);白话与站内译文一致;出处到章;异解如实标分歧不替读者拍板;不杜撰史实。',
].join('\n')

const FIGSPEC = [
  '配图(每章 2–4 张,流程/对比/列举优先,图比文更直观处才出;纯叙述不硬塞):',
  '- 类型 ftype 取:金句卡 / 对比 / 古今义对比 / 结构图 / 列举 / 时间线 等。**金句卡每章必出 1 张**;结构/列举按内容;时间线仅当该章确有版本流变/历史脉络才出(没有就不出,不编造)。',
  '- 一律内联 SVG(不用栅格图):<svg viewBox=... style="width:100%;height:auto;font-family:var(--font-serif)">…;文字/线条颜色一律用 CSS 变量,**只能写 style="fill:var(--ink)" / style="stroke:var(--line)" / style="fill:var(--cinnabar)"(强调)等,绝不写死 #hex 颜色**(否则不随明暗/组色自适应);text-anchor 居中排版;可用 var(--ink-soft)/var(--ink-faint)/var(--paper-raised)。',
  '- 每图配 caption(讲清它在说什么 + 出处)。',
].join('\n')

// ── corpus 加厚档(owner:佛经按易经标准——更厚、更多图、更多生活场景;短章逐句、长章摘录精华)──
const THICK = new Set([])   // 整组走加厚档的 corpus(空:当前无整组加厚;按书加厚见 THICK_BOOKS)
// 按「书」加厚(只某 corpus 里的部分书走加厚,其余书普通档)——owner 2026-06-22:道只道德经、纵横只鬼谷子(战国策选普通档)
const THICK_BOOKS = new Set(['dao/daodejing', 'zong/guiguzi', 'xin/chuanxilu', 'xin/daxuewen', 'fo/xinjing', 'fo/tanjing', 'fo/jingangjing'])
const IS_THICK = THICK.has(corpus) || THICK_BOOKS.has(`${corpus}/${slug}`)
const THICK_EXTRA = [
  '【加厚要求(本书按易经白话标准)】白话占比再提高、讲得更厚:',
  '- 每一处义理都落到一个今人日常场景或实例(通勤/加班/还房贷/带孩子/考试/和人相处/独处…)+ 一个接地气比喻,讲到完全没读过的人也秒懂;共情入口要强。',
  '- 纵深层尽量都铺(源流/版本/比喻系统/当代回响/跨典互见),有料就展开。守本组红线不变。',
].join('\n')
const FIGSPEC_THICK = [
  '配图(本章按加厚标准,每章 5–8 张,远多于常规;图比文直观处就上):',
  '- 金句卡每章必出 1 张;对比/古今义对比/结构图/列举按内容多上;时间线仅当确有版本流变/历史脉络才出(没有不编)。',
  '- 一律内联 SVG:颜色只用 style="fill:var(--ink)"/"stroke:var(--line)"/"fill:var(--cinnabar)" 等 CSS 变量,**绝不写死 #hex**;viewBox + text-anchor 居中 + 每图 caption(讲清+出处)。',
].join('\n')

// ── 易经加厚支线(owner:一卦一厚文 + 三传必含 + 周边关联成网 + 更白更多生活实例,每卦 5–8 图)──
const Y_FILE = `${ROOT}/src/data/yijing/hexagrams.json`
const SPEC_Y = [
  '这是为易经研习站写的整卦「白话」深读 —— **首先是一篇能让小白读懂的公众号文章,不是逐句翻译作业**。',
  '灵魂:大白话把这一卦讲透 + 人人跟得上的「脑回路」(把古人对处境的思路翻成现代推理链)+ 接地气的比喻。',
  '**关键(易经最易写成术语堆砌,务必避免)**:每一处抽象义理(爻位、当位、中正、刚柔、进退、盈亏、应比承乘…)都要落到一个**今人日常的场景或实例**(职场进退、攒钱花钱、熬夜、排队、考试、家庭关系、新人入职、创业守成…)+ 一个**接地气的比喻**,把卦象/爻义讲到「下里巴人也秒懂」。判准:一个没读过易经、不懂阴阳爻的普通人,读完能用大白话复述这一卦在讲什么、并联系到自己生活里的某件事。',
  '语言:大白话第一;术语(初九/中正/应)出现即随手用一句人话解释;比喻是魂(抽象处必有比喻落地)。',
  '诚实:引文必须逐字取站内经传原文(quote.original 须为本卦某段经传原文的精确连续子串);白话与站内译文一致;象数只讲能稳妥推出的,异解如实标分歧;不杜撰史实、不编卦名/纳甲。',
].join('\n')
const FIGSPEC_Y = [
  '配图(每卦 5–8 张,远多于一般章;卦本身可视化潜力大,图比文直观处就上):',
  '- 必出:① **卦画六爻图**(六条爻自下而上:阳爻画一条实心长横、阴爻画中间断开的两段短横,初爻在最下、上爻在最上,爻旁可标爻题如「初九」);② **上下经卦分解**(上卦/下卦各是八经卦之一,标卦名与取象,如 ☰ 乾为天、☷ 坤为地);③ **金句卡**(卦辞或彖传题眼,1 张)。',
  '- 按内容出:④ **爻位身份图**(六爻位置 + 标当位/中正/与谁相应);⑤ **错综/卦变图**(若正文讲了错卦综卦);⑥ **六爻爻义一览**(列举:每爻一句大白话主旨)。涉方位/消息卦才加,拿不准不画。',
  '- 一律内联 SVG:<svg viewBox=... style="width:100%;height:auto;font-family:var(--font-serif)">…;颜色只用 style="fill:var(--ink)"/"stroke:var(--line)"/"fill:var(--cinnabar)"(强调)等 CSS 变量,**绝不写死 #hex**;text-anchor 居中;每图配 caption(讲清它在说什么+出处)。',
].join('\n')
const yijingDraft = (u) => {
  const band = u.no <= 2
    ? '约 9000–14000 字(乾/坤含文言传,须最厚;文言传不可略)'
    : '约 7000–11000 字(一卦一厚文,逐爻铺 + 周边关联;宁详勿凑数)'
  return `你在为「观象」易经研习站写《易经·${u.title}》整卦「白话」深读。${RED.yijing}\n\n` +
    `【取数据 —— 务必逐个 Read/Grep,以站内原文为底】\n` +
    `1. Read ${Y_FILE},找到数组里 id===${u.no} 的那一卦。字段:name/fullName(卦名)、binary(六位,下标0=初爻,自下而上)、upperTrigram/lowerTrigram(上下经卦)、summary/imagery(卦象提要)、judgment(卦辞{original,translation})、tuan(彖传)、daxiang(大象传)、lines[6](六爻,每爻{title如「初九」,original 爻辞,translation,xiaoxiang 小象{original,translation}})、extra.use(乾坤的用九/用六)、extra.wenyan(文言传,仅乾坤有,逐段{original,translation})、xugua(序卦传引文)、zagua(杂卦传引文)、guazhu(卦主{line,note})。\n` +
    `2. 周边关联(有则带、无则略,自然穿插不堆砌、勿编造):\n` +
    `   - 筮例:Grep ${ROOT}/src/data/yijing/shili.json 找提到本卦的左传/国语占筮故事,讲「古人怎么用这一卦」。\n` +
    `   - 史事:Grep ${ROOT}/src/data/yijing/shishi.json 找本卦爻辞背后的商周史事。\n` +
    `   - 错综卦:错卦=六爻阴阳全反、综卦=整体上下颠倒;可在 hexagrams.json 里按 binary 找出对应卦名,点出本卦与哪些卦相反相成(拿不准只讲卦象本身,勿编卦名)。\n` +
    `   - 卦序:用 xugua/zagua 讲此卦为何排在第 ${u.no} 位、与前后卦怎样承接。\n` +
    `   - 成语典故:由本卦/爻生出的成语(确有才写,如乾「飞龙在天/亢龙有悔」、谦「谦谦君子」),勾连今天语用。八宫/纳甲拿不准不要写。\n\n` +
    SPEC_Y + '\n\n' + FIGSPEC_Y + '\n\n' +
    `篇幅:${band}。\n\n按 schema 产出文章:\n` +
    `- title:"白话易经 · ${u.title}";subtitle:一句副题;centralIdea:一句话中心思想。\n` +
    `- blocks 顺序(脊柱):①lead 导语 hook + 共情入口(一个谁都遇到过的现代瞬间)②卦名与卦象(上下两经卦取象 + 大象传「君子以…」修身落点;配卦画六爻图、上下经卦分解图)③卦辞 + 彖传(整卦主旨;配金句卡)④**六爻逐爻走读**——每爻一段:引爻辞(quote)→大白话→该爻小象(quote)怎么补充→爻位身份(初/二/三/四/五/上,当位/中正/应比/承乘,随手用人话解释)→**落到一个今人日常场景或比喻**;用九/用六若有也讲(配爻位身份图、六爻爻义一览图)⑤(仅乾坤)文言传逐节白话,把文言整段织进⑥周边关联(卦序/错综/卦主/筮例/史事/成语,有则带)⑦中心思想贯通(重头戏)⑧落地启发(1–3 条,守不算命红线、不宿命预言)⑨收束首尾呼应⑩refs 出处与参考。\n` +
    `- quote{original,translation}:original 必为本卦经传原文(卦辞/爻辞/彖/大象/小象/用九六/文言/序卦/杂卦)的精确连续子串,translation 与站内译文一致。\n` +
    (u.featured ? `- 这是全书开篇总纲(乾卦):额外给 featured:true 和 hero:{badge:"开篇 · 易之门户",headline:本卦关键句(如「天行健,君子以自强不息」),tagline:一句题词}。\n` : `- **不要**输出 featured 或 hero 字段。\n`) +
    `\n只返回结构化结果。`
}
const yijingVerify = (u, draft) => `校对修正《易经·${u.title}》整卦白话草稿,返回修正后完整结构。${RED.yijing}\n\n` +
  `先 Read ${Y_FILE} 中 id===${u.no} 的卦核对经传原文。草稿:\n${draft}\n\n` +
  `逐项改正:\n- 每个 quote.original 必须是本卦经传原文(卦辞/爻辞/彖/大象/小象/用九六/文言/序卦/杂卦)的精确连续子串,否则改对或删;translation 与站内译文一致。\n` +
  `- 守不算命红线:吉凶悔吝只作古人对处境的判语训读,删去任何「对读者命运的预言/占卜趋避/宿命」措辞;象数(错综/卦变/纳甲/八宫)凡无据或编造一律删。\n` +
  `- 三传齐:确认彖传、大象、每爻小象都讲到了;乾坤须含文言传逐节。六爻须逐爻铺、每爻有现代场景或比喻,不沦为逐字翻译清单。\n` +
  `- 每张 figure 的 svg:颜色只用 var(--…),不得写死 #hex;有 viewBox 与 caption;卦画图阴阳爻按本卦 binary(自下而上)画对。每卦应有 5–8 图。\n` +
  `- 周边关联(卦序/错综/卦主/筮例/史事/成语)有则保留、错则删;末尾保留 refs 块。\n\n只返回修正后的结构化结果。`

// ── 易经经传(十翼)加厚支线:义理散论/取象/卦序,非卦爻;系辞/说卦/序卦/杂卦各配专图 ──
const JZ_FILE = (b) => `${ROOT}/src/data/yijing/classics/${b}.json`
const JZ_FIG = {
  'xici-shang': '系辞上配图:太极生两仪→四象→八卦的衍生树图、大衍之数(大衍之数五十/其用四十有九/分二挂一揲四)推演图、阴阳刚柔对比、「易有圣人之道四焉」(辞变象占)列举、金句卡——按本章内容出 5–8 张。',
  'xici-xia': '系辞下配图:八卦取象造物(结绳→网罟、刳木→舟楫…「制器尚象」)列举图、刚柔相推/阴阳消息结构图、忧患九卦阶梯、金句卡——按本章内容出 5–8 张。',
  'shuogua': '说卦配图:**八卦取象图**(☰乾·天/父、☷坤·地/母、☳震·雷、☴巽·风、☵坎·水、☲离·火、☶艮·山、☱兑·泽——卦符 + 所象之物列举)、**先天(伏羲)八卦方位图**、**后天(文王)八卦方位图**、金句卡——取象章配图要足,5–8 张。',
  'xugua': '序卦配图:**卦序流程图**(本章涉及的若干卦依「物极必反/相因相生」首尾相衔成链,标卦名 + 承接之由)、金句卡——按内容出。',
  'zagua': '杂卦配图:**卦义对比图**(成对卦相反相成,如乾刚坤柔、比乐师忧、临观之义「或与或求」)列举/对照、金句卡——按内容出。',
}
const jzDraft = (u) => {
  const longCh = u.chars >= 1500   // 序卦/杂卦整篇为一章(卦序长链)→分段摘录;系辞/说卦短章→逐句
  const band = longCh
    ? '约 7000–10000 字(加厚·长章:把卦序/卦义按卦群分组,逐组摘关键句深读,不必逐句翻全篇)'
    : '约 6000–9000 字(加厚·短章:全文逐句展开;义理总纲章宁详勿凑)'
  const approach = longCh
    ? '\n\n【本章较长——分段摘录】把本章按卦群/义理**分成几组**,每组挑关键句(quote)深读;次要重复处并讲带过,引文仍须精确子串。'
    : '\n\n【本章较短——全文逐句】**全文逐句展开**:每个原文句子都引(quote)讲透,不漏句。'
  return `你在为「观象」易经研习站写《${bookTitle}·${u.title}》的「白话」整章加厚深读 —— 这是易经「十翼」之经传(义理散论/取象/卦序),不是某一卦的卦爻。${RED.yijing}\n\n` +
    `第一步:用 Read 读 ${JZ_FILE(slug)},找到 chapters 里 no===${u.no} 的那一章(paragraphs 为原文段,每段含 original 与 translation)。以这章原文为底成文。\n` +
    (slug !== 'xici-shang' && slug !== 'xici-xia' ? `如需卦名/卦象/取象/卦序,可 Grep ${Y_FILE} 查证(name/binary/upperTrigram/lowerTrigram/xugua/zagua),八卦符号与卦名务必与原文一致,勿凭记忆编造。\n` : '') +
    `\n${SPEC}\n${THICK_EXTRA}\n\n${FIGSPEC_THICK}\n${JZ_FIG[slug] || ''}${approach}\n\n` +
    `篇幅:${band}。\n\n按 schema 产出文章:\n` +
    `- title:"白话${bookTitle} · ${u.title}";subtitle:一句副题;centralIdea:一句话中心思想。\n` +
    `- blocks:lead/p/h2/quote{original,translation}/figure{ftype,svg,caption}/refs。quote.original 必为该章原文段精确连续子串、translation 与站内译文一致。脊柱顺序铺;走读用 quote+p 穿插;金句卡每章必出;末尾一个 refs 块。\n` +
    (u.featured ? `- 这是系辞开篇(全经传义理总纲):额外给 featured:true 和 hero:{badge:"十翼 · 义理总纲",headline:本章关键句(如「天尊地卑,乾坤定矣」),tagline:一句题词}。\n` : `- 本章非开篇,**不要**输出 featured 或 hero 字段。\n`) +
    `\n只返回结构化结果。`
}
const jzVerify = (u, draft) => `校对修正《${bookTitle}·${u.title}》白话草稿,返回修正后完整结构。${RED.yijing}\n\n` +
  `先 Read ${JZ_FILE(slug)} 中 no===${u.no} 的章核对原文。草稿:\n${draft}\n\n` +
  `逐项改正:\n- 每个 quote.original 必为该章某原文段的精确连续子串,否则改对或删;translation 与站内译文一致。\n` +
  `- 守不算命红线:删去任何对读者命运的预言/占卜趋避/宿命措辞;吉凶悔吝只作古人对处境的判语训读。\n` +
  `- 卦象/八卦符号(☰☷☳☴☵☶☱☲)/方位/卦序如出现于图或文,须与原文及 ${Y_FILE} 一致,无据或编造一律删(可 Grep 查证)。\n` +
  `- 每张 figure 的 svg:颜色只用 var(--…)不写死 #hex;有 viewBox 与 caption;本章按加厚标准应有 5–8 图。\n` +
  `- 中心思想突出、脑回路与比喻到位、不沦为逐字翻译清单;末尾保留 refs 块。\n\n只返回修正后的结构化结果。`

const draftPrompt = (u) => {
  if (IS_HEX) return yijingDraft(u)
  if (IS_JZ) return jzDraft(u)
  const thick = IS_THICK
  const longCh = u.chars >= 1500   // 长章阈值:超过则分段摘录精华句,不逐句翻全篇(owner:坛经/金刚经那类)
  const band = thick
    ? (longCh ? '约 7000–11000 字(加厚·长章:分段摘录精华句逐一深读,不必逐句翻全篇)' : '约 6000–9000 字(加厚·短章:全文逐句展开)')
    : (u.chars < 120 ? '约 2500–4500 字(短章,宁短不注水)' : u.chars < 600 ? '约 5000–8000 字' : '约 7000–10000 字(长篇,过长可只覆盖前半并在收束点明)')
  const spec = thick ? `${SPEC}\n${THICK_EXTRA}` : SPEC
  const figspec = thick ? FIGSPEC_THICK : FIGSPEC
  // owner 长短分流:短章逐句展开;长章分段摘录精华句
  const approach = !thick ? '' : longCh
    ? '\n\n【本章较长——分段摘录】把本章**分成几段**,每段挑出**精华/关键的句子**(quote)逐一深读解释;次要的叙述/重复句可并讲带过,**不必逐句翻每一句**。引文仍须精确子串。'
    : '\n\n【本章较短——全文逐句】**全文逐句展开**:每个原文句子都引(quote)并讲透,不漏句。'
  return `你在为研习站写《${bookTitle}·${u.title}》的「白话」整章深读。${RED[corpus] || ''}\n\n${spec}\n\n${figspec}${approach}\n\n` +
    `第一步:用 Read 读 ${FILE(corpus, slug)},找到 chapters 里 no===${u.no} 的那一章(paragraphs 为原文段,每段含 original 与 translation)。以这章原文为底成文。\n\n` +
    `篇幅:${band}。\n\n按 schema 产出一篇白话文章:\n` +
    `- title:"白话${bookTitle} · ${u.title}";subtitle:一句副题;centralIdea:一句话中心思想。\n` +
    `- blocks:有序数组,块类型 lead(导语)/p(段落)/h2(小节标题)/quote{original,translation}(引文,original 必为该章原文段精确子串、translation 与站内译文一致)/figure{ftype,svg,caption}(内联 SVG 图)/refs{items:[…]}(出处与参考)。按脊柱顺序铺;走读用 quote+p 穿插;金句卡等图穿插在合适处;末尾一个 refs 块。\n` +
    (u.featured ? `- 这是全书开篇总纲章:额外给 featured:true 和 hero:{badge:"开篇 · 全书总纲",headline:本章关键句,tagline:一句题词};正文不必再单列与 hero 重复的金句卡。\n` : `- 本章非开篇,**不要**输出 featured 或 hero 字段。\n`) +
    `\n只返回结构化结果。`
}

const verifyPrompt = (u, draft) => IS_HEX ? yijingVerify(u, draft) : IS_JZ ? jzVerify(u, draft) : `校对修正《${bookTitle}·${u.title}》白话草稿,返回修正后完整结构。${RED[corpus] || ''}\n\n` +
  `先 Read ${FILE(corpus, slug)} 中 no===${u.no} 的章核对。草稿:\n${draft}\n\n` +
  `逐项改正:\n- 每个 quote.original 必须是该章某原文段的精确连续子串,否则改对或删;translation 与站内译文一致。\n` +
  `- 守红线:删去违红线的措辞(${corpus === 'zhongyi' ? '诊疗/功效用法用量/疗效断语' : corpus === 'moulue' ? '为伪书张目/教施用' : corpus === 'fo' ? '果报/往生劝信' : '鸡汤/成功学/权术/政治影射'})。\n` +
  `- 每张 figure 的 svg:颜色只用 var(--…)/currentColor,**不得写死 #hex**;有 viewBox 与 caption。${IS_THICK ? '本书按加厚标准,应有 5–8 张图、每处义理都落到日常场景+比喻;' : ''}\n` +
  (IS_THICK && u.chars >= 1500 ? `- 本章较长:应是「分段 + 摘录精华句逐一深读」,不必逐句翻全篇;确认未遗漏关键句、也未沦为流水账。\n` : IS_THICK ? `- 本章较短:应「全文逐句展开」,确认无漏句。\n` : '') +
  `- 中心思想突出、脑回路与比喻到位、不沦为逐字翻译清单;篇幅合宜。\n- 末尾保留 refs 块。\n\n只返回修正后的结构化结果。`

const script = `export const meta = {
  name: 'baihua-${corpus}-${slug}',
  description: '白话深读 ${bookTitle} 起草+校对(design-v22)',
  phases: [ { title: 'Draft', detail: '据真原文成文 + 内联 SVG 图' }, { title: 'Verify', detail: '核引文逐字/红线/图色/篇幅' } ],
}

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'subtitle', 'centralIdea', 'blocks'],
  properties: {
    title: { type: 'string' }, subtitle: { type: 'string' }, centralIdea: { type: 'string' },
    featured: { type: 'boolean' },
    hero: { type: 'object', additionalProperties: false, properties: { badge: { type: 'string' }, headline: { type: 'string' }, tagline: { type: 'string' } } },
    blocks: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['type'],
      properties: {
        type: { enum: ['lead', 'p', 'h2', 'quote', 'figure', 'refs'] },
        text: { type: 'string' }, original: { type: 'string' }, translation: { type: 'string' },
        ftype: { type: 'string' }, svg: { type: 'string' }, caption: { type: 'string' },
        items: { type: 'array', items: { type: 'string' } },
      },
    } },
  },
}

const UNITS = ${JSON.stringify(units, null, 0)}
const DRAFT = ${JSON.stringify(Object.fromEntries(units.map((u) => [u.no, draftPrompt(u)])))}
const VERIFY_HEAD = ${JSON.stringify(Object.fromEntries(units.map((u) => [u.no, verifyPrompt(u, '__DRAFT__')])))}

phase('Draft')
const results = await pipeline(
  UNITS,
  (u) => agent(DRAFT[u.no], { label: '草:${bookTitle}·' + u.title, phase: 'Draft', schema: SCHEMA, model: 'opus' }),
  (draft, u) => {
    if (!draft) return { ...u, data: null }
    const vp = VERIFY_HEAD[u.no].replace('__DRAFT__', JSON.stringify(draft).slice(0, 60000))
    return agent(vp, { label: '校:${bookTitle}·' + u.title, phase: 'Verify', schema: SCHEMA, model: 'opus' })
      .then((v) => ({ ...u, data: v || draft }))
  },
)
const ok = results.filter(Boolean)
log('完成 ' + ok.filter((r) => r.data).length + '/' + UNITS.length + ' 章')
return ok
`

const outName = `scripts/.baihua-${corpus}-${slug}-wf.js`
fs.writeFileSync(path.join(ROOT, outName), script)
console.log(`生成 ${units.length} 章单元 → ${outName}  (${bookTitle} 第 ${units[0]?.no}–${units[units.length - 1]?.no} ${unit})`)
