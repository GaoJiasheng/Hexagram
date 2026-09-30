import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ogShardKey } from '../server/og-index.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'src/data')
const CONTENT = path.join(ROOT, 'public/content')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const exists = (file) => fs.existsSync(file)

// ═══════════════════════════════════════════════════════════════════════
// 纯函数:App 路由表解析 · 路由匹配(照 react-router 的排名)· 实体存在检查 ·
// JSX / 文档里手写链接的提取。不读盘、无副作用,scripts/check-links.test.js 覆盖;
// 读数据、出报告都在下面的 main()。
// ═══════════════════════════════════════════════════════════════════════

/** 行号查询器:字符下标 → 1 起算的行号 */
export function lineIndexer(src) {
  const starts = [0]
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1)
  return (idx) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= idx) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

const IDENT = '[A-Za-z_$][\\w$]*'
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// `{[...].map((c) => (<Route path={`/${c}/me`} …/>))}`:往回找紧挨着的那个字面量数组,逐项展开。
// 中间若隔着别的 <Route>,说明不是同一个 map,不认。
function findMapValues(src, routeIdx, varName) {
  const re = new RegExp(`\\[([^\\[\\]]*)\\]\\s*\\.map\\(\\s*\\(?\\s*${escapeRe(varName)}\\s*\\)?\\s*=>`, 'g')
  let last = null
  for (const m of src.slice(0, routeIdx).matchAll(re)) last = m
  if (!last || /<Route\b/.test(src.slice(last.index, routeIdx))) return null
  const vals = [...last[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2])
  return vals.length ? vals : null
}

/**
 * 从 App.jsx 源码抽出全部 <Route path>,返回 { routes: [{path, line}], warnings }。支持:
 *   path="/x" · path='/x' · path={'/x'} · path={`/x`}(纯字面量模板)
 *   path={`/${c}/me`} —— 按紧挨着的 `[...].map((c) =>` 字面量数组逐项展开
 *   path={IDENT} —— 按 idents(registry.js 的字符串导出,如 MASTER_PORTAL_PATH)解析
 * 跳过 path="*"(兜底 404 什么都接,算「匹配上」就没意义了)。
 * 只按平铺路由解析:App 现在全平铺,若出现嵌套 <Route>…</Route> 给 warning(子路由路径未拼接)。
 */
export function parseAppRoutes(src, { idents = {} } = {}) {
  const routes = []
  const warnings = []
  const lineOf = lineIndexer(src)
  const PATH_RE = new RegExp(`\\bpath=(?:"([^"]*)"|'([^']*)'|\\{\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`|(${IDENT}))\\s*\\})`)
  const starts = [...src.matchAll(/<Route\b/g)].map((m) => m.index)
  for (let k = 0; k < starts.length; k++) {
    const idx = starts[k]
    const line = lineOf(idx)
    const m = src.slice(idx, starts[k + 1] ?? src.length).match(PATH_RE)
    if (!m) {
      warnings.push(`App.jsx:${line} <Route> 没有可解析的 path,跳过`)
      continue
    }
    const [, d1, s1, d2, s2, tpl, ident] = m
    let raw = d1 ?? s1 ?? d2 ?? s2
    if (raw === undefined && ident !== undefined) {
      if (typeof idents[ident] !== 'string') {
        warnings.push(`App.jsx:${line} path={${ident}} 解析不出字面量,跳过`)
        continue
      }
      raw = idents[ident]
    }
    if (raw === undefined) {
      const subs = [...tpl.matchAll(/\$\{\s*([^}]*?)\s*\}/g)]
      if (!subs.length) {
        raw = tpl
      } else {
        const only = subs.length === 1 && new RegExp(`^${IDENT}$`).test(subs[0][1]) ? subs[0] : null
        const vals = only ? findMapValues(src, idx, only[1]) : null
        if (vals) {
          for (const v of vals) routes.push({ path: tpl.replace(only[0], v), line })
          continue
        }
        // 展开不了:把插值当一个 :param 段兜底(宁宽勿漏报),并提示
        raw = tpl.replace(/\$\{[^}]*\}/g, ':param')
        warnings.push(`App.jsx:${line} path={\`${tpl}\`} 的插值展开不了,按 ${raw} 兜底`)
      }
    }
    if (raw === '*') continue
    routes.push({ path: raw, line })
  }
  if (/<\/Route>/.test(src)) warnings.push('App.jsx 出现嵌套 <Route>…</Route>:本脚本只按平铺路由解析,子路由路径未拼接')
  return { routes, warnings }
}

