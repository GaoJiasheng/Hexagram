import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as registry from '../src/sites/registry.js'
import {
  parseAppRoutes, rankRoutes, matchRoutes, matchPattern, routeScore,
  extractJsxLinks, extractDocPaths, splitHref, makeEntityChecker, makeSitePathChecker,
  extractNavigateCalls, extractJsLinks, checkOgShard,
} from './check-links.mjs'
import { ogShardKey } from '../server/og-index.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const idents = Object.fromEntries(Object.entries(registry).filter(([, v]) => typeof v === 'string'))
const app = parseAppRoutes(fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8'), { idents })
const ranked = rankRoutes(app.routes)
const best = (p) => matchRoutes(ranked, p)[0]?.path
const all = (p) => matchRoutes(ranked, p).map((m) => m.path)

describe('parseAppRoutes(真 App.jsx)', () => {
  it('解析无 warning,兜底 * 不入表,插值全部展开', () => {
    expect(app.warnings).toEqual([])
    const paths = app.routes.map((r) => r.path)
    expect(paths).not.toContain('*')
    expect(paths.some((p) => p.includes('${'))).toBe(false)
  })
  it('`[...].map((c) =>` 里的模板 path 逐组展开;path={MASTER_PORTAL_PATH} 按 registry 解析', () => {
    const paths = app.routes.map((r) => r.path)
    expect(paths).toContain('/ru/me')
    expect(paths).toContain('/mingli/me')
    expect(paths).toContain('/tangshi/:slug/baihua/:chapter')
    expect(paths).toContain(registry.MASTER_PORTAL_PATH)
  })
  it('小样:引号 / 花括号 / 纯字面量模板 / 解析不了的标识符', () => {
    const src = [
      '<Route path="/a" element={<A />} />',
      "<Route path={'/b'} element={<B />} />",
      '<Route path={`/c`} element={<C />} />',
      '<Route path={NOPE} element={<D />} />',
      '<Route path="*" element={<E />} />',
    ].join('\n')
    const r = parseAppRoutes(src)
    expect(r.routes).toEqual([{ path: '/a', line: 1 }, { path: '/b', line: 2 }, { path: '/c', line: 3 }])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toMatch(/App\.jsx:4/)
  })
})

describe('路由匹配(react-router 排名)', () => {
  it('/ru/lunyu/renwu 同时命中具体路由与 /ru/:slug/:chapter,具体路由排前', () => {
    expect(all('/ru/lunyu/renwu')).toEqual(expect.arrayContaining(['/ru/lunyu/renwu', '/ru/:slug/:chapter']))
    expect(best('/ru/lunyu/renwu')).toBe('/ru/lunyu/renwu')
  })
  it('/dao/cantongqi/moon 走具体页,不落 /dao/:slug/:chapter', () => {
    expect(all('/dao/cantongqi/moon')).toContain('/dao/:slug/:chapter')
    expect(best('/dao/cantongqi/moon')).toBe('/dao/cantongqi/moon')
  })
  it('/fo/concepts 压过 /fo/:slug;/fo/school 同理', () => {
    expect(all('/fo/concepts')).toContain('/fo/:slug')
    expect(best('/fo/concepts')).toBe('/fo/concepts')
    expect(best('/fo/school')).toBe('/fo/school')
  })
  it('四段白话路由不与三段章路由冲突;尾斜杠、大小写照 react-router 宽容', () => {
    expect(best('/ru/shijing/baihua/1-1')).toBe('/ru/:slug/baihua/:chapter')
    expect(best('/ru/lunyu/1')).toBe('/ru/:slug/:chapter')
    expect(best('/ru/')).toBe('/ru')
    expect(best('/Debates/map')).toBe('/debates/map')
  })
  it('坏路径:段数对不上 / 无此前缀 → 无命中', () => {
    expect(all('/ru/lunyu/1/2')).toEqual([])
    expect(all('/no-such-page')).toEqual([])
    expect(all('/debates/x/y/z')).toEqual([])
  })
  it('matchPattern 取参数、routeScore 静态高于动态', () => {
    expect(matchPattern('/mingli/learn/:topic', '/mingli/learn/qizhu')).toEqual({ topic: 'qizhu' })
    expect(matchPattern('/docs/*', '/docs/a/b')).toEqual({ '*': 'a/b' })
    expect(routeScore('/ru/lunyu/renwu')).toBeGreaterThan(routeScore('/ru/:slug/:chapter'))
  })
})

// 小样数据的站内路径判定器:实体检查、navigate()、.js 链接表、og 几组共用
const checkEntity = makeEntityChecker({
  corpusKeys: new Set(['ru']),
  textMeta: { ru: [{ slug: 'lunyu', sections: 20 }, { slug: 'draft', sections: 3, status: 'pending' }] },
  manifest: { school: { ru: {} }, daodu: { ru: { lunyu: {} } }, baihua: { ru: { lunyu: { chapters: { 1: {} } } } } },
  hexIds: new Set([1, 2]),
  debateIds: new Set(['renxing']),
  mingliLearnKeys: new Set(['qizhu']),
})
const check = makeSitePathChecker({ ranked, checkEntity, fileExists: (p) => p === '/feed.xml' })

describe('实体检查 + 站内路径判定', () => {
  it('实体在 → 通过', () => {
    for (const p of ['/ru/lunyu', '/ru/lunyu/20', '/ru/lunyu/daodu', '/ru/lunyu/baihua/1', '/ru/school', '/ru/lunyu/renwu', '/hexagram/2', '/debates/renxing', '/mingli/learn/qizhu', '/feed.xml']) {
      expect(check(p), p).toBeNull()
    }
  })
  it('实体不在 → 报坏并说明命中的路由', () => {
    expect(check('/ru/lunyu/21')).toMatch(/无第 21 章.*\/ru\/:slug\/:chapter/)
    expect(check('/ru/nosuch')).toMatch(/无「nosuch」/)
    expect(check('/ru/draft')).toMatch(/pending/)
    expect(check('/ru/lunyu/baihua/2')).toMatch(/无白话/)
    expect(check('/hexagram/65')).toMatch(/无第 65 卦/)
    expect(check('/debates/nope')).toMatch(/无辩题/)
    expect(check('/mingli/learn/nope')).toMatch(/学堂无/)
    expect(check('/robots-missing.txt')).toMatch(/静态文件/)
    expect(check('/no-such-page')).toMatch(/无路由/)
  })
})

describe('extractJsxLinks', () => {
  const src = [
    '<Link to="/ru/lineage">学脉</Link>',                    // 1 静态
    "<Link to={'/fo/concepts'}>名相</Link>",                  // 2 花括号字符串
    '<Link to={`/debates/map`} />',                          // 3 无插值模板 = 静态
    '<Link to={`/hexagram/${id}`} />',                       // 4 插值在路径段 → 动态
    '<Link to={`/renwu#${pid}`} />',                         // 5 插值只在锚里 → 路径静态
    '<a href="/about#community">x</a> <a href="https://x.y">y</a> <a href="//cdn/x">z</a>',  // 6
    '<Link to={site.home} /> <a href="#top">t</a>',           // 7 表达式 → 动态;纯锚不收
    "const to = '/not-a-link'",                               // 8 变量赋值不算
    "const NAV = [{ to: '/basics', label: '学堂' }]",          // 9 对象字面量
    '<Link to="/workbench?method=meihua" data-to="/skip" />', // 10 查询截掉;data-to 不算
    '<Route path="/zhuzi" element={<Navigate to="/debates/map" replace />} />',  // 11 <Navigate to> 走 to= 扫描
    "const HINT = { trigram: ['/basics/yinyang', '学阴阳八卦'] }", // 12 纯字符串数组项
    "const v = MAP[`${a}/${b}`]; f(x, '/not-array')",           // 13 成员访问 / 函数实参 都不是数组项
  ].join('\n')
  const { links, dynamic } = extractJsxLinks(src)
  it('只收完全静态的站内路径,带行号,#/? 截掉', () => {
    expect(links.map((l) => [l.line, l.path])).toEqual([
      [1, '/ru/lineage'], [2, '/fo/concepts'], [3, '/debates/map'], [5, '/renwu'],
      [6, '/about'], [10, '/workbench'], [11, '/debates/map'], [9, '/basics'], [12, '/basics/yinyang'],
    ])
  })
  it('动态拼接只计数', () => {
    expect(dynamic).toBe(2)
  })
  it('<Navigate to> 已由 to= 扫描覆盖并单独标注;真 App.jsx 的两处重定向都在', () => {
    expect(links.find((l) => l.line === 11).kind).toBe('<Navigate>')
    const appNav = extractJsxLinks(fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf8')).links.filter((l) => l.kind === '<Navigate>')
    expect(appNav.map((l) => l.path)).toEqual(expect.arrayContaining(['/', '/debates/map']))
    for (const l of appNav) expect(check(l.path), l.path).toBeNull()
  })
  it('splitHref', () => {
    expect(splitHref('/a/b?x=1#y')).toBe('/a/b')
    expect(splitHref('#top')).toBe('')
  })
})

describe('extractDocPaths', () => {
  it('只取反引号里的 /… 路径,带行号', () => {
    const md = '看 `/ru/lunyu/renwu` 与 `/ru/shijing/3?p=2`\n文件 `src/App.jsx` 不算,`/debates/*` 照取(由调用方跳过)'
    expect(extractDocPaths(md)).toEqual([
      { path: '/ru/lunyu/renwu', line: 1 },
      { path: '/ru/shijing/3?p=2', line: 1 },
      { path: '/debates/*', line: 2 },
    ])
  })
})

describe('extractNavigateCalls', () => {
  const src = [
    'const navigate = useNavigate()',
    "navigate('/ru/lunyu/20')",                         // 2 静态 → 正例
    'navigate(`/ru/lunyu/21`)',                         // 3 静态模板 → 实体不在(反例)
    'navigate(`/hexagrams?view=${v}`)',                 // 4 插值只在查询 → 路径静态
    'navigate(`/hexagram/${id}`); navigate(r.to)',       // 5 路径插值 / 表达式 → 动态
    'navigate(-1); navigate(`#${anchorId(no)}`)',        // 6 历史回退 / 纯锚 → 不收不计
    "const nav = useNavigate(); nav('/no-such-page')",   // 7 别名也认 → 无路由(反例)
    "router.navigate('/skip'); function navigate(p) {}", // 8 别家方法 / 定义 → 不算调用
  ].join('\n')
  const r = extractNavigateCalls(src)
  it('收静态首参(含别名),动态只计数,数字与锚不收', () => {
    expect(r.links.map((l) => [l.line, l.path])).toEqual([
      [2, '/ru/lunyu/20'], [3, '/ru/lunyu/21'], [4, '/hexagrams'], [7, '/no-such-page'],
    ])
    expect(r.dynamic).toBe(2)
    expect(r.calls).toBe(8)
  })
  it('过同一套路由 + 实体检查:正例通过,反例报原因与命中路由', () => {
    expect(check('/ru/lunyu/20')).toBeNull()
    expect(check('/hexagrams')).toBeNull()
    expect(check('/ru/lunyu/21')).toMatch(/无第 21 章.*命中路由 \/ru\/:slug\/:chapter/)
    expect(check('/no-such-page')).toMatch(/无路由/)
  })
})

describe('extractJsLinks(.js 链接表)', () => {
  const src = [
    "export const LEARN = [{ id: 'yinyang', to: '/basics/yinyang' }]", // 1 to:
    "  home: '/ru', path: '/debates/renxing',",                      // 2 home: / path:
    "  href: '/ru/nosuch',",                                          // 3 实体不在(反例)
    "  { to: '/hexagrams', match: ['/hexagrams', '/hexagram/'] },",    // 4 纯字符串数组项
    '  flowHref: `/mingli/learn/qizhu?${qs}`, chapterHref: `/mingli/zhenquan/${ch}`,', // 5 xxxHref:插值在查询照收 / 在路径计动态
    '  to: `/basics/glossary#${g.key}`, to: `/hexagram/${h.id}`,',    // 6 锚插值照收 / 路径插值计动态
    "const MIXED = ['/mixed', x]; const X = '/assign'; f(a, '/arg', b)", // 7 混合数组 / 赋值 / 实参 → 不收
    "const k = LOADERS[`${corpus}/${slug}`]; aliases: ['周易', 'http://x/y']", // 8 成员访问不算;非站内不收
  ].join('\n')
  const r = extractJsLinks(src)
  it('收 to/href/home/path/xxxHref 与纯字符串数组里的静态 /… 路径', () => {
    expect(r.links.map((l) => [l.line, l.kind, l.path])).toEqual([
      [1, 'to:', '/basics/yinyang'],
      [2, 'home:', '/ru'], [2, 'path:', '/debates/renxing'],
      [3, 'href:', '/ru/nosuch'],
      [4, 'to:', '/hexagrams'],
      [5, 'flowHref:', '/mingli/learn/qizhu'],
      [6, 'to:', '/basics/glossary'],
      [4, '[数组项]', '/hexagrams'], [4, '[数组项]', '/hexagram/'],
    ])
  })
  it('模板拼接只计数', () => {
    expect(r.dynamic).toBe(2)
  })
  it('正例过、反例报坏', () => {
    for (const p of ['/basics/yinyang', '/ru', '/debates/renxing', '/hexagram/', '/mingli/learn/qizhu']) expect(check(p), p).toBeNull()
    expect(check('/ru/nosuch')).toMatch(/无「nosuch」.*命中路由 \/ru\/:slug/)
  })
  it('真 learnTopics.js 的学堂注册表逐条可达', () => {
    const { links } = extractJsLinks(fs.readFileSync(path.join(ROOT, 'src/features/yijing/learnTopics.js'), 'utf8'))
    expect(links.length).toBeGreaterThanOrEqual(10)
    for (const l of links) expect(matchRoutes(ranked, l.path).length, l.path).toBeGreaterThan(0)
  })
})

describe('checkOgShard(og 索引一片)', () => {
  const put = (...hrefs) => Object.fromEntries(hrefs.map((h) => [h, ['t', 'd', 'b']]))
  it('放对片、路由 + 实体都在 → 无坏', () => {
    const ok = '/ru/lunyu/20'
    expect(checkOgShard(ogShardKey(ok), put(ok), check)).toEqual([])
  })
  it('实体不在 / 无路由 / 放错片 各报原因', () => {
    const bad = '/ru/lunyu/21'
    expect(checkOgShard(ogShardKey(bad), put(bad), check)).toEqual([
      { href: bad, why: expect.stringMatching(/无第 21 章.*命中路由/) },
    ])
    const lost = '/no-such-page'
    expect(checkOgShard(ogShardKey(lost), put(lost), check)[0].why).toMatch(/无路由/)
    const ok = '/ru/lunyu/1'
    const wrong = (ogShardKey(ok) + 1) % 256
    expect(checkOgShard(wrong, put(ok), check)[0].why).toMatch(new RegExp(`应在第 ${ogShardKey(ok)} 片`))
  })
})
