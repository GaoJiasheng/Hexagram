// I8 · 儒门学脉图 的校验闸(docs/design-v24.md §0.2 / §5)。规则与 check-data 7c 诸子拓扑图同源:
//   · id 唯一;era / school / edgeType 合法;节点必有 when、note
//   · 每条边 ≥1 条引文,每条引文逐字回查——校验池收窄到它所指的那一章(跨章拼接即判错)
//   · 节点挂的书(book / alsoBooks)在该组 texts.json 里确有;renwu 指向人物志确有之人;debateKey 在争鸣里确有其席
//   · 师承线只许由前指向后(起点的时代不晚于终点);「存疑」的线必须在 note 里说清存疑在哪
//   · 版面微调(layout.stack 层距 / k 层号 / dx 横移 / era.w 带宽)不许把两人叠在一起,也不许把人挤出自己的时代带
// 数据 src/data/ru-lineage.json 是人工策展(引文由脚本从原文切出后写入),没有生成脚本,故只校验不重算。
import fs from 'node:fs'
import path from 'node:path'

export const DATA_PATH = 'src/data/ru-lineage.json'
// 与 src/features/zhuzi/topology.js 同值(那边依赖 Vite 的 import.meta.glob,node 里 import 不进来)
const ERA_W = 192
const NODE_W = 88
const NODE_H = 30
const EDGE_C = new Set(['disputed'])

// 禅宗传灯图(§14)同一把尺子:换 DATA_PATH / tag 即可
export default function check(ctx) {
  return checkLineage(ctx, { DATA_PATH, tag: '儒门学脉图' })
}

