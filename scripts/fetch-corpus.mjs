// 通用 corpus 抓取驱动(v16 §1)——佛/儒等读经类站共用一套管线。
// 用法:node scripts/fetch-corpus.mjs <key>  (key ∈ ru/fo;读 scripts/corpus/<key>.config.mjs 的 BOOKS)
// 产出:src/data/<key>/classics/{slug}.json;人工译文来自 scripts/authored/<key>-translations.json。
// 与道藏(fetch-dao.mjs)同构、共享 wikisource.mjs 与缓存;但解析模型不同:
//   每个源页 = 一章;页内 ==标题== 行、章号标记行(论语「一之X」)、导航链接行一律剔除,
//   余下文本行各为一段。原文一律来自抓取,严禁手改、严禁凭记忆补。

import { validPunctuated } from './lib/punct-layer.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { t2s, clean, isJunk as isJunkBase, createFetcher } from './lib/wikisource.mjs'
import { isValidGanZhi, monthGan, hourGan } from '../src/features/shared/ganzhi/index.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CACHE_FILE = path.join(ROOT, 'scripts/.cache/wikisource.json') // 与易经/道藏管线共享缓存
const { fetchPages } = createFetcher(CACHE_FILE)

const key = process.argv[2]
if (!key) {
  console.error('用法: node scripts/fetch-corpus.mjs <key>  (如 ru / fo)')
  process.exit(1)
}

// 导航/版本行:外链、列表式跨页链接(*[[…]])、语言转换残文
const isJunk = (text) => isJunkBase(text) || /^\[http/.test(text) || /^-\{/.test(text) || /^[a-z]{2,3}:/i.test(text)
// 章号标记行(论语 div 内「一之一」「十一之二」之类),清洗后为纯篇序之章序
const CHAPTER_MARK_RE = /^[一二三四五六七八九十百]+之[一二三四五六七八九十百]+$/
// 页尾「有声文献」诵读块(链接+录制说明+「更多有声文献」),命中即停止解析本页
const STOP_RE = /有聲文獻|Spoken_?Wikisource|ximalaya/i
// 横线分隔(----)、纯数字卷次行、「上一篇 回目录 下一篇」页脚导航(孟子各卷页尾的残留)
const NAV_LINE_RE = /^(?:[-－—]{2,}|\d{1,3})$|回目[录錄]|^(?:上|下)一[篇章卷]/
// 品/分题独立成行(坛经各品页正文里重复的「行由品第一」等),作标记行剔除
const PIN_TITLE_RE = /^.{1,7}[品分]第[一二三四五六七八九十]+$/
// 亡篇占位注(商君书御盗「[内容及篇目俱亡]」、他书「(闕)」「篇亡」等),整行为编者注非经文,剔除
const LOSS_NOTE_RE = /^[【\[（(].{0,24}[亡闕阙缺佚].{0,24}[】\])）]$/
// splitHeadings 模式下需跳过的非经文标题(金刚经「正文/外部链接」、心经 djvu 页的明太祖序等)
const HEADING_SKIP_RE = /^(正文|外部連結|外部链接|參考|参考|附錄|附录|注釋|注释|目錄|目录|答話|答话)$|序$/
// 解析 -{…}- 繁简转换标记:多变体语法 -{zh:X;zh-hans:Y;zh-hant:Z}- 取简体(zh-hans/zh-cn),
// 单体 -{乾}- / -{T|乾}- 取本字。
const pickConv = (inner) => {
  if (/(?:^|;)\s*zh[\w-]*\s*:/.test(inner)) {
    const map = {}
    for (const seg of inner.split(';')) {
      const m = seg.match(/^\s*([\w-]+)\s*:\s*([\s\S]*)$/)
      if (m) map[m[1]] = m[2].trim()
    }
    return map['zh-hans'] ?? map['zh-cn'] ?? map['zh'] ?? map['zh-hant'] ?? Object.values(map)[0] ?? inner
  }
  return inner.replace(/^[A-Za-z]\|/, '')
}
// 先解析行内链接与繁简转换标记,使 {{另}} 模板首参(经文)不再内含 | 和 { }
// (如 {{另2|《[[尚書|書]]》-{云}-…|校勘}} 的首参含 [[..|..]] 与 -{..}-,否则下面取首参会失败、经文被整段删)
const preResolve = (s) => s
  .replace(/-\{([^{}]*?)\}-/g, (_, inner) => pickConv(inner))
  .replace(/<\/?onlyinclude>/gi, '')                                          // 罗织经等 <onlyinclude> 包裹标记
  .replace(/__[A-Z]+__/g, '')                                                 // __TOC__/__NOTOC__ 魔术字(行内)
  .replace(/\{\{ProperNoun\|([^|}]*)(?:\|[^}]*)?\}\}/gi, '$1')                 // {{ProperNoun|左丘明}} → 左丘明
  .replace(/\{\{(?:Novel|footer|header2?|Textquality|PD-old|NoteTA|检索|檢索|gap|reflist|DEFAULTSORT)[^{}]*\}\}/gi, '')  // 元/导航模板
  .replace(/\{\{[^{}]*?作品\}\}/g, '')                                         // {{唐朝作品}} 等版权模板
  .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  // 分类链接**整条剔除**,不能落到下面的通用链接规则去 —— 那条规则取管道后的显示文本,
  // 而分类链接管道后是**排序键**([[Category:唐詩三百首|李]] 的「李」),会当正文漏出来。
  // 唐诗页因此曾漏出 25 个单字段(「李」「杜甫」「王维」)。
  .replace(/\[\[\s*(?:Category|category|分[类類])\s*:[^\]]*\]\]/g, '')
  .replace(/\[\[(?:[^\][|]*\|)?([^\][]*)\]\]/g, '$1')
// 含字校勘模板 {{另|主|注}} / {{另2|主|注}}:取首参(主读、即经文),先于通用模板清洗
const replaceAnother = (s) => s.replace(/\{\{另\d?\|([^|{}]*)(?:\|[^{}]*)*\}\}/g, '$1')
// 行内 <ref>…</ref> 校勘注(常含外链),整段剔除——经文只留正文(论语各篇为单行,无跨行 ref)
const stripRef = (s) => s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')

