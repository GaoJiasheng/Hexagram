import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as registry from '../src/sites/registry.js'
import {
  parseAppRoutes, rankRoutes, matchRoutes, matchPattern, routeScore,
  extractJsxLinks, extractDocPaths, splitHref, makeEntityChecker, makeSitePathChecker,
} from './check-links.mjs'

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

describe('实体检查 + 站内路径判定', () => {
  const checkEntity = makeEntityChecker({
    corpusKeys: new Set(['ru']),
    textMeta: { ru: [{ slug: 'lunyu', sections: 20 }, { slug: 'draft', sections: 3, status: 'pending' }] },
    manifest: { school: { ru: {} }, daodu: { ru: { lunyu: {} } }, baihua: { ru: { lunyu: { chapters: { 1: {} } } } } },
    hexIds: new Set([1, 2]),
    debateIds: new Set(['renxing']),
    mingliLearnKeys: new Set(['qizhu']),
  })
  const check = makeSitePathChecker({ ranked, checkEntity, fileExists: (p) => p === '/feed.xml' })
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
  ].join('\n')
  const { links, dynamic } = extractJsxLinks(src)
  it('只收完全静态的站内路径,带行号,#/? 截掉', () => {
    expect(links.map((l) => [l.line, l.path])).toEqual([
      [1, '/ru/lineage'], [2, '/fo/concepts'], [3, '/debates/map'], [5, '/renwu'],
      [6, '/about'], [10, '/workbench'], [9, '/basics'],
    ])
  })
  it('动态拼接只计数', () => {
    expect(dynamic).toBe(2)
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