// react-router computeScore:段数为底,静态段 10、:param 3、空段 1,含 * 罚 2。
// 分高者先匹配 —— 所以 /ru/lunyu/renwu(静态)压过 /ru/:slug/:chapter,/fo/concepts 压过 /fo/:slug。
const PARAM_SEG = /^:[\w-]+$/
export function routeScore(p) {
  const segs = p.split('/')
  let score = segs.length
  if (segs.includes('*')) score -= 2
  for (const s of segs) {
    if (s === '*') continue
    score += PARAM_SEG.test(s) ? 3 : s === '' ? 1 : 10
  }
  return score
}

/** 按 react-router 的排名排序(同分保持 App.jsx 里的先后,sort 是稳定的) */
export function rankRoutes(routes) {
  return routes.map((r) => ({ ...r, score: routeScore(r.path) })).sort((a, b) => b.score - a.score)
}

const safeDecode = (s) => {
  try { return decodeURIComponent(s) } catch { return s }
}
const segsOf = (p) => p.split('/').filter(Boolean)

/** 单条路由模式匹配:命中返回 params 对象,不中返回 null。静态段不分大小写(react-router 默认) */
export function matchPattern(pattern, pathname) {
  const ps = segsOf(pattern)
  const us = segsOf(pathname)
  const params = {}
  for (let i = 0; i < ps.length; i++) {
    const seg = ps[i]
    if (seg === '*') {
      params['*'] = us.slice(i).map(safeDecode).join('/')
      return params
    }
    if (i >= us.length) return null
    const u = safeDecode(us[i])
    if (seg.startsWith(':')) params[seg.slice(1)] = u
    else if (seg.toLowerCase() !== u.toLowerCase()) return null
  }
  return us.length === ps.length ? params : null
}

/** 全部命中的路由(已按排名),[0] 即 react-router 实际渲染的那一条 */
export function matchRoutes(ranked, pathname) {
  const out = []
  for (const r of ranked) {
    const params = matchPattern(r.path, pathname)
    if (params) out.push({ path: r.path, line: r.line, params })
  }
  return out
}

/** 截掉 ?查询 与 #锚 */
export function splitHref(raw) {
  const cut = raw.search(/[?#]/)
  return cut < 0 ? raw : raw.slice(0, cut)
}

const isSiteAbs = (s) => s.startsWith('/') && !s.startsWith('//')

// 三个提取器(JSX / navigate() / .js 链接表)共用的收集器:
// 路径部分(截掉 #锚 ?查询 后)含 `${` → 只计 dynamic;完全静态且以 / 起头(非 //)→ 收;其余(#锚、http、相对)不收也不计。
function linkCollector(src) {
  const lineOf = lineIndexer(src)
  const out = { links: [], dynamic: 0 }
  out.take = (raw, idx, kind) => {
    const p = splitHref(raw)
    if (p.includes('${')) {
      if (isSiteAbs(p) || p.startsWith('${')) out.dynamic++
      return
    }
    if (!isSiteAbs(p)) return
    out.links.push({ path: p, raw, line: lineOf(idx), kind })
  }
  return out
}

// 字符串字面量(单 / 双引号不跨行;模板可跨行、可带插值 —— 插值交给 take 计 dynamic)
const STR_LIT = `'[^'\\n]*'|"[^"\\n]*"|\`[^\`]*\``
const PURE_STR_ARRAY = new RegExp(`(?<![\\w$)\\].])\\[\\s*((?:(?:${STR_LIT})\\s*,\\s*)*(?:${STR_LIT})\\s*,?\\s*)\\]`, 'g')

/**
 * 「纯字符串数组」里以 / 起头的项:['/basics/yinyang', '学阴阳八卦'] · match: ['/hexagrams', '/hexagram/']。
 * 只认整个数组都是字符串字面量的(混了变量 / 对象 / 注释的不认)—— 宁漏勿把函数实参误当链接。
 * `[` 紧贴在标识符 / ) / ] / . 之后的是成员访问(obj[`${a}/${b}`]),不是数组,不认。
 */
function takeArrayItems(src, c) {
  for (const m of src.matchAll(PURE_STR_ARRAY)) {
    const base = m.index + m[0].indexOf(m[1])
    for (const e of m[1].matchAll(new RegExp(STR_LIT, 'g'))) c.take(e[0].slice(1, -1), base + e.index, '[数组项]')
  }
}

/**
 * 从一份 .jsx 源码里抽「完全静态」的站内链接,返回 { links: [{path, raw, line, kind}], dynamic }。
 *   JSX 属性:to="/x" · to='/x' · to={'/x'} · to={`/x`}(无插值)· href= 同上
 *     —— 等号两侧不许有空格,所以 `const to = '/x'` 这类变量赋值不算;
 *     <Navigate to="/x" /> 也走这条(kind 记作 <Navigate>,汇总里单列条数)
 *   对象字面量:to: '/x' · href: '/x'(导航表、入口卡片数组;只收静态字符串,不计动态)
 *   纯字符串数组项:['/basics/yinyang', '…'](见 takeArrayItems)
 * 插值落在路径段里的(`/hexagram/${id}`)、整个是表达式的(to={site.home})→ 只计入 dynamic;
 * 插值只在 #锚 / ?查询 里的(`/dao/x/4#p${n}`)→ 路径部分仍是静态,照收。
 * 非站内(#锚、http、mailto、//cdn、相对路径)不收也不计。
 */
export function extractJsxLinks(src) {
  const c = linkCollector(src)
  // 属性所在的标签名:往回找最近的 `<`(属性值里一般不含 <;偶有误判只影响 kind 标注)
  const tagOf = (idx) => {
    const lt = src.lastIndexOf('<', idx)
    return lt < 0 ? null : /^<([\w.]+)/.exec(src.slice(lt, lt + 40))?.[1] ?? null
  }
  const ATTR = /(?<![\w.$-])(to|href)=(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)\s*\}|\{)/g
  for (const m of src.matchAll(ATTR)) {
    const [, attr, d1, s1, d2, s2, tpl] = m
    const raw = d1 ?? s1 ?? d2 ?? s2 ?? tpl
    if (raw === undefined) c.dynamic++
    else c.take(raw, m.index, tagOf(m.index) === 'Navigate' ? '<Navigate>' : attr)
  }
  const PROP = /(?<![\w.$-])(to|href):\s*(?:'([^']*)'|"([^"]*)"|`([^`$]*)`)/g
  for (const m of src.matchAll(PROP)) {
    const [, attr, s1, d1, tpl] = m
    c.take(s1 ?? d1 ?? tpl, m.index, `${attr}:`)
  }
  takeArrayItems(src, c)
  return { links: c.links, dynamic: c.dynamic }
}

