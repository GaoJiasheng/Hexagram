// 校验闸 · 韵书三种(design-v24 §7 / §0.2)。
// 查:① 三份 json 存在;② 部数(平水韵 106 = 上平15/下平15/上29/去30/入17、词林正韵 19、中原音韵 19);
// ③ 索引自洽(索引里的部 id 都存在、字表里每字都进了索引、异体退查表所指之字确在韵书);
// ④ 抽样(東→上平一東、「中」平仄两收)。生成物来自 scripts/fetch-rhyme.mjs,不手改。
// ⑤ 未收字清单 unlisted.json(M8 · /rhyme 页):存在、三组各有 stats 且与条目合计相符、清单里每字
//    按阅读器同一套查法确实查不到、与按现行韵书 + 诗词原文重算的结果一致(不一致 = 过期,重跑
//    node scripts/gen-rhyme-unlisted.mjs)。
import path from 'node:path'
import fs from 'node:fs'
import { computeUnlisted, RHYME_GROUPS, MAX_EXAMPLES } from './rhyme-unlisted.mjs'
import { rhymePart } from '../../src/features/reader/prosody.js'

const DIR = 'src/data/rhyme'
const PS_EXPECT = { 上平: 15, 下平: 15, 上: 29, 去: 30, 入: 17 }
const chars = (s) => [...(s || '')]

export default function check({ ROOT, err, info, readJson }) {
  const load = (name) => {
    const file = path.join(ROOT, DIR, `${name}.json`)
    if (!fs.existsSync(file)) { err(`韵书: 缺 ${DIR}/${name}.json(node scripts/fetch-rhyme.mjs)`); return null }
    const d = readJson(file)
    if (!Array.isArray(d.parts) || !d.index || typeof d.index !== 'object') { err(`韵书: ${name}.json 缺 parts / index`); return null }
    return d
  }
  const ps = load('pingshui')
  const cl = load('cilin')
  const zy = load('zhongyuan')

  const variantsOk = (name, d, has) => {
    for (const [v, base] of Object.entries(d.variants || {})) {
      if (has(v)) err(`韵书 ${name}: 异体表「${v}」本字已收,不应退查`)
      if (!has(base)) err(`韵书 ${name}: 异体表「${v}→${base}」所指之字韵书未收`)
    }
  }

  let nPs = 0, nPsCi = 0, nCl = 0, nZy = 0
  if (ps) {
    if (ps.parts.length !== 106) err(`韵书 平水韵: 应 106 部,实得 ${ps.parts.length}`)
    for (const [sheng, want] of Object.entries(PS_EXPECT)) {
      const got = ps.parts.filter((p) => p.sheng === sheng).length
      if (got !== want) err(`韵书 平水韵: ${sheng}声应 ${want} 部,实得 ${got}`)
    }
    const ids = new Set(ps.parts.map((p) => p.id))
    if (ids.size !== ps.parts.length) err('韵书 平水韵: 部 id 重复')
    for (const p of ps.parts) {
      if (p.tone !== (p.sheng.endsWith('平') ? '平' : '仄')) err(`韵书 平水韵 ${p.id}: 平仄标错`)
      for (const c of chars(p.chars)) if (!ps.index[c]?.includes(p.id)) { err(`韵书 平水韵 ${p.id}: 「${c}」未进索引`); break }
    }
    for (const [k, v] of Object.entries({ ...ps.index, ...ps.ciIndex })) {
      if (!Array.isArray(v) || !v.length || v.some((id) => !ids.has(id))) { err(`韵书 平水韵: 索引「${k}」指向不存在的部`); break }
    }
    if (JSON.stringify(ps.index['東']) !== '["上平一東"]') err('韵书 平水韵: 抽样「東」应只在上平一東')
    if (!(ps.index['中']?.includes('上平一東') && ps.index['中']?.includes('去一送'))) err('韵书 平水韵: 抽样「中」应平仄两收(一東/一送)')
    variantsOk('平水韵', ps, (c) => !!(ps.index[c] || ps.ciIndex?.[c]))
    nPs = new Set(ps.parts.flatMap((p) => chars(p.chars))).size
    nPsCi = new Set(ps.parts.flatMap((p) => chars(p.ciChars))).size
  }
  if (cl) {
    if (cl.parts.length !== 19) err(`韵书 词林正韵: 应 19 部,实得 ${cl.parts.length}`)
    const ids = new Set(cl.parts.flatMap((p) => (p.sections || []).map((s) => `${p.no}${s.tone}`)))
    cl.parts.forEach((p, i) => { if (p.no !== i + 1) err(`韵书 词林正韵: 第 ${i + 1} 部序号错`) })
    for (const [k, v] of Object.entries(cl.index)) {
      if (!Array.isArray(v) || !v.length || v.some((id) => !ids.has(id))) { err(`韵书 词林正韵: 索引「${k}」指向不存在的部`); break }
    }
    for (const p of cl.parts) if (/[（）()\[\]]/.test(p.chars)) err(`韵书 词林正韵 第${p.no}部: 字表残留括注`)
    variantsOk('词林正韵', cl, (c) => !!cl.index[c])
    nCl = new Set(cl.parts.flatMap((p) => chars(p.chars))).size
  }
  if (zy) {
    if (zy.parts.length !== 19) err(`韵书 中原音韵: 应 19 韵,实得 ${zy.parts.length}`)
    const names = new Set(zy.parts.map((p) => p.name))
    for (const p of zy.parts) {
      for (const k of ['阴平', '阳平', '上', '去']) if (!p.groups?.[k]?.length) err(`韵书 中原音韵 ${p.name}: 缺 ${k}`)
    }
    for (const [k, v] of Object.entries(zy.index)) {
      if (!Array.isArray(v) || !v.length || v.some((n) => !names.has(n))) { err(`韵书 中原音韵: 索引「${k}」指向不存在的韵`); break }
    }
    variantsOk('中原音韵', zy, (c) => !!zy.index[c])
    nZy = new Set(zy.parts.flatMap((p) => Object.values(p.groups).flat().flatMap(chars))).size
  }
  info(`韵书: 平水韵 ${nPs} 字(另【詞】增补 ${nPsCi})· 词林 ${nCl} 字 · 中原 ${nZy} 字`)

  checkUnlisted({ ROOT, err, info, readJson, books: { pingshui: ps, cilin: cl, zhongyuan: zy } })
}

