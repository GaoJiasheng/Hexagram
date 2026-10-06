// 维基文库抓取与文本清洗的共享工具(六期 v6 §1.1 从 fetch-data.mjs 抽出)。
// 易经(fetch-data.mjs)与道藏(fetch-dao.mjs)两条管线共用;改动此文件后
// 必须重跑 npm run data:fetch 并确认 src/data/yijing 生成物零 diff。

import fs from 'node:fs'
import path from 'node:path'
import * as OpenCCNS from 'opencc-js'

const API = 'https://zh.wikisource.org/w/api.php'

// ---------- 繁转简 ----------
// 保护「乾」:周易/丹经语料一律读 qián,不得转作「干」(参同契满篇乾坤)。
// 占位符用私用区 U+E000 显式转义,避免工具链吞掉不可见字符。
const OpenCC = OpenCCNS.Converter ? OpenCCNS : OpenCCNS.default
const t2sRaw = OpenCC.Converter({ from: 't', to: 'cn' })
// 扩展区汉字方块根治·方案 ①(2026-10-01,owner 定):OpenCC 把一些 BMP 里的繁体字转成《通用规范汉字表》编在扩展 B–F 区的简体字
//(蹻→𫏋、駉→𬳶、鑪→𬬻、絺→𫄨……全站 155 字 492 处),多数设备没有字体,显示成方块。这类字一律**保留繁体原字**
//(仍在 BMP,任何 CJK 字体都有;代价是简体正文混几十个繁体僻字)。判定不靠人工名单:逐字试转,输出落在 BMP 之外的
// 即受保护——转换前换成私用区占位符,转完还原。底本自身就是扩展区的字(四库白文的 𤣥 𠫵 之类)不在此列,那要靠字体(方案 ②)。
const KEEP_TRAD = new Map()   // 繁体原字 → 占位符
const KEEP_BACK = new Map()   // 占位符 → 繁体原字
{
  let i = 0
  for (let cp = 0x3400; cp <= 0x9fff; cp++) {
    const ch = String.fromCodePoint(cp)
    const out = t2sRaw(ch)
    if (out === ch) continue
    if ([...out].some((c) => c.codePointAt(0) > 0xffff)) {
      const ph = String.fromCodePoint(0xe100 + i++)
      KEEP_TRAD.set(ch, ph)
      KEEP_BACK.set(ph, ch)
    }
  }
}
const KEEP_RE = new RegExp(`[${[...KEEP_TRAD.keys()].join('')}]`, 'g')
const BACK_RE = /[\ue100-\ue4ff]/g
// 维基文库源页里编者用私用区码位打的缺字(任何字体都没有,显示成方块)。逐个查过独立见证本才收进来,
// 只认这三个出处,别的私用区码位照旧留着让 scan-astral-chars 报出来(2026-10-07,N11):
//   U+F6E3 → 無:《左传》襄九年「是以雖隨□咎」,同书襄二十五/二十七年「棠□咎」即棠無咎;《左传正义》《太平御览》作「無咎」
//   U+E789 → 昺:《参同契》「煥若星經漢兮，□如水宗海」,四库彭晓/陈显微/俞琰三本、《喻林》《图书集成》作「昺」
//   U+F069 → 啘:《难经》十六难「掌中熱而□」,《图书集成》引滑寿本义四处、《难经悬解》作「啘」(滑注:啘,乾嘔也)
const PUA_FIX = new Map([['\uF6E3', '無'], ['\uE789', '昺'], ['\uF069', '啘']])
const PUA_FIX_RE = /[\uF6E3\uE789\uF069]/g
export const t2s = (s) => bmpForm(t2sRaw(s.replace(PUA_FIX_RE, (c) => PUA_FIX.get(c)).replaceAll('乾', '\uE000').replace(KEEP_RE, (c) => KEEP_TRAD.get(c)))
  .replace(BACK_RE, (c) => KEEP_BACK.get(c) || c)
  .replaceAll('\uE000', '乾').replaceAll('遯', '遁').replaceAll('隂', '阴'))
export const keptTraditional = () => [...KEEP_TRAD.keys()]
// 反向表:OpenCC 会把某个 BMP 繁体字转成的扩展区简体字 → 那个繁体字。给「字已经是扩展区形」的入口用
//(四库本的 SKchar 缺字表直接给出 𡒄 这类本字;源页里偶有编者手打的扩展区字),与 t2s 的保留规则一致。
const EXT_TO_TRAD = new Map([...KEEP_TRAD.keys()].map((ch) => [t2sRaw(ch), ch]).filter(([a]) => [...a].length === 1))
export const bmpForm = (s) => [...s].map((c) => EXT_TO_TRAD.get(c) || c).join('')