/**
 * useNavigate() 返回函数的调用:navigate('/ru') · navigate(`/dao`) · navigate(`/hexagrams?view=${v}`)(插值只在查询里 → 静态)。
 * 函数名默认认 navigate,另从本文件的 `const X = useNavigate()` 收别名(如 BookHomePage 的 nav)。
 * 返回 { links, dynamic, calls }:
 *   首参是静态站内路径 → links;带路径插值的模板 / 变量 / 表达式(navigate(r.to))→ dynamic 只计数;
 *   navigate(-1) 这类数字(历史回退)与 navigate(`#锚`) 不收也不计。
 * <Navigate to="/x" /> 组件不在这里,归 extractJsxLinks 的 to= 扫描。
 */
export function extractNavigateCalls(src) {
  const c = linkCollector(src)
  const names = new Set(['navigate'])
  for (const m of src.matchAll(new RegExp(`\\b(?:const|let|var)\\s+(${IDENT})\\s*=\\s*useNavigate\\s*\\(`, 'g'))) names.add(m[1])
  const alt = [...names].map(escapeRe).join('|')
  // 排除 obj.navigate(…)(别家的同名方法)与 function navigate(…)(定义,不是调用)
  const CALL = new RegExp(`(?<![\\w.$]|\\bfunction\\s+)(?:${alt})\\(\\s*(?:'([^'\\n]*)'|"([^"\\n]*)"|\`([^\`]*)\`|(-?\\d+)|([^\\s)]))`, 'g')
  let calls = 0
  for (const m of src.matchAll(CALL)) {
    const [, s1, d1, tpl, num] = m
    calls++
    if (num !== undefined) continue
    const raw = s1 ?? d1 ?? tpl
    if (raw === undefined) c.dynamic++
    else c.take(raw, m.index, 'navigate()')
  }
  return { links: c.links, dynamic: c.dynamic, calls }
}

/**
 * .js 里的链接表(学堂注册表、registry 的 nav/home、书目索引、镜头的 flowHref…),返回 { links, dynamic }:
 *   对象字面量键 to / href / home / path / xxxHref(flowHref、chapterHref)后跟字符串或模板
 *   纯字符串数组项(见 takeArrayItems)
 * 只认完全静态的 /… 路径;路径段里带 ${} 的模板只计 dynamic;插值只在 #锚 / ?查询 里的照收路径部分。
 */
