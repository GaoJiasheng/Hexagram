// 人物出场索引的通用派生器(design-v24 §2 论语版抽出来的,§14 推广到孟子 / 传习录)。
// 一本书一份人名表(cfg.PEOPLE)+ 排除表(cfg.EXCLUDE),出场由这里从站内原文逐段 grep 派生,每条附命中片段(evidence)可回查。
//   full  —— 全称/字/尊称,原文出现即计
//   solo  —— 单字或短称呼名,**只在呼格语境计**:其后紧跟 cfg.vocativeNext 里的字(论语「由也」「赐！」;传习录「爱问」「澄曰」)
//   extra —— 呼格正则漏掉、但确属呼名的整句片段,term 指明片段里哪个字是名
// 全角标点一律转义写(工具链可能把字面量全角标点静默改成半角)。
import path from 'node:path'

export const P = {
  comma: '，', bang: '！', q: '？', colon: '：', semi: '；', period: '。', dun: '、',
  lq: '「', rq: '」', lq2: '『', rq2: '』',
}
const SENT_END = new Set([P.period, P.q, P.bang])
const CLOSE = new Set([P.rq, P.rq2])
const LEFT_STOP = new Set([P.comma, P.period, P.colon, P.semi, P.q, P.bang, P.dun, P.lq, P.rq, P.lq2, P.rq2])
const OPEN = new Set([P.lq, P.lq2])
const CLAUSE = new Set([P.comma, P.colon, P.semi, P.dun])

export const EV_MAX = 20 // evidence 上限(字)
const HEAD_MIN = 14 // 首句太短(「宪问「耻」。」)就续一句
const HEAD_MAX = 56

// 不在代理对(扩展区汉字,如「𦰏」)中间下刀
const isLow = (text, i) => { const c = text.charCodeAt(i); return c >= 0xdc00 && c <= 0xdfff }

// 命中处前后取一段作 evidence:左边退到最近的句读(至多 8 字),右边延到句末,总长 ≤20。
// 太短(「子贡。」「于子张。」)就向左并入前一个整分句——不越过句号、总长仍 ≤20;开头残留的句读剥掉
export function evidenceAt(text, at, len) {
  let s = at
  while (s > 0 && at - s < 8 && !LEFT_STOP.has(text[s - 1])) s--
  let e = at + len
  while (e < text.length && e - s < EV_MAX && !SENT_END.has(text[e])) e++
  if (e < text.length && e - s < EV_MAX && SENT_END.has(text[e])) e++
  while (s > 0 && e - s < 10) {
    let p = s
    while (p > 0 && LEFT_STOP.has(text[p - 1]) && !SENT_END.has(text[p - 1])) p--
    while (p > 0 && !CLAUSE.has(text[p - 1]) && !SENT_END.has(text[p - 1])) p--
    if (p === s || e - p > EV_MAX) break
    s = p
  }
  while (s < at && LEFT_STOP.has(text[s]) && !OPEN.has(text[s])) s++
  if (isLow(text, s)) s--
  if (isLow(text, e)) e--
  while (e - s > EV_MAX) { e--; if (isLow(text, e)) e-- }
  return { evidence: text.slice(s, e), mark: at - s }
}

// 段落开头一两句(页面列表用)。返回原文精确前缀;cut 表示后面还有
export function headOf(text) {
  let e = 0
  while (e < text.length) {
    while (e < text.length && !SENT_END.has(text[e])) e++
    if (e < text.length) e++
    while (e < text.length && CLOSE.has(text[e])) e++
    if (e >= HEAD_MIN) break
  }
  if (e > HEAD_MAX) e = HEAD_MAX - 4
  if (isLow(text, e)) e--
  return { head: text.slice(0, e), cut: e < text.length }
}

function allIndexes(text, needle) {
  const out = []
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i)
  return out
}