export function checkLineage({ ROOT, err, warn, info, readJson, chapterText }, { DATA_PATH, tag }) {
  const file = path.join(ROOT, DATA_PATH)
  if (!fs.existsSync(file)) { err(`${tag}: ${DATA_PATH} 不存在`); return }
  const T = readJson(file)
  for (const k of ['eras', 'schools', 'edgeTypes', 'nodes', 'edges']) {
    if (!Array.isArray(T?.[k]) || !T[k].length) { err(`${tag}: 缺 ${k} 数组`); return }
  }
  if (!T.title) err(`${tag}: 缺 title`)

  const uniq = (arr, what) => {
    const s = new Set(arr)
    if (s.size !== arr.length) err(`${tag}: ${what} 有重复`)
    return s
  }
  const eraIdx = new Map(T.eras.map((e, i) => [e.key, i]))
  uniq(T.eras.map((e) => e.key), 'era key')
  const schools = uniq(T.schools.map((s) => s.key), 'school key')
  const types = uniq(T.edgeTypes.map((t) => t.key), 'edgeType key')
  const ids = uniq(T.nodes.map((n) => n.id), '节点 id')
  for (const e of T.eras) {
    if (!e.label || !e.when) err(`${tag} 时代 ${e.key}: 缺 label / when`)
    if (e.w !== undefined && !(typeof e.w === 'number' && e.w >= NODE_W + 8)) err(`${tag} 时代 ${e.key}: w 须为 ≥${NODE_W + 8} 的数`)
  }
  for (const t of T.edgeTypes) if (!t.label || !t.color) err(`${tag} 边类型 ${t.key}: 缺 label / color`)
  // 层距小于节点高 + 4,上下两层就叠在一起了
  if (T.layout?.stack !== undefined && !(typeof T.layout.stack === 'number' && T.layout.stack >= NODE_H + 4)) {
    err(`${tag}: layout.stack 须为 ≥${NODE_H + 4} 的数`)
  }

  // ── 节点 ──
  const texts = {}
  const bookOk = (b, who) => {
    if (!b?.corpus || !b?.slug || !b?.title) { err(`${who}: 书目须含 corpus / slug / title`); return }
    const tf = path.join(ROOT, `src/data/${b.corpus}/texts.json`)
    if (!(b.corpus in texts)) texts[b.corpus] = fs.existsSync(tf) ? readJson(tf) : null
    const list = texts[b.corpus]
    const rec = Array.isArray(list) ? list.find((t) => t.slug === b.slug) : null
    if (!rec) { err(`${who}: 书「${b.corpus}/${b.slug}」不在该组 texts.json`); return }
    if (!fs.existsSync(path.join(ROOT, `src/data/${b.corpus}/classics/${b.slug}.json`))) err(`${who}: 书「${b.slug}」无原文文件`)
    if (rec.title !== b.title) warn(`${who}: 书名「${b.title}」与 texts.json「${rec.title}」不一致`)
  }
  const renwuFile = path.join(ROOT, 'src/data/renwu.json')
  const renwuIds = new Set(fs.existsSync(renwuFile) ? (readJson(renwuFile).people || []).map((p) => p.id) : [])
  const dbIdx = path.join(ROOT, 'src/data/debates/index.json')
  const debateKeys = fs.existsSync(dbIdx)
    ? new Set(readJson(dbIdx).topics.flatMap((t) => (t.schools || []).map((s) => s.key)))
    : null

  for (const n of T.nodes) {
    const who = `${tag} 节点 ${n.id}`
    if (!n.label) err(`${who}: 缺 label`)
    if (!eraIdx.has(n.era)) err(`${who}: era 非法「${n.era}」`)
    if (!schools.has(n.school)) err(`${who}: school 非法「${n.school}」`)
    if (!n.when) err(`${who}: 缺 when(大致年代)`)
    if (!n.note) err(`${who}: 缺 note`)
    if (n.book) bookOk(n.book, who)
    for (const b of n.alsoBooks || []) bookOk(b, who)
    if (n.renwu && !renwuIds.has(n.renwu)) err(`${who}: renwu「${n.renwu}」人物志无此人`)
    if (debateKeys) {
      for (const k of [].concat(n.debateKey || [])) if (!debateKeys.has(k)) err(`${who}: debateKey「${k}」在争鸣里无此参辩家`)
    }
    if (n.k !== undefined && !(Number.isInteger(n.k) && n.k >= 0)) err(`${who}: k 须为非负整数`)
    if (n.dx !== undefined && typeof n.dx !== 'number') err(`${who}: dx 须为数`)
  }

  // 版面:同格同层的两人不许叠;人不许出自己的时代带
  const cells = new Map()
  for (const n of T.nodes) {
    const key = `${n.school}|${n.era}`
    if (!cells.has(key)) cells.set(key, [])
    cells.get(key).push(n)
  }
  for (const [key, cell] of cells) {
    cell.forEach((n, i) => {
      const lv = n.k ?? i, dx = n.dx ?? 0
      const era = T.eras[eraIdx.get(n.era)]
      if (era && Math.abs(dx) + NODE_W / 2 > (era.w ?? ERA_W) / 2 - 2) err(`${tag} 节点 ${n.id}: dx=${dx} 把人挤出了「${era.label}」带`)
      cell.forEach((m, j) => {
        if (j <= i) return
        if ((m.k ?? j) === lv && Math.abs((m.dx ?? 0) - dx) < NODE_W + 4) err(`${tag}: ${key} 格里 ${n.id} 与 ${m.id} 同层相叠`)
      })
    })
  }

  // ── 边 ──
  const byId = Object.fromEntries(T.nodes.map((n) => [n.id, n]))
  const seenEdge = new Set()
  let nCite = 0, nBad = 0, nDisputed = 0
  const count = {}
  for (const e of T.edges) {
    const who = `${tag} 边 ${e.from}→${e.to}`
    if (!ids.has(e.from)) err(`${who}: from 无此节点`)
    if (!ids.has(e.to)) err(`${who}: to 无此节点`)
    if (e.from === e.to) err(`${who}: 自指`)
    if (!types.has(e.type)) err(`${who}: type 非法「${e.type}」`)
    count[e.type] = (count[e.type] || 0) + 1
    const k = `${e.from}|${e.to}|${e.type}`
    if (seenEdge.has(k)) err(`${who}: 同类型重复`)
    seenEdge.add(k)
    if (!e.gist) err(`${who}: 缺 gist`)
    if (e.c !== undefined) {
      if (!EDGE_C.has(e.c)) err(`${who}: c 只许 disputed`)
      else { nDisputed++; if (!e.note) err(`${who}: 标了存疑却没有 note 说明存疑在哪`) }
    }
    if (e.type === 'lineage' && byId[e.from] && byId[e.to] && eraIdx.get(byId[e.from].era) > eraIdx.get(byId[e.to].era)) {
      err(`${who}: 师承线须由前指向后,起点时代晚于终点`)
    }
    if (!(e.cites || []).length) err(`${who}: 一条引文都没有——无出处的关系不许上图(站外之事写进 note)`)
    for (const c of e.cites || []) {
      nCite++
      if (!c.quote || !c.corpus || !c.slug || !Number.isInteger(c.ch) || !c.label) {
        err(`${who}: 引文缺 quote / corpus / slug / ch / label`); nBad++; continue
      }
      const txt = chapterText(c.corpus, c.slug, c.ch)
      if (txt == null) { err(`${who}: 章不存在 ${c.corpus}/${c.slug} ch${c.ch}`); nBad++; continue }
      if (!txt.includes(c.quote)) { err(`${who}: 引文非 ${c.label} 原文子串「${c.quote.slice(0, 16)}…」`); nBad++ }
    }
  }

  // 孤立节点不是错,但须在 note 里交代原因(同 7c)
  const linked = new Set(T.edges.flatMap((e) => [e.from, e.to]))
  for (const n of T.nodes) {
    if (!linked.has(n.id) && !/孤立|没有|无(其书)?.{0,6}(记载|原文)/.test(n.note || '')) {
      warn(`${tag} 节点 ${n.id}(${n.label}): 图上孤立却未在 note 里交代原因`)
    }
  }

  if (!T.end?.label || !Array.isArray(T.end.items) || !T.end.items.length) err(`${tag}: 缺 end(label + items)`)
  for (const it of T.end?.items || []) if (!it.when || !it.label || !it.note) err(`${tag}: end 条目缺 when / label / note`)
  if (T.companion && !String(T.companion.href || '').startsWith('/')) err(`${tag}: companion.href 须为站内路径`)

  const byType = T.edgeTypes.map((t) => `${t.label.split(' ')[0]} ${count[t.key] || 0}`).join(' · ')
  info(`${tag}: ${T.nodes.length} 人 · ${T.edges.length} 条关系(${byType})· ${nCite} 条引文 · ${nBad} 坏引文 · 存疑 ${nDisputed}`)
}