export function extractJsLinks(src) {
  const c = linkCollector(src)
  const PROP = /(?<![\w.$-])(to|href|home|path|[a-z]\w*Href):\s*(?:'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`)/g
  for (const m of src.matchAll(PROP)) {
    const [, key, s1, d1, tpl] = m
    c.take(s1 ?? d1 ?? tpl, m.index, `${key}:`)
  }
  takeArrayItems(src, c)
  return { links: c.links, dynamic: c.dynamic }
}

/** 从 Markdown 文档的反引号里抽 /… 路径(只作 warn:文档里的路径可能是参数示例) */
export function extractDocPaths(src) {
  const lineOf = lineIndexer(src)
  const out = []
  for (const m of src.matchAll(/`([^`\n]+)`/g)) {
    for (const t of m[1].matchAll(/(?<![\w./-])\/(?!\/)[^\s`，。、；：（）()[\]]*/g)) {
      out.push({ path: t[0], line: lineOf(m.index) })
    }
  }
  return out
}

/**
 * 实体存在检查:路由匹配上了还不够,参数得指向真有的东西。按命中的**路由模式**分派;
 * 返回 null = 通过,字符串 = 坏在哪。ctx 里缺哪份数据,对应那项就不查。
 */
export function makeEntityChecker(ctx) {
  const {
    corpusKeys = new Set(), textMeta = {}, manifest = {}, hexIds, yijingClassics, shiliIds,
    debateIds, debateArticleIds, ditiansuiCaseIds, mingliLearnKeys, bookChapters,
  } = ctx
  const isInt = (v) => /^\d+$/.test(String(v))
  const bookOf = (c, slug) => textMeta[c]?.find((t) => t.slug === slug && t.status !== 'pending')
  const hasBaihua = (c, slug, ch) => !!manifest.baihua?.[c]?.[slug]?.chapters?.[String(ch)]
  const inSet = (set, v, why) => (set && !set.has(v) ? why : null)

  return function checkEntity(pattern, params) {
    const p = params
    switch (pattern) {
      case '/hexagram/:id':
      case '/hexagram/:id/baihua':
        if (!isInt(p.id) || (hexIds && !hexIds.has(Number(p.id)))) return `无第 ${p.id} 卦`
        if (pattern.endsWith('/baihua') && !hasBaihua('yijing', 'hexagrams', p.id)) return `第 ${p.id} 卦无白话`
        return null
      case '/classics/:book/:chapter':
      case '/classics/:book/:chapter/baihua': {
        if (!yijingClassics) return null
        const b = yijingClassics[p.book]
        if (!b) return `经传无「${p.book}」`
        if (!isInt(p.chapter) || !b.chapters?.some((c) => c.no === Number(p.chapter))) return `${p.book} 无第 ${p.chapter} 章`
        if (pattern.endsWith('/baihua') && !hasBaihua('yijing', p.book, p.chapter)) return `${p.book} 第 ${p.chapter} 章无白话`
        return null
      }
      case '/shili/:id': return inSet(shiliIds, p.id, `无筮例「${p.id}」`)
      case '/debates/:id': return inSet(debateIds, p.id, `无辩题「${p.id}」`)
      case '/debates/:id/article':
        return inSet(debateIds, p.id, `无辩题「${p.id}」`) || inSet(debateArticleIds, p.id, `辩题「${p.id}」无白话讲解`)
      case '/mingli/ditiansui/cases/:id': return inSet(ditiansuiCaseIds, p.id, `无命例「${p.id}」`)
      case '/mingli/learn/:topic': return inSet(mingliLearnKeys, p.topic, `学堂无「${p.topic}」篇`)
      case '/books/:slug':
      case '/books/:slug/overview':
        return bookChapters && !bookChapters.has(p.slug) ? `书房无「${p.slug}」` : null
      case '/books/:slug/:chapter':
        if (!bookChapters) return null
        if (!bookChapters.has(p.slug)) return `书房无「${p.slug}」`
        return bookChapters.get(p.slug).has(String(p.chapter)) ? null : `《${p.slug}》无第 ${p.chapter} 章`
      default:
        break
    }
    const [, c, ...rest] = pattern.split('/')
    if (!corpusKeys.has(c)) return null
    const book = p.slug !== undefined ? bookOf(c, p.slug) : null
    switch ('/' + rest.join('/')) {
      case '/school': return manifest.school?.[c] ? null : `${c} 组无家级导读`
      case '/:slug': return book ? null : `${c} 组书目无「${p.slug}」(或尚 pending)`
      case '/:slug/daodu': return manifest.daodu?.[c]?.[p.slug] ? null : `${c}/${p.slug} 无书级导读`
      case '/:slug/:chapter':
        if (!book) return `${c} 组书目无「${p.slug}」(或尚 pending)`
        return isInt(p.chapter) && Number(p.chapter) >= 1 && Number(p.chapter) <= book.sections
          ? null
          : `${c}/${p.slug} 无第 ${p.chapter} 章(共 ${book.sections} 章)`
      case '/:slug/baihua/:chapter': return hasBaihua(c, p.slug, p.chapter) ? null : `${c}/${p.slug} 第 ${p.chapter} 章无白话`
      default: return null
    }
  }
}