// 维基文库页首 {{header ... }} 元数据块:整块剔除。其多行字段(如 override_author =
// [[作者:孟子|孟轲\n]]及其弟子公孙丑、万章等人)的断行会让闭合 ]] 那一行漏出残文——
// 该行不以 {|}= 起首,逃过 isJunk(孟子告子上/下曾各漏出一段)。按花括号配平扫描整块切除,
// 容忍字段内嵌套模板({{gap}} 等);切前置于逐行解析,paras/chapters 两路共用。
function stripHeaderBlock(wikitext) {
  const m = /\{\{\s*header\b/i.exec(wikitext)
  if (!m) return wikitext
  const start = m.index
  let depth = 0
  let i = start
  while (i < wikitext.length) {
    if (wikitext.startsWith('{{', i)) { depth++; i += 2; continue }
    if (wikitext.startsWith('}}', i)) { depth--; i += 2; if (depth === 0) break; continue }
    i++
  }
  return wikitext.slice(0, start) + wikitext.slice(i)
}

// 战国策(士礼居叢書本)校注模板 {{*|姚本…}} / {{*|鮑本…}} / {{*|補曰…}}:整段剔除。
// 括号配平扫描(容嵌套 {{gap}} 等与跨行),只去校注、保经文。仅含 `{{*` 的书受影响,他经无此标记。
function stripStarTemplates(wikitext) {
  if (!wikitext.includes('{{*')) return wikitext
  let out = ''
  let i = 0
  while (i < wikitext.length) {
    if (wikitext.startsWith('{{*', i)) {
      let depth = 0
      let j = i
      while (j < wikitext.length) {
        if (wikitext.startsWith('{{', j)) { depth++; j += 2; continue }
        if (wikitext.startsWith('}}', j)) { depth--; j += 2; if (depth === 0) break; continue }
        j++
      }
      i = j
      continue
    }
    out += wikitext[i]
    i++
  }
  return out
}

// 竖排版式模板({{VH1|题}} {{Vtext|作者}} {{VtextStart}}诗句{{VtextEnd}} {{clr}}):
// 它是同一首诗的**竖排渲染副本**,与页内 <poem> 正文逐字重复。整行剔除,否则每首诗抓两遍
// (唐诗 26 页中招:《八阵图》《登乐游原》《登楼》等各出现两套正文,且 {{Vtext|杜甫}} 那行
// 还会漏出作者名当正文)。他经无此模板,no-op。
function stripVerticalText(wikitext) {
  if (!/\{\{\s*(?:VH1|Vtext|VtextStart|clr)\b/i.test(wikitext)) return wikitext
  // ⚠️ 少数页**只有**竖排一份、没有 <poem>(《隋宫》即是)。那时竖排就是唯一正文,
  // 剔光会把整首诗剔没(第一版就这么翻的车)。故:有 <poem> 才当副本剔,没有则就地转成正文行。
  const hasPoem = /<poem>/i.test(wikitext)
  return wikitext.split('\n').map((line) => {
    const t = line.trim()
    if (/^\{\{\s*(?:VH1|Vtext|clr)\b/i.test(t)) return ''          // 题/作者/清除浮动,任何情形都非正文
    if (/^\{\{\s*VtextStart\b/i.test(t)) {
      if (hasPoem) return ''                                          // 有横排正本 → 竖排是重复副本
      return t.replace(/\{\{\s*VtextStart\s*\}\}/gi, '').replace(/\{\{\s*VtextEnd\s*\}\}/gi, '')
    }
    return line
  }).join('\n')
}

// 底本讹字校正表(逐字、极少、须有确证才加)。维基文库个别页与通行本有出入,属源页之误
// 而非管线之误——改在这里而非手改生成物,重跑才不会被覆盖。
// 每条须注明:通行本作什么、凭什么判定源页有误。
const SOURCE_TYPOS = [
  // 《卫风·硕人》「美目盻兮」:通行《毛诗》作「盼」(pàn,目黑白分明),源页作「盻」(xì,恨视),
  // 二字义不相涉。铁证是站内《论语·八佾》子夏引此句即作「盼」——同一站内两书用字打架。
  { book: 'shijing', from: '美目盻兮', to: '美目盼兮' },
]
const fixTypos = (slug, text) => SOURCE_TYPOS.reduce(
  (t, r) => (r.book === slug ? t.replaceAll(r.from, r.to) : t), text)

// 整页级 wikitext 预处理(按页名精确匹配,发生在切段/切章之前;与 fixTypos 对称,但作用于原始
// wikitext 而非清洗后的文本)。目前仅《滴天髓阐微》一页用到:该页用 {{*|原注：…}} 包裹原书原注、
// {{annotate|任氏曰：…}} 包裹任铁樵阐微——前者与战国策等书里 {{*|…}} 表「剔除的校注」语义相反
// (这里的原注是正文的一部分，要保留)，后者全站无他处使用。经核实两种模板在该页均不嵌套、且
// 100% 以「原注」「任氏曰」开头,故用非贪婪正则整体解包(保留内容、去模板壳)即可,不需要
// stripStarTemplates 那样的花括号配平。按页名精确匹配,不影响其余任何页面(它们的 wikitext
// 不含这两种模板)。
const PAGE_PRETREAT = {
  '滴天髓闡微': (text) => text
    .replace(/\{\{\*\|(原注[：:][^{}]*)\}\}/g, '$1')
    .replace(/\{\{annotate\|(任氏曰[：:][^{}]*)\}\}/g, '$1'),
  // 《珞琭子三命消息賦注》(宋徐子平注,已句读的非四庫页):赋文一行、注文一行,注包在 {{*|…}} 里。
  // 与战国策等书 {{*|姚本…}} 表「该剔的校注」语义相反——这里的注就是本书的主体(全书=赋 77 节 + 注 77
  // 段),故按页名解包保留。经核实该页只有 Header 与 77 个 {{*|}},无嵌套,非贪婪正则即可。
  '珞琭子三命消息賦注': (text) => text.replace(/\{\{\*\|([^{}]*)\}\}/g, '$1'),
}

// ---------- 四庫全書本(SKQS)专用预处理 ----------
// 维基文库的「X (四庫全書本)」系列页用一套自有模板承载四庫写本的版式(观数组的三命通会/李虚中命书/
// 玉照定真经三书皆是),通用 clean() 会把模板连同**内容**一起剔掉,故须先解包:
//   · {{SK anchor|篇题}}   —— 篇/子目的标题(四庫写本里顶格或另起的小标题)。解包后独占一行,
//                             再由 book.sections 的判据决定它是「篇」(切章)还是普通行(留作正文段)。
//   · {{SK notes|小字}}    —— 四庫写本的双行小字:或为撰者自注(万民英的夹注、命例),或为注家的注文
//                             (李虚中命书的「命入贵格明暗取官」、玉照定真经张颙注)。**内容是书的一部分,
//                             不能剔**。book.skNotes 决定它落成独立段('para',注文自成一层的书用)
//                             还是留在原行('inline',夹注混在正文句中的书用——拆出去反而把句子切碎)。
//   · {{SKchar|编号}}      —— 字库缺字。编号查 Module:SKchar(维基文库自有的 4591 条对照表,随页面一同
//                             抓取、不另建数据文件):有「本字」则还原本字;只有「描述字」(异体字或部首
//                             组合 IDS)而无本字的,按下面 skcharResolve 的规则谨慎还原,仍还原不了的
//                             写作缺字符「□」并计数报告——**宁可显标缺字,不可静默吞字**。
//   · {{YL|乾隆四十四年}}  —— 年号模板,解包取字面。
// 只对 book.skqs 为真的书生效,其余 60 余部书零影响。
const SKCHAR_MOD = 'Module:SKchar'
// 解析 Module:SKchar 的 skchars 表:['编号']={"本字"} 或 ['编号']={nil, "描述字"}。
function parseSkCharTable(moduleText) {
  const map = {}
  for (const m of moduleText.matchAll(/\['(\d+)'\]=\{\s*(?:nil|"([^"]*)")\s*(?:,\s*"([^"]*)")?\s*\}/g)) {
    map[m[1]] = { ben: m[2] ?? null, desc: m[3] ?? null }
  }
  return map
}
// 单个汉字(含扩展区)判定:排除 IDS 表意文字描述符 ⿰⿱… (U+2FF0–U+2FFF,表里偶有把 IDS 串
// 误填进「本字」栏的,如编号 2025 本字栏只有一个「⿰」)。
const isOneHan = (s) => !!s && [...s].length === 1 && /[㐀-䶿一-鿿豈-﫿]|[\u{20000}-\u{2fa1f}]/u.test(s)
// 缺字还原:①有本字且是单个汉字 → 用本字(四庫原字,最忠实)。
// ②否则看描述字:它的写法有「异体字」「⿰部件组合」「⿰部件组合 -- 通行字」「通行字 --（形状说明）」
//   几种,以 ` -- ` 切开后取**第一个恰为单汉字**的片段(即维基编者判定的该字通行写法)。
// ③再不成(描述字只有 IDS 串或整句说明)→ 「□」,并记入 warnings 供人工复核。
function skcharResolve(entry) {
  if (!entry) return null
  if (isOneHan(entry.ben)) return { ch: entry.ben, exact: true }
  // 分隔符写法不齐(「⿳亠口⿱冖至 -- 臺」「揚 --（『昜』上『旦』之『日』與『一』相連）」),故用宽松切分。
  for (const seg of (entry.desc ?? '').split(/\s*--\s*/)) {
    const s = seg.trim()
    if (isOneHan(s)) return { ch: s, exact: false }
  }
  return null
}
// SKQS 页 wikitext → 供通用 parsePageChapters 消费的 wikitext(篇题化为 == 标题 ==)。
// isSection(title, wasAnchor) 由调用方按 book.sections[页序] 提供。
function skqsTransform(wikitext, { skMap, notes, isSection, pageName, warnings, stat, needSections }) {
  let t = wikitext
    // 页首的 HTML 注释(「請根據四庫全書掃描版校對本頁…加標點請另外建立頁面。」——给维基编者的校对说明)。
    // 通用 clean() 按行剥标签,剥不掉这种跨行注释:注释中间那几行不含 < >,会当正文漏出来
    // (李虚中命书卷上首段、玉照定真经首段都中过)。故整块剔除。
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{SKQS (?:header|footer)\|[^{}]*\}\}/g, '')
    .replace(/\{\{SK list\|[\s\S]*?\}\}\s*$/g, '')
    .replace(/\{\{YL\|([^{}|]*)(?:\|[^{}]*)?\}\}/g, '$1')
    .replace(/\{\{SKchar\|(\d+)[^{}]*\}\}/g, (whole, id) => {
      const r = skcharResolve(skMap[id])
      if (!r) { stat.skcharLost++; stat.lostIds.add(id); return '□' }
      stat.skchar++
      if (!r.exact) stat.skcharApprox++
      return r.ch
    })
    .replace(/\{\{SK notes\|([^{}]*)\}\}/g, notes === 'para' ? '\n$1\n' : '$1')
    // 用  包住 anchor 文本,使下面逐行判定时能区分「它原本是 anchor」还是普通行
    .replace(/\{\{SK anchor\|([^{}|]*)\}\}/g, '\n$1\n')
  const out = []
  let nSec = 0
  for (const line of t.split('\n')) {
    const m = line.trim().match(/^([\s\S]*)$/)
    const wasAnchor = !!m
    const bare = wasAnchor ? m[1] : line
    const title = t2s(clean(bare)).trim()
    if (title && isSection(title, wasAnchor)) { out.push(`== ${bare} ==`); nSec++; continue }
    out.push(wasAnchor ? bare : line)
  }
  stat.sections += nSec
  if (!nSec && needSections) warnings.push(`${pageName}: SKQS 切篇后无任何篇题,请检查 sections 判据`)
  return out.join('\n')
}

// 行清洗 → 简体正文;若为导航/标题/标记/空行返回 null
function cleanLine(raw) {
  if (/^\*+\s*\[\[/.test(raw.trim())) return null          // *[[…]] 导航链接行
  if (/^\[\d+\][^[]{0,16}[：:]/.test(raw.trim())) return null  // 校勘脚注行(如难经「[1]字：原作…据《…》改」),整行剔除
  // 剥离正文内联校注锚 [数字](难经经文如「其脉浮[1]在…」);经典正文不用 [数字] 故他书 no-op
  // 源页编者所加的韵脚标注(《邶风·北风》「惠而好我，携手同行，【韵：雱行】」),
  // 是编者标注非诗句正文——站内注疏一度专出两条解释它,等于拿注疏给数据缺陷打补丁。
  // 标注为行尾内联、不独立成段,故剔除不改段数,译文/注疏的位置索引安全。
  const text = clean(replaceAnother(preResolve(stripRef(raw))).replace(/^[*#:;]+/, '').replace(/\[\d+\]/g, ''))
  if (isJunk(text)) return null
  const simp = t2s(text).replaceAll('愼', '慎').replaceAll('擧', '举')   // OpenCC 未规范的异体字补正(慎/举)
    // 源页编者所加的韵脚标注(《邶风·北风》「携手同行，【韵：雱行】」),是编者标注非诗句正文。
    // 须在繁转简之后剔——源页作繁体「韻」,在 t2s 之前匹配「韵」命不中(踩过一次)。
    // 标注为行尾内联、不独立成段,故剔除不改段数,译文/注疏的位置索引安全。
    .replace(/【韵[：:][^】]*】/g, '').trim()
  if (!simp || CHAPTER_MARK_RE.test(simp) || NAV_LINE_RE.test(simp) || PIN_TITLE_RE.test(simp) || LOSS_NOTE_RE.test(simp) || /^__\w+__$/.test(simp) || /^目\s*[录錄]/.test(simp)) return null
  return simp
}

// 诗经专用:一诗一页,页内构造不统一——部分诗以「===毛诗序===/===诗文===」分节标题隔开头注与正文
// (樛木一类),部分以「毛诗序：「…」」内嵌一行不另立标题(那/文王一类),《关雎》因是开篇更叠了鲁诗说/
// 齐诗说/韩诗说三家序甚至「鲁齐韩三家说」合并标题(何彼襛矣),个别另附「安大简本」等出土文献异文
// 对照(蒹葭)、页首「詩經‧类别‧诗题」面包屑重复行(部分页无 < 前缀故不落入 clean() 的残段清除)、
// 表格式版式残留的 `!诗题` 表头行(鸤鸠);页尾另有「《X》，N章，M句」计数注(个别诗页内文用异体字
// 拼写与页名不同,如「何彼襛矣」页内作「何彼穠矣」,故计数注判据须用通配、不能只靠精确诗题匹配)、
// 「===注解/注释===」训诂节。
// 判据:①序类/异文类小标题(毛诗序/毛诗说/毛诗叙/鲁诗说/…/鲁齐韩三家说/诗序/小序/X简本/X帛书本)
// 本身非正文,其下内容整段跳过;②内嵌无标题的「毛诗序：」行逐行丢弃;③面包屑行(诗经‧…)、表头行
// (!…)、与本诗诗题相同的裸标题行(节南山、丰)逐行丢弃;④以书名号起首、句中含「章」「句」的计数注
// 逐行丢弃(通配,不要求诗题字形与页名完全一致);⑤训诂节即本诗终点。
const SHI_XU_LINE_RE = /^毛诗序/
const SHI_BREADCRUMB_RE = /^诗经[‧·]/
const SHI_STANZA_NOTE_RE = /^《[^》]+》.*[章句]/
const SHI_SKIP_HEADING_RE = /(诗(序|说|叙)$)|(简本$)|(帛书本?$)|^小序$|^鲁齐韩三家说$/
// 子串匹配(非锚定):个别多国合页的「注解」标题被语言转换标记包住(如「-{zh-hans:註解; zh-hant:註解}-」
// 未被通用 clean() 的简化 -{}- 处理器完全拆开),子串匹配可稳健命中。
const SHI_STOP_HEADING_RE = /注解|注释/
// 唐诗页另有几类非正文节:「收录」(他本出处清单)、「備注」(注音释义)、「縱」(竖排版式,与「橫」重复)、
// 「注釋/外部連結」等。其下内容整段跳过。(诗经诸页无这些标题,no-op。)
const SHI_SKIP_HEADING2_RE = /^(收[录錄]|备注|備注|注[释釋]|外部[连連][结結]|参考|參考|附[录錄])[:：]?$/
// 编者附录块:【注解】【韵译】【评析】等整行标签,其后到页尾全是今人所加的注释/白话译/赏析,
// 不是原文。命中即停止解析本页(《将赴吴兴登乐游原》页尾曾漏出 10 段这类文字)。
const SHI_APPENDIX_RE = /^【\s*(注解|注释|注釋|韵译|韻譯|评析|評析|简析|簡析|译文|譯文|集评|集評|赏析|賞析)\s*】/
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// sectionFilter:同页含多首同名诗(如「白华」笙诗〔亡辞〕与魚藻之什实有其辞的「白华」共享一页,
// 以「----」分隔为两个 === 小节),仅取标题含 sectionFilter 的小节;不传则不作节过滤,遇训诂节即停。
// (已核实:8 处同页消歧诗均为内嵌无标题的简单形式,不含毛诗序/诗文分节标题,故消歧模式下不需
// 处理 SHI_SKIP_HEADING_RE 与 sectionFilter 的层级交互——两套机制分工清晰、互不纠缠。)
function parsePoemPage(wikitext, warnings, pageName, sectionFilter = null, preferSection = null) {
  const paras = []
  // preferSection(唐诗用):个别页把同一首诗的**几种底本**并列成节(《静夜思》页有
  // ===李太白全集=== / ===唐詩三百首=== / ===全唐詩=== 三种异文),不选节就三种全抓进来。
  // 本站底本是《唐诗三百首》,故该节存在时只取它;页上没有这种分节的(绝大多数)不受影响。
  if (!sectionFilter && preferSection) {
    const want = t2s(preferSection)
    const has = (wikitext.match(/^=+\s*(.+?)\s*=+$/gm) || [])
      .some((h) => t2s(clean(h.replace(/^=+\s*|\s*=+$/g, ''))).includes(want))
    if (has) sectionFilter = preferSection
  }
  const filterSimp = sectionFilter ? t2s(sectionFilter) : null // 标题已简体化,过滤关键字(配置里或写繁体)需同转
  let active = !sectionFilter
  let controlLevel = null // 记录使 active 生效的标题层级,子级标题(层级更深)不重判、继承父级状态
  const poemName = t2s(pageName.slice(pageName.indexOf('/') + 1))
  const selfTitleRe = new RegExp(`^《${reEscape(poemName)}》`)
  // 长短经等篇内含 {{*|议曰：…}} 大段夹注(可能跨行),需先整段剔除(同战国策处理);诗经无此标记,no-op。
  // stripVerticalText:唐诗页的竖排渲染副本,与 <poem> 正文重复,须先剔。
  for (const raw of stripHeaderBlock(stripStarTemplates(stripVerticalText(wikitext))).split('\n')) {
    if (STOP_RE.test(raw)) break
    if (SHI_APPENDIX_RE.test(t2s(raw.trim()))) break   // 【注解】【韵译】【评析】以下是今人附录,非原文
    const h = raw.trim().match(/^(=+)\s*(.+?)\s*=+$/)
    if (h) {
      const level = h[1].length
      const title = t2s(clean(h[2]))
      if (SHI_STOP_HEADING_RE.test(title)) {
        // 仅当前(或无节过滤)已在目标节内时,训诂节才是本诗终点;否则可能是另一同页诗的训诂节,继续找目标节
        if (!sectionFilter || active) break
        continue
      }
      if (sectionFilter) {
        if (controlLevel === null || level <= controlLevel) {
          active = title.includes(filterSimp)
          controlLevel = level
        }
        continue
      }
      // 无节过滤(单一诗页):序类小标题本身非正文,其下内容跳过;其余标题(诗文/诗题自身重复/
      // 国风归属行)一律视为正文段起点。SHI_SKIP_HEADING2_RE 是唐诗页那几类(收录/備注/縱…)。
      active = !SHI_SKIP_HEADING_RE.test(title) && !SHI_SKIP_HEADING2_RE.test(title) && title !== '纵'
      continue
    }
    if (!active) continue
    if (/^!/.test(raw.trim())) continue // 表格式版式残留的表头行(如「!鳲鳩」)
    const simp = cleanLine(raw)
    if (!simp || simp === poemName) continue
    // 页首残留的「诗题 + 朝代 + 作者」署名行(《蜀相》页在 header 之后、<onlyinclude> 之前
    // 裸着一行「蜀相  唐 杜甫」),是页面版式不是诗句。判据须收紧到「诗题 + 空白 + 朝代 + 至多四字」
    // ——只判「以诗题起首且余下很短」会把《周颂·维清》的「维清缉熙，文王之典」误伤(实测过)。
    if (simp.startsWith(poemName) && /^[\s\u3000]+[唐宋元明清汉晋魏隋金梁陈周秦][\s\u3000]*\S{1,4}$/.test(simp.slice(poemName.length))) continue
    if (SHI_XU_LINE_RE.test(simp) || selfTitleRe.test(simp) || SHI_STANZA_NOTE_RE.test(simp) || SHI_BREADCRUMB_RE.test(simp)) continue
    paras.push({ original: simp, translation: null })
  }
  // 整节重复剔除:个别源页把「===詩文===」连同正文重复贴了数遍(《桃夭》4 遍,系维基页面编辑事故),
  // 表现为全诗恰好整倍重复。只在「后半段与前半段逐字全等」时截掉,故诗经本有的重章叠句
  // (如秦风《黄鸟》叠唱「彼苍者天」)不受影响——那是部分重复,不构成整倍。
  for (let unit = 1; unit <= paras.length / 2; unit++) {
    if (paras.length % unit) continue
    const head = paras.slice(0, unit).map((p) => p.original).join(' ')
    let allSame = true
    for (let k = unit; k < paras.length; k += unit) {
      if (paras.slice(k, k + unit).map((p) => p.original).join(' ') !== head) { allSame = false; break }
    }
    if (allSame) {
      if (unit < paras.length) warnings.push(`${pageName}: 正文整倍重复 ${paras.length / unit} 遍,已截为 ${unit} 段`)
      paras.length = unit
      break
    }
  }
  // 「一诗两贴」:个别页把同一首诗贴两遍 —— 一遍白文逐句分行,一遍**整首挤成一段的注本**
  // (行内夹 <ref> 校注,剥注后成一长行)。《石鼓歌》页即如此,于是卷 2 末尾多出一段 529 字的重复。
  // 上面那条「整倍重复」判不出来:两份的**分段形状不同**(33 段 vs 1 段),不构成整倍。
  // 判据收得很紧(全站 65 部书实测只此一处命中):某段汉字数 >=100,且与紧邻其前 >=5 段的拼接
  // 相似度 >=0.95(留余地是因为两传本间有异文,如「陵迟/凌迟」「嗟予/嗟余」)。
  {
    const han = (x) => (x.match(/[\u4e00-\u9fff]/g) || []).join('')
    const ratio = (a, b) => {           // 最长公共子序列长度 / 较长者
      if (!a.length || !b.length) return 0
      const dp = new Array(b.length + 1).fill(0)
      for (let i = 1; i <= a.length; i++) {
        let prev = 0
        for (let j = 1; j <= b.length; j++) {
          const tmp = dp[j]
          dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1])
          prev = tmp
        }
      }
      return dp[b.length] / Math.max(a.length, b.length)
    }
    for (let i = paras.length - 1; i >= 5; i--) {
      const cur = han(paras[i].original)
      if (cur.length < 100) continue
      for (let run = 5; run <= Math.min(60, i); run++) {
        const cat = han(paras.slice(i - run, i).map((x) => x.original).join(''))
        if (Math.abs(cat.length - cur.length) > cur.length * 0.05) continue
        if (ratio(cat, cur) >= 0.95) {
          warnings.push(`${pageName}: 同一首诗贴了两遍(白文分行 + 注本整段),已剔除整段的那份`)
          paras.splice(i, 1)
          break
        }
      }
    }
  }
  if (!paras.length) warnings.push(`${pageName}: 解析后无任何段落`)
  return paras
}

// 单页 → 段落数组(各源页即一章)
function parsePageParas(wikitext, warnings, pageName) {
  const paras = []
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break                       // 页尾诵读块,其后不再有正文
    if (/^=+.*=+$/.test(raw.trim())) continue          // == 标题 == 行
    const simp = cleanLine(raw)
    if (simp) paras.push({ original: simp, translation: null })
  }
  if (!paras.length) warnings.push(`${pageName}: 解析后无任何段落`)
  return paras
}

// 单页按 == 标题 == 切多章(金刚经 32 分):标题去『…』夹注;跳过「正文/外部链接」等非经文标题;
// 首个有效标题前的内容(开经偈、礼佛文等)丢弃——除非 book.leadTitle 指定,见下。
function parsePageChapters(wikitext, warnings, pageName, book = {}) {
  // mergeHeadingRe:匹配的标题不另起章,内容并入上一章(如金匮附方并入前篇);
  // dropChapterRe:切章后丢弃标题匹配的整章(如六韬卷题章「文韬」等只含卷标无正文)。
  const mergeRe = book.mergeHeadingRe ? new RegExp(book.mergeHeadingRe) : null
  const dropRe = book.dropChapterRe ? new RegExp(book.dropChapterRe) : null
  const chapters = []
  // leadTitle(渊海子平用):首个 == 标题 == 之前若已有实质内容(该页开篇「基础」一节,十神对照表,
  // 无 wiki 标题包裹),默认会被丢弃——设此项则把这段内容收作第一章,标题即此值。不设则行为不变
  // (cur 仍从 null 起,他书零影响)。
  let cur = book.leadTitle ? { title: book.leadTitle, paragraphs: [] } : null
  if (cur) chapters.push(cur)
  for (const raw of stripHeaderBlock(stripStarTemplates(wikitext)).split('\n')) {
    if (STOP_RE.test(raw)) break
    const h = raw.trim().match(/^=+\s*(.+?)\s*=+$/)
    if (h) {
      const rawTitle = h[1].replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/<ref[^>]*\/>/gi, '')  // 剔标题内 <ref> 校勘
      const title = t2s(clean(rawTitle).replace(/『[^』]*』/g, '').replace(/「[^」]*」/g, '')).trim()
      // keepHeadingRe:白名单,压过 HEADING_SKIP_RE(五行大义首页的「五行大义序」是萧吉自序、是正文,
      // 但通用规则把凡以「序」收尾的标题都当非经文跳过——那条规则本为心经 djvu 页的明太祖序而设)。
      if (!title || (HEADING_SKIP_RE.test(title) && !(book.keepHeadingRe && new RegExp(book.keepHeadingRe).test(title)))) { cur = null; continue }
      if (mergeRe && mergeRe.test(title) && chapters.length) { cur = chapters[chapters.length - 1]; continue }
      cur = { title, paragraphs: [] }
      chapters.push(cur)
      continue
    }
    const simp = cleanLine(raw)
    if (simp && cur && simp !== cur.title) cur.paragraphs.push({ original: simp, translation: null }) // 丢章末重复的经题
  }
  let kept = chapters.filter((c) => c.paragraphs.length)
  if (dropRe) kept = kept.filter((c) => !dropRe.test(c.title))
  if (!kept.length) warnings.push(`${pageName}: 切章后无内容`)
  return kept
}

// 本地纯文本源专用切章(穷通宝鉴/子平真诠):这两本书维基文库没有,殆知阁电子本是纯文本,
// 原文里没有任何机器可稳定识别的分章标记(子平真诠正文甚至完全不重复 48 篇篇目——已人工
// 逐段核对确认)。故切章边界是人工读原文核实后写死的行号(book.localBreaks,1 起、含该行本身;
// 相邻两个断点之间的所有行归为一章,最后一个断点到文件末尾归为末章),而不是靠猜测性正则—— 这与
// pickHeadings/groupPages 等其他「人工在 config 里点名章节」的既有做法同一性质,只是落到行号
// 而非标题字符串。断点行本身(如「论木」「三春乙木总论」「一、论十干十二支」)照样当作正文的
// 第一段保留,不被吞作纯标题——与「小节题行保留为独立段」的要求一致。每行仍走 cleanLine(),
// 与维基页面同一套清洗逻辑,只是没有 wiki 语法可剥。
function parseLocalBreaks(text, breaks, warnings, pageName) {
  const lines = text.split('\n')
  const chapters = []
  for (let i = 0; i < breaks.length; i++) {
    const from = breaks[i] - 1
    const to = i + 1 < breaks.length ? breaks[i + 1] - 1 : lines.length
    const paragraphs = []
    for (const raw of lines.slice(from, to)) {
      const simp = cleanLine(raw)
      if (simp) paragraphs.push({ original: simp, translation: null })
    }
    if (paragraphs.length) chapters.push({ no: chapters.length + 1, title: null, paragraphs })
    else warnings.push(`${pageName}: 第 ${breaks[i]} 行起的一章解析后无内容`)
  }
  if (!chapters.length) warnings.push(`${pageName}: localBreaks 切章后无内容`)
  return chapters
}

// 命例竖排合并(滴天髓阐微专用,book.mergeGanzhiRuns 开关):维基文库把命例的四柱与大运竖排,
// 每柱/每步大运各占一段(个别相邻两柱因源页版式挤在同一行,如"丙子丙申"=时柱丙子+首运丙申),
// 拆散成一堆 2–4 字的碎段,前后夹着长篇分析文字。合并规则(2026-09-19 owner 追加 + 复核后补丁):
//   · 逐段判定"是否纯干支"——去空白/顿号/逗号后按 2 字一组核验每组都是合法干支(甲子表 60 组之一,
//     用 isValidGanZhi,与易经纳甲、中医五行同一张表,不是本管线另起的判断);
//   · 连续 ≥5 段且都纯干支 → 判定为一处命例(数量必然 ≥5,含四柱+大运);
//   · 或单独一段恰好 4 个合法干支(有无分隔符皆可)→ 判定为"只录四柱、未录大运"的命例;
//   · 或**恰好连续 4 个单干支段**(每段仅 1 个干支,无大运可认)——单凭"4 段"本身信号太弱,
//     须再核**双重自洽**才收:月柱干支合五虎遁(monthGan(年干,月支)===月干)**且**时柱干支合
//     五鼠遁(hourGan(日干,时支)===时干)。两条规则各自独立成立的概率很低,同时成立基本排除误判。
//   · 都不满足的(如 2–4 段的短串、混了别的字)不合并、原样保留,记入 warnings 供人工复核——
//     宁可漏合并,不可错合并。
// 合并只做拼接:original 用单个半角空格顺序连接原段文字,**不增删一字**;另附 pillars(前 4 个,即
// 年月日时四柱)与 dayun(其余,大运,可能为空数组)两个结构化字段,及 kind:'mingli' 标记供阅读器识别。
function splitGanzhiChunks(text) {
  const compact = text.replace(/[\s、，,]/g, '')
  if (!compact || compact.length % 2 !== 0) return null
  const chunks = []
  for (let i = 0; i < compact.length; i += 2) {
    const gz = compact.slice(i, i + 2)
    if (!isValidGanZhi(gz)) return null
    chunks.push(gz)
  }
  return chunks
}
// 四柱自洽:月柱干支须合五虎遁(年上起月)、时柱干支须合五鼠遁(日上起时)。仅当四段都恰为
// 单个干支(runLen===4===allChunks.length,即无大运、无并行)时才需要这重校验——凑够 4 段
// 本身信号太弱,双重排盘自洽同时成立才够可信。
function fourPillarSelfConsistent(chunks) {
  if (chunks.length !== 4) return false
  const [year, month, day, hour] = chunks
  return monthGan(year[0], month[1]) === month[0] && hourGan(day[0], hour[1]) === hour[0]
}
function mergeGanzhiRuns(chapters, warnings, pageName) {
  let nMerged = 0
  let nWithDayun = 0
  for (const c of chapters) {
    const paras = c.paragraphs
    const out = []
    let i = 0
    while (i < paras.length) {
      const firstChunks = splitGanzhiChunks(paras[i].original)
      if (!firstChunks) { out.push(paras[i]); i++; continue }
      let j = i + 1
      const allChunks = [...firstChunks]
      while (j < paras.length) {
        const next = splitGanzhiChunks(paras[j].original)
        if (!next) break
        allChunks.push(...next)
        j++
      }
      const runLen = j - i
      const qualifies = (runLen >= 5 && allChunks.length >= 4) || (runLen === 1 && allChunks.length === 4)
        || (runLen === 4 && allChunks.length === 4 && fourPillarSelfConsistent(allChunks))
      if (qualifies) {
        out.push({
          original: allChunks.join(' '),
          translation: null,
          kind: 'mingli',
          pillars: allChunks.slice(0, 4),
          dayun: allChunks.slice(4),
        })
        nMerged++
        if (allChunks.length > 4) nWithDayun++
        i = j
      } else {
        warnings.push(`${pageName} 第${c.no}${c.title ? '(' + c.title + ')' : ''}章 段${i}起: 连续 ${runLen} 段共 ${allChunks.length} 个干支,不满足命例合并条件(需连续≥5段,或单段恰4个干支,或4段四柱月时自洽),原样保留,请人工复核`)
        for (let k = i; k < j; k++) out.push(paras[k])
        i = j
      }
    }
    c.paragraphs = out
  }
  return { nMerged, nWithDayun }
}

async function main() {
  const { BOOKS } = await import(path.join(ROOT, `scripts/corpus/${key}.config.mjs`))
  const OUT_DIR = path.join(ROOT, `src/data/${key}/classics`)
  const warnings = []
  const errors = []
  const trPath = path.join(ROOT, `scripts/authored/${key}-translations.json`)
  const translations = fs.existsSync(trPath) ? JSON.parse(fs.readFileSync(trPath, 'utf8')) : {}
  const puPath = path.join(ROOT, `scripts/authored/${key}-punct.json`)
  const punctLayer = fs.existsSync(puPath) ? JSON.parse(fs.readFileSync(puPath, 'utf8')) : {}

  // localFile 的书不走维基文库抓取(见下),从 allPages 里排除。
  const allPages = BOOKS.flatMap((b) => (b.localFile ? [] : b.groupPages
    ? b.groupPages.flatMap((g) => g.pages.map((p) => (typeof p === 'string' ? p : p.page)))
    : b.pages))
  // 四庫全書本的书另需抓一张缺字对照表(维基文库自有的 Module:SKchar,见 skqsTransform 说明);
  // 它与经文页走同一个缓存,不另建数据文件。没有 skqs 书时不抓。
  const needSkChar = BOOKS.some((b) => b.skqs)
  const pages = await fetchPages(needSkChar ? [...allPages, SKCHAR_MOD] : allPages)
  const skMap = needSkChar ? parseSkCharTable(pages[SKCHAR_MOD]) : {}
  if (needSkChar) console.log(`已载入 ${SKCHAR_MOD} 缺字表 ${Object.keys(skMap).length} 条`)

  // 页面级预处理(见 PAGE_PRETREAT 定义处的说明),先于转写壳解析、切段/切章。
  for (const [pageName, fn] of Object.entries(PAGE_PRETREAT)) {
    if (pageName in pages) pages[pageName] = fn(pages[pageName])
  }

  // 本地文本源(书在维基文库没有,取殆知阁等纯文本电子本):不经 wikisource API,直接读本地文件,
  // 以文件路径本身作为 pages 的键——此后即与维基页面走同一套 cleanLine()/parsePageParas() 等
  // 清洗逻辑(该文本已是纯文本、无 wiki 语法,wiki 专属的正则替换在它身上多数是 no-op)。
  // t2s() 是 cleanLine() 里对每行都会做的一步;这里额外整体跑一次只是为了在写盘前**核实并报告**
  // 是否真的是 no-op(殆知阁简体电子本理论上应当是),而不是让它悄悄改字却没人知道。
  for (const book of BOOKS) {
    if (!book.localFile) continue
    const filePath = path.join(ROOT, book.localFile)
    const raw = fs.readFileSync(filePath, 'utf8')
    const converted = t2s(raw)
    if (converted !== raw) {
      let diff = 0
      for (let i = 0; i < Math.max(raw.length, converted.length); i++) if (raw[i] !== converted[i]) diff++
      warnings.push(`${book.localFile}: t2s() 对本地文本并非 no-op,约 ${diff} 处字符差异——已按 t2s 转换结果继续处理(与其余管线一致),但请人工复核这些差异是否为繁体残留而非底本原有的异体字`)
    }
    pages[book.localFile] = raw
  }

  // 转写壳 {{:页名}}:维基文库常把一篇正文放在独立页,合集页只写一行转写指令。
  // 不解开的话那一章只剩个小标题(《宋词三百首》第 179 首辛弃疾《青玉案·元夕》整首曾因此全阙)。
  // 同款坑另见 CLAUDE.md 记的黄庭经「全覽」。做法:抓被转写页,把 {{:X}} 就地换成它的正文。
  const TRANSCLUDE_RE = /\{\{:\s*([^}|]+?)\s*\}\}/g
  const wanted = new Set()
  for (const t of Object.values(pages)) {
    if (typeof t !== 'string') continue
    for (const m of t.matchAll(TRANSCLUDE_RE)) wanted.add(m[1])
  }
  if (wanted.size) {
    const sub = await fetchPages([...wanted].filter((p) => !(p in pages)))
    const bodyOf = (raw) => {
      if (typeof raw !== 'string') return ''
      const only = raw.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/i)
      return only ? only[1] : stripHeaderBlock(raw)
    }
    for (const k of Object.keys(pages)) {
      if (typeof pages[k] !== 'string') continue
      pages[k] = pages[k].replace(TRANSCLUDE_RE, (whole, name) => {
        const body = bodyOf(sub[name] ?? pages[name])
        if (!body) { warnings.push(`转写页「${name}」抓不到正文,原样保留`); return whole }
        return body
      })
    }
    console.log(`已解开 ${wanted.size} 处 {{:转写}}`)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const summary = []

  for (const book of BOOKS) {
    const single = !book.groupPages && !book.localFile && book.pages?.length === 1 && !book.splitHeadings
    const chapters = []
    const skqsStat = { sections: 0, skchar: 0, skcharApprox: 0, skcharLost: 0, lostIds: new Set() }
    // 本地文本源切章(穷通宝鉴/子平真诠:维基文库没有,殆知阁电子本按人工核实的行号切,见 parseLocalBreaks)
    if (book.localFile) {
      for (const c of parseLocalBreaks(pages[book.localFile], book.localBreaks, warnings, book.localFile)) {
        chapters.push(c)
      }
    } else
    // 内联卷题切章(韬晦术:单页无 == 标题,卷题「隐晦卷一」等内联成行,按 markPattern 切)
    if (book.markPattern) {
      const re = new RegExp(book.markPattern)
      let cur = null
      for (const p of parsePageParas(pages[book.pages[0]], warnings, book.pages[0])) {
        if (re.test(p.original)) { cur = { no: chapters.length + 1, title: p.original, paragraphs: [] }; chapters.push(cur) }
        else if (cur) cur.paragraphs.push(p)
      }
    } else
    // 摘录式(战国策):跨卷切章后,按 pickHeadings 顺序挑选指定章并改用友好标题(v18 §1 纵横)
    if (book.pickHeadings) {
      const all = book.pages.flatMap((p) => parsePageChapters(pages[p], warnings, p).map((c) => ({ ...c, page: p })))
      for (const pick of book.pickHeadings) {
        const matched = all.filter((c) => c.title.includes(pick.match) && (!pick.page || c.page === pick.page))
        if (!matched.length) { errors.push(`${book.title}: 未找到摘录章「${pick.match}」`); continue }
        if (matched.length > 1) warnings.push(`${book.title}: 摘录「${pick.match}」命中 ${matched.length} 章,取第一`)
        chapters.push({ no: chapters.length + 1, title: pick.title, paragraphs: matched[0].paragraphs })
      }
    } else
    // 多页合一章(诗经:一诗一页,按国风/什归组,组内诸诗顺次接续、诗题作为一段插在诗句之前)
    if (book.groupPages) {
      for (const group of book.groupPages) {
        const paragraphs = []
        for (const entry of group.pages) {
          const page = typeof entry === 'string' ? entry : entry.page
          const section = typeof entry === 'string' ? null : entry.section
          const poemParas = parsePoemPage(pages[page], warnings, page, section, book.preferSection)
          if (!poemParas.length) continue
          const poemTitle = t2s(page.slice(page.indexOf('/') + 1))
          paragraphs.push({ original: `《${poemTitle}》`, translation: null })
          paragraphs.push(...poemParas)
        }
        if (paragraphs.length) chapters.push({ no: chapters.length + 1, title: t2s(group.title), paragraphs })
        else warnings.push(`${group.title}: 分组无内容`)
      }
    } else
    // 单页按段落切章(珞琭子:全书一页、无 == 标题,四庫本分卷上卷下,以卷下首句为界切两章)。
    // 与 markPattern 的差别:首个匹配之前的内容自成第一章,而不是被丢弃;章名由 chapterTitles 给。
    if (book.breakParaRe) {
      const re = new RegExp(book.breakParaRe)
      let cur = { no: 1, title: null, paragraphs: [] }
      chapters.push(cur)
      for (const p of parsePageParas(pages[book.pages[0]], warnings, book.pages[0])) {
        if (re.test(p.original) && cur.paragraphs.length) { cur = { no: chapters.length + 1, title: null, paragraphs: [] }; chapters.push(cur) }
        cur.paragraphs.push(p)
      }
    } else
    for (const [pi, page] of book.pages.entries()) {
      // skqs:四庫全書本的模板解包 + 篇题判定(见 skqsTransform);产出的 wikitext 仍交通用切章器处理
      const wikitext = book.skqs ? skqsTransform(pages[page], {
        skMap,
        notes: book.skNotes ?? 'para',
        pageName: page,
        warnings,
        stat: skqsStat,
        needSections: !!book.splitHeadings,
        isSection: (title, wasAnchor) => {
          const rule = book.sections?.[pi]
          if (!rule) return wasAnchor            // 未给判据的书:每个 anchor 即一篇
          if (rule.extra?.includes(title)) return true   // 未加 anchor 的篇题(整行精确相等)
          return wasAnchor && new RegExp(rule.keep).test(title)
        },
      }) : pages[page]
      if (book.splitHeadings) {
        // 单页按标题切多章(金刚经 32 分)
        for (const c of parsePageChapters(wikitext, warnings, page, book)) {
          const prefix = book.titlePrefix?.[pi]
          chapters.push({ no: chapters.length + 1, title: prefix ? `${prefix} · ${c.title}` : c.title, paragraphs: c.paragraphs })
        }
        continue
      }
      const paras = parsePageParas(wikitext, warnings, page)
      const seg = page.includes('/') ? page.slice(page.indexOf('/') + 1) : page
      const title = single ? null : t2s(seg)
      if (paras.length) chapters.push({ no: chapters.length + 1, title, paragraphs: paras })
      else warnings.push(`${page}: 无正文段落`)
    }

    // dropParaRe:逐段丢弃匹配的非正文段(经题/卷题/撰人题等,如证道歌首标题与撰人题)
    if (book.dropParaRe) {
      const re = new RegExp(book.dropParaRe)
      for (const c of chapters) c.paragraphs = c.paragraphs.filter((p) => !re.test(p.original))
    }
    // stopParaRe:章内遇首个匹配段即截断(含其后),剔除正文后的附录(如阿弥陀经正文末「佛说阿弥陀经」经题后所附往生咒、译咒题记)
    if (book.stopParaRe) {
      const re = new RegExp(book.stopParaRe)
      for (const c of chapters) { const idx = c.paragraphs.findIndex((p) => re.test(p.original)); if (idx >= 0) c.paragraphs = c.paragraphs.slice(0, idx) }
    }
    // 剔段/截断后整章为空的,连章一起去掉(子平真诠末篇「附论杂格取运」整篇系徐乐吾所补,截断后即空)
    for (let k = chapters.length - 1; k >= 0; k--) if (!chapters[k].paragraphs.length) chapters.splice(k, 1)

    // fixes([{from,to,reason}]):底本错字精确整段勘误,须在 mergeGanzhiRuns 之前生效——
    // from 必须与某段 original **整段完全相等**才替换(不是子串替换,防误伤),每条命中打日志、
    // 未命中则报 warning(防条目本身写错、静默失效)。仅少数条目有确证时才加,不凭语感改。
    if (book.fixes) {
      for (const fix of book.fixes) {
        let hit = 0
        for (const c of chapters) for (const p of c.paragraphs) {
          if (p.original === fix.from) { p.original = fix.to; hit++ }
        }
        if (hit) console.log(`  勘误「${fix.from}」→「${fix.to}」(${fix.reason}): 命中 ${hit} 处`)
        else warnings.push(`${book.title}: 勘误条目「${fix.from}」→「${fix.to}」未命中任何段落,请检查`)
      }
    }

    // mergeGanzhiRuns(滴天髓阐微专用):命例竖排碎段合并,见函数定义处说明
    let ganzhiStat = null
    if (book.mergeGanzhiRuns) {
      ganzhiStat = mergeGanzhiRuns(chapters, warnings, book.pages?.[0] ?? book.localFile ?? book.slug)
    }

    // mergeCaseTables(穷通宝鉴专用):底本把命例排成横表——
    //   「时日月年」/「庚丙庚丙」(四柱天干,时→年)/「寅午寅午」(四柱地支)/「两间不杂，按察<TAB>时日月年」…
    // 一个命例被拆成三段,案语还和下一个表头用制表符粘在同一段。这不只是难看:译注代理被这些
    // 碎行带偏,整单元译文错位一段(2026-09-19 实测穷通第 4、7 章三个单元中招)。
    // 这里:①按制表符拆段 ②表头+天干行+地支行 → 一个结构化命例段(pillars 按 年月日时 排,
    // 与滴天髓同构,阅读器直接出四柱图)。四柱不合六十甲子的(底本讹字)原样保留三行并报 warning。
    let caseTableStat = null
    if (book.mergeCaseTables) {
      const GAN_S = '甲乙丙丁戊己庚辛壬癸', ZHI_S = '子丑寅卯辰巳午未申酉戌亥'
      const strip = (t) => t.replace(/[\s\u3000]/g, '')
      const isHead = (t) => strip(t) === '时日月年'
      const isRow = (t, set) => { const x = strip(t); return [...x].length === 4 && [...x].every((c) => set.includes(c)) }
      let merged = 0, broken = 0
      for (const c of chapters) {
        const flat = c.paragraphs.flatMap((p) => p.original.split('\t').map((t) => t.trim()).filter(Boolean).map((t) => ({ ...p, original: t })))
        const out = []
        for (let i = 0; i < flat.length; i++) {
          if (isHead(flat[i].original) && flat[i + 1] && flat[i + 2] && isRow(flat[i + 1].original, GAN_S) && isRow(flat[i + 2].original, ZHI_S)) {
            const g = [...strip(flat[i + 1].original)], z = [...strip(flat[i + 2].original)]
            const pillars = [3, 2, 1, 0].map((k) => g[k] + z[k])        // 底本 时日月年 → 年月日时
            const ok = pillars.every((gz) => GAN_S.indexOf(gz[0]) % 2 === ZHI_S.indexOf(gz[1]) % 2)
            if (ok) { out.push({ original: pillars.join(' '), translation: null, kind: 'mingli', pillars }); merged++; i += 2; continue }
            broken++
            warnings.push(`${book.title} 第${c.no}章: 命例表「${flat[i + 1].original}/${flat[i + 2].original}」四柱不合六十甲子(底本讹字),原样保留`)
          }
          out.push(flat[i])
        }
        c.paragraphs = out
      }
      caseTableStat = { merged, broken }
      console.log(`  命例横表合并: ${merged} 处${broken ? `,${broken} 处干支不合法原样保留` : ''}`)
    }

    // typoFixes([{from,to,reason,expect}]):底本**形讹**的子串勘误(区别于上面整段相等的 fixes)。
    // 只作用于非命例段;每条必须写明 expect(预期命中处数),实际不符即报 warning——
    // 这道闸是为了防「子串替换误伤」:条目写宽了、或上游页面改了,都会在这里露出来。
    // 只收有内证的(同书同词正写占压倒多数、或与该例四柱相校必为某字),拿不准的宁可留讹。
    if (book.typoFixes) {
      for (const fix of book.typoFixes) {
        let hit = 0
        for (const c of chapters) for (const p of c.paragraphs) {
          if (p.pillars || !p.original.includes(fix.from)) continue
          hit += p.original.split(fix.from).length - 1
          p.original = p.original.split(fix.from).join(fix.to)
        }
        if (hit === fix.expect) console.log(`  形讹「${fix.from}」→「${fix.to}」: ${hit} 处`)
        else warnings.push(`${book.title}: 形讹条目「${fix.from}」预期 ${fix.expect} 处、实际 ${hit} 处,请检查`)
      }
    }
    // tidyPunct:正文里混入的半角逗号转全角、连续逗号并为一个(OCR/录入残留,不涉字)
    if (book.tidyPunct) {
      let n = 0
      for (const c of chapters) for (const p of c.paragraphs) {
        if (p.pillars) continue
        const t = p.original.replace(/,/g, '\uFF0C').replace(/\uFF0C{2,}/g, '\uFF0C')
        if (t !== p.original) { p.original = t; n++ }
      }
      if (n) console.log(`  标点归一: ${n} 段`)
    }

    // 子页书友好章名覆盖(罗织经 01..12 → 阅人卷一 等),按序赋予
    if (book.chapterTitles) chapters.forEach((c, i) => { if (book.chapterTitles[i]) c.title = book.chapterTitles[i] })

    if (book.exactChapters && chapters.length !== book.exactChapters) {
      errors.push(`${book.title}: 应恰 ${book.exactChapters} 章,实得 ${chapters.length}`)
    }

    // 底本讹字校正(SOURCE_TYPOS):须在合并译文之前,且不改段数
    for (const c of chapters) for (const p of c.paragraphs) p.original = fixTypos(book.slug, p.original)

    // 断句层(punctLayer,四库白文专用):见 scripts/lib/punct-layer.mjs。过不了「去标点后逐字相等」的段保留白文。
    // 须在合并译文之前:译文、注疏锚点都是对着断句后的文本做的。
    let punctInfo = ''
    if (book.punctLayer) {
      const bookPu = punctLayer[book.slug] ?? {}
      let nOk = 0, nBad = 0, nTotal = 0
      for (const c of chapters) {
        const ps = bookPu[String(c.no)] || []
        c.paragraphs.forEach((p, i) => {
          if (p.pillars) return
          nTotal++
          if (!ps[i]) return
          if (validPunctuated(ps[i], p.original)) { p.original = ps[i]; nOk++ } else nBad++
        })
      }
      if (nBad) warnings.push(`${book.title}: 断句层有 ${nBad} 段去标点后与底本不等,已弃用(保留白文)`)
      punctInfo = `,断句 ${nOk}/${nTotal} 段`
    }

    // 合并人工译文(章号 → 段序数组)
    const bookTr = translations[book.slug] ?? {}
    let trCount = 0
    for (const c of chapters) {
      const ps = bookTr[String(c.no)]
      if (!ps) continue
      c.paragraphs.forEach((p, i) => {
        if (ps[i]) { p.translation = ps[i]; trCount++ }
      })
    }

    const out = { book: book.slug, title: book.title, chapters }
    fs.writeFileSync(path.join(OUT_DIR, `${book.slug}.json`), JSON.stringify(out, null, 2) + '\n')
    const paraTotal = chapters.reduce((n, c) => n + c.paragraphs.length, 0)
    const ganzhiInfo = ganzhiStat ? `,命例 ${ganzhiStat.nMerged} 处(${ganzhiStat.nWithDayun} 带大运)` : ''
    let skqsInfo = ''
    if (book.skqs) {
      skqsInfo = `,缺字还原 ${skqsStat.skchar}(其中按描述字定 ${skqsStat.skcharApprox})`
      if (skqsStat.skcharLost) {
        skqsInfo += `、仍缺 ${skqsStat.skcharLost} 作□`
        warnings.push(`${book.title}: ${skqsStat.skcharLost} 处缺字无法还原,已写作「□」(SKchar 编号 ${[...skqsStat.lostIds].join('/')})`)
      }
    }
    summary.push(`${book.title}: ${chapters.length} 章,${paraTotal} 段,译文 ${trCount} 段${ganzhiInfo}${skqsInfo}${punctInfo}`)
  }

  for (const w of warnings) console.warn('⚠', w)
  for (const s of summary) console.log(s)
  if (errors.length) {
    for (const e of errors) console.error('✗', e)
    process.exit(1)
  }
  console.log(`已写入 ${OUT_DIR}(${BOOKS.length} 部)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