// ---------- wikitext 清洗 ----------
export function clean(raw) {
  // 维基文库缺字记法「■{X}」(黑方块 + 花括号里的替代字,如《庄子·天运》「柤■{梨}橘柚」):取替代字,去方块(2026-10-01,M4 抽查发现)
  raw = raw.replace(/■\{([^{}]{1,3})\}/g, '$1')
  let s = raw
  s = s.replace(/-\{([^{}]*?)\}-/g, (_, inner) => inner.replace(/^[A-Za-z]\|/, '')) // -{乾}- / -{T|xx}-
  s = s.replace(/(.)\{\{[另别別]\|\1\|[^{}]*\}\}/g, '$1') // 校注式「另作」:模板首参与前字相同时是对前字的校注(如「三君{{另|君|聖}}」),去重不增字
  // 异体/异文模板:{{另|正|异}} 与 **{{别|正|异}}（别／別）**,首参即底本用字,保留之。
  // 别/別 这两个名字是后补的:唐诗《九月九日忆山东兄弟》源页作 獨在異鄉{{别|為|爲}}異客,
  // 因未认此名而被下面的通配模板连参数一起删,站内原文成了「独在异乡异客」(脱「为」字);
  // 元曲《沉醉东风》(白朴)同样丢了「隄」与一个句末标点。全站缓存里只此二页用,他书 no-op。
  s = s.replace(/\{\{[另别別]\|([^|{}]+)\|[^{}]*\}\}/g, '$1') // 「另作」模板:保留正文用字(第一参数)——先于通配模板剔除,否则整段丢字(逍遥游「槍/湌」、参同契等曾因此缺字)
  // 专名号/下划线一类**只作排版、参数即正文**的模板:先解包保住正文,再让下面的通配剔除扫尾。
  // 不这么做,下一行会把模板连同参数一起删掉——《蜀道难》曾因此丢了「蜀」「蚕丛」「鱼凫」「秦」
  // 「太白」「峨眉」「青泥」「剑阁」,《将进酒》同理。(全站缓存里只此二页用,他书 no-op。)
  for (let i = 0; i < 4; i++) s = s.replace(/\{\{\s*(?:ul|u|專名號|专名号|書名號|书名号|YL)\s*\|([^|{}]*)\}\}/g, '$1')   // YL = 年号链接模板({{YL|永和九年}}),古文观止用于正文年号,连参数删就丢字(2026-10-01 踩过)
  for (let i = 0; i < 4; i++) s = s.replace(/\{\{[^{}]*\}\}/g, '') // 模板(含 {{gap}}、{{*|注}})
  s = s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  s = s.replace(/\[\[[^\][|]*\|([^\][]*)\]\]/g, '$1') // 管道链接取显示文本(含 [[w:xx|顯示]] 等命名空间管道链接——须先于下行的整体剔除)
  s = s.replace(/\[\[[a-z][a-z-]*:[^\]]*\]\]/gi, '') // 无管道跨语言/命名空间链接([[fr:...]])整体剔除
  s = s.replace(/\[\[([^\][]*)\]\]/g, (_, t) => (t.includes('/') ? (t.split('/').filter(Boolean).pop() || '') : t)) // 无管道链接:取显示文本;跨页([[周易/夬]])取末段,[[../]] 清空
  s = s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '') // <ref>校勘脚注连内容整体剔除(黄庭21曾把「黃庭內景玉經註…」注文漏进正文)
  s = s.replace(/<[^>]+>/g, '') // span 等行内标签
  s = s.replace(/<[^>]*$/, '') // 被断行的开标签(如行尾的 <span)
  s = s.replace(/^[^<>]*>/, '') // 上一行开标签的残余(如行首的 style=...>)
  s = s.replace(/'''?/g, '')
  return s.trim()
}

// 通用垃圾行判定;各管线可在其上叠加自己的导航行规则
export function isJunk(text) {
  if (!text) return true
  if (/^[{}|=']/.test(text)) return true
  if (/^(Category|分类|分類)[:：]/i.test(text)) return true
  if (/^(previous|next|title|section|author)\s*=/.test(text)) return true
  return false
}

// ---------- API 与带缓存抓取 ----------
export async function apiGet(params) {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  const res = await fetch(`${API}?${qs}`, { headers: { 'User-Agent': 'hexagram-learning-site/0.1 (personal study project)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${qs}`)
  return res.json()
}

/** 创建带本地缓存的页面抓取器;两条管线传同一 cacheFile 即共享缓存。 */
export function createFetcher(cacheFile) {
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {}
  function saveCache() {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify(cache))
  }
  async function fetchPages(titles) {
    const result = {}
    const missing = titles.filter((t) => !(t in cache))
    for (let i = 0; i < missing.length; i += 40) {
      const batch = missing.slice(i, i + 40)
      const data = await apiGet({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        redirects: '1',
        titles: batch.join('|'),
      })
      const redirectMap = {}
      for (const r of data.query.redirects ?? []) redirectMap[r.to] = r.from
      // API 可能先规范化标题(下划线↔空格、特殊字符等)再处理:normalized.from 是请求名,to 是规范名。
      const normalizedMap = {}
      for (const n of data.query.normalized ?? []) normalizedMap[n.to] = n.from
      for (const page of data.query.pages ?? []) {
        const content = page.revisions?.[0]?.slots?.main?.content
        if (!content) throw new Error(`页面无内容: ${page.title}`)
        // 先解重定向、再解规范化,映射回最初请求名,作缓存键
        const afterRedirect = redirectMap[page.title] ?? page.title
        const requested = normalizedMap[afterRedirect] ?? afterRedirect
        cache[requested] = content
      }
      saveCache()
      await new Promise((r) => setTimeout(r, 300))
    }
    for (const t of titles) {
      if (!(t in cache)) throw new Error(`抓取失败,缺页面: ${t}`)
      result[t] = cache[t]
    }
    return result
  }
  return { fetchPages }
}