/** 一条站内路径的判定:静态文件查 public/,其余走 App 路由 + 实体检查。null = 通过 */
export function makeSitePathChecker({ ranked, checkEntity, fileExists = () => true }) {
  return function checkSitePath(p) {
    const last = p.split('/').pop()
    if (/\.[A-Za-z0-9]+$/.test(last)) return fileExists(p) ? null : 'public/ 下无此静态文件'
    const hits = matchRoutes(ranked, p)
    if (!hits.length) return 'App.jsx 无路由能匹配'
    const why = checkEntity(hits[0].path, hits[0].params)
    return why ? `${why} · 命中路由 ${hits[0].path}` : null
  }
}

/**
 * og 索引一片的校验:{ 路径: [标题, 摘要, 正文] } 的每个键 —— 片号对不对(中间件按 shardKey(路径) 取片,
 * 放错片即静默查不到)、是不是站内绝对路径、过路由 + 实体检查。返回坏的 [{ href, why }]。
 */
export function checkOgShard(shardNo, entries, checkSitePath, shardKey = ogShardKey) {
  const bad = []
  for (const href of Object.keys(entries)) {
    const want = shardKey(href)
    const whys = [
      want !== shardNo ? `应在第 ${want} 片,中间件按路径哈希取片,放错即查不到` : null,
      isSiteAbs(href) ? checkSitePath(splitHref(href)) : '不是站内绝对路径',
    ].filter(Boolean)
    if (whys.length) bad.push({ href, why: whys.join(';') })
  }
  return bad
}

// ═══════════════════════════════════════════════════════════════════════
// main:白话资源 / 搜索索引 / JSX 手写链接 / navigate() / .js 链接表 / og 索引 / 文档路径
// ═══════════════════════════════════════════════════════════════════════

