#!/usr/bin/env node
// 依据 src/data/debates/<id>.json 同步 index.json 的 topics。
//
// 用法: node scripts/sync-debate-index.mjs [--write]
//
// 为什么要有它:index 的 topic 是辩论文件的**派生物**(标题/类目/概念/问题/家次/轮数/阵营都能算出来),
// 以前靠手工补,加一辩就得记得同步一次,漏了就是列表页少一张卡。这里改成算出来。
// 规则:
//   - 已在 index 里的 topic **保持原有次序**,只把字段更新成与源文件一致(列表页按 topics 顺序排卡);
//   - 源文件里有、index 里没有的 → 追加到末尾;
//   - index 里有、源文件已删的 → 报出来但不自动删(宁可人来确认);
//   - division 由 category 反查(与 src/features/debates/debates.js 的 CATEGORY_ORDER 同一张表)。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'src/data/debates')
const IDX = path.join(DIR, 'index.json')
const WRITE = process.argv.includes('--write')

// 与 debates.js 的 CATEGORY_ORDER 保持一致(那边是显示次序,这里是反查表)
const DIVISION_OF = {
  '天人 · 形上 · 道': 'tiandao',
  '性与心': 'xinxing',
  '生死 · 身 · 苦乐': 'xinxing',
  '治道与政治': 'zhidao',
  '伦理 · 义利 · 爱孝': 'zhidao',
  '礼 · 文 · 乐': 'zhidao',
  '工夫与学': 'weixue',
  '名实 · 言辩 · 知': 'weixue',
}

const idx = JSON.parse(fs.readFileSync(IDX, 'utf8'))
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')

// format(形态分面)本可由 schools 算出:单组 = 组内多方、跨组 = 跨组会通。
// 但只有 10/75 条填过,列表页 `fmts.includes(t.format)` 一筛就把其余 65 条全滤掉——分面等于是坏的。
// 故:**已填的一律保留**(其中几条儒/心跨组却标 intra,是策展人把「儒门内部流变」看作组内,不覆盖),
// 没填的按 schools 算,补齐后 75 条都有形态,筛选才是对的。
const derivedFormat = (d) => (new Set(d.schools.map((s) => s.group)).size === 1 ? 'intra' : 'synthesis')

const topicOf = (d, prev) => {
  const division = DIVISION_OF[d.category]
  if (!division) throw new Error(`${d.id}: 类目「${d.category}」不在分门表里,先在 debates.js 的 CATEGORY_ORDER 与本脚本的 DIVISION_OF 里登记`)
  return {
    ...prev,                      // 保留 index 里既有的、算不出来的策展字段
    id: d.id,
    title: d.title,
    division,
    category: d.category,
    concept: d.concept,
    question: d.question,
    turns: d.rounds.reduce((n, r) => n + r.turns.length, 0),
    status: 'done',
    // key 是全站统一过的参辩家标识(check-data 有跨辩一致性校验),拓扑图靠它对接同一批人;
    // 早先 index 只留 label,按 label 匹配会踩「同名不同人 / 书名人名混用」的坑。
    schools: d.schools.map((s) => ({ key: s.key, label: s.label, group: s.group, seal: s.seal, stance: s.stance })),
    format: prev?.format || derivedFormat(d),
  }
}

const prevById = Object.fromEntries(idx.topics.map((t) => [t.id, t]))
const bySlug = {}
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))
  bySlug[d.id] = topicOf(d, prevById[d.id])
}

// 比对要**忽略键序**:两侧字段一模一样、只是键的排列不同,不该算「有变化」
const canon = (v) => JSON.stringify(v, (k, x) =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]]))
    : x)

const kept = [], updated = [], added = [], orphan = []
const next = []
for (const t of idx.topics) {
  if (bySlug[t.id]) {
    const n = bySlug[t.id]
    ;(canon(n) === canon(t) ? kept : updated).push(t.id)
    next.push(n)
    delete bySlug[t.id]
  } else {
    orphan.push(t.id)
    next.push(t)          // 源文件没了也不自动删,留着让人确认
  }
}
for (const id of Object.keys(bySlug)) { added.push(id); next.push(bySlug[id]) }

console.log(`辩论文件 ${files.length} 个 · index 原有 ${idx.topics.length} 条`)
console.log(`  不变 ${kept.length} · 字段更新 ${updated.length}${updated.length ? ' → ' + updated.join(' ') : ''}`)
console.log(`  新增 ${added.length}${added.length ? ' → ' + added.join(' ') : ''}`)
if (orphan.length) console.warn(`  ⚠ index 里有、但源文件缺失:${orphan.join(' ')}(未自动删,请确认)`)

if (WRITE) {
  fs.writeFileSync(IDX, JSON.stringify({ ...idx, topics: next }, null, 1) + '\n')
  console.log(`已写入 ${path.relative(ROOT, IDX)}`)
} else {
  console.log('(加 --write 才落盘)')
}