const STAT_KEYS = ['chars', 'lines', 'unlisted', 'distinct', 'endUnlisted', 'endDistinct']
function checkUnlisted({ ROOT, err, info, readJson, books }) {
  const file = path.join(ROOT, DIR, 'unlisted.json')
  if (!fs.existsSync(file)) { err(`韵书: 缺 ${DIR}/unlisted.json(node scripts/gen-rhyme-unlisted.mjs)`); return }
  const u = readJson(file)
  const summary = []
  for (const g of RHYME_GROUPS) {
    const got = (u.groups || []).find((x) => x.corpus === g.corpus)
    const where = `韵书未收字 ${g.label}`
    if (!got) { err(`${where}: unlisted.json 缺该组`); continue }
    if (got.scheme !== g.scheme) err(`${where}: 韵书应为 ${g.scheme},实为 ${got.scheme}`)
    const s = got.stats
    if (!s || STAT_KEYS.some((k) => !Number.isInteger(s[k]) || s[k] < 0)) { err(`${where}: 缺 stats 或 stats 字段不全(${STAT_KEYS.join('/')})`); continue }
    if (!Array.isArray(got.items)) { err(`${where}: 缺 items`); continue }
    const sum = (k) => got.items.reduce((n, x) => n + (x[k] || 0), 0)
    if (sum('count') !== s.unlisted) err(`${where}: 条目次数合计 ${sum('count')} ≠ stats.unlisted ${s.unlisted}`)
    if (sum('endCount') !== s.endUnlisted) err(`${where}: 句末次数合计 ${sum('endCount')} ≠ stats.endUnlisted ${s.endUnlisted}`)
    if (got.items.length !== s.distinct) err(`${where}: 条目 ${got.items.length} ≠ stats.distinct ${s.distinct}`)
    const book = books[g.scheme]
    for (const it of got.items) {
      if (book && rhymePart(it.char, g.scheme, book)) err(`${where}: 「${it.char}」韵书已收(清单过期或查法不一)`)
      if (!Array.isArray(it.examples) || !it.examples.length || it.examples.length > MAX_EXAMPLES) err(`${where}: 「${it.char}」例句应 1–${MAX_EXAMPLES} 条`)
      for (const ex of it.examples || []) {
        if (!g.slugs.includes(ex.slug) || !Number.isInteger(ex.ch) || !Number.isInteger(ex.para)) err(`${where}: 「${it.char}」例句定位不全`)
        if (!String(ex.line || '').includes(it.char)) err(`${where}: 「${it.char}」例句「${ex.line}」不含该字`)
      }
    }
    summary.push(`${g.label} ${s.distinct} 字 ${s.unlisted} 次(${((s.unlisted / (s.chars || 1)) * 100).toFixed(2)}%)· 句末 ${s.endUnlisted}`)
  }
  // 与重算比对:韵书重抓、诗词原文改动后未重跑生成脚本,即报过期
  if (books.pingshui && books.cilin && books.zhongyuan) {
    const fresh = computeUnlisted({ ROOT, readJson, books })
    if (JSON.stringify(fresh.groups) !== JSON.stringify(u.groups) || JSON.stringify(fresh.books) !== JSON.stringify(u.books)) {
      err('韵书未收字: unlisted.json 与按现行韵书 + 诗词原文重算的结果不一致(过期),重跑 node scripts/gen-rhyme-unlisted.mjs')
    }
  }
  info(`韵书未收字: ${summary.join(' · ')}`)
}
