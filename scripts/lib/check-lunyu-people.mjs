// I5 · 论语孔门弟子出场索引 的校验闸(docs/design-v24.md §0.2 / §2)。
// 数据 src/data/ru/lunyu-people.json 由 scripts/gen-lunyu-people.mjs 从原文派生;这里逐条回查:
//   · 每个 hit 的 evidence 是该章原文子串(chapterText),且是该段原文子串、≤20 字、mark 处正是所计称谓
//   · head 是该段原文前缀;term 是此人的名或原文所见称谓
//   · 每人 ≥1 hit(0 hit 的人应从表里删);人数 ≥20;id 不重、同一人同段不重
//   · 排除表里的每个片段原文确有(否则排除表已过时);底本变了而没重跑 gen → 警告
import path from 'node:path'
import { derive, EXCLUDE, SRC, OUT } from '../gen-lunyu-people.mjs'

const EV_MAX = 20
const MIN_PEOPLE = 20

export default function check({ ROOT, err, warn, info, readJson, chapterText }) {
  const tag = '论语人物'
  const data = readJson(path.join(ROOT, OUT))
  const lunyu = readJson(path.join(ROOT, SRC))
  const people = Array.isArray(data?.people) ? data.people : null
  if (!people) { err(`${tag}: ${OUT} 缺 people 数组`); return }

  if (people.length < MIN_PEOPLE) err(`${tag}: 仅 ${people.length} 人,规格要求 ≥${MIN_PEOPLE}`)

  const byNo = new Map(lunyu.chapters.map((c) => [c.no, c]))
  const ids = new Set()
  let hitsTotal = 0, solo = 0
  for (const p of people) {
    const who = `${tag} ${p.name || p.id}`
    if (!p.id || !p.name) err(`${who}: 缺 id / name`)
    if (ids.has(p.id)) err(`${who}: id 重复 ${p.id}`)
    ids.add(p.id)
    if (!p.note || typeof p.note !== 'string') err(`${who}: 缺 note`)
    if (!Array.isArray(p.hits) || p.hits.length === 0) { err(`${who}: 0 条出场(应从人名表删去)`); continue }
    const names = new Set([p.name, ...(p.aliases || [])])
    const seen = new Set()
    for (const h of p.hits) {
      const at = `${who} ${h.ch}.${h.para}`
      const c = byNo.get(h.ch)
      const para = c?.paragraphs?.[h.para]
      if (!para) { err(`${at}: 章/段不存在`); continue }
      const key = `${h.ch}.${h.para}`
      if (seen.has(key)) err(`${at}: 同段重复计入`)
      seen.add(key)
      const whole = chapterText('ru', 'lunyu', h.ch)
      if (whole === null) err(`${at}: chapterText 取不到该章`)
      else if (!h.evidence || !whole.includes(h.evidence)) err(`${at}: evidence「${h.evidence}」不在该章原文中`)
      if (!para.original.includes(h.evidence)) err(`${at}: evidence「${h.evidence}」不在该段原文中`)
      if ((h.evidence || '').length > EV_MAX) err(`${at}: evidence 超过 ${EV_MAX} 字`)
      if (!names.has(h.term)) err(`${at}: 所计称谓「${h.term}」不在此人名/别名里`)
      if (h.evidence?.slice(h.mark, h.mark + (h.term || '').length) !== h.term) err(`${at}: mark 处不是「${h.term}」`)
      if (!h.head || !para.original.startsWith(h.head)) err(`${at}: head 不是该段原文前缀`)
      if (h.term?.length === 1) solo++
      hitsTotal++
    }
  }

  for (const ex of EXCLUDE) {
    if (!lunyu.chapters.some((c) => c.paragraphs.some((p) => p.original.includes(ex.phrase)))) {
      warn(`${tag}: 排除表片段「${ex.phrase}」原文已无,排除表可能过时`)
    }
  }

  // 底本变了没重跑:重新派生一遍比对(只比出场集合与证据,note 等人工字段一并比)
  const fresh = derive(lunyu)
  if (JSON.stringify(fresh.people) !== JSON.stringify(people)) {
    warn(`${tag}: ${OUT} 与原文重新派生的结果不一致——重跑 node scripts/gen-lunyu-people.mjs`)
  }

  const pian = people.map((p) => new Set(p.hits.map((h) => h.ch)).size)
  info(`${tag}: ${people.length} 人 · ${hitsTotal} 条出场(单字呼名证 ${solo})· 最多 ${people[0]?.name} ${pian[0]} 篇 · 排除表 ${EXCLUDE.length} 条`)
}
