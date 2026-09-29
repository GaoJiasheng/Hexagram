// 校验闸 · 韵书三种(design-v24 §7 / §0.2)。
// 查:① 三份 json 存在;② 部数(平水韵 106 = 上平15/下平15/上29/去30/入17、词林正韵 19、中原音韵 19);
// ③ 索引自洽(索引里的部 id 都存在、字表里每字都进了索引、异体退查表所指之字确在韵书);
// ④ 抽样(東→上平一東、「中」平仄两收)。生成物来自 scripts/fetch-rhyme.mjs,不手改。
import path from 'node:path'
import fs from 'node:fs'

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
}