// 一段原文里某人的全部命中(已剔排除表),按位置先后排序
export function matchPersonIn(person, text, cfg) {
  const spans = []
  for (const f of person.full || []) for (const at of allIndexes(text, f)) spans.push({ at, term: f, kind: 'full' })
  for (const c of person.solo || []) {
    const re = new RegExp(`${c}(?=[${cfg.vocativeNext}])`, 'g')
    for (const m of text.matchAll(re)) spans.push({ at: m.index, term: c, kind: 'solo' })
  }
  for (const x of person.extra || []) {
    const off = x.phrase.indexOf(x.term)
    for (const at of allIndexes(text, x.phrase)) spans.push({ at: at + off, term: x.term, kind: 'extra' })
  }
  const blocked = []
  for (const ex of cfg.EXCLUDE || []) for (const at of allIndexes(text, ex.phrase)) blocked.push([at, at + ex.phrase.length])
  const kept = spans.filter((s) => !blocked.some(([a, b]) => s.at >= a && s.at + s.term.length <= b))
  // 按位置先后(证据尽量落在段首,页面列表的首句里就能标出来);同位置取长
  kept.sort((a, b) => a.at - b.at || b.term.length - a.term.length)
  // 单字名若落在某全称之内(「冉求」里的「求」),不重复算
  return kept.filter((s, i) => !kept.some((t, j) => j !== i && t.kind === 'full' && t.term.length > s.term.length
    && s.at >= t.at && s.at + s.term.length <= t.at + t.term.length))
}

export function deriveIndex(book, cfg) {
  const chapters = book.chapters.map((c) => ({ ch: c.no, title: c.title }))
  const people = cfg.PEOPLE.map((p) => {
    const hits = []
    const used = new Set()
    for (const c of book.chapters) {
      c.paragraphs.forEach((para, i) => {
        const text = para.original
        if ((cfg.SKIP_PARA || []).some((x) => x.test(text))) return
        const spans = matchPersonIn(p, text, cfg)
        if (!spans.length) return
        spans.forEach((s) => used.add(s.term))
        const best = spans[0]
        const { evidence, mark } = evidenceAt(text, best.at, best.term.length)
        const { head, cut } = headOf(text)
        hits.push({ ch: c.no, para: i, term: best.term, evidence, mark, head, ...(cut ? { cut: true } : {}) })
      })
    }
    // aliases 只收原文实际命中过的称呼(按表内顺序)
    const order = [...(p.full || []), ...(p.solo || []), ...(p.extra || []).map((x) => x.term)]
    const aliases = [...new Set(order)].filter((t) => used.has(t) && t !== p.name)
    return { id: p.id, name: p.name, aliases, note: p.note, pian: new Set(hits.map((h) => h.ch)).size, hits }
  })
    .filter((p) => p.hits.length > 0) // 0 hit 的人从表里删(§2)
  // 出场篇数降序 → 段数降序 → 首次出场先后
  people.sort((a, b) => b.pian - a.pian || b.hits.length - a.hits.length
    || (a.hits[0].ch - b.hits[0].ch) || (a.hits[0].para - b.hits[0].para))
  return { book: cfg.book, source: cfg.src, chapters, people }
}

// 三本书共用的闸(check-data 7f 各挂一个薄包装):逐条回查 evidence / head / term / mark,排除表片段原文确有,底本变了没重跑即警告
export function checkPeopleIndex({ ROOT, err, warn, info, readJson, chapterText }, { tag, corpus, slug, OUT, SRC, derive, EXCLUDE, minPeople }) {
  const data = readJson(path.join(ROOT, OUT))
  const book = readJson(path.join(ROOT, SRC))
  const people = Array.isArray(data?.people) ? data.people : null
  if (!people) { err(`${tag}: ${OUT} 缺 people 数组`); return }
  if (people.length < minPeople) err(`${tag}: 仅 ${people.length} 人,规格要求 ≥${minPeople}`)

  const byNo = new Map(book.chapters.map((c) => [c.no, c]))
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
      const whole = chapterText(corpus, slug, h.ch)
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

  for (const ex of EXCLUDE || []) {
    if (!book.chapters.some((c) => c.paragraphs.some((p) => p.original.includes(ex.phrase)))) {
      warn(`${tag}: 排除表片段「${ex.phrase}」原文已无,排除表可能过时`)
    }
  }

  const fresh = derive(book)
  if (JSON.stringify(fresh.people) !== JSON.stringify(people)) {
    warn(`${tag}: ${OUT} 与原文重新派生的结果不一致——重跑生成脚本`)
  }

  const pian = people.map((p) => new Set(p.hits.map((h) => h.ch)).size)
  info(`${tag}: ${people.length} 人 · ${hitsTotal} 条出场(单字/短称呼名证 ${solo})· 最多 ${people[0]?.name} ${pian[0]} 篇 · 排除表 ${(EXCLUDE || []).length} 条`)
}