async function main() {
  const errors = []
  const warnings = []
  const err = (msg) => errors.push(msg)
  const registry = await import(pathToFileURL(path.join(ROOT, 'src/sites/registry.js')).href)
  const { SITES } = registry

  const SITE_KEYS = new Set(SITES.map((s) => s.key))
  const CORPUS_KEYS = new Set(['dao', 'fo', 'ru', 'xin', 'fa', 'mo', 'bing', 'zong', 'zhongyi', 'moulue', 'tangshi', 'songci', 'yuanqu', 'mingli'])
  // 下面几条路由正则里的 corpus 分支一律由 CORPUS_KEYS 派生 —— 别再手写第二份清单。
  // (加诗词曲三组时踩过:这个 Set 加了、正则里那三份写死的清单忘了加,整组章链全被判坏链。)
  const CORPUS_ALT = [...CORPUS_KEYS].join('|')
  const STATIC_ROUTES = new Set([
    '/',
    '/hexagram',
    '/hexagrams',
    '/workbench',
    '/classics',
    '/basics',
    '/basics/yinyang',
    '/basics/hetu-luoshu',
    '/basics/xiaoxi',
    '/basics/shicao',
    '/basics/meihua',
    '/basics/jinqian',
    '/basics/yuanliu',
    '/basics/shishi',
    '/basics/guahua',
    '/basics/tuiyan',
    '/basics/glossary',
    '/shili',
    '/me',
    '/concepts',
    '/timeline',
    '/renwu',
    '/debates',
    '/about',
    // 二十四期 · 交互化改造(design-v24 §11)
    '/ru/lunyu/renwu',
    '/dao/cantongqi/moon',
    '/fo/concepts',
    '/ru/lineage',
    '/dao/zhuangzi/fables',
    '/ru/shijing/map',
    '/zong/zhanguoce/map',
  '/rhyme',
  ])
  for (const s of SITES) {
    STATIC_ROUTES.add(s.home)
    for (const n of s.nav || []) STATIC_ROUTES.add(n.to)
    if (s.key !== 'yijing') STATIC_ROUTES.add(`${s.home}/me`)
  }

  const manifest = readJson(path.join(CONTENT, 'manifest.json'))
  const search = readJson(path.join(CONTENT, 'search/index.json'))
  const searchRecords = Array.isArray(search.records) ? search.records : []
  const hexagrams = readJson(path.join(DATA, 'yijing/hexagrams.json'))
  const hexIds = new Set(hexagrams.map((h) => h.id))
  const shiliIds = new Set(exists(path.join(DATA, 'yijing/shili.json')) ? readJson(path.join(DATA, 'yijing/shili.json')).map((s) => s.id) : [])
  const debateIds = new Set(exists(path.join(DATA, 'debates/index.json')) ? readJson(path.join(DATA, 'debates/index.json')).topics.map((t) => t.id) : [])
  const textMeta = {}
  for (const c of CORPUS_KEYS) {
    const f = path.join(DATA, c, 'texts.json')
    textMeta[c] = exists(f) ? readJson(f) : []
  }
  const yijingClassics = {}
  for (const slug of ['xici-shang', 'xici-xia', 'shuogua', 'xugua', 'zagua']) {
    const f = path.join(DATA, `yijing/classics/${slug}.json`)
    if (exists(f)) yijingClassics[slug] = readJson(f)
  }

  function hasBaihua(corpus, slug, ch) {
    return !!manifest.baihua?.[corpus]?.[slug]?.chapters?.[String(ch)]
  }

  function hasCorpusChapter(corpus, slug, ch) {
    const meta = textMeta[corpus]?.find((t) => t.slug === slug && t.status !== 'pending')
    if (!meta) return false
    return Number(ch) >= 1 && Number(ch) <= meta.sections
  }

  function verifyPath(rawHref) {
    if (!rawHref || rawHref.startsWith('http')) return true
    const href = rawHref.split('#')[0].split('?')[0] || '/'
    if (STATIC_ROUTES.has(href)) return true

    let m = href.match(/^\/hexagram\/(\d+)(?:\/baihua)?$/)
    if (m) {
      const id = Number(m[1])
      if (!hexIds.has(id)) return false
      return href.endsWith('/baihua') ? hasBaihua('yijing', 'hexagrams', id) : true
    }

    m = href.match(/^\/classics\/([^/]+)\/(\d+(?:-\d+)?)(?:\/baihua)?$/)
    if (m) {
      const [, slug, chRaw] = m
      const ch = Number(chRaw)
      const book = yijingClassics[slug]
      if (!book?.chapters?.some((c) => c.no === ch)) return false
      return href.endsWith('/baihua') ? hasBaihua('yijing', slug, ch) : true
    }

    m = href.match(/^\/shili\/([^/]+)$/)
    if (m) return shiliIds.has(m[1])

    m = href.match(/^\/debates\/([^/]+)$/)
    if (m) return debateIds.has(m[1])

    // 家级导读 /<组>/school 与书级导读 /<组>/<书>/daodu ——
    // 必须排在下面那条 /<组>/<slug> 之前,否则 school 会被当成书名去查 texts.json。
    // 组名一律从 CORPUS_ALT 派生,**不再手写第二份清单**:诗词曲三组上线时这两条曾漏掉,
    // 而 build-content-assets 是自动发现 daodu/school 的,于是新组的导读被判成坏链(同 93e906e)。
    m = href.match(new RegExp(`^/(${CORPUS_ALT})/school$`))
    if (m) return !!manifest.school?.[m[1]]

    m = href.match(new RegExp(`^/(${CORPUS_ALT})/([^/]+)/daodu$`))
    if (m) return !!manifest.daodu?.[m[1]]?.[m[2]]

    m = href.match(new RegExp(`^/(${CORPUS_ALT})/([^/]+)$`))
    if (m) return !!textMeta[m[1]]?.find((t) => t.slug === m[2] && t.status !== 'pending')

    m = href.match(new RegExp(`^/(${CORPUS_ALT})/([^/]+)/(\\d+)$`))
    if (m) return hasCorpusChapter(m[1], m[2], Number(m[3]))

    // 白话章键有两种:整章用数字,细粒度用「组-序」/「卷-序」(诗经一诗一篇、传习录一条一篇、
    // 长短经一篇一篇)。hasBaihua 本就按字符串查 manifest,故这里只需放开正则、且**不可** Number()
    // ——Number('3-9') 是 NaN,会把所有细粒度白话判成坏链(诗经诗级白话上线时即埋下,
    // 直到本次上线前跑 check-links 才暴露,428 个错误全是它)。
    m = href.match(new RegExp(`^/(${CORPUS_ALT})/([^/]+)/baihua/(\\d+(?:-\\d+)?)$`))
    if (m) return hasBaihua(m[1], m[2], m[3])

    return false
  }

  function baihuaRoute(corpus, slug, ch) {
    if (corpus === 'yijing') return slug === 'hexagrams' ? `/hexagram/${ch}/baihua` : `/classics/${slug}/${ch}/baihua`
    return `/${corpus}/${slug}/baihua/${ch}`
  }

  for (const [corpus, books] of Object.entries(manifest.baihua || {})) {
    for (const [slug, data] of Object.entries(books)) {
      for (const [ch, meta] of Object.entries(data.chapters || {})) {
        const file = path.join(ROOT, 'public', meta.path)
        if (!exists(file)) err(`白话资源缺失: ${corpus}/${slug}#${ch} -> ${meta.path}`)
        if (!verifyPath(baihuaRoute(corpus, slug, ch))) err(`白话路由无效: ${corpus}/${slug}#${ch}`)
      }
    }
  }

  if (!Array.isArray(search.records) || searchRecords.length !== search.count) {
    err(`搜索索引 count 不一致: ${searchRecords.length}/${search.count}`)
  }
  const ids = new Set()
  for (const r of searchRecords) {
    if (!r.id || ids.has(r.id)) err(`搜索记录 id 缺失/重复: ${r.id || '(empty)'}`)
    ids.add(r.id)
    if (!SITE_KEYS.has(r.site) && r.site !== 'portal') err(`搜索记录 site 非法: ${r.id} -> ${r.site}`)
    if (!verifyPath(r.href)) err(`搜索记录坏链: ${r.id} -> ${r.href}`)
  }

  if (!Array.isArray(search.shards) || !search.shards.length) {
    err('搜索分片目录缺失')
  } else {
    for (const key of search.shards) {
      const file = path.join(CONTENT, 'search/shards', `${key}.json`)
      if (!exists(file)) {
        err(`搜索分片缺失: ${key}`)
        continue
      }
      const shard = readJson(file)
      for (const [token, list] of Object.entries(shard.tokens || {})) {
        if (!token || !Array.isArray(list)) {
          err(`搜索分片格式错误: ${key}/${token || '(empty)'}`)
          continue
        }
        for (const idx of list) {
          if (!Number.isInteger(idx) || idx < 0 || idx >= searchRecords.length) {
            err(`搜索分片记录越界: ${key}/${token} -> ${idx}`)
          }
        }
      }
    }
  }

  // ── JSX 里手写的站内链接(M9)──────────────────────────────────────
  // 路由表从 App.jsx 现解析(不另抄一份),按 react-router 排名取实际命中的那条,再查参数指向的实体在不在。
  const idents = Object.fromEntries(Object.entries(registry).filter(([, v]) => typeof v === 'string'))
  const { routes, warnings: routeWarns } = parseAppRoutes(fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8'), { idents })
  warnings.push(...routeWarns)
  const ranked = rankRoutes(routes)

  const optSet = (file, pick) => (exists(file) ? new Set(pick(readJson(file))) : undefined)
  const debateArticleDir = path.join(DATA, 'debates/articles')
  const debateArticleIds = exists(debateArticleDir)
    ? new Set(fs.readdirSync(debateArticleDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
    : undefined
  const ditiansuiCaseIds = optSet(path.join(DATA, 'mingli/cases/ditiansui.json'), (d) => d.cases.map((c) => c.id))
  const { LEARN_TOPICS } = await import(pathToFileURL(path.join(ROOT, 'src/features/mingli/learn/mingliLearnTopics.js')).href)
  const mingliLearnKeys = new Set(LEARN_TOPICS.map((t) => t.key))
  const booksIndexFile = path.join(DATA, 'books/index.json')
  const bookChapters = exists(booksIndexFile)
    ? new Map(readJson(booksIndexFile).map((b) => [b.slug, new Set((b.chapters || []).map((c) => String(c.no)))]))
    : undefined

  const checkEntity = makeEntityChecker({
    corpusKeys: CORPUS_KEYS, textMeta, manifest, hexIds, yijingClassics, shiliIds,
    debateIds, debateArticleIds, ditiansuiCaseIds, mingliLearnKeys, bookChapters,
  })
  const checkSitePath = makeSitePathChecker({
    ranked, checkEntity, fileExists: (p) => exists(path.join(ROOT, 'public', p)),
  })

  // 源码按扩展名分两份:.jsx 走 JSX 扫描,.js 走链接表扫描;navigate() 两份都扫。测试文件一律不扫。
  const jsxFiles = []
  const jsFiles = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.jsx') && !e.name.endsWith('.test.jsx')) jsxFiles.push(p)
      else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) jsFiles.push(p)
    }
  }
  walk(path.join(ROOT, 'src'))
  jsxFiles.sort()
  jsFiles.sort()
  const srcOf = new Map([...jsxFiles, ...jsFiles].map((f) => [f, fs.readFileSync(f, 'utf8')]))

  // 一类源码链接的统一过一遍:逐文件提取 → checkSitePath → 坏的进 errors(文件:行 → 路径(原因 · 命中路由))
  const scanSource = (label, files, extract) => {
    const st = { files: 0, links: 0, dynamic: 0, bad: 0, calls: 0, navigateTo: 0 }
    for (const file of files) {
      const r = extract(srcOf.get(file))
      if (r.links.length || r.dynamic || r.calls) st.files++
      st.links += r.links.length
      st.dynamic += r.dynamic
      st.calls += r.calls || 0
      for (const l of r.links) {
        if (l.kind === '<Navigate>') st.navigateTo++
        const why = checkSitePath(l.path)
        if (why) {
          st.bad++
          err(`${label}坏链: ${path.relative(ROOT, file)}:${l.line} → ${l.raw}(${why})`)
        }
      }
    }
    return st
  }
  const jsx = scanSource('JSX ', jsxFiles, extractJsxLinks)
  const nav = scanSource('navigate() ', [...jsxFiles, ...jsFiles], extractNavigateCalls)
  const jsTable = scanSource('.js 链接表', jsFiles, extractJsLinks)

  // ── og 索引(public/content/og/<片号>.json,{ 路径: [标题, 摘要, 正文] })────────
  // 键即分享卡 / SEO 正文所对应的页面路径:同样过路由 + 实体检查,另核片号(见 checkOgShard)。
  const ogDir = path.join(CONTENT, 'og')
  const og = { shards: 0, paths: 0, bad: 0 }
  if (!exists(ogDir)) {
    err('og 索引目录缺失: public/content/og(先跑 npm run content:build)')
  } else {
    const shardFiles = fs.readdirSync(ogDir).filter((f) => /^\d+\.json$/.test(f)).sort((x, y) => parseInt(x) - parseInt(y))
    for (const f of shardFiles) {
      og.shards++
      const no = parseInt(f)
      const entries = readJson(path.join(ogDir, f))
      og.paths += Object.keys(entries).length
      for (const { href, why } of checkOgShard(no, entries, checkSitePath)) {
        og.bad++
        err(`og 坏链: 片 ${no} → ${href}(${why})`)
      }
    }
    if (!shardFiles.length) err('og 索引为空: public/content/og 下没有分片')
  }

  // ── 文档里反引号中的路径:只 warn(可能是参数示例)────────────────────
  const normPattern = (p) => segsOf(p).map((s) => (s.startsWith(':') ? ':' : s)).join('/')
  const routePatterns = new Set(routes.map((r) => normPattern(r.path)))
  let docPaths = 0
  let docSkipped = 0
  for (const rel of ['docs/review-2026-09-30.md', 'docs/interactive-plan.md']) {
    const file = path.join(ROOT, rel)
    if (!exists(file)) {
      warnings.push(`文档不存在,跳过: ${rel}`)
      continue
    }
    for (const d of extractDocPaths(fs.readFileSync(file, 'utf8'))) {
      const p = splitHref(d.path)
      if (/[*<>{}]/.test(p)) {
        docSkipped++
        continue
      }
      docPaths++
      const why = /(^|\/):/.test(p)
        ? (routePatterns.has(normPattern(p)) ? null : 'App.jsx 无此路由模式')
        : checkSitePath(p)
      if (why) warnings.push(`文档路径可疑: ${rel}:${d.line} → ${d.path}(${why})`)
    }
  }

  const summaries = [
    `JSX 手写链接: ${jsxFiles.length} 个文件 · ${jsx.links} 条静态链接(坏 ${jsx.bad};含 <Navigate to> ${jsx.navigateTo} 条)· ${jsx.dynamic} 处动态拼接未校 · App 路由 ${routes.length} 条`,
    `navigate() 调用: ${nav.files} 个文件 · ${nav.calls} 处调用 → ${nav.links} 条静态路径(坏 ${nav.bad})· ${nav.dynamic} 处动态未校(扫 ${jsxFiles.length + jsFiles.length} 个 .jsx/.js)`,
    `.js 链接表: ${jsTable.files} 个文件 · ${jsTable.links} 条静态路径(坏 ${jsTable.bad})· ${jsTable.dynamic} 处模板拼接未校(扫 ${jsFiles.length} 个 .js)`,
    `og 索引: ${og.shards} 片 · ${og.paths} 条路径(坏 ${og.bad})`,
    `文档路径: ${docPaths} 条(示例跳过 ${docSkipped};只 warn)`,
  ]

  if (warnings.length) {
    console.warn(`⚠ ${warnings.length} 条提示(不算失败):`)
    for (const w of warnings) console.warn(`- ${w}`)
  }

  if (errors.length) {
    console.error(`✗ 链接校验失败, ${errors.length} 个错误:`)
    for (const e of errors) console.error(`- ${e}`)
    for (const line of summaries) console.error(line)
    process.exit(1)
  }

  console.log(`✓ 链接校验通过: ${Object.keys(manifest.baihua || {}).length} 组白话, ${searchRecords.length} 条搜索记录, ${search.shards?.length || 0} 个搜索分片`)
  for (const line of summaries) console.log(`✓ ${line}`)
}

const isMain = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) await main()
