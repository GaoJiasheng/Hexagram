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
export const t2s = (s) => t2sRaw(s.replaceAll('乾', '\uE000')).replaceAll('\uE000', '乾').replaceAll('遯', '遁').replaceAll('隂', '阴')

// ---------- wikitext 清洗 ----------
export function clean(raw) {
  let s = raw
  s = s.replace(/-\{([^{}]*?)\}-/g, (_, inner) => inner.replace(/^[A-Za-z]\|/, '')) // -{乾}- / -{T|xx}-
  s = s.replace(/(.)\{\{另\|\1\|[^{}]*\}\}/g, '$1') // 校注式「另作」:模板首参与前字相同时是对前字的校注(如「三君{{另|君|聖}}」),去重不增字
  s = s.replace(/\{\{另\|([^|{}]+)\|[^{}]*\}\}/g, '$1') // 「另作」模板:保留正文用字(第一参数)——先于通配模板剔除,否则整段丢字(逍遥游「槍/湌」、参同契等曾因此缺字)
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
